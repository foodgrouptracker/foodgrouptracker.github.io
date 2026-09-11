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

// Downscale and boost contrast so small label text reads better; returns a canvas.
export async function prepareImage(file, maxSide = 1800) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d");
  c.drawImage(bmp, 0, 0, w, h);
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  // grayscale + contrast stretch around the mid-tones
  let min = 255, max = 0;
  const lum = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    lum[j] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    let g = ((lum[j] - min) / range) * 255;
    g = g < 128 ? g * 0.85 : Math.min(255, g * 1.1); // push darks darker, lights lighter
    d[i] = d[i + 1] = d[i + 2] = g;
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
export function parseLabel(text) {
  const t = text.replace(/\r/g, "").replace(/[–—]/g, "-");
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const out = {};
  const NUMTOK = "([0-9OoIl|S][0-9OoIl|S.,]*)";
  const grab = (re, key, mult = 1) => {
    if (out[key] != null) return;
    for (const l of lines) {
      const m = l.match(re);
      if (m) {
        const v = num(m[1]);
        if (v != null && v < 10000) {
          out[key] = Math.round(v * mult * 10) / 10;
          return;
        }
      }
    }
  };
  // Serving size: "Serving size 1 cup (240g)" / "Serving Size 2/3 cup (55g)"
  for (const l of lines) {
    const m = l.match(/serv\w*\s*size[:\s]*(.+)$/i);
    if (m) {
      out.serving = m[1].replace(/\s{2,}/g, " ").replace(/[|]/g, "").trim().slice(0, 40);
      const g = out.serving.match(/\(?\s*([0-9OoIl]+)\s*g\s*\)?/i);
      if (g) out.servingGrams = num(g[1]);
      break;
    }
  }
  grab(new RegExp(`total\\s*carb\\w*\\.?\\s*${NUMTOK}\\s*g`, "i"), "carb");
  grab(new RegExp(`(?:dietary\\s*)?fib(?:er|re)\\s*${NUMTOK}\\s*g`, "i"), "fiber");
  grab(new RegExp(`protein\\s*${NUMTOK}\\s*g`, "i"), "protein");
  grab(new RegExp(`total\\s*fat\\s*${NUMTOK}\\s*g`, "i"), "fat");
  grab(new RegExp(`sodium\\s*${NUMTOK}\\s*mg`, "i"), "sodium");
  // Fallbacks when "Total" was dropped by the OCR
  grab(new RegExp(`\\bcarb\\w*\\.?\\s*${NUMTOK}\\s*g`, "i"), "carb");
  grab(new RegExp(`\\bfat\\s*${NUMTOK}\\s*g`, "i"), "fat");
  const found = ["carb", "protein", "fat", "fiber", "sodium"].filter((k) => out[k] != null);
  return { ...out, found, missing: ["carb", "protein", "fat", "fiber", "sodium"].filter((k) => out[k] == null) };
}

export async function scanLabel(file, onProgress) {
  const canvas = await prepareImage(file);
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(canvas);
  const parsed = parseLabel(data.text || "");
  // small thumbnail for the confirm step
  const th = document.createElement("canvas");
  const s = Math.min(1, 480 / canvas.width);
  th.width = Math.round(canvas.width * s);
  th.height = Math.round(canvas.height * s);
  th.getContext("2d").drawImage(canvas, 0, 0, th.width, th.height);
  return { ...parsed, thumbnail: th.toDataURL("image/jpeg", 0.7), text: data.text };
}
