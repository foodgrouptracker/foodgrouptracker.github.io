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
const NUMTOK = "([0-9OoIl|S][0-9OoIl|S.,]*)";
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

  // Serving size: same line ("Serving size 2/3 cup (55g)") or the next line
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/serv\w*\.?\s*s[il1]ze[:\s]*(.*)$/i);
    if (m) {
      let val = m[1].trim();
      if (val.length < 3 && lines[i + 1]) val = lines[i + 1].trim();
      val = val.replace(/\s{2,}/g, " ").replace(/[|]/g, "").replace(/\bml\b/i, "mL").slice(0, 40);
      if (val) {
        out.serving = val;
        const g = val.match(/\(?\s*([0-9OoIl]+(?:\.[0-9]+)?)\s*g\b/i);
        if (g) out.servingGrams = num(g[1]);
      }
      break;
    }
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
  await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" }); // one block of text
  const keys = ["carb", "protein", "fat", "fiber", "sodium"];

  // Pass 1: contrast-stretched, moderate size.
  const cv1 = prepareContrast(await toCanvas(file, 1800));
  let { data } = await worker.recognize(cv1);
  let result = parseLabel(data.text || "");
  let text = data.text || "";

  // Pass 2, only if something is missing: adaptive black-and-white at a larger size.
  if (result.missing.length || !result.serving) {
    onProgress?.({ status: "recognizing text", progress: 0, pass: 2 });
    const cv2 = prepareBinary(await toCanvas(file, 2400));
    ({ data } = await worker.recognize(cv2));
    const second = parseLabel(data.text || "");
    for (const k of [...keys, "serving", "servingGrams"]) if (result[k] == null && second[k] != null) result[k] = second[k];
    result.found = keys.filter((k) => result[k] != null);
    result.missing = keys.filter((k) => result[k] == null);
    text += "\n" + (data.text || "");
  }

  // A large preview the client can actually read against the label.
  const prev = await toCanvas(file, 1400);
  return { ...result, preview: prev.toDataURL("image/jpeg", 0.8), text };
}
