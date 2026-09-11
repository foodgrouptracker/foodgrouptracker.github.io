// Nutrition-label scan: on-device text recognition (Tesseract in a web worker), then parsing.
// The photo never leaves the phone; it is resized, read, and discarded.
import { createWorker } from "tesseract.js";

let workerPromise = null;
function getWorker(onProgress) {
  if (!workerPromise) {
    const base = (import.meta.env && import.meta.env.BASE_URL) || "/";
    workerPromise = createWorker("eng", 1, {
      workerPath: `${base}ocr/worker.min.js`,
      corePath: `${base}ocr`,
      langPath: `${base}ocr`,
      gzip: true,
      logger: (m) => onProgress?.(m),
    }).catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

// Draw the photo to a canvas at a working size. Labels are small type, so we upscale small
// photos rather than only downscaling large ones.
async function toCanvas(file, targetLong) {
  const bmp = await createImageBitmap(file);
  const scale = targetLong / Math.max(bmp.width, bmp.height);
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
  return cv;
}

function luminance(c, w, h) {
  const d = c.getImageData(0, 0, w, h).data;
  const lum = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) lum[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  return lum;
}

// Find the label in the photo without reading it: text is dense in edges, packaging and
// shelves are not. Returns a box in the bitmap's own pixels, or null if nothing text-like
// stands out. Mirrors a prototype verified against cluttered test scenes.
export function locatePanel(bmp) {
  const w = 400, h = Math.max(1, Math.round((bmp.height / bmp.width) * 400));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d");
  c.drawImage(bmp, 0, 0, w, h);
  const lum = luminance(c, w, h);
  const T = 8, th = Math.floor(h / T), tw = Math.floor(w / T);
  if (th < 4 || tw < 4) return null;
  const dens = new Float32Array(th * tw);
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      let n = 0;
      for (let y = ty * T; y < (ty + 1) * T; y++) {
        for (let x = tx * T; x < (tx + 1) * T; x++) {
          const i = y * w + x;
          if (x + 1 < w && Math.abs(lum[i + 1] - lum[i]) > 40) n++;
          if (y + 1 < h && Math.abs(lum[i + w] - lum[i]) > 40) n++;
        }
      }
      dens[ty * tw + tx] = n / (2 * T * T);
    }
  }
  const mask = new Uint8Array(th * tw);
  for (let i = 0; i < mask.length; i++) mask[i] = dens[i] > 0.12 ? 1 : 0;
  const grown = new Uint8Array(th * tw);
  for (let ty = 0; ty < th; ty++)
    for (let tx = 0; tx < tw; tx++)
      if (mask[ty * tw + tx]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ny = ty + dy, nx = tx + dx;
        if (ny >= 0 && ny < th && nx >= 0 && nx < tw) grown[ny * tw + nx] = 1;
      }
  const seen = new Uint8Array(th * tw);
  let best = null;
  for (let start = 0; start < grown.length; start++) {
    if (!grown[start] || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    let score = 0, x0 = tw, y0 = th, x1 = -1, y1 = -1, cells = 0;
    while (stack.length) {
      const i = stack.pop();
      const ty = Math.floor(i / tw), tx = i % tw;
      score += dens[i];
      cells++;
      if (tx < x0) x0 = tx;
      if (tx > x1) x1 = tx;
      if (ty < y0) y0 = ty;
      if (ty > y1) y1 = ty;
      for (const [ny, nx] of [[ty - 1, tx], [ty + 1, tx], [ty, tx - 1], [ty, tx + 1]]) {
        if (ny < 0 || ny >= th || nx < 0 || nx >= tw) continue;
        const j = ny * tw + nx;
        if (grown[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    if (!best || score > best.score) best = { score, x0, y0, x1, y1, cells };
  }
  if (!best || best.cells < 0.03 * th * tw) return null; // nothing text-like; read the whole photo
  const sx = bmp.width / w, sy = bmp.height / h;
  const mx = 0.04 * bmp.width, my = 0.04 * bmp.height;
  return {
    x: Math.max(0, best.x0 * T * sx - mx),
    y: Math.max(0, best.y0 * T * sy - my),
    w: Math.min(bmp.width, (best.x1 + 1) * T * sx + mx) - Math.max(0, best.x0 * T * sx - mx),
    h: Math.min(bmp.height, (best.y1 + 1) * T * sy + my) - Math.max(0, best.y0 * T * sy - my),
  };
}

function cropToCanvas(bmp, region, targetLong) {
  const r = region || { x: 0, y: 0, w: bmp.width, h: bmp.height };
  const scale = targetLong / Math.max(r.w, r.h);
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(r.w * scale));
  cv.height = Math.max(1, Math.round(r.h * scale));
  cv.getContext("2d").drawImage(bmp, r.x, r.y, r.w, r.h, 0, 0, cv.width, cv.height);
  return cv;
}

// Pass 1: grayscale with a contrast stretch. Good for flat, evenly lit labels.
export function prepareContrast(cv) {
  const w = cv.width, h = cv.height, c = cv.getContext("2d");
  const lum = luminance(c, w, h);
  let min = 255, max = 0;
  for (const g of lum) { if (g < min) min = g; if (g > max) max = g; }
  const range = Math.max(1, max - min);
  const img = c.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    let g = ((lum[j] - min) / range) * 255;
    g = g < 128 ? g * 0.85 : Math.min(255, g * 1.1);
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  c.putImageData(img, 0, 0);
  return cv;
}

// Pass 2: local (adaptive) threshold to pure black and white. Copes with curved containers,
// shadows, and glossy packaging where one global contrast setting fails.
export function prepareBinary(cv, block = 31, bias = 8) {
  const w = cv.width, h = cv.height, c = cv.getContext("2d");
  const lum = luminance(c, w, h);
  // integral image for fast local means
  const W = w + 1;
  const sum = new Float64Array(W * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      row += lum[(y - 1) * w + (x - 1)];
      sum[y * W + x] = sum[(y - 1) * W + x] + row;
    }
  }
  const r = block >> 1;
  const img = c.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      const area = (y1 - y0 + 1) * (x1 - x0 + 1);
      const mean = (sum[(y1 + 1) * W + (x1 + 1)] - sum[y0 * W + (x1 + 1)] - sum[(y1 + 1) * W + x0] + sum[y0 * W + x0]) / area;
      const v = lum[y * w + x] < mean - bias ? 0 : 255;
      const i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  c.putImageData(img, 0, 0);
  return cv;
}

// OCR reads "0" as "O", "1" as "l"/"I", "5" as "S" in numbers. Fix inside a numeric token only.
const num = (s) => {
  const t = String(s).replace(/[Oo]/g, "0").replace(/[lI|]/g, "1").replace(/S/g, "5").replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : null;
};

// Pull the five numbers and the serving size out of recognized text. Returns only what was found.
// Label words are matched loosely because OCR swaps letters (Tota1 Fat, Pr0tein, S0dium, Flber).
const FUZ = {
  total: "t[o0]ta[l1I]",
  fat: "fat",
  carb: "carb[o0]?h?[yv]?d?r?a?t?e?s?",
  fiber: "(?:d[il1]etary\\s*)?f[il1]b(?:er|re)",
  protein: "pr[o0]te[il1]n",
  sodium: "s[o0]d[il1]um",
};
const NUMTOK = "([0-9OoIl|S][0-9OoIl|S.,]*?)"; // lazy: lets a trailing 9 act as a misread "g"
const PLAUSIBLE = { carb: 200, protein: 100, fat: 100, fiber: 60, sodium: 5000 };

export function parseLabel(text) {
  const t = text.replace(/\r/g, "").replace(/[–—]/g, "-");
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const out = {};

  const grab = (labelRe, key, unit) => {
    if (out[key] != null) return;
    const withUnit = new RegExp(`${labelRe}\\s*[:.]?\\s*${NUMTOK}\\s*(${unit})\\b`, "i");
    const noUnit = new RegExp(`${labelRe}\\s*[:.]?\\s*${NUMTOK}`, "i");
    for (const l of lines) {
      let m = l.match(withUnit);
      if (m) {
        const v = num(m[1]);
        if (v != null && v <= PLAUSIBLE[key]) { out[key] = Math.round(v * 10) / 10; return; }
      }
    }
    for (const l of lines) {
      const m = l.match(noUnit);
      if (!m) continue;
      let v = num(m[1]);
      if (v == null) continue;
      // "8g" read as "89": drop a trailing 9 when the value is implausible without it
      if (v > PLAUSIBLE[key] && /9$/.test(String(Math.round(v)))) v = Math.floor(v / 10);
      if (v <= PLAUSIBLE[key]) { out[key] = Math.round(v * 10) / 10; return; }
    }
  };

  // Serving size: a quantity and a unit, with an optional (55g) / (240mL). Anything else on the
  // line (a neighbouring column the OCR merged in) is dropped. No unit found means no serving.
  const UNITS = "cups?|tbsp|tbs|tablespoons?|tsp|teaspoons?|fl\\.?\\s*oz|oz|ounces?|g|grams?|ml|pieces?|slices?|packages?|pkg|containers?|bars?|bottles?|cans?|scoops?|eggs?|cookies?|crackers?|chips|pouch|patt(?:y|ies)|links?|tortillas?|waffles?|pancakes?|muffins?|bagels?|rolls?|buns?|servings?|pods?|sticks?|squares?|wedges?|tablets?|capsules?|packets?";
  const QTY = "(?:\\d+\\s+\\d/\\d|\\d+/\\d|\\d+(?:\\.\\d+)?|[½¼¾⅓⅔])";
  const AMOUNT = new RegExp(`(${QTY}\\s*(?:${UNITS})\\b)\\s*(\\(\\s*(?:about\\s*)?\\d+(?:\\.\\d+)?\\s*(?:g|mL|ml)\\s*\\))?`, "i");
  const PAREN = /\(\s*(?:about\s*)?(\d+(?:\.\d+)?)\s*(g|mL|ml)\s*\)/i;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/serv\w*\.?\s*s[il1]ze[:\s]*(.*)$/i);
    if (!m) continue;
    // Use the next line only when the "Serving size" line itself carries no amount, and never
    // a line that is clearly a nutrient row.
    const nutrientish = /fat|carb|protein|sodium|fib|cholesterol|calories|sugars|potassium|vitamin|calcium|iron/i;
    const candidates = [m[1]];
    if (!/\d/.test(m[1]) && lines[i + 1] && !nutrientish.test(lines[i + 1])) candidates.push(lines[i + 1]);
    for (const cand of candidates) {
      if (nutrientish.test(cand) && !/serv/i.test(lines[i])) continue;
      const a = cand.match(AMOUNT);
      if (a) {
        out.serving = (a[1].replace(/\s+/g, " ") + (a[2] ? " " + a[2].replace(/\s+/g, "") : "")).replace(/\bml\b/i, "mL").slice(0, 32);
        const g = out.serving.match(/\(\s*(?:about\s*)?(\d+(?:\.\d+)?)\s*g\s*\)/i);
        if (g) out.servingGrams = num(g[1]);
        break;
      }
      const pr = cand.match(PAREN);
      if (pr) {
        out.serving = `(${pr[1]}${pr[2].toLowerCase() === "g" ? "g" : "mL"})`;
        if (pr[2].toLowerCase() === "g") out.servingGrams = num(pr[1]);
        break;
      }
    }
    break;
  }

  grab(`${FUZ.total}\\s*${FUZ.carb}`, "carb", "g|9|q");
  grab(FUZ.fiber, "fiber", "g|9|q");
  grab(FUZ.protein, "protein", "g|9|q");
  grab(`${FUZ.total}\\s*${FUZ.fat}`, "fat", "g|9|q");
  grab(FUZ.sodium, "sodium", "mg|m9|rng");
  // when "Total" was lost, accept the bare word at the start of a line
  grab(`^${FUZ.carb}`, "carb", "g|9|q");
  grab(`^${FUZ.fat}`, "fat", "g|9|q");

  const keys = ["carb", "protein", "fat", "fiber", "sodium"];
  return { ...out, found: keys.filter((k) => out[k] != null), missing: keys.filter((k) => out[k] == null) };
}

export async function scanLabel(file, onProgress) {
  const worker = await getWorker(onProgress);
  const keys = ["carb", "protein", "fat", "fiber", "sodium"];
  const merge = (into, from) => {
    for (const k of [...keys, "serving", "servingGrams"]) if (into[k] == null && from[k] != null) into[k] = from[k];
    into.found = keys.filter((k) => into[k] != null);
    into.missing = keys.filter((k) => into[k] == null);
    return into;
  };

  onProgress?.({ status: "locating", progress: 0 });
  const bmp = await createImageBitmap(file);
  const region = locatePanel(bmp);
  let text = "";

  // Pass 1: the panel (or the whole photo), enlarged, contrast-stretched, read as one block.
  await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
  let { data } = await worker.recognize(prepareContrast(cropToCanvas(bmp, region, 2200)));
  let result = parseLabel(data.text || "");
  text += data.text || "";

  // Pass 2: same crop in adaptive black-and-white, when anything is missing.
  if (result.missing.length || !result.serving) {
    onProgress?.({ status: "recognizing text", progress: 0, pass: 2 });
    ({ data } = await worker.recognize(prepareBinary(cropToCanvas(bmp, region, 2400))));
    result = merge(result, parseLabel(data.text || ""));
    text += "\n" + (data.text || "");
  }

  // Pass 3: if the crop was a bad guess, the whole photo with automatic layout.
  if (region && result.missing.length >= 3) {
    onProgress?.({ status: "recognizing text", progress: 0, pass: 3 });
    await worker.setParameters({ tessedit_pageseg_mode: "3" });
    ({ data } = await worker.recognize(prepareContrast(cropToCanvas(bmp, null, 2200))));
    result = merge(result, parseLabel(data.text || ""));
    text += "\n" + (data.text || "");
  }

  // Preview: the part of the photo the reader used, untouched, large enough to read.
  const prev = cropToCanvas(bmp, region, 1400);
  return { ...result, preview: prev.toDataURL("image/jpeg", 0.85), cropped: !!region, text };
}
