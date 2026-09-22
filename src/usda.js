// Offline food lookup built from USDA FoodData Central (public domain). See tools/build-usda.py.
let db = null;
let loading = null;

export function loadUsda() {
  if (db) return Promise.resolve(db);
  if (!loading) {
    loading = fetch(`${(import.meta.env && import.meta.env.BASE_URL) || "/"}usda.json`)
      .then((r) => {
        if (!r.ok) throw new Error("no database");
        return r.json();
      })
      .then((raw) => {
        const F = raw.fields;
        const foods = raw.foods.map((row) => {
          const o = {};
          F.forEach((k, i) => (o[k] = row[i]));
          o.category = raw.categories[o.cat] || "";
          o.combo = [6, 21, 22, 25].includes(o.cat);
          o.lc = o.desc.toLowerCase();
          return o;
        });
        db = { foods, source: raw.source };
        return db;
      })
      .catch((e) => {
        loading = null;
        throw e;
      });
  }
  return loading;
}

// All words must appear (a word may match a cooking-method synonym). Whole foods rank
// above branded and processed items; words found in the food's main name rank first.
const PROCESSED_CATS = new Set([7, 21, 22, 25]); // luncheon meats, fast foods, meals/entrees, restaurant foods
const MODIFIERS = [
  [/low ?fat|lowfat|nonfat|non-fat|fat[- ]free|skim/, /low|fat|nonfat|skim|free/],
  [/\blight\b|\blite\b/, /light|lite/],
  [/reduced fat|reduced-fat/, /reduced|fat/],
  [/reduced sugar|sugar[- ]free|no sugar|unsweetened|diet\b/, /reduced|sugar|unsweetened|diet|free/],
  [/rendered|separable fat|fat only|skin only/, /rendered|separable|only/],
  [/unsalted|without salt|no salt/, /unsalted|salt/],
  [/shake|cocoa|homemade|imitation|substitute/, /shake|cocoa|homemade|imitation|substitute/],
];
const SYN = {
  baked: ["baked", "dry heat", "roasted"],
  grilled: ["grilled", "broiled", "dry heat"],
  broiled: ["broiled", "dry heat"],
  roasted: ["roasted", "dry heat"],
  fried: ["fried", "pan-fried"],
  cooked: ["cooked", "boiled", "roasted", "dry heat"],
};
export function rankFoods(foods, query, limit = 30) {
  const words = query.toLowerCase().split(/[^a-z0-9%'-]+/).filter(Boolean);
  if (!words.length) return [];
  const hits = [];
  for (const f of foods) {
    if (!f.segs) f.segs = f.lc.split(",").map((x) => x.trim());
    let ok = true, score = 0;
    for (const w of words) {
      const alts = SYN[w] || [w];
      let best = -1;
      for (const a of alts) {
        const si = f.segs.findIndex((seg) => seg.includes(a));
        if (si >= 0 && (best < 0 || si < best)) best = si;
      }
      if (best < 0) { ok = false; break; }
      score += best * 6;                                     // earlier segment is better
      if (best === 0) score -= 20;
      if (alts.some((a) => new RegExp(`\\b${a}\\b`).test(f.lc))) score -= 10;
    }
    if (!ok) continue;
    score += f.lc.length * 0.4;                              // shorter is better
    if (/\b[A-Z]{3,}\b/.test(f.desc)) score += 60;            // brand names in caps
    if (PROCESSED_CATS.has(f.cat) && !words.some((w) => /deli|lunch|fast|restaurant|sliced|frozen|sausage|meal/.test(w))) score += 80;
    if (/evaporated|condensed|\bdry\b|powder|dehydrated|concentrate|reconstituted/.test(f.lc) && !words.some((w) => /evaporated|condensed|dry|powder|dehydrated|concentrate/.test(w))) score += 30;
    // The plain version of a food ranks above its variants unless the variant was asked for.
    for (const [inDesc, inQuery] of MODIFIERS) {
      if (inDesc.test(f.lc) && !words.some((w) => inQuery.test(w))) score += 25;
    }
    if (f.src === "F") score -= 8;                           // Foundation data is newer
    hits.push([score, f]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  return hits.slice(0, limit).map((h) => h[1]);
}
export function searchUsda(query, limit = 30) {
  return db ? rankFoods(db.foods, query, limit) : [];
}

// Conversion options for a portion: foods the lists count by weight get 1 oz = 1 Meat.
export function convertOpts(food, grams, portionLabel = "") {
  const o = { proteinSeparate: !!(food.sep ?? food.legume) };
  if (food.byWeight) o.meatByWeightOz = grams / 28.35;
  if (food.drink) o.noProtein = true;
  if (food.row === "veg") {
    const cups = cupsIn(portionLabel);
    if (cups) o.vegServings = /cooked|boiled|steamed|roasted|baked|sauteed|saut|frozen/.test(food.lc || food.desc.toLowerCase()) ? cups * 2 : cups;
  }
  return o;
}

// "1 cup", "0.5 cup", "1/2 cup, chopped" → cups as a number; 0 when the portion isn't a volume.
export function cupsIn(label) {
  const m = String(label).toLowerCase().match(/(\d+\s+\d\/\d|\d\/\d|\d+(?:\.\d+)?)\s*cups?\b/);
  if (!m) return 0;
  const t = m[1].trim();
  if (t.includes(" ")) { const [w, f] = t.split(/\s+/); const [a, b] = f.split("/"); return Number(w) + Number(a) / Number(b); }
  if (t.includes("/")) { const [a, b] = t.split("/"); return Number(a) / Number(b); }
  return Number(t);
}

// Nutrients for a portion of `grams`.
export function macrosFor(food, grams) {
  const k = grams / 100;
  return {
    carb: Math.round(food.carb * k * 10) / 10,
    protein: Math.round(food.protein * k * 10) / 10,
    fat: Math.round(food.fat * k * 10) / 10,
    fiber: Math.round(food.fiber * k * 10) / 10,
    sodium: Math.round(food.sodium * k),
  };
}

// Household portions plus two standards, deduplicated by gram weight.
export function portionsFor(food) {
  const list = [...(food.portions || []).map(([label, g]) => ({ label, g }))];
  const have = new Set(list.map((p) => Math.round(p.g)));
  for (const std of [{ label: "1 oz", g: 28.35 }, { label: "100 g", g: 100 }]) {
    if (!have.has(Math.round(std.g))) list.push(std);
  }
  return list;
}
