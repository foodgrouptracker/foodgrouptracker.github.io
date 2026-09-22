#!/usr/bin/env python3
"""Build public/usda.json from USDA FoodData Central downloads (public domain).

Usage: python3 tools/build-usda.py <sr_legacy_csv_dir> <foundation_csv_dir>

Keeps only what the app needs: description, category, per-100 g carb / protein / fat / fiber / sodium / kcal,
a suggested carbohydrate row for the exchange conversion, a legume flag, and household portions.
"""
import csv, json, sys, os, re
from collections import defaultdict

SR, FND = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "usda.json")

NUT = {"1005": "c", "1003": "p", "1004": "f", "1079": "fi", "1093": "na", "1008": "k", "2047": "k2", "2048": "k3", "1018": "alc"}
SKIP_CATS = {"3", "26", "27"}  # baby foods, branded, QC materials

def read(path):
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))

def load(dirpath, data_type):
    foods = {r["fdc_id"]: r for r in read(os.path.join(dirpath, "food.csv")) if r["data_type"] == data_type and r["food_category_id"] not in SKIP_CATS}
    nut = defaultdict(lambda: defaultdict(list))
    with open(os.path.join(dirpath, "food_nutrient.csv"), newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            if r["fdc_id"] in foods and r["nutrient_id"] in NUT and r["amount"] not in ("", None):
                nut[r["fdc_id"]][NUT[r["nutrient_id"]]].append(float(r["amount"]))
    units = {r["id"]: r["name"] for r in read(os.path.join(dirpath, "measure_unit.csv"))}
    ports = defaultdict(list)
    for r in read(os.path.join(dirpath, "food_portion.csv")):
        if r["fdc_id"] not in foods or not r["gram_weight"]:
            continue
        amt = r["amount"] or "1"
        try:
            amt_f = float(amt)
        except ValueError:
            continue
        unit = units.get(r["measure_unit_id"], "")
        mod = (r.get("modifier") or "").strip()
        pdesc = (r.get("portion_description") or "").strip()
        amt_s = ("%g" % amt_f)
        if unit and unit != "undetermined":
            label = f"{amt_s} {unit}" + (f" {mod}" if mod else "")
        else:
            label = f"{amt_s} {mod or pdesc}".strip()
        if not label or label == amt_s:
            continue
        ports[r["fdc_id"]].append((label, round(float(r["gram_weight"]), 1), int(r.get("seq_num") or 0)))
    cats = {r["id"]: r["description"] for r in read(os.path.join(dirpath, "food_category.csv"))}
    return foods, nut, ports, cats

def mean(xs):
    return sum(xs) / len(xs) if xs else None

DESSERT_DAIRY = ("ice cream", "ice milk", "frozen", "sherbet", "sorbet", "shake", "pudding", "custard", "eggnog", "whipped", "dessert", "topping")

def carb_row(cat, desc, c, p, f):
    d = desc.lower()
    if cat == "9":
        return "fruit"
    if cat == "11":
        return "starch" if (c or 0) >= 10 else "veg"
    if cat == "1":
        # Milk / Yogurt row is for milk, yogurt, kefir. Cheese, eggs, cream and dairy desserts are
        # counted as protein, fat, or carbohydrate in the food lists.
        if "cheese" in d or "egg" in d or ("cream" in d and "ice" not in d) or any(x in d for x in DESSERT_DAIRY):
            return "starch"
        if (c or 0) >= 3.5 and (p or 0) >= 2.5:
            return "milk"
        return "starch"
    # Soy, almond, rice and coconut milks are carbohydrate (+ fat) choices in the food lists, not Milk.
    return "starch"

def build():
    sr_foods, sr_nut, sr_ports, cats = load(SR, "sr_legacy_food")
    fd_foods, fd_nut, fd_ports, cats2 = load(FND, "foundation_food")
    cats.update(cats2)

    # Foundation: keep the newest record per description
    newest = {}
    for fid, r in fd_foods.items():
        key = r["description"].strip().lower()
        if key not in newest or r["publication_date"] > fd_foods[newest[key]]["publication_date"]:
            newest[key] = fid
    fd_keep = {fid for fid in newest.values()}
    fd_desc = {fd_foods[fid]["description"].strip().lower() for fid in fd_keep}

    out = []
    def add(fid, r, nut, ports, src):
        n = nut.get(fid, {})
        c, p, f = mean(n.get("c")), mean(n.get("p")), mean(n.get("f"))
        if c is None and p is None and f is None:
            return
        k = mean(n.get("k")) or mean(n.get("k3")) or mean(n.get("k2"))
        if k is None:
            k = 4 * (c or 0) + 4 * (p or 0) + 9 * (f or 0) + 7 * (mean(n.get("alc")) or 0)
        desc = re.sub(r"\s*\(Includes foods for USDA's Food Distribution Program\)", "", r["description"]).strip()
        cat = r["food_category_id"]
        pl = sorted(set(ports.get(fid, [])), key=lambda t: (t[2], t[1]))[:6]
        dl = desc.lower()
        # 1 oz = 1 protein serving for meat, poultry, fish and cheese. Not for items the lists count
        # by the piece or by protein (bacon, hot dogs, sausages) or that are mostly breading/sauce.
        piece_meats = ("bacon", "frankfurter", "hot dog", "sausage", "bratwurst", "kielbasa", "chorizo", "knockwurst", "wiener",
                       "salad", "breaded", "batter", "with gravy", "in sauce", "casserole", "nugget", "patty", "meatball", "stuffed")
        by_weight = (cat in {"5", "7", "10", "13", "15", "17"} and not any(x in dl for x in piece_meats)) or (
            cat == "1" and "cheese" in dl and not any(x in dl for x in ("cottage", "ricotta", "cream cheese", "sauce", "spread")))
        # Protein counted separately from the carbohydrate serving (the lists do this for beans,
        # combination dishes, soups and restaurant food); grains and breads keep protein inside the starch.
        sep = cat in {"16", "22", "21", "25", "6"}
        drink = any(x in dl for x in ("soymilk", "soy milk", "almond milk", "rice milk", "oat milk", "cashew milk", "coconut milk beverage", "milk substitute", "non-dairy milk", "nondairy milk"))
        out.append([
            int(fid), desc, int(cat), carb_row(cat, desc, c, p, f),
            round(c or 0, 1), round(p or 0, 1), round(f or 0, 1),
            round(mean(n.get("fi")) or 0, 1), int(round(mean(n.get("na")) or 0)), int(round(k)),
            1 if sep else 0, src, [[lab, g] for lab, g, _ in pl], 1 if by_weight else 0, 1 if drink else 0,
        ])

    for fid in fd_keep:
        add(fid, fd_foods[fid], fd_nut, fd_ports, "F")
    for fid, r in sr_foods.items():
        if r["description"].strip().lower() in fd_desc:
            continue  # Foundation has a newer twin
        add(fid, r, sr_nut, sr_ports, "S")

    out.sort(key=lambda x: x[1].lower())
    payload = {
        "v": 1,
        "source": "USDA FoodData Central: Foundation Foods (2026-04) and SR Legacy (2018-04). Public domain.",
        "fields": ["id", "desc", "cat", "row", "carb", "protein", "fat", "fiber", "sodium", "kcal", "sep", "src", "portions", "byWeight", "drink"],
        "categories": {int(k): v for k, v in cats.items() if k not in SKIP_CATS},
        "foods": out,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"foods: {len(out)}  (foundation {sum(1 for x in out if x[11]=='F')}, sr legacy {sum(1 for x in out if x[11]=='S')})")
    print(f"size: {os.path.getsize(OUT)/1e6:.2f} MB")

build()
