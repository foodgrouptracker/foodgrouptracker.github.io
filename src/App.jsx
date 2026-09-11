import { useEffect, useMemo, useRef, useState } from "react";
import {
  GROUPS, emptyCounts, todayKey, weekKeys, normalizePlan, scheduledVariant, decodePlan,
  roundBoxes, applyExchanges, normalizeEntries,
} from "./model.js";
import { T } from "./theme.js";
import { storeGet, storeSet } from "./storage.js";
import { isStandalone, planCodeFromLocation, clearPlanFromLocation } from "./platform.js";
import { TodayScreen } from "./ui/Today.jsx";
import { PlanScreen } from "./ui/Plan.jsx";
import { AddFoodScreen } from "./ui/AddFood.jsx";
import { LogScreen } from "./ui/Log.jsx";
import { HistoryScreen } from "./ui/History.jsx";
import { InstallScreen } from "./ui/Install.jsx";
import { SetupScreen } from "./ui/Setup.jsx";
import { Onboarding } from "./ui/Onboarding.jsx";
import { HelpScreen } from "./ui/Help.jsx";

const REQUIRE_INSTALL = import.meta.env.VITE_REQUIRE_INSTALL !== "false"; // set false for desktop dev

export default function App() {
  const dayKey = useMemo(todayKey, []);
  const [view, setView] = useState("today");
  const [plan, setPlan] = useState(null); // null until loaded; false = no plan yet
  const [variant, setVariant] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [weekDays, setWeekDays] = useState({});
  const [foods, setFoods] = useState([]);
  const [entries, setEntries] = useState([]);
  const [onboarded, setOnboarded] = useState(true);
  const [toast, setToast] = useState(null); // {title, detail, key}
  const toastTimer = useRef(null);
  const notify = (title, detail = "", ms = 2800) => {
    clearTimeout(toastTimer.current);
    setToast({ title, detail, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  const [planNotice, setPlanNoticeRaw] = useState(null);
  const setPlanNotice = (msg) => {
    setPlanNoticeRaw(null);
    if (msg) notify(msg, "", 4000);
  };
  const [helpStart, setHelpStart] = useState(null);
  const reduceMotion = useRef(false);
  const standalone = REQUIRE_INSTALL ? isStandalone() : true;

  useEffect(() => {
    reduceMotion.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const others = weekKeys().filter((k) => k !== dayKey);
    Promise.all([
      storeGet("fgt:plan"),
      storeGet(`fgt:day:${dayKey}`),
      storeGet("fgt:foods"),
      storeGet("fgt:onboarded"),
      storeGet("fgt:applied-codes"),
      ...others.map((k) => storeGet(`fgt:day:${k}`)),
    ]).then(([p, d, f, ob, applied, ...rest]) => {
      const wk = {};
      others.forEach((k, i) => {
        if (rest[i]) wk[k] = rest[i];
      });
      setWeekDays(wk);
      if (Array.isArray(f)) setFoods(f);
      setOnboarded(!!ob);

      let pl = false;
      if (p) {
        try {
          pl = normalizePlan(p);
        } catch {
          pl = false;
        }
      }

      // A plan in the URL is applied once. Codes seen before are ignored, so the
      // iPhone home-screen launch URL (which keeps the hash) can't re-apply an old plan.
      const code = planCodeFromLocation();
      const seen = Array.isArray(applied) ? applied : [];
      if (code && standalone && !seen.includes(code)) {
        try {
          const fromLink = decodePlan(code);
          pl = fromLink;
          storeSet("fgt:plan", fromLink);
          storeSet("fgt:applied-codes", [...seen, code].slice(-20));
          setPlanNotice(`Plan updated: ${fromLink.base.name}, ${fromLink.base.kcal.toLocaleString()} calories.`);
        } catch {
          setPlanNotice("The link you opened didn't contain a valid plan.");
        }
      }
      if (standalone) clearPlanFromLocation();

      setPlan(pl);
      if (pl) {
        if (d) {
          setVariant(Math.min(d.variant ?? 0, pl.variants.length));
          if (Array.isArray(d.entries) && d.entries.length) setEntries(d.entries);
          else if (d.counts && GROUPS.some((g) => d.counts[g.id] > 0)) {
            const t0 = new Date();
            t0.setHours(0, 0, 0, 0);
            setEntries([{ type: "tap", t: t0.getTime(), name: "Earlier today", added: { ...emptyCounts(), ...d.counts } }]);
          }
        } else {
          setVariant(scheduledVariant(pl));
        }
      }
      setLoaded(true);
    });
  }, [dayKey, standalone]);

  const options = plan ? [plan.base, ...plan.variants] : [];
  const current = plan ? options[variant] ?? plan.base : null;

  const counts = useMemo(() => {
    const c = emptyCounts();
    for (const e of entries) for (const g of GROUPS) c[g.id] = Math.max(0, Math.round((c[g.id] + (e.added?.[g.id] || 0)) * 2) / 2);
    return c;
  }, [entries]);

  useEffect(() => {
    if (!loaded || !current) return;
    storeSet(`fgt:day:${dayKey}`, { date: dayKey, counts, variant, planName: current.name, kcal: current.kcal, targets: current.counts, entries });
  }, [counts, variant, loaded, dayKey, current, entries]);

  const applyPlan = (p) => {
    setPlan(p);
    storeSet("fgt:plan", p);
    setPlanNotice(null);
    const opts = [p.base, ...p.variants];
    const nothingLogged = entries.length === 0;
    setVariant(nothingLogged ? scheduledVariant(p) : Math.min(variant, opts.length - 1));
  };

  const pickVariant = (i) => setVariant(i);

  // Tap semantics (counts move in half steps):
  //  - tap an empty box: +1 (or +½ when `half` is set by a long press)
  //  - tap the half-filled box: complete it (+½)
  //  - tap any filled box: remove the last step (−½ if a half is pending, else −1)
  //  - the row's trailing + box (shown when the row is full) adds beyond the target
  // Every tap is a log entry; consecutive taps on one row merge into one line.
  const tap = (id, index, half = false) => {
    const cur = counts[id];
    const full = Math.floor(cur);
    const hasHalf = cur - full >= 0.5;
    let next;
    if (index < full) next = hasHalf ? cur - 0.5 : cur - 1;
    else if (index === full && hasHalf) next = cur + 0.5;
    else next = cur + (half ? 0.5 : 1);
    next = Math.max(0, Math.round(next * 2) / 2);
    const delta = next - cur;
    if (delta === 0) return;
    setEntries((e) => {
      const now = Date.now();
      const last = e[e.length - 1];
      const lastDelta = last?.added?.[id] || 0;
      if (last && last.type === "tap" && last.row === id && now - last.t < 120000 && (lastDelta === 0 || Math.sign(lastDelta) === Math.sign(delta))) {
        const d = Math.round((lastDelta + delta) * 2) / 2;
        if (d === 0) return e.slice(0, -1);
        return [...e.slice(0, -1), { ...last, t: now, added: { [id]: d } }];
      }
      return [...e, { type: "tap", t: now, row: id, added: { [id]: delta } }];
    });
  };

  // Log a food: add its boxes to today, spilling Starch/Fruit/Milk into one
  // another when a row is full (the interchange rule), and record the entry.
  // Log a food. Anything logged is kept in History (deduplicated), so it's one tap next time.
  const logFood = (food, servings) => {
    const add = Object.fromEntries(GROUPS.map((g) => [g.id, roundBoxes(g.id, (food.per[g.id] || 0) * servings)]));
    const result = applyExchanges(counts, current.counts, add);
    setEntries((e) => [
      ...e,
      { type: "food", t: Date.now(), name: food.name, servings, per: food.per, source: food.source, fiber: food.fiber ?? null, sodium: food.sodium ?? null, added: result.added },
    ]);
    setFoods((fs) => {
      const same = (a, b) => a.id === b.id || (a.fdcId && a.fdcId === b.fdcId && a.serving === b.serving) || (a.name === b.name && a.serving === b.serving && a.source === b.source);
      const existing = fs.find((f) => same(f, food));
      const rec = { ...(existing || { id: `f${Date.now().toString(36)}` }), ...food, id: (existing || {}).id || food.id || `f${Date.now().toString(36)}`, uses: ((existing || {}).uses || 0) + 1, lastUsed: Date.now() };
      const next = [...fs.filter((f) => f.id !== rec.id), rec].sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0)).slice(0, 400);
      storeSet("fgt:foods", next);
      return next;
    });
    return result;
  };

  const removeEntry = (t) => setEntries((e) => normalizeEntries(e.filter((x) => x.t !== t)));

  // Change servings on a food entry: take its boxes out, re-apply at the new amount.
  const changeServings = (t, servings) => {
    setEntries((e) => {
      const idx = e.findIndex((x) => x.t === t);
      if (idx < 0) return e;
      const entry = e[idx];
      const without = e.filter((x) => x.t !== t);
      const c = emptyCounts();
      for (const x of without) for (const g of GROUPS) c[g.id] = Math.max(0, c[g.id] + (x.added?.[g.id] || 0));
      const add = Object.fromEntries(GROUPS.map((g) => [g.id, roundBoxes(g.id, (entry.per?.[g.id] || 0) * servings)]));
      const r = applyExchanges(c, current.counts, add);
      const updated = { ...entry, servings, added: r.added };
      return normalizeEntries([...without.slice(0, idx), updated, ...without.slice(idx)]);
    });
  };

  const saveFood = (food) => {
    const withId = { ...food, id: food.id || `f${Date.now().toString(36)}`, uses: food.uses || 0, lastUsed: food.lastUsed || 0 };
    setFoods((fs) => {
      const next = [...fs.filter((f) => f.id !== withId.id), withId];
      storeSet("fgt:foods", next);
      return next;
    });
    return withId;
  };

  const deleteFood = (id) => {
    setFoods((fs) => {
      const next = fs.filter((f) => f.id !== id);
      storeSet("fgt:foods", next);
      return next;
    });
  };

  const finishOnboarding = () => {
    setOnboarded(true);
    storeSet("fgt:onboarded", true);
  };

  const weekUsage = plan
    ? plan.variants
        .map((v, i) => ({ v, i: i + 1 }))
        .filter(({ v }) => v.schedule && v.schedule.type === "perweek")
        .map(({ v, i }) => {
          const earlier = Object.values(weekDays).filter((r) => r.planName === v.name).length;
          return { name: v.name, used: earlier + (variant === i ? 1 : 0), n: v.schedule.n };
        })
    : [];

  let screen = null;
  if (!loaded) screen = null;
  else if (!standalone) {
    let summary = null;
    try {
      const code = planCodeFromLocation();
      if (code) {
        const p = decodePlan(code);
        summary = `${p.base.name}, ${p.base.kcal.toLocaleString()} calories`;
      }
    } catch {
      /* no summary */
    }
    screen = <InstallScreen planCode={planCodeFromLocation()} planSummary={summary} />;
  } else if (!plan) screen = <SetupScreen onApply={(p) => { applyPlan(p); setOnboarded(false); }} />;
  else if (!onboarded) screen = <Onboarding onDone={finishOnboarding} />;
  else if (view === "today")
    screen = (
      <>
        <TodayScreen
          plan={plan}
          options={options}
          variant={variant}
          current={current}
          counts={counts}
          weekUsage={weekUsage}
          onTap={tap}
          onPickVariant={pickVariant}
          onOpenPlan={() => setView("plan")}
          onAddFood={() => setView("add")}
          onOpenLog={() => setView("log")}
          onOpenHistory={() => setView("history")}
          entryCount={entries.length}
          reduceMotion={reduceMotion.current}
        />
      </>
    );
  else if (view === "plan")
    screen = (
      <PlanScreen
        plan={plan}
        onApply={applyPlan}
        onBack={() => setView("today")}
        onOpenHelp={(t) => {
          setHelpStart(t);
          setView("help");
        }}
      />
    );
  else if (view === "help") screen = <HelpScreen start={helpStart} onBack={() => setView("plan")} />;
  else if (view === "add") screen = <AddFoodScreen foods={foods} counts={counts} targets={current.counts} onLog={logFood} onSave={saveFood} onDelete={deleteFood} onBack={() => setView("today")} notify={notify} />;
  else if (view === "log") screen = <LogScreen entries={entries} counts={counts} targets={current.counts} onRemove={removeEntry} onChangeServings={changeServings} onBack={() => setView("today")} />;
  else if (view === "history")
    screen = (
      <HistoryScreen
        dayKey={dayKey}
        today={{ date: dayKey, counts, targets: current.counts, planName: current.name, kcal: current.kcal, entries }}
        plan={plan}
        onBack={() => setView("today")}
        onImported={() => window.location.reload()}
      />
    );

  return (
    <div className="fgt w-full flex justify-center" style={{ height: "100dvh", overflow: "hidden", background: T.paper, color: T.ink, fontFamily: T.font }}>
      <div className="w-full max-w-md h-full flex flex-col px-5" style={{ paddingTop: "max(16px, env(safe-area-inset-top))", paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
        {screen}
      </div>
      {/* iOS colors the status bar from the top rows of the page; keep them the page color while a banner shows. */}
      {toast && <div className="fixed inset-x-0 top-0 pointer-events-none" style={{ height: "calc(env(safe-area-inset-top, 0px) + 14px)", background: T.paper, zIndex: 60 }} aria-hidden="true" />}
      {toast && (
        <div className="fixed inset-x-0 flex justify-center pointer-events-none" style={{ top: "calc(env(safe-area-inset-top, 0px) + 14px)", zIndex: 50 }} role="status" aria-live="polite">
          <button
            key={toast.key}
            onClick={() => setToast(null)}
            className="fgt-toast pointer-events-auto mx-5 w-full max-w-md rounded-xl px-4 py-3 text-left text-sm focus:outline-none focus-visible:ring-2"
            style={{ background: T.accentDeep, color: "#fff", boxShadow: "0 12px 20px -8px rgba(34,48,43,0.35)" }}
          >
            <div className="font-bold">{toast.title}</div>
            {toast.detail && <div className="mt-0.5 text-xs" style={{ opacity: 0.9 }}>{toast.detail}</div>}
          </button>
        </div>
      )}
    </div>
  );
}
