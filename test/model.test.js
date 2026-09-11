import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encodePlan, decodePlan, normalizePlan, scheduledVariant, deriveFromLabel, suggestCarbRow,
  roundBoxes, applyExchanges, normalizeEntries, halfText, tagsFor,
} from "../src/model.js";

const plan = {
  v: 1,
  base: { name: "Standard", kcal: 2000, counts: { starch: 8, fruit: 3, milk: 3, veg: 3, meat: 8, fat: 6, water: 8 } },
  variants: [{ name: "Active day", kcal: 2200, counts: { starch: 8, fruit: 3, milk: 4, veg: 3, meat: 8, fat: 6, water: 8 }, schedule: { type: "weekly", days: [1, 3, 5] } }],
  notes: "Vegetable at lunch — café's fine.",
  requireFoods: false,
};

test("plan survives a link round trip, including unicode notes", () => {
  const url = "https://x.github.io/food-group-tracker/#plan=" + encodePlan(plan);
  assert.deepEqual(decodePlan(url), normalizePlan(plan));
});

test("legacy weekday format still decodes", () => {
  const p = normalizePlan({ base: plan.base, variants: [{ name: "A", kcal: 2200, counts: plan.base.counts, days: [2] }] });
  assert.deepEqual(p.variants[0].schedule, { type: "weekly", days: [2] });
});

test("schedules: weekly and every-N select the right variant", () => {
  assert.equal(scheduledVariant(plan, new Date(2026, 8, 14)), 1); // Monday
  assert.equal(scheduledVariant(plan, new Date(2026, 8, 15)), 0); // Tuesday
  const every = normalizePlan({ ...plan, variants: [{ name: "E", kcal: 0, counts: plan.base.counts, schedule: { type: "every", n: 3, start: "2026-09-10" } }] });
  assert.equal(scheduledVariant(every, new Date(2026, 8, 13)), 1);
  assert.equal(scheduledVariant(every, new Date(2026, 8, 14)), 0);
});

test("label conversion matches the book on common foods", () => {
  const boxes = (m, row) => {
    const { per } = deriveFromLabel(m, row || suggestCarbRow(m));
    return Object.fromEntries(Object.entries(per).map(([k, v]) => [k, roundBoxes(k, v)]).filter(([, v]) => v > 0));
  };
  assert.deepEqual(boxes({ carb: 15, protein: 4, fat: 1.5 }), { starch: 1 });               // bread
  assert.deepEqual(boxes({ carb: 12, protein: 8, fat: 5 }), { milk: 1 });                   // 2% milk
  assert.deepEqual(boxes({ carb: 0, protein: 26, fat: 3 }), { meat: 3 });                   // 3 oz chicken
  assert.deepEqual(boxes({ carb: 0, protein: 6, fat: 5 }), { meat: 1 });                    // egg
  assert.deepEqual(boxes({ carb: 36, protein: 3, fat: 12 }), { starch: 2.5, fat: 2.5 });    // brownie, half boxes
  assert.deepEqual(boxes({ carb: 5, protein: 2, fat: 0 }), { veg: 1 });                     // broccoli
  assert.deepEqual(boxes({ carb: 0, protein: 0, fat: 0 }), {});                             // diet soda: free
});

test("fiber and sodium tags use the food-list thresholds", () => {
  assert.deepEqual(tagsFor({ fiber: 3, sodium: 100 }), ["Good source of fiber"]);
  assert.deepEqual(tagsFor({ fiber: 1, sodium: 480 }), ["High in sodium"]);
});

test("interchange spill, then past-the-plan on limited rows, silent on free rows", () => {
  const t = plan.base.counts;
  let r = applyExchanges({ starch: 8, fruit: 2, milk: 3, veg: 0, meat: 0, fat: 0, water: 0 }, t, { starch: 2 });
  assert.equal(r.added.fruit, 1);
  assert.equal(r.added.starch, 1); // one spilled, one beyond
  assert.ok(r.notes.some((n) => n.includes("beyond")));
  r = applyExchanges({ starch: 0, fruit: 0, milk: 0, veg: 3, meat: 0, fat: 0, water: 0 }, t, { veg: 2 });
  assert.equal(r.added.veg, 2);
  assert.deepEqual(r.notes, []);
});

test("a row can never go below zero after removing an entry", () => {
  const es = normalizeEntries([{ type: "tap", t: 2, row: "starch", added: { starch: -2 } }]);
  assert.deepEqual(es, []);
});

test("half text", () => {
  assert.equal(halfText(2.5), "2½");
  assert.equal(halfText(0.5), "½");
  assert.equal(halfText(3), "3");
});
