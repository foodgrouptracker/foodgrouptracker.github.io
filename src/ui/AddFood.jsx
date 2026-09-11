import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Search } from "lucide-react";
import { CARB_ROWS, GROUPS, HALF_STEPS, addedText, deriveFromLabel, halfText, perSummary, roundBoxes, suggestCarbRow } from "../model.js";
import { T } from "../theme.js";
import { loadUsda, searchUsda, macrosFor, portionsFor, convertOpts } from "../usda.js";
import { PreviewAdd, ServingsPicker, Tags } from "./shared.jsx";

export function AddFoodScreen({ foods, counts, targets, onLog, onSave, onDelete, onBack }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("list"); // list | new | detail
  const [picked, setPicked] = useState(null); // saved food selected for logging
  const [servings, setServings] = useState(1);
  const [result, setResult] = useState(null); // {added, notes}
  const [prefill, setPrefill] = useState(null); // a USDA food handed to the New food form

  const sorted = [...foods].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0) || a.name.localeCompare(b.name));
  const filtered = q.trim() ? sorted.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())) : sorted;

  const log = (food, s) => {
    const r = onLog(food, s);
    setResult({ name: food.name, servings: s, ...r });
    setMode("list");
    setPicked(null);
    setPrefill(null);
    setServings(1);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (mode === "list") onBack();
            else if (mode === "new" && prefill) { setPrefill(null); setMode("usda"); }
            else { setMode("list"); setPicked(null); setPrefill(null); }
          }}
          aria-label={mode === "list" ? "Back to today" : "Back to my foods"}
          className="rounded-full p-1 -ml-2 focus:outline-none focus-visible:ring-2"
          style={{ color: T.accentDeep }}
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
        <h1 className="text-2xl font-bold" style={{ color: T.accentDeep }}>
          {mode === "new" ? (prefill ? "From USDA" : "New food") : mode === "usda" ? "Search USDA foods" : mode === "detail" ? picked?.name : "Add food"}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto mt-3" style={{ minHeight: 0 }}>
        {mode === "list" && (
          <>
            {result && (
              <div className="rounded-lg p-3 text-sm mb-3" role="status" style={{ background: T.tint }}>
                <div className="font-bold" style={{ color: T.accentDeep }}>
                  Logged {result.name}
                  {result.servings !== 1 ? ` × ${result.servings}` : ""}
                </div>
                <div className="mt-0.5">{addedText(result.added) || "No boxes added."}</div>
                {result.notes.map((n, i) => (
                  <div key={i} className="mt-0.5 text-xs" style={{ color: T.muted }}>
                    {n}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search my foods"
                aria-label="Search my foods"
                className="flex-1 rounded-full px-4 py-2 text-sm focus:outline-none focus-visible:ring-2"
                style={{ border: `1px solid ${T.hair}`, background: T.surface, minWidth: 0 }}
              />
              <button
                onClick={() => setMode("usda")}
                aria-label="Search USDA foods"
                className="shrink-0 flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2"
                style={{ background: T.surface, color: T.accentDeep, border: `1px solid ${T.hair}` }}
              >
                <Search size={16} strokeWidth={2.5} aria-hidden="true" />
                USDA
              </button>
              <button
                onClick={() => setMode("new")}
                className="shrink-0 flex items-center gap-1 rounded-full pl-2 pr-3 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2"
                style={{ background: T.accent, color: "#fff" }}
              >
                <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                New
              </button>
            </div>

            {filtered.length === 0 && (
              <p className="text-sm mt-6 text-center" style={{ color: T.muted }}>
                {foods.length === 0 ? "No saved foods yet. Add the things you eat most and they'll be one tap next time." : "Nothing matches."}
              </p>
            )}
            <ul className="mt-3">
              {filtered.map((f) => (
                <li key={f.id} style={{ borderTop: `1px solid ${T.hair}` }}>
                  <button
                    onClick={() => {
                      setPicked(f);
                      setServings(1);
                      setMode("detail");
                    }}
                    className="w-full text-left py-3 flex items-center justify-between gap-3 focus:outline-none focus-visible:ring-2"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold truncate">{f.name}</span>
                      <span className="block text-xs truncate" style={{ color: T.muted }}>
                        {f.serving ? `${f.serving} · ` : ""}
                        {perSummary(f.per)}
                        {f.source === "label" ? " · from label" : f.source === "usda" ? " · from USDA" : " · from food lists"}
                      </span>
                      <Tags food={f} />
                    </span>
                    <ChevronRight size={18} style={{ color: T.muted }} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {mode === "detail" && picked && (
          <LogPanel
            food={picked}
            servings={servings}
            setServings={setServings}
            counts={counts}
            targets={targets}
            onLog={() => log(picked, servings)}
            onDelete={() => {
              onDelete(picked.id);
              setMode("list");
              setPicked(null);
            }}
          />
        )}

        {mode === "new" && (
          <NewFoodForm
            counts={counts}
            targets={targets}
            initial={prefill}
            onDone={(food, s, save) => {
              const f = save ? onSave(food) : food;
              log(f, s);
            }}
          />
        )}

        {mode === "usda" && (
          <UsdaSearch
            onPick={(init) => {
              setPrefill(init);
              setMode("new");
            }}
          />
        )}
      </div>
    </>
  );
}


export function LogPanel({ food, servings, setServings, counts, targets, onLog, onDelete }) {
  return (
    <div>
      <div className="text-sm" style={{ color: T.muted }}>
        {food.serving ? `1 serving = ${food.serving}. ` : ""}
        Per serving: {perSummary(food.per)}.{food.source === "label" ? " Converted from the nutrition label." : food.source === "usda" ? " Converted from USDA nutrient data." : " From the food lists."}
      </div>
      <Tags food={food} />
      <div className="mt-4 text-sm font-bold">How many servings?</div>
      <div className="mt-2">
        <ServingsPicker value={servings} onChange={setServings} />
      </div>
      <div className="mt-4">
        <PreviewAdd per={food.per} servings={servings} counts={counts} targets={targets} />
      </div>
      <div className="flex items-center justify-between mt-4">
        <button onClick={onLog} className="rounded-full px-5 py-2.5 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ background: T.accent, color: "#fff" }}>
          Log it
        </button>
        <button onClick={onDelete} aria-label="Remove from my foods" className="flex items-center gap-1 text-xs focus:outline-none focus-visible:ring-2" style={{ color: T.muted }}>
          <Trash2 size={14} aria-hidden="true" />
          Remove
        </button>
      </div>
    </div>
  );
}


export function NewFoodForm({ counts, targets, onDone, initial = null }) {
  const usda = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [serving, setServing] = useState(initial?.serving || "");
  const [source, setSource] = useState(usda ? "label" : "list"); // list | label (USDA foods use the label arithmetic)
  const [listPer, setListPer] = useState({ starch: 0, fruit: 0, milk: 0, veg: 0, meat: 0, fat: 0, water: 0 });
  const [macros, setMacros] = useState(
    initial ? { carb: String(initial.macros.carb), protein: String(initial.macros.protein), fat: String(initial.macros.fat), fiber: String(initial.macros.fiber), sodium: String(initial.macros.sodium) } : { carb: "", protein: "", fat: "", fiber: "", sodium: "" }
  );
  const [carbRow, setCarbRow] = useState(initial?.carbRow || null); // null = auto
  const [servings, setServings] = useState(1);
  const [save, setSave] = useState(true);
  const opts = initial?.opts || {};

  const m = { carb: Number(macros.carb) || 0, protein: Number(macros.protein) || 0, fat: Number(macros.fat) || 0 };
  const autoRow = suggestCarbRow(m);
  const row = carbRow || autoRow;
  const derived = source === "label" ? deriveFromLabel(m, row, opts) : null;
  const per = source === "label" ? derived.per : listPer;
  const hasMacros = macros.carb !== "" || macros.protein !== "" || macros.fat !== "";
  const ready = name.trim() && (source === "list" ? Object.values(listPer).some((v) => v > 0) : hasMacros);

  const food = {
    name: name.trim(),
    serving: serving.trim(),
    source: usda ? "usda" : source,
    per,
    ...(source === "label"
      ? { macros: m, carbRow: row, fiber: macros.fiber === "" ? null : Number(macros.fiber), sodium: macros.sodium === "" ? null : Number(macros.sodium) }
      : {}),
    ...(usda ? { fdcId: initial.fdcId, opts } : {}),
  };

  const inputStyle = { border: `1px solid ${T.hair}`, background: T.surface, color: T.ink };

  return (
    <div>
      <label className="text-xs font-bold block" style={{ color: T.accentDeep }}>
        Name
      </label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Greek yogurt, plain" className="w-full mt-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2" style={inputStyle} />

      <label className="text-xs font-bold block mt-3" style={{ color: T.accentDeep }}>
        One serving is
      </label>
      <input value={serving} onChange={(e) => setServing(e.target.value)} placeholder="e.g. ¾ cup, 1 slice, 3 oz" className="w-full mt-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2" style={inputStyle} />

      {usda && (
        <p className="text-xs mt-3" style={{ color: T.muted }}>
          USDA FoodData Central: {initial.desc}. Numbers below are for {initial.serving}; edit them if you ate a different amount.
        </p>
      )}
      {!usda && (
      <div className="text-xs font-bold mt-4" style={{ color: T.accentDeep }}>
        Where do the servings come from?
      </div>
      )}
      {!usda && (
      <div role="radiogroup" className="inline-flex rounded-full p-0.5 mt-1" style={{ background: T.tint }}>
        {[
          ["list", "My food lists"],
          ["label", "Nutrition label"],
        ].map(([v, l]) => (
          <button
            key={v}
            role="radio"
            aria-checked={source === v}
            onClick={() => setSource(v)}
            className="rounded-full px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2"
            style={{ background: source === v ? T.surface : "transparent", color: source === v ? T.accentDeep : T.muted, fontWeight: source === v ? 700 : 400, boxShadow: source === v ? "0 1px 2px rgba(34,48,43,0.12)" : "none" }}
          >
            {l}
          </button>
        ))}
      </div>
      )}

      {source === "list" && (
        <div className="mt-3">
          <p className="text-xs" style={{ color: T.muted }}>
            Enter what the food lists say one serving counts as.
          </p>
          {GROUPS.filter((g) => g.id !== "water").map((g) => (
            <div key={g.id} className="flex items-center justify-between py-1.5 text-sm" style={{ borderTop: `1px solid ${T.hair}` }}>
              <span>{g.label}</span>
              <select
                aria-label={`${g.label} servings`}
                value={listPer[g.id]}
                onChange={(e) => setListPer({ ...listPer, [g.id]: Number(e.target.value) })}
                className="rounded-lg px-2 py-1 text-sm focus:outline-none focus-visible:ring-2"
                style={inputStyle}
              >
                {HALF_STEPS.map((v) => (
                  <option key={v} value={v}>
                    {v === 0 ? "—" : halfText(v)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {source === "label" && (
        <div className="mt-3">
          {!usda && (
            <p className="text-xs" style={{ color: T.muted }}>
              Per serving, from the Nutrition Facts panel. The app works out the boxes; you can't assign them by hand.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[
              ["carb", "Total carb (g)"],
              ["protein", "Protein (g)"],
              ["fat", "Total fat (g)"],
              ["fiber", "Fiber (g)"],
              ["sodium", "Sodium (mg)"],
            ].map(([k, l]) => (
              <label key={k} className="text-xs" style={{ color: T.muted }}>
                {l}
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={macros[k]}
                  onChange={(e) => setMacros({ ...macros, [k]: e.target.value })}
                  className="w-full mt-1 rounded-lg px-2 py-2 text-sm focus:outline-none focus-visible:ring-2"
                  style={{ ...inputStyle, color: T.ink }}
                />
              </label>
            ))}
          </div>

          {hasMacros && !derived.free && m.carb >= 3 && (
            <div className="mt-3">
              <div className="text-xs" style={{ color: T.muted }}>
                Which row do the carbs belong in?{!carbRow && " (suggested)"}
              </div>
              <div className="flex gap-1.5 flex-wrap mt-1" role="radiogroup" aria-label="Carbohydrate row">
                {CARB_ROWS.map((r) => {
                  const on = r.id === row;
                  return (
                    <button
                      key={r.id}
                      role="radio"
                      aria-checked={on}
                      onClick={() => setCarbRow(r.id)}
                      className="rounded-full px-3 py-1 text-xs focus:outline-none focus-visible:ring-2"
                      style={{ background: on ? T.accent : T.surface, color: on ? "#fff" : T.ink, border: `1px solid ${on ? T.accent : T.hair}`, fontWeight: on ? 700 : 400 }}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasMacros && (
            <div className="mt-3 rounded-lg p-3 text-xs" style={{ background: T.surface, border: `1px solid ${T.hair}` }}>
              <div className="font-bold text-sm mb-1" style={{ color: T.accentDeep }}>
                Per serving: {perSummary(per)}
              </div>
              <Tags food={food} />
              {derived.steps.map((s, i) => (
                <div key={i} style={{ color: T.muted }}>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ready && (
        <>
          <div className="mt-4 text-sm font-bold">How many servings now?</div>
          <div className="mt-2">
            <ServingsPicker value={servings} onChange={setServings} />
          </div>
          <div className="mt-3">
            <PreviewAdd per={per} servings={servings} counts={counts} targets={targets} />
          </div>
          <label className="flex items-center gap-2 mt-3 text-sm">
            <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
            Save to my foods for next time
          </label>
          <button onClick={() => onDone(food, servings, save)} className="mt-4 rounded-full px-5 py-2.5 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ background: T.accent, color: "#fff" }}>
            Log it
          </button>
        </>
      )}
    </div>
  );
}



// ---------------------------------------------------------------------------
function UsdaSearch({ onPick }) {
  const [q, setQ] = useState("");
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);
  const [hits, setHits] = useState([]);
  const [open, setOpen] = useState(null); // food whose portions are showing
  const [grams, setGrams] = useState("");

  useEffect(() => {
    loadUsda()
      .then(() => setReady(true))
      .catch(() => setErr("The food database isn't available offline yet. Open the app once while online and try again."));
  }, []);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setHits(searchUsda(q, 30)), 120);
    return () => clearTimeout(t);
  }, [q, ready]);

  const boxesText = (food, g) => {
    const m = macrosFor(food, g);
    const { per } = deriveFromLabel(m, food.row, convertOpts(food, g));
    const parts = GROUPS.filter((gr) => roundBoxes(gr.id, per[gr.id] || 0) > 0).map((gr) => `${halfText(roundBoxes(gr.id, per[gr.id]))} ${gr.label.split(" /")[0]}`);
    return parts.length ? parts.join(", ") : "free food";
  };
  const pick = (food, label, g) => {
    onPick({ name: food.desc, desc: food.desc, serving: `${label} (${Math.round(g)} g)`, macros: macrosFor(food, g), carbRow: food.row, opts: convertOpts(food, g), fdcId: food.id });
  };

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. brown rice, chicken breast, banana"
        aria-label="Search USDA foods"
        autoFocus
        className="w-full rounded-full px-4 py-2 focus:outline-none focus-visible:ring-2"
        style={{ border: `1px solid ${T.hair}`, background: T.surface }}
      />
      {err && (
        <p className="text-sm mt-3" style={{ color: "#9A3B2E" }}>
          {err}
        </p>
      )}
      {!err && !ready && (
        <p className="text-sm mt-3" style={{ color: T.muted }}>
          Loading the food database…
        </p>
      )}
      {ready && q && hits.length === 0 && (
        <p className="text-sm mt-3" style={{ color: T.muted }}>
          Nothing matches. Try fewer or different words; the database uses plain names like "chicken breast roasted".
        </p>
      )}
      <ul className="mt-2">
        {hits.map((f) => {
          const isOpen = open?.id === f.id;
          return (
            <li key={f.id} style={{ borderTop: `1px solid ${T.hair}` }}>
              <button
                onClick={() => {
                  setOpen(isOpen ? null : f);
                  setGrams("");
                }}
                aria-expanded={isOpen}
                className="w-full text-left py-2.5 flex items-start justify-between gap-3 focus:outline-none focus-visible:ring-2"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{f.desc}</span>
                  <span className="block text-xs" style={{ color: T.muted }}>
                    {f.category}
                  </span>
                </span>
                <ChevronRight size={18} style={{ color: T.muted, transform: isOpen ? "rotate(90deg)" : "none" }} aria-hidden="true" />
              </button>
              {isOpen && (
                <div className="pb-3">
                  <div className="text-xs font-bold" style={{ color: T.accentDeep }}>
                    How much?
                  </div>
                  <ul className="mt-1">
                    {portionsFor(f).map((p) => (
                      <li key={p.label}>
                        <button
                          onClick={() => pick(f, p.label, p.g)}
                          className="w-full text-left py-1.5 flex items-baseline justify-between gap-3 text-sm focus:outline-none focus-visible:ring-2"
                        >
                          <span>
                            {p.label} <span style={{ color: T.muted }}>· {Math.round(p.g)} g</span>
                          </span>
                          <span className="shrink-0 text-xs" style={{ color: T.accentDeep }}>
                            {boxesText(f, p.g)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2 mt-1 text-sm">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={1}
                      value={grams}
                      onChange={(e) => setGrams(e.target.value)}
                      placeholder="grams"
                      aria-label="Custom amount in grams"
                      className="w-24 rounded-lg px-2 py-1 focus:outline-none focus-visible:ring-2"
                      style={{ border: `1px solid ${T.hair}`, background: T.surface }}
                    />
                    <button
                      onClick={() => Number(grams) > 0 && pick(f, `${Number(grams)} g`, Number(grams))}
                      disabled={!(Number(grams) > 0)}
                      className="rounded-full px-3 py-1 text-xs font-bold focus:outline-none focus-visible:ring-2"
                      style={{ background: T.tint, color: T.accentDeep, opacity: Number(grams) > 0 ? 1 : 0.5 }}
                    >
                      Use
                    </button>
                    {Number(grams) > 0 && (
                      <span className="text-xs" style={{ color: T.accentDeep }}>
                        {boxesText(f, Number(grams))}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {ready && (
        <p className="text-xs mt-4" style={{ color: T.muted }}>
          Generic foods from USDA FoodData Central (public domain), converted with the same rules as a nutrition label. Packaged foods: use the label. Mixed dishes: use your food lists.
        </p>
      )}
    </div>
  );
}
