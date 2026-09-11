import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, X, Search, Clock, BookOpen, Tag, Camera } from "lucide-react";
import { CARB_ROWS, GROUPS, addedText, deriveFromLabel, halfText, perSummary, roundBoxes, suggestCarbRow } from "../model.js";
import { T } from "../theme.js";
import { loadUsda, searchUsda, macrosFor, portionsFor, convertOpts } from "../usda.js";
import { scanLabel } from "../ocr.js";
import { PreviewAdd, ServingsPicker, Tags } from "./shared.jsx";

// Add food: the USDA database is the backbone. Search is the default; History is everything
// logged before; Recipes are the client's own combination foods; New is a label or a recipe.

const TABS = [
  ["search", "Search", Search],
  ["history", "History", Clock],
  ["recipes", "Recipes", BookOpen],
  ["new", "New", Plus],
];

export function AddFoodScreen({ foods, counts, targets, onLog, onSave, onDelete, onBack, notify }) {
  const [tab, setTab] = useState("search");
  const [overlay, setOverlay] = useState(null); // {kind:"log", food} | {kind:"label", prefill} | {kind:"recipe", recipe}
  // Search state lives here so it survives going into a food and coming back.
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [grams, setGrams] = useState("");
  const scrollRef = useRef(null);
  const savedScroll = useRef(0);

  // Restore the list position when an overlay closes.
  useEffect(() => {
    if (!overlay && scrollRef.current) scrollRef.current.scrollTop = savedScroll.current;
  }, [overlay]);
  const openOverlay = (o) => {
    savedScroll.current = scrollRef.current?.scrollTop || 0;
    setOverlay(o);
  };

  const finish = (food, servings) => {
    const r = onLog(food, servings);
    const detail = [addedText(r.added) || "No boxes added.", ...r.notes].join(" ");
    notify?.(`Logged ${food.name}${servings !== 1 ? ` × ${fmtServ(servings)}` : ""}`, detail);
    setOverlay(null);
  };

  const history = [...foods.filter((f) => f.source !== "recipe")].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
  const recipes = [...foods.filter((f) => f.source === "recipe")].sort((a, b) => a.name.localeCompare(b.name));

  const title = overlay?.kind === "log" ? overlay.food.name : overlay?.kind === "label" ? (overlay.prefill ? "From USDA" : "From a label") : overlay?.kind === "recipe" ? (overlay.recipe ? "Edit recipe" : "New recipe") : "Add food";

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => (overlay ? setOverlay(null) : onBack())}
          aria-label={overlay ? "Back" : "Back to today"}
          className="rounded-full p-1 -ml-2 focus:outline-none focus-visible:ring-2"
          style={{ color: T.accentDeep }}
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
        <h1 className="text-2xl font-bold truncate" style={{ color: T.accentDeep }}>
          {title}
        </h1>
      </div>

      {!overlay && (
        <div role="tablist" className="flex gap-1 mt-3 rounded-full p-0.5" style={{ background: T.tint }}>
          {TABS.map(([id, label, Icon]) => {
            const on = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(id)}
                className="flex-1 flex items-center justify-center gap-1 rounded-full py-1.5 text-xs focus:outline-none focus-visible:ring-2"
                style={{ background: on ? T.surface : "transparent", color: on ? T.accentDeep : T.muted, fontWeight: on ? 700 : 400, boxShadow: on ? "0 1px 2px rgba(34,48,43,0.12)" : "none" }}
              >
                <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto mt-3" style={{ minHeight: 0 }}>
        {!overlay && tab === "search" && (
          <SearchTab
            q={q}
            setQ={setQ}
            openId={openId}
            setOpenId={setOpenId}
            grams={grams}
            setGrams={setGrams}
            history={history}
            onPickSaved={(f) => openOverlay({ kind: "log", food: f })}
            onPickUsda={(prefill) => openOverlay({ kind: "label", prefill })}
          />
        )}

        {!overlay && tab === "history" && <SavedList items={history} empty="Nothing logged yet. Everything you log shows up here, one tap to log again." onPick={(f) => openOverlay({ kind: "log", food: f })} />}

        {!overlay && tab === "recipes" && (
          <>
            <button
              onClick={() => openOverlay({ kind: "recipe", recipe: null })}
              className="w-full flex items-center justify-center gap-1 rounded-full py-2.5 text-sm font-bold focus:outline-none focus-visible:ring-2"
              style={{ background: T.accent, color: "#fff" }}
            >
              <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
              New recipe
            </button>
            <div className="mt-3">
              <SavedList items={recipes} empty="A recipe is your own combination food: add its ingredients once, say how many servings it makes, and log it by the serving from then on." onPick={(f) => openOverlay({ kind: "log", food: f })} />
            </div>
          </>
        )}

        {!overlay && tab === "new" && (
          <div className="grid gap-3">
            <BigOption icon={Tag} title="From a nutrition label" body="Type the serving size and the numbers from the panel. The app works out the boxes." onClick={() => openOverlay({ kind: "label", prefill: null })} />
            <BigOption icon={BookOpen} title="New recipe" body="Your own dish: add the ingredients, say how many servings it makes, log it by the serving." onClick={() => openOverlay({ kind: "recipe", recipe: null })} />
          </div>
        )}

        {overlay?.kind === "log" && (
          <LogPanel
            food={overlay.food}
            counts={counts}
            targets={targets}
            onLog={(s) => finish(overlay.food, s)}
            onEdit={overlay.food.source === "recipe" ? () => setOverlay({ kind: "recipe", recipe: overlay.food }) : null}
            onDelete={() => {
              onDelete(overlay.food.id);
              setOverlay(null);
            }}
          />
        )}

        {overlay?.kind === "label" && <NewFoodForm counts={counts} targets={targets} initial={overlay.prefill} onDone={(food, s) => finish(food, s)} />}

        {overlay?.kind === "recipe" && (
          <RecipeEditor
            recipe={overlay.recipe}
            history={history}
            onSave={(recipe) => {
              const saved = onSave(recipe);
              setOverlay({ kind: "log", food: saved });
            }}
            onCancel={() => setOverlay(null)}
          />
        )}
      </div>
    </>
  );
}

const fmtServ = (s) => (s === 0.5 ? "½" : s === 1.5 ? "1½" : String(s));

function BigOption({ icon: Icon, title, body, onClick }) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-lg p-3 flex items-start gap-3 focus:outline-none focus-visible:ring-2" style={{ background: T.surface, border: `1px solid ${T.hair}` }}>
      <span className="shrink-0 rounded-full p-2" style={{ background: T.tint, color: T.accentDeep }}>
        <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs mt-0.5" style={{ color: T.muted }}>
          {body}
        </span>
      </span>
      <ChevronRight size={18} className="ml-auto shrink-0" style={{ color: T.muted }} aria-hidden="true" />
    </button>
  );
}

const sourceLabel = (f) => (f.source === "usda" ? "USDA" : f.source === "label" ? "label" : f.source === "recipe" ? `recipe · ${f.makes} servings` : "entered by hand");

function SavedList({ items, empty, onPick }) {
  if (!items.length)
    return (
      <p className="text-sm mt-4 text-center px-4" style={{ color: T.muted }}>
        {empty}
      </p>
    );
  return (
    <ul>
      {items.map((f) => (
        <li key={f.id} style={{ borderTop: `1px solid ${T.hair}` }}>
          <button onClick={() => onPick(f)} className="w-full text-left py-3 flex items-center justify-between gap-3 focus:outline-none focus-visible:ring-2">
            <span className="min-w-0">
              <span className="block text-sm font-bold truncate">{f.name}</span>
              <span className="block text-xs truncate" style={{ color: T.muted }}>
                {f.serving ? `${f.serving} · ` : ""}
                {perSummary(f.per)} · {sourceLabel(f)}
              </span>
              <Tags food={f} />
            </span>
            <ChevronRight size={18} style={{ color: T.muted }} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
function SearchTab({ q, setQ, openId, setOpenId, grams, setGrams, history, onPickSaved, onPickUsda }) {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);
  const [hits, setHits] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    loadUsda()
      .then(() => setReady(true))
      .catch(() => setErr("The food database isn't available yet. Open the app once while online and try again."));
  }, []);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setHits(searchUsda(q, 30)), 120);
    return () => clearTimeout(t);
  }, [q, ready]);

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const fromHistory = words.length ? history.filter((f) => words.every((w) => f.name.toLowerCase().includes(w))).slice(0, 5) : [];
  const recent = history.slice(0, 6);

  return (
    <div>
      <div className="relative">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search foods, e.g. brown rice cooked"
          aria-label="Search foods"
          className="w-full rounded-full pl-4 pr-10 py-2 focus:outline-none focus-visible:ring-2"
          style={{ border: `1px solid ${T.hair}`, background: T.surface }}
        />
        {q && (
          <button
            onClick={() => {
              setQ("");
              setOpenId(null);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 focus:outline-none focus-visible:ring-2"
            style={{ color: T.muted, background: T.tint }}
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>

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

      {!q && recent.length > 0 && (
        <>
          <div className="text-xs font-bold mt-4" style={{ color: T.muted }}>
            Recent
          </div>
          <SavedList items={recent} empty="" onPick={onPickSaved} />
        </>
      )}
      {!q && ready && recent.length === 0 && (
        <p className="text-sm mt-4" style={{ color: T.muted }}>
          Type a plain name, like "banana," "whole wheat bread," or "chicken breast roasted." Foods you've logged appear here for one-tap logging.
        </p>
      )}

      {q && fromHistory.length > 0 && (
        <>
          <div className="text-xs font-bold mt-4" style={{ color: T.muted }}>
            From your history
          </div>
          <SavedList items={fromHistory} empty="" onPick={onPickSaved} />
        </>
      )}

      {q && ready && (
        <div className="text-xs font-bold mt-4" style={{ color: T.muted }}>
          Foods
        </div>
      )}
      {q && ready && hits.length === 0 && (
        <p className="text-sm mt-2" style={{ color: T.muted }}>
          Nothing matches. Try fewer or different words.
        </p>
      )}
      {q && <UsdaResults hits={hits} openId={openId} setOpenId={setOpenId} grams={grams} setGrams={setGrams} onPick={onPickUsda} />}
    </div>
  );
}

// Per-portion boxes for a USDA food.
function boxesText(food, g) {
  const m = macrosFor(food, g);
  const { per } = deriveFromLabel(m, food.row, convertOpts(food, g));
  const parts = GROUPS.filter((gr) => roundBoxes(gr.id, per[gr.id] || 0) > 0).map((gr) => `${halfText(roundBoxes(gr.id, per[gr.id]))} ${gr.label.split(" /")[0]}`);
  return parts.length ? parts.join(", ") : "free food";
}
function usdaPick(food, label, g) {
  return { name: food.desc, desc: food.desc, serving: `${label} (${Math.round(g)} g)`, grams: g, macros: macrosFor(food, g), carbRow: food.row, opts: convertOpts(food, g), fdcId: food.id };
}

export function UsdaResults({ hits, openId, setOpenId, grams, setGrams, onPick }) {
  return (
    <ul className="mt-1">
      {hits.map((f) => {
        const isOpen = openId === f.id;
        return (
          <li key={f.id} style={{ borderTop: `1px solid ${T.hair}` }}>
            <button
              onClick={() => {
                setOpenId(isOpen ? null : f.id);
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
              <ChevronRight size={18} className="shrink-0 mt-0.5" style={{ color: T.muted, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 120ms" }} aria-hidden="true" />
            </button>
            {isOpen && (
              <div className="pb-3">
                <div className="text-xs font-bold mb-1" style={{ color: T.accentDeep }}>
                  How much? Tap an amount.
                </div>
                <div className="grid gap-1.5">
                  {portionsFor(f).map((p) => (
                    <button
                      key={p.label}
                      onClick={() => onPick(usdaPick(f, p.label, p.g))}
                      className="w-full text-left rounded-lg px-3 py-2 flex items-center justify-between gap-3 text-sm focus:outline-none focus-visible:ring-2"
                      style={{ background: T.surface, border: `1px solid ${T.hair}` }}
                    >
                      <span>
                        <span className="font-bold">{p.label}</span> <span style={{ color: T.muted }}>· {Math.round(p.g)} g</span>
                      </span>
                      <span className="shrink-0 flex items-center gap-1 text-xs" style={{ color: T.accentDeep }}>
                        {boxesText(f, p.g)}
                        <ChevronRight size={14} aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ border: `1px dashed ${T.hair}` }}>
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
                    <span className="text-xs flex-1" style={{ color: T.accentDeep }}>
                      {Number(grams) > 0 ? boxesText(f, Number(grams)) : ""}
                    </span>
                    <button
                      onClick={() => Number(grams) > 0 && onPick(usdaPick(f, `${Number(grams)} g`, Number(grams)))}
                      disabled={!(Number(grams) > 0)}
                      className="rounded-full px-3 py-1 text-xs font-bold focus:outline-none focus-visible:ring-2"
                      style={{ background: T.accent, color: "#fff", opacity: Number(grams) > 0 ? 1 : 0.4 }}
                    >
                      Use
                    </button>
                  </div>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
function LogPanel({ food, counts, targets, onLog, onEdit, onDelete }) {
  const [servings, setServings] = useState(1);
  return (
    <div>
      <div className="text-sm" style={{ color: T.muted }}>
        {food.serving ? `1 serving = ${food.serving}. ` : ""}
        Per serving: {perSummary(food.per)}.{food.source === "usda" ? " From USDA nutrient data." : food.source === "label" ? " From the nutrition label." : food.source === "recipe" ? ` Your recipe, ${food.makes} servings.` : ""}
      </div>
      <Tags food={food} />
      {food.source === "recipe" && food.ingredients?.length > 0 && (
        <ul className="mt-3 text-xs" style={{ color: T.muted }}>
          {food.ingredients.map((i, k) => (
            <li key={k} className="py-1" style={{ borderTop: `1px solid ${T.hair}` }}>
              {i.name} <span>· {i.serving}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 text-sm font-bold">How many servings?</div>
      <div className="mt-2">
        <ServingsPicker value={servings} onChange={setServings} />
      </div>
      <div className="mt-4">
        <PreviewAdd per={food.per} servings={servings} counts={counts} targets={targets} />
      </div>
      <div className="flex items-center justify-between mt-4">
        <button onClick={() => onLog(servings)} className="rounded-full px-5 py-2.5 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ background: T.accent, color: "#fff" }}>
          Log it
        </button>
        <span className="flex items-center gap-3">
          {onEdit && (
            <button onClick={onEdit} className="text-xs font-bold focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
              Edit recipe
            </button>
          )}
          <button onClick={onDelete} aria-label="Remove from history" className="flex items-center gap-1 text-xs focus:outline-none focus-visible:ring-2" style={{ color: T.muted }}>
            <Trash2 size={14} aria-hidden="true" />
            Remove
          </button>
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A food from a nutrition label (typed now, scanned later), or a USDA food handed in prefilled.
export function NewFoodForm({ counts, targets, onDone, initial = null }) {
  const usda = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [serving, setServing] = useState(initial?.serving || "");
  const [macros, setMacros] = useState(
    initial ? { carb: String(initial.macros.carb), protein: String(initial.macros.protein), fat: String(initial.macros.fat), fiber: String(initial.macros.fiber), sodium: String(initial.macros.sodium) } : { carb: "", protein: "", fat: "", fiber: "", sodium: "" }
  );
  const [carbRow, setCarbRow] = useState(initial?.carbRow || null);
  const [servings, setServings] = useState(1);
  const opts = initial?.opts || {};
  const [scan, setScan] = useState(null); // {busy, progress, status, preview, missing, error}
  const [zoom, setZoom] = useState(false);
  const [showText, setShowText] = useState(false);

  const onPhoto = async (file) => {
    if (!file) return;
    setScan({ busy: true, progress: 0, status: "Reading the label" });
    try {
      const r = await scanLabel(file, (m) => {
        if (m.status === "locating") setScan((sc) => ({ ...(sc || {}), busy: true, progress: 0, status: "Finding the label" }));
        else if (m.status === "recognizing text") setScan((sc) => ({ ...(sc || {}), busy: true, progress: m.progress || 0, status: m.pass === 3 ? "Trying the whole photo" : m.pass === 2 ? "Second look" : "Reading the label" }));
        else if (/loading|initializ/.test(m.status || "")) setScan((sc) => ({ ...(sc || {}), busy: true, progress: 0, status: "Getting the reader ready (first time only)" }));
      });
      // A scan describes one label: take everything it read and clear what it didn't,
      // so scanning a different product never carries the previous one's numbers along.
      setMacros({
        carb: r.carb != null ? String(r.carb) : "",
        protein: r.protein != null ? String(r.protein) : "",
        fat: r.fat != null ? String(r.fat) : "",
        fiber: r.fiber != null ? String(r.fiber) : "",
        sodium: r.sodium != null ? String(r.sodium) : "",
      });
      setServing(r.serving || "");
      setCarbRow(null);
      setScan({ busy: false, preview: r.preview, cropped: r.cropped, missing: r.missing, found: r.found, serving: r.serving, text: r.text });
    } catch (e) {
      setScan({ busy: false, error: "Couldn't read that photo. Try again with the panel flat, well lit, and filling the frame." });
    }
  };
  const MISSING_LABEL = { carb: "carbohydrate", protein: "protein", fat: "fat", fiber: "fiber", sodium: "sodium" };

  const m = { carb: Number(macros.carb) || 0, protein: Number(macros.protein) || 0, fat: Number(macros.fat) || 0 };
  const row = carbRow || suggestCarbRow(m);
  const derived = deriveFromLabel(m, row, opts);
  const per = derived.per;
  const hasMacros = macros.carb !== "" || macros.protein !== "" || macros.fat !== "";
  const ready = name.trim() && hasMacros;

  const food = {
    name: name.trim(),
    serving: serving.trim(),
    source: usda ? "usda" : "label",
    per,
    macros: m,
    carbRow: row,
    fiber: macros.fiber === "" ? null : Number(macros.fiber),
    sodium: macros.sodium === "" ? null : Number(macros.sodium),
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

      {usda ? (
        <p className="text-xs mt-3" style={{ color: T.muted }}>
          USDA FoodData Central: {initial.desc}. Numbers below are for {initial.serving}; edit them if you ate a different amount.
        </p>
      ) : (
        <div className="mt-3">
          <label
            className="w-full flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold cursor-pointer focus-within:ring-2"
            style={{ background: scan?.busy ? T.tint : T.accent, color: scan?.busy ? T.accentDeep : "#fff", opacity: scan?.busy ? 0.9 : 1 }}
          >
            <Camera size={18} strokeWidth={2.2} aria-hidden="true" />
            {scan?.busy ? `${scan.status}${scan.progress ? ` ${Math.round(scan.progress * 100)}%` : "…"}` : scan?.preview ? "Scan again" : "Scan the Nutrition Facts label"}
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={!!scan?.busy} onChange={(e) => onPhoto(e.target.files?.[0])} />
          </label>
          {!scan?.busy && (
            <label className="block text-center text-xs mt-2 cursor-pointer focus-within:ring-2" style={{ color: T.accentDeep }}>
              <span className="font-bold">or choose a photo you already have</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
            </label>
          )}
          {scan?.busy && (
            <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: T.hair }} aria-hidden="true">
              <div className="h-full" style={{ width: `${Math.round((scan.progress || 0) * 100)}%`, background: T.accent, transition: "width 200ms" }} />
            </div>
          )}
          {scan?.error && (
            <p className="text-xs mt-2" role="status" style={{ color: "#9A3B2E" }}>
              {scan.error}
            </p>
          )}
          {scan?.preview && (
            <div className="mt-2">
              <button type="button" onClick={() => setZoom(true)} className="block w-full rounded-lg overflow-hidden focus:outline-none focus-visible:ring-2" style={{ border: `1px solid ${T.hair}`, background: "#fff" }} aria-label="Enlarge the scanned label">
                <img src={scan.preview} alt="The label you scanned" className="w-full" style={{ maxHeight: 320, objectFit: "contain" }} />
              </button>
              <p className="text-xs mt-1" style={{ color: T.muted }}>
                {scan.cropped ? "This is the part of the photo that was read. " : ""}Tap to enlarge. Check the numbers below against it and fix anything that's off.
                {scan.missing?.length > 0 && <> Couldn't find {scan.missing.map((k) => MISSING_LABEL[k]).join(", ")}; type {scan.missing.length === 1 ? "it" : "those"} in.</>}
                {!scan.serving && <> Couldn't read the serving size.</>}
              </p>
              {scan.missing?.length > 0 && (
                <div className="mt-1">
                  <button type="button" onClick={() => setShowText((v) => !v)} className="text-xs font-bold focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
                    {showText ? "Hide what the reader saw" : "Show what the reader saw"}
                  </button>
                  {showText && (
                    <div className="mt-1">
                      <pre className="text-xs rounded-lg p-2 overflow-auto" style={{ background: T.surface, border: `1px solid ${T.hair}`, maxHeight: 200, whiteSpace: "pre-wrap" }}>
                        {(scan.text || "").trim() || "(nothing)"}
                      </pre>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(scan.text || "")}
                        className="mt-1 text-xs font-bold focus:outline-none focus-visible:ring-2"
                        style={{ color: T.accentDeep }}
                      >
                        Copy text
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {zoom && scan?.preview && (
            <div className="fixed inset-0 flex flex-col" style={{ background: "#111", zIndex: 70 }} role="dialog" aria-label="Scanned label">
              <div className="flex justify-end p-3">
                <button onClick={() => setZoom(false)} aria-label="Close" className="rounded-full p-2 focus:outline-none focus-visible:ring-2" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                  <X size={22} strokeWidth={2.5} />
                </button>
              </div>
              <div className="flex-1 overflow-auto" style={{ WebkitOverflowScrolling: "touch" }}>
                <img src={scan.preview} alt="" style={{ width: "200%", maxWidth: "none", display: "block" }} />
              </div>
              <p className="text-center text-xs p-3" style={{ color: "#bbb" }}>
                Drag to move around. Tap × to go back to the numbers.
              </p>
            </div>
          )}
          <p className="text-xs mt-3" style={{ color: T.muted }}>
            Or type them: per serving, from the Nutrition Facts panel. The app works out the boxes from these numbers. Photos are read on your phone and not kept.
          </p>
        </div>
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
            <input type="number" inputMode="decimal" min={0} value={macros[k]} onChange={(e) => setMacros({ ...macros, [k]: e.target.value })} className="w-full mt-1 rounded-lg px-2 py-2 text-sm focus:outline-none focus-visible:ring-2" style={inputStyle} />
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
                <button key={r.id} role="radio" aria-checked={on} onClick={() => setCarbRow(r.id)} className="rounded-full px-3 py-1 text-xs focus:outline-none focus-visible:ring-2" style={{ background: on ? T.accent : T.surface, color: on ? "#fff" : T.ink, border: `1px solid ${on ? T.accent : T.hair}`, fontWeight: on ? 700 : 400 }}>
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

      {ready && (
        <>
          <div className="mt-4 text-sm font-bold">How many servings now?</div>
          <div className="mt-2">
            <ServingsPicker value={servings} onChange={setServings} />
          </div>
          <div className="mt-3">
            <PreviewAdd per={per} servings={servings} counts={counts} targets={targets} />
          </div>
          <p className="text-xs mt-2" style={{ color: T.muted }}>
            This food is kept in your History for next time.
          </p>
          <button onClick={() => onDone(food, servings)} className="mt-3 rounded-full px-5 py-2.5 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ background: T.accent, color: "#fff" }}>
            Log it
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recipe: ingredients (from the database or History) → per-serving boxes.
function perFor(ing) {
  // Ingredient shapes: USDA pick {macros, carbRow, opts} × 1; History food {per} × servings
  if (ing.per) return Object.fromEntries(GROUPS.map((g) => [g.id, (ing.per[g.id] || 0) * (ing.servings || 1)]));
  return deriveFromLabel(ing.macros, ing.carbRow, ing.opts || {}).per;
}

function RecipeEditor({ recipe, history, onSave, onCancel }) {
  const [name, setName] = useState(recipe?.name || "");
  const [makes, setMakes] = useState(recipe?.makes || 4);
  const [ings, setIngs] = useState(recipe?.ingredients || []);
  const [adding, setAdding] = useState(null); // "usda" | "history" | null
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const [grams, setGrams] = useState("");
  const [hits, setHits] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (adding !== "usda") return;
    loadUsda().then(() => setReady(true)).catch(() => setReady(false));
  }, [adding]);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setHits(searchUsda(q, 20)), 120);
    return () => clearTimeout(t);
  }, [q, ready]);

  const total = GROUPS.reduce((acc, g) => ((acc[g.id] = ings.reduce((s, i) => s + (perFor(i)[g.id] || 0), 0)), acc), {});
  const perServing = Object.fromEntries(GROUPS.map((g) => [g.id, total[g.id] / Math.max(1, makes)]));
  const fiber = ings.reduce((s, i) => s + (i.macros?.fiber || 0) * (i.servings || 1) || (i.fiber || 0) * (i.servings || 1), 0) / Math.max(1, makes);
  const sodium = ings.reduce((s, i) => s + (i.macros?.sodium || 0) * (i.servings || 1) || (i.sodium || 0) * (i.servings || 1), 0) / Math.max(1, makes);
  const ready2 = name.trim() && ings.length > 0;

  const save = () =>
    onSave({
      ...(recipe || {}),
      name: name.trim(),
      serving: `1 of ${makes}`,
      source: "recipe",
      makes,
      ingredients: ings,
      per: perServing,
      fiber: Math.round(fiber * 10) / 10,
      sodium: Math.round(sodium),
    });

  const inputStyle = { border: `1px solid ${T.hair}`, background: T.surface, color: T.ink };
  const histMatches = q ? history.filter((f) => q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => f.name.toLowerCase().includes(w))).slice(0, 10) : history.slice(0, 10);

  if (adding) {
    return (
      <div>
        <button onClick={() => setAdding(null)} className="text-sm font-bold flex items-center gap-1 focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
          <ChevronLeft size={16} /> Back to recipe
        </button>
        <div className="relative mt-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={adding === "usda" ? "Search foods" : "Search your history"} aria-label="Search" className="w-full rounded-full pl-4 pr-10 py-2 focus:outline-none focus-visible:ring-2" style={inputStyle} autoFocus />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1" style={{ color: T.muted, background: T.tint }}>
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
        {adding === "usda" && (
          <UsdaResults
            hits={hits}
            openId={openId}
            setOpenId={setOpenId}
            grams={grams}
            setGrams={setGrams}
            onPick={(p) => {
              setIngs([...ings, { name: p.desc, serving: p.serving, macros: p.macros, carbRow: p.carbRow, opts: p.opts, fdcId: p.fdcId }]);
              setAdding(null);
              setQ("");
              setOpenId(null);
            }}
          />
        )}
        {adding === "history" && (
          <SavedList
            items={histMatches}
            empty="Nothing in your history yet."
            onPick={(f) => {
              setIngs([...ings, { name: f.name, serving: f.serving || "1 serving", per: f.per, servings: 1, fiber: f.fiber, sodium: f.sodium }]);
              setAdding(null);
              setQ("");
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-bold block" style={{ color: T.accentDeep }}>
        Recipe name
      </label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunday chili" className="w-full mt-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2" style={inputStyle} />

      <div className="flex items-center justify-between mt-4">
        <span className="text-sm font-bold">Makes how many servings?</span>
        <span className="inline-flex items-center rounded-full overflow-hidden" style={{ border: `1px solid ${T.hair}`, background: T.surface }}>
          <button type="button" aria-label="Fewer servings" onClick={() => setMakes(Math.max(1, makes - 1))} className="w-9 h-8 text-lg focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
            −
          </button>
          <input type="number" inputMode="numeric" aria-label="Servings the recipe makes" value={makes} min={1} max={48} onChange={(e) => setMakes(Math.max(1, Math.min(48, Math.round(Number(e.target.value)) || 1)))} className="w-12 h-8 text-center text-sm font-bold focus:outline-none" style={{ border: "none", background: "transparent" }} />
          <button type="button" aria-label="More servings" onClick={() => setMakes(Math.min(48, makes + 1))} className="w-9 h-8 text-lg focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
            +
          </button>
        </span>
      </div>

      <div className="text-xs font-bold mt-4" style={{ color: T.accentDeep }}>
        Ingredients (the whole recipe)
      </div>
      <ul className="mt-1">
        {ings.map((i, k) => (
          <li key={k} className="py-2 flex items-center justify-between gap-3 text-sm" style={{ borderTop: `1px solid ${T.hair}` }}>
            <span className="min-w-0">
              <span className="block font-bold truncate">{i.name}</span>
              <span className="block text-xs" style={{ color: T.muted }}>
                {i.serving}
                {i.servings && i.servings !== 1 ? ` × ${fmtServ(i.servings)}` : ""} · {perSummary(perFor(i))}
              </span>
            </span>
            <span className="shrink-0 flex items-center gap-2">
              {i.per && (
                <select aria-label="Servings of this ingredient" value={i.servings || 1} onChange={(e) => setIngs(ings.map((x, j) => (j === k ? { ...x, servings: Number(e.target.value) } : x)))} className="rounded-lg px-2 py-1 text-xs" style={inputStyle}>
                  {[0.5, 1, 1.5, 2, 3, 4, 6, 8].map((v) => (
                    <option key={v} value={v}>
                      × {fmtServ(v)}
                    </option>
                  ))}
                </select>
              )}
              <button onClick={() => setIngs(ings.filter((_, j) => j !== k))} aria-label={`Remove ${i.name}`} className="rounded-full p-1 focus:outline-none focus-visible:ring-2" style={{ color: T.muted }}>
                <Trash2 size={16} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 mt-2">
        <button onClick={() => setAdding("usda")} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ background: T.tint, color: T.accentDeep }}>
          <Search size={14} strokeWidth={2.5} aria-hidden="true" /> Add from foods
        </button>
        <button onClick={() => setAdding("history")} className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ background: T.tint, color: T.accentDeep }}>
          <Clock size={14} strokeWidth={2.5} aria-hidden="true" /> Add from history
        </button>
      </div>

      {ings.length > 0 && (
        <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: T.surface, border: `1px solid ${T.hair}` }}>
          <div className="font-bold" style={{ color: T.accentDeep }}>
            Per serving (1 of {makes}): {perSummary(perServing)}
          </div>
          <div className="text-xs mt-1" style={{ color: T.muted }}>
            Whole recipe: {perSummary(total)}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-4 mb-2">
        <button onClick={save} disabled={!ready2} className="rounded-full px-5 py-2.5 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ background: T.accent, color: "#fff", opacity: ready2 ? 1 : 0.5 }}>
          Save recipe
        </button>
        <button onClick={onCancel} className="rounded-full px-4 py-2.5 text-sm focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep, border: `1px solid ${T.hair}` }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
