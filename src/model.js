// Food Group Tracker — plan model, schedules, and the exchange-conversion rules.
// Pure functions: no DOM, no React. Shared by the app and the tests.

export const GROUPS = [
  { id: "starch", label: "Starch / Carbohydrate", swap: true },
  { id: "fruit", label: "Fruits", swap: true },
  { id: "milk", label: "Milk / Yogurt", swap: true },
  { id: "veg", label: "Vegetables" },
  { id: "meat", label: "Meat / Cheese / Eggs" },
  { id: "fat", label: "Fats" },
  { id: "water", label: "Water", unit: "1 cup" },
];

export const GAP = 6;
export const ROW_CHROME = 36;

export function encodePlan(plan) {
  const bytes = new TextEncoder().encode(JSON.stringify(plan));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodePlan(input) {
  let s = input.trim();
  const m = s.match(/#?plan=([A-Za-z0-9_-]+)/);
  if (m) s = m[1];
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const plan = JSON.parse(new TextDecoder().decode(bytes));
  return normalizePlan(plan);
}

export const HARD_MAX = 30; // typo guard, not a plan limit
export const FREE_ROWS = ["veg", "water"]; // going past the target here is fine; extra boxes look normal
export const PER_LINE = 10; // boxes per line before a row wraps (matches the generator)
export const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
export const DAYS_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function normalizeSchedule(s, legacyDays) {
  if (!s && Array.isArray(legacyDays) && legacyDays.length) s = { type: "weekly", days: legacyDays };
  if (!s || typeof s !== "object") return null;
  if (s.type === "weekly") {
    const days = Array.isArray(s.days) ? [...new Set(s.days.map(Number).filter((d) => d >= 0 && d <= 6))].sort() : [];
    return days.length ? { type: "weekly", days } : null;
  }
  if (s.type === "every") {
    const n = Math.max(2, Math.min(14, Math.round(Number(s.n)) || 3));
    const start = /^\d{4}-\d{2}-\d{2}$/.test(String(s.start)) ? s.start : isoDate(new Date());
    return { type: "every", n, start };
  }
  if (s.type === "perweek") return { type: "perweek", n: Math.max(1, Math.min(6, Math.round(Number(s.n)) || 2)) };
  return null;
}

export function scheduleText(s) {
  if (!s) return "";
  if (s.type === "weekly") return "Applies automatically: " + s.days.map((d) => DAYS_LONG[d]).join(", ");
  if (s.type === "every") {
    const start = new Date(s.start + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `Applies automatically every ${ordinal(s.n)} day, starting ${start}`;
  }
  if (s.type === "perweek") return `Up to ${s.n} day${s.n === 1 ? "" : "s"} a week, your choice`;
  return "";
}

export function normalizePlan(p) {
  if (!p || typeof p !== "object" || !p.base || !p.base.counts) throw new Error("not a plan");
  const fix = (o, isVariant) => ({
    name: String(o.name || "").slice(0, 24) || "Plan",
    kcal: Math.max(0, Number(o.kcal) || 0),
    counts: Object.fromEntries(GROUPS.map((g) => [g.id, Math.max(0, Math.min(HARD_MAX, Math.round(Number(o.counts?.[g.id]) || 0)))])),
    ...(isVariant ? { schedule: normalizeSchedule(o.schedule, o.days) } : {}),
  });
  return {
    v: 1,
    base: fix(p.base, false),
    variants: Array.isArray(p.variants) ? p.variants.slice(0, 8).map((v) => fix(v, true)) : [],
    notes: String(p.notes || "").slice(0, 300),
    requireFoods: !!p.requireFoods,
  };
}

// Variant scheduled for a given date (index into [base, ...variants]); 0 if none.
// "perweek" schedules never auto-select; the client chooses the days.
export function scheduledVariant(plan, date = new Date()) {
  const wd = date.getDay();
  const i = plan.variants.findIndex((v) => {
    const s = v.schedule;
    if (!s) return false;
    if (s.type === "weekly") return s.days.includes(wd);
    if (s.type === "every") {
      const start = new Date(s.start + "T00:00");
      const today = new Date(isoDate(date) + "T00:00");
      const diff = Math.round((today - start) / 86400000);
      return diff >= 0 && diff % s.n === 0;
    }
    return false;
  });
  return i >= 0 ? i + 1 : 0;
}

// Walk the log in time order; a negative adjustment can only remove boxes that
// exist at that moment. Anything left with nothing to remove is dropped.
export function normalizeEntries(entries) {
  const sorted = [...entries].sort((a, b) => a.t - b.t);
  const running = Object.fromEntries(GROUPS.map((g) => [g.id, 0]));
  const out = [];
  for (const e of sorted) {
    const added = { ...(e.added || {}) };
    let any = false;
    for (const g of GROUPS) {
      let d = added[g.id] || 0;
      if (d < 0) d = Math.max(d, -running[g.id]);
      d = Math.round(d * 2) / 2;
      if (d === 0) delete added[g.id];
      else {
        added[g.id] = d;
        any = true;
      }
      running[g.id] = Math.max(0, running[g.id] + d);
    }
    if (any || e.type === "food") out.push({ ...e, added });
  }
  return out;
}

// Sunday-to-Saturday keys for the week containing `date`.
export function weekKeys(date = new Date()) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return isoDate(d);
  });
}


export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const longDate = () => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
export const emptyCounts = () => Object.fromEntries(GROUPS.map((g) => [g.id, 0]));

export const CARB_ROWS = [
  { id: "starch", label: "Starch / Carbohydrate", g: 15 },
  { id: "fruit", label: "Fruit", g: 15 },
  { id: "milk", label: "Milk / Yogurt", g: 12 },
  { id: "veg", label: "Vegetable", g: 5 },
];
export const ROW_LABEL = { starch: "Starch", fruit: "Fruit", milk: "Milk/Yogurt", veg: "Vegetable", meat: "Meat", fat: "Fat", water: "Water" };
export const SWAP_ROWS = ["starch", "fruit", "milk"];

export function suggestCarbRow(m) {
  const { carb = 0, protein = 0, fat = 0 } = m;
  if (carb > 0 && carb <= 12 && protein <= 4 && fat <= 1) return "veg"; // non-starchy vegetable profile
  if (protein >= 6 && carb >= 4 && carb <= 20 && fat <= 9 && protein / Math.max(carb, 1) > 0.4) return "milk"; // dairy profile
  return "starch";
}

// Protein that is already part of a carbohydrate serving (per the exchange definitions).
export const PROTEIN_IN_ROW = { starch: 3, fruit: 0, milk: 8, veg: 2 };

// Whole boxes at logging time. Protein rounds down unless within a quarter of
// the next box, because lean meats run above 7 g per ounce and the food lists
// count 1 oz as 1 serving. Everything else rounds normally.
export function roundBoxes(id, x) {
  if (x <= 0) return 0;
  return id === "meat" ? Math.floor(x + 0.25) : Math.round(x * 2) / 2;
}

// Fiber and sodium flags, per serving, using the food lists' thresholds.
export const FIBER_GOOD_G = 3;
export const SODIUM_HIGH_MG = 480;
export function tagsFor(food) {
  const t = [];
  if (food.fiber != null && Number(food.fiber) >= FIBER_GOOD_G) t.push("Good source of fiber");
  if (food.sodium != null && Number(food.sodium) >= SODIUM_HIGH_MG) t.push("High in sodium");
  return t;
}

// Per-serving boxes (fractional) from label grams. Returns { per, steps }.
export function deriveFromLabel(m, carbRow) {
  const carb = Math.max(0, Number(m.carb) || 0);
  const protein = Math.max(0, Number(m.protein) || 0);
  const fat = Math.max(0, Number(m.fat) || 0);
  const per = { starch: 0, fruit: 0, milk: 0, veg: 0, meat: 0, fat: 0, water: 0 };
  const steps = [];
  if (carb < 5 && protein < 3 && fat < 2) return { per, steps: ["Under 5 g carb, 3 g protein and 2 g fat: counts as a free food, no box."], free: true };

  const row = CARB_ROWS.find((r) => r.id === carbRow) || CARB_ROWS[0];
  let proteinLeft = protein;
  let fatAllowance = 0;
  if (carb >= 3) {
    per[row.id] = carb / row.g;
    steps.push(`${carb} g carb ÷ ${row.g} = ${fmt(per[row.id])} ${ROW_LABEL[row.id]}`);
    const inRow = Math.min(proteinLeft, PROTEIN_IN_ROW[row.id] * per[row.id]);
    if (inRow > 0) {
      proteinLeft -= inRow;
      steps.push(`${fmt(inRow)} g protein is part of the ${ROW_LABEL[row.id]} serving`);
    }
    if (row.id === "milk") fatAllowance += 3 * per.milk;
  }
  if (proteinLeft >= 3) {
    per.meat = proteinLeft / 7;
    fatAllowance += 3 * per.meat;
    steps.push(`${fmt(proteinLeft)} g protein ÷ 7 = ${fmt(per.meat)} Meat`);
  } else if (proteinLeft > 0) {
    steps.push(`${fmt(proteinLeft)} g protein left over, under 3 g: no Meat box`);
  }
  const extraFat = Math.max(0, fat - fatAllowance);
  if (extraFat >= 2.5) {
    per.fat = extraFat / 5;
    steps.push(`${fmt(extraFat)} g fat beyond what comes with the servings ÷ 5 = ${fmt(per.fat)} Fat`);
  } else if (fat > 0) {
    steps.push(`${fat} g fat is within what comes with the servings: no Fat box`);
  }
  return { per, steps, free: false };
}

export const fmt = (n) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));
export const roundHalf = (n) => Math.round(n * 2) / 2;

// Summarise per-serving boxes for a saved food: "1 Starch, 2 Meat, ½ Fat"
export function perSummary(per) {
  const parts = GROUPS.filter((g) => (per[g.id] || 0) > 0).map((g) => `${halfText(per[g.id])} ${ROW_LABEL[g.id]}`);
  return parts.length ? parts.join(", ") : "Free food";
}
export const halfText = (n) => {
  const r = roundHalf(n);
  const whole = Math.floor(r);
  const half = r - whole >= 0.5;
  return (whole ? whole : "") + (half ? "½" : "") || "0";
};

// Add boxes (half steps) to today's counts. Starch/Fruit/Milk spill into one
// another when full (interchange rule); anything still left goes past the
// row's target and is reported. Vegetables and water are free rows.
export function applyExchanges(counts, targets, add) {
  const next = { ...counts };
  const added = Object.fromEntries(GROUPS.map((g) => [g.id, 0]));
  const notes = [];
  const room = (id) => Math.max(0, (targets[id] || 0) - next[id]);
  const tracked = (id) => (targets[id] || 0) > 0;
  for (const g of GROUPS) {
    let n = add[g.id] || 0;
    if (n <= 0) continue;
    if (!tracked(g.id)) {
      // Spill into an interchangeable row that is tracked; otherwise this group isn't part of the plan.
      let placed = 0;
      if (SWAP_ROWS.includes(g.id)) {
        for (const alt of SWAP_ROWS.filter((r) => r !== g.id && tracked(r))) {
          if (n <= 0) break;
          const t = Math.min(n, room(alt));
          if (t > 0) {
            next[alt] += t;
            added[alt] += t;
            n -= t;
            placed += t;
            notes.push(`${ROW_LABEL[g.id]} isn't on your plan, so ${halfText(t)} went to ${ROW_LABEL[alt]} (interchangeable).`);
          }
        }
      }
      if (n > 0) notes.push(`${ROW_LABEL[g.id]} isn't tracked on your plan; ${halfText(n)} not counted.`);
      continue;
    }
    const take = Math.min(n, room(g.id));
    next[g.id] += take;
    added[g.id] += take;
    n -= take;
    if (n > 0 && SWAP_ROWS.includes(g.id)) {
      for (const alt of SWAP_ROWS.filter((r) => r !== g.id && tracked(r))) {
        if (n <= 0) break;
        const t = Math.min(n, room(alt));
        if (t > 0) {
          next[alt] += t;
          added[alt] += t;
          n -= t;
          notes.push(`${ROW_LABEL[g.id]} row was full, so ${halfText(t)} went to ${ROW_LABEL[alt]} (interchangeable).`);
        }
      }
    }
    if (n > 0) {
      next[g.id] += n;
      added[g.id] += n;
      if (!FREE_ROWS.includes(g.id)) notes.push(`${ROW_LABEL[g.id]}: ${halfText(n)} beyond today's plan.`);
    }
  }
  return { counts: next, added, notes };
}

export function addedText(added) {
  const parts = GROUPS.filter((g) => (added?.[g.id] || 0) !== 0).map((g) => `${added[g.id] > 0 ? "+" : "−"}${halfText(Math.abs(added[g.id]))} ${ROW_LABEL[g.id]}`);
  return parts.join(", ");
}

export const SERVING_CHOICES = [0.5, 1, 1.5, 2, 3];

export const HALF_STEPS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

export function quickLabel(e) {
  const rows = GROUPS.filter((g) => (e.added?.[g.id] || 0) !== 0);
  const neg = rows.some((g) => e.added[g.id] < 0);
  return neg ? "Adjustment" : "Quick check";
}

export const dayKeyOf = (d) => isoDate(d);
export const shiftDays = (key, n) => {
  const d = new Date(key + "T12:00");
  d.setDate(d.getDate() + n);
  return dayKeyOf(d);
};

