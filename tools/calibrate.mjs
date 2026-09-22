// Calibration against the food lists: for each entry, the serving the lists give and the boxes they
// assign, versus what the app derives from USDA data. Run: node tools/calibrate.mjs
import fs from "node:fs";
import { deriveFromLabel, roundBoxes, GROUPS } from "../src/model.js";
import { rankFoods, convertOpts, macrosFor } from "../src/usda.js";

const raw = JSON.parse(fs.readFileSync(new URL("../public/usda.json", import.meta.url), "utf8"));
const F = raw.fields;
const foods = raw.foods.map((row) => { const o = {}; F.forEach((k, i) => (o[k] = row[i])); o.lc = o.desc.toLowerCase(); return o; });

// [list, query, portion label, grams, expected boxes]  — expected: s=starch f=fruit m=milk v=veg p=protein(meat) t=fat
const CASES = [
  // Bread / starch
  ["Bread", "bread whole-wheat commercially prepared", "1 slice", 28, { s: 1 }],
  ["Bread", "bagels plain", "1/4 large", 28, { s: 1 }],
  ["Bread", "english muffins plain", "1/2 muffin", 29, { s: 1 }],
  ["Bread", "tortillas corn", "1 tortilla", 26, { s: 1 }],
  ["Bread", "tortillas flour", "1 tortilla 6 inch", 30, { s: 1 }],
  ["Bread", "pancakes plain prepared from recipe", "1 pancake 4 inch", 38, { s: 1 }],
  ["Bread", "waffles plain prepared from recipe", "1 waffle 4 inch", 39, { s: 1, t: 1 }],
  ["Bread", "biscuits plain refrigerated dough baked", "1 biscuit", 34, { s: 1, t: 1 }],
  ["Cereal", "cereals oats regular quick cooked with water", "1/2 cup", 117, { s: 1 }],
  ["Grains", "rice brown long-grain cooked", "1/3 cup", 65, { s: 1 }],
  ["Grains", "rice white long-grain cooked", "1 cup", 158, { s: 3 }],
  ["Grains", "spaghetti cooked enriched", "1/3 cup", 47, { s: 1 }],
  ["Grains", "quinoa cooked", "1/3 cup", 62, { s: 1 }],
  ["Starchy veg", "potatoes baked flesh and skin", "3 oz", 85, { s: 1 }],
  ["Starchy veg", "corn sweet yellow cooked boiled", "1/2 cup", 82, { s: 1 }],
  ["Starchy veg", "peas green cooked boiled", "1/2 cup", 80, { s: 1 }],
  ["Starchy veg", "squash winter butternut cooked baked", "1 cup", 205, { s: 1 }],
  ["Starchy veg", "sweet potato cooked baked in skin", "1/2 cup", 100, { s: 1 }],
  ["Crackers", "crackers saltines", "6 crackers", 18, { s: 1 }],
  ["Snacks", "popcorn air-popped", "3 cups", 24, { s: 1 }],
  ["Snacks", "pretzels hard plain salted", "3/4 oz", 21, { s: 1 }],
  ["Beans", "beans black mature seeds cooked", "1/2 cup", 86, { s: 1, p: 1 }],
  ["Beans", "lentils mature seeds cooked", "1/2 cup", 99, { s: 1, p: 1 }],
  ["Beans", "hummus commercial", "1/3 cup", 82, { s: 1, p: 1 }],
  // Fruit
  ["Fruit", "apples raw with skin", "1 small 4 oz", 113, { f: 1 }],
  ["Fruit", "bananas raw", "extra small 4 oz with peel", 75, { f: 1 }],
  ["Fruit", "oranges raw all varieties", "1 medium", 131, { f: 1 }],
  ["Fruit", "strawberries raw", "1 1/4 cup whole", 180, { f: 1 }],
  ["Fruit", "grapes red or green raw", "17 small 3 oz", 85, { f: 1 }],
  ["Fruit", "raisins seedless", "2 tbsp", 18, { f: 1 }],
  ["Fruit", "orange juice raw", "1/2 cup", 124, { f: 1 }],
  ["Fruit", "apple juice canned or bottled unsweetened", "1/2 cup", 124, { f: 1 }],
  // Milk
  ["Milk", "milk nonfat fluid", "1 cup", 245, { m: 1 }],
  ["Milk", "milk reduced fat fluid 2%", "1 cup", 244, { m: 1 }],
  ["Milk", "milk whole 3.25%", "1 cup", 244, { m: 1 }],
  ["Milk", "chocolate milk lowfat", "1 cup", 250, { m: 1, s: 1 }],
  ["Milk", "yogurt greek plain nonfat", "2/3 cup", 170, { m: 1 }],
  ["Milk", "yogurt plain whole milk", "1 cup", 245, { m: 1 }],
  ["Milk", "yogurt fruit low fat", "2/3 cup", 170, { m: 1, s: 1 }],
  ["Milk", "eggnog", "1/3 cup", 84, { s: 1, t: 1 }],
  ["Milk", "soymilk original and vanilla", "1 cup", 243, { s: 1, t: 1 }],
  ["Milk", "almond milk unsweetened", "1 cup", 240, { s: 0.5, t: 0.5 }],
  // Vegetables
  ["Veg", "broccoli cooked boiled drained", "1/2 cup chopped", 78, { v: 1 }],
  ["Veg", "lettuce cos or romaine raw", "1 cup shredded", 47, { v: 1 }],
  ["Veg", "carrots raw", "1 cup chopped", 128, { v: 1 }],
  ["Veg", "tomatoes red ripe raw", "1 cup chopped", 180, { v: 1 }],
  // Protein
  ["Protein", "chicken breast meat only cooked roasted", "3 oz", 85, { p: 3 }],
  ["Protein", "beef ground 85% lean cooked", "3 oz", 85, { p: 3 }],
  ["Protein", "cheese cheddar", "1 oz", 28, { p: 1 }],
  ["Protein", "egg whole cooked hard-boiled", "1 large", 50, { p: 1 }],
  ["Protein", "cheese cottage lowfat 2%", "1/4 cup", 56, { p: 1 }],
  ["Protein", "tofu regular raw", "1/2 cup", 124, { p: 1 }],
  ["Protein", "peanut butter smooth", "1 tbsp", 16, { p: 1 }],
  ["Protein", "pork cured bacon cooked", "2 slices", 16, { p: 1 }],
  ["Protein", "frankfurter beef", "1 frankfurter", 57, { p: 1, t: 1 }],
  ["Protein", "salmon atlantic farmed cooked", "3 oz", 85, { p: 3 }],
  ["Protein", "tuna light canned in water drained", "3 oz", 85, { p: 3 }],
  ["Protein", "ham sliced regular", "1 oz", 28, { p: 1 }],
  // Fats
  ["Fat", "oil olive", "1 tsp", 4.5, { t: 1 }],
  ["Fat", "butter salted", "1 tsp", 4.7, { t: 1 }],
  ["Fat", "avocados raw", "2 tbsp", 30, { t: 1 }],
  ["Fat", "nuts almonds", "6 nuts", 7, { t: 1 }],
  ["Fat", "mayonnaise regular", "1 tsp", 4.6, { t: 1 }],
  ["Fat", "cream half and half", "2 tbsp", 30, { t: 1 }],
  ["Fat", "cream cheese", "1 tbsp", 14.5, { t: 1 }],
  ["Fat", "sour cream", "2 tbsp", 24, { t: 1 }],
  // Sweets, drinks, condiments
  ["Sweets", "ice cream vanilla", "1/2 cup", 66, { s: 1, t: 2 }],
  ["Sweets", "frozen yogurt vanilla soft-serve", "1/2 cup", 72, { s: 1, t: 0.5 }],
  ["Sweets", "sherbet orange", "1/2 cup", 74, { s: 2 }],
  ["Sweets", "doughnuts cake-type plain", "1 medium", 43, { s: 1.5, t: 2 }],
  ["Sweets", "brownies commercially prepared", "1 oz", 28, { s: 1, t: 1 }],
  ["Sweets", "candies milk chocolate", "1 oz", 28, { s: 1, t: 2 }],
  ["Sweets", "honey", "1 tbsp", 21, { s: 1 }],
  ["Sweets", "syrup maple", "1 tbsp", 20, { s: 1 }],
  ["Condiments", "catsup", "3 tbsp", 51, { s: 1 }],
  ["Drinks", "carbonated cola", "12 fl oz", 368, { s: 2.5 }],
  ["Drinks", "beer regular", "12 fl oz", 356, { s: 1 }],
  ["Drinks", "beer light", "12 fl oz", 354, { s: 0.5 }],
  ["Drinks", "wine table red", "5 fl oz", 147, {}],
  // Combination foods
  ["Combo", "soup bean with pork canned prepared with water", "1 cup", 253, { s: 2, p: 1 }],
  ["Combo", "soup chicken noodle chunky ready-to-serve", "1 cup", 240, { s: 1, p: 1 }],
  ["Combo", "lasagna with meat sauce", "1 cup", 250, { s: 2, p: 2 }],
  ["Combo", "pizza cheese regular crust", "1 slice 5 oz", 140, { s: 2.5, p: 2 }],
  ["Combo", "tuna salad", "1/2 cup", 103, { s: 0.5, p: 2, t: 1 }],
  ["Combo", "macaroni and cheese", "1 cup", 200, { s: 2, p: 2 }],
];

const KEY = { s: "starch", f: "fruit", m: "milk", v: "veg", p: "meat", t: "fat" };
const short = { starch: "S", fruit: "F", milk: "M", veg: "V", meat: "P", fat: "Fat" };
const fmtBoxes = (b) => GROUPS.filter((g) => (b[g.id] || 0) > 0).map((g) => `${b[g.id]} ${short[g.id]}`).join(" + ") || "none";

let exact = 0, half = 0, miss = 0, nf = 0;
const rows = [];
for (const [list, q, label, g, exp] of CASES) {
  const f = rankFoods(foods, q, 1)[0];
  if (!f) { rows.push([list, q, label, "NOT FOUND", "", "miss"]); nf++; continue; }
  const m = macrosFor(f, g);
  const { per } = deriveFromLabel(m, f.row, convertOpts(f, g, label));
  const got = Object.fromEntries(GROUPS.map((gr) => [gr.id, roundBoxes(gr.id, per[gr.id] || 0)]));
  const want = Object.fromEntries(GROUPS.map((gr) => [gr.id, 0]));
  for (const k of Object.keys(exp)) want[KEY[k]] = exp[k];
  let worst = 0;
  for (const gr of GROUPS) worst = Math.max(worst, Math.abs((got[gr.id] || 0) - (want[gr.id] || 0)));
  const verdict = worst === 0 ? "exact" : worst <= 0.5 ? "half" : "MISS";
  if (verdict === "exact") exact++; else if (verdict === "half") half++; else miss++;
  rows.push([list, f.desc.slice(0, 54), label, fmtBoxes(want), fmtBoxes(got), verdict]);
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("LIST", 12), pad("USDA FOOD", 56), pad("SERVING", 18), pad("LISTS SAY", 18), pad("APP SAYS", 18), "VERDICT");
for (const r of rows) console.log(pad(r[0], 12), pad(r[1], 56), pad(r[2], 18), pad(r[3], 18), pad(r[4], 18), r[5]);
console.log(`\n${CASES.length} servings: ${exact} exact, ${half} within half a box, ${miss} off by more, ${nf} not found`);
