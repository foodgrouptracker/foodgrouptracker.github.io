import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, List, Plus } from "lucide-react";
import { FREE_ROWS, GAP, GROUPS, PER_LINE, ROW_CHROME, halfText, longDate } from "../model.js";
import { T } from "../theme.js";

export function TodayScreen({ plan, options, variant, current, counts, weekUsage, onTap, onPickVariant, onOpenPlan, onAddFood, onOpenLog, onOpenHistory, entryCount, reduceMotion }) {
  const locked = !!plan.requireFoods; // boxes only change through the food log
  const [box, setBox] = useState(34);
  const [justTapped, setJustTapped] = useState(null);
  const rowsRef = useRef(null);
  const maxBoxes = Math.max(1, ...options.flatMap((o) => Object.values(o.counts)));

  const targets = current.counts;
  const baseTargets = plan.base.counts;
  const rows = GROUPS.filter((g) => targets[g.id] > 0); // a 0-box row is not part of this plan
  const linesFor = (n) => Math.max(1, Math.ceil(n / PER_LINE));
  // Boxes shown per row: the target, or more when the row has gone past it, plus one "+" box once full.
  const shown = (id) => Math.max(targets[id], Math.ceil(counts[id])) + (counts[id] >= targets[id] ? 1 : 0);
  const layoutKey = GROUPS.map((g) => shown(g.id)).join(".");
  const maxShown = Math.max(1, ...rows.map((g) => shown(g.id)));
  const [slack, setSlack] = useState(0); // extra vertical space per row so the grid fills the screen

  useEffect(() => {
    const el = rowsRef.current;
    if (!el) return;
    const measure = () => {
      const perLine = Math.min(Math.max(maxBoxes, maxShown), PER_LINE);
      const byWidth = Math.floor((el.clientWidth - (perLine - 1) * GAP) / perLine);
      // Size as if all seven rows were present, so hiding a row never changes the
      // others: remaining rows keep their size and simply move up.
      const totalLines = GROUPS.reduce((s, g) => s + linesFor(shown(g.id)), 0);
      const hairlines = GROUPS.length - 1;
      const fixed = GROUPS.reduce((s, g) => s + ROW_CHROME + (linesFor(shown(g.id)) - 1) * GAP, 0) + hairlines;
      const byHeight = Math.floor((el.clientHeight - fixed) / totalLines);
      const b = Math.max(22, Math.min(40, byWidth, byHeight));
      const sl = Math.max(0, Math.floor(((el.clientHeight - fixed - totalLines * b) / GROUPS.length) * 2) / 2);
      setBox((prev) => (prev === b ? prev : b));
      setSlack((prev) => (prev === sl ? prev : sl));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxBoxes, layoutKey]);

  const allDone = rows.length > 0 && rows.every((g) => counts[g.id] >= targets[g.id]);
  const labelSize = box >= 32 ? 15 : 13;

  // One quiet moment when the day completes: the check pops in with a soft ring.
  const wasDone = useRef(allDone);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (allDone && !wasDone.current) {
      setCelebrate(true);
      const id = setTimeout(() => setCelebrate(false), 1000);
      wasDone.current = allDone;
      return () => clearTimeout(id);
    }
    wasDone.current = allDone;
  }, [allDone]);

  // Long press on an empty box adds a half serving; a normal tap adds a whole one.
  const pressTimer = useRef(null);
  const pressed = useRef(false);
  const startPress = (id, i, canHalf) => {
    pressed.current = false;
    if (!canHalf) return;
    pressTimer.current = setTimeout(() => {
      pressed.current = true;
      onTap(id, i, true);
      setJustTapped(`${id}:${i}`);
      if (!reduceMotion) setTimeout(() => setJustTapped(null), 160);
    }, 450);
  };
  const endPress = () => {
    clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const tap = (id, i) => {
    if (pressed.current) {
      pressed.current = false; // the long press already handled this interaction
      return;
    }
    onTap(id, i);
    setJustTapped(`${id}:${i}`);
    if (!reduceMotion) setTimeout(() => setJustTapped(null), 160);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <button onClick={onOpenHistory} aria-label={`${longDate()}. View history.`} className="flex items-center gap-0.5 text-xs truncate focus:outline-none focus-visible:ring-2 rounded" style={{ color: T.muted }}>
          {longDate()}
          <ChevronRight size={12} strokeWidth={2.5} aria-hidden="true" />
        </button>
        <button
          onClick={onOpenPlan}
          aria-label={`${current.kcal.toLocaleString()} calories. View plan.`}
          className="shrink-0 flex items-center gap-1 rounded-full pl-3 pr-2 py-1 text-xs font-bold focus:outline-none focus-visible:ring-2"
          style={{ background: T.accent, color: "#FFFFFF" }}
        >
          {current.kcal.toLocaleString()} calories
          <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mt-1">
        <h1 className="text-2xl font-bold leading-tight flex items-center gap-2 min-w-0" style={{ color: T.accentDeep }}>
          Today
          {allDone && (
            <span className={`flex items-center justify-center ${celebrate ? "fgt-pop fgt-ring" : ""}`} style={{ width: 26, height: 26 }}>
              <Check size={22} strokeWidth={3} aria-hidden="true" />
            </span>
          )}
        </h1>
        <span className="sr-only" aria-live="polite">
          {allDone ? "Every row is complete for today." : ""}
        </span>

        {plan.variants.length > 0 && options.length <= 3 && (
          <div role="radiogroup" aria-label="Plan for today" className="inline-flex rounded-full p-0.5 shrink-0" style={{ background: T.tint }}>
            {options.map((v, i) => {
              const on = i === variant;
              return (
                <button
                  key={i}
                  role="radio"
                  aria-checked={on}
                  onClick={() => onPickVariant(i)}
                  className="rounded-full px-3 py-1.5 text-xs focus:outline-none focus-visible:ring-2"
                  style={{
                    background: on ? T.surface : "transparent",
                    color: on ? T.accentDeep : T.muted,
                    fontWeight: on ? 700 : 400,
                    boxShadow: on ? "0 1px 2px rgba(34,48,43,0.12)" : "none",
                  }}
                >
                  {v.name}
                </button>
              );
            })}
          </div>
        )}
        {plan.variants.length > 0 && options.length > 3 && (
          <select
            aria-label="Plan for today"
            value={variant}
            onChange={(e) => onPickVariant(Number(e.target.value))}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold focus:outline-none focus-visible:ring-2"
            style={{ background: T.tint, color: T.accentDeep, border: "none" }}
          >
            {options.map((v, i) => (
              <option key={i} value={i}>
                {v.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div ref={rowsRef} className="fgt-noselect flex-1 flex flex-col justify-start mt-2" style={{ minHeight: 0, overflow: "hidden" }}>
        {rows.map((g, gi) => {
          const target = targets[g.id];
          const base = baseTargets[g.id];
          const have = counts[g.id];
          const left = Math.max(target - have, 0);
          const over = Math.max(have - target, 0);
          const free = FREE_ROWS.includes(g.id);
          const total = shown(g.id);
          const fullBoxes = Math.floor(have);
          const hasHalf = have - fullBoxes >= 0.5;
          const status =
            target === 0 && have === 0 ? "" : left > 0 ? `${halfText(left)} left` : over > 0 && !free ? `${halfText(over)} over` : "Done";
          const statusColor = left > 0 ? T.muted : over > 0 && !free ? T.overInk : T.accent;
          return (
            <section key={g.id} style={{ borderTop: gi === 0 ? "none" : `1px solid ${T.hair}`, paddingTop: 8 + slack / 2, paddingBottom: 8 + slack / 2 }}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-bold leading-none" style={{ fontSize: labelSize }}>
                  {g.label}
                  {g.unit && (
                    <span className="ml-1 font-normal" style={{ color: T.muted }}>
                      ({g.unit})
                    </span>
                  )}
                  {g.swap && (
                    <span aria-hidden="true" className="ml-0.5" style={{ color: T.accent }}>
                      *
                    </span>
                  )}
                </h2>
                <span className="leading-none" style={{ fontSize: labelSize - 2, color: statusColor }}>
                  {status}
                </span>
              </div>
              <div className="flex flex-col" style={{ gap: GAP, marginTop: 6, minHeight: box }} role="group" aria-label={`${g.label}, ${halfText(have)} of ${target}`}>
                {Array.from({ length: linesFor(total) }).map((_, li) => (
                  <div key={li} className="flex" style={{ gap: GAP }}>
                    {Array.from({ length: Math.min(PER_LINE, total - li * PER_LINE) }).map((_, k) => {
                      const i = li * PER_LINE + k;
                      const filled = i < fullBoxes;
                      const half = i === fullBoxes && hasHalf;
                      const isPlus = i === total - 1 && have >= target; // trailing + box
                      const isOver = i >= target && !free; // beyond the plan on a limited row
                      const extra = i >= base && i < target; // variant-only box
                      const pop = justTapped === `${g.id}:${i}`;
                      const fillColor = isOver ? T.over : T.accent;
                      let background = T.surface;
                      if (filled) background = fillColor;
                      else if (half) background = `linear-gradient(135deg, ${fillColor} 50%, ${T.surface} 50%)`;
                      const border = filled || half ? `1.5px solid ${fillColor}` : isPlus ? `1.5px dashed ${isOver ? T.overBorder : T.hair}` : extra ? `1.5px dashed ${T.accent}` : `1.5px solid ${T.hair}`;
                      const canHalf = !filled && !half; // long press adds a half here
                      const label = isPlus
                        ? `${g.label}: add another${isOver ? " beyond plan" : ""}`
                        : `${g.label} serving ${i + 1}${filled ? ", checked" : half ? ", half" : ""}${isOver ? ", beyond plan" : extra ? `, ${current.name} box` : ""}`;
                      const Tag = locked && !isPlus ? "div" : "button";
                      return (
                        <Tag
                          key={i}
                          onClick={locked ? (isPlus ? onAddFood : undefined) : () => tap(g.id, i)}
                          onPointerDown={locked ? undefined : () => startPress(g.id, i, canHalf)}
                          onPointerUp={locked ? undefined : endPress}
                          onPointerLeave={locked ? undefined : endPress}
                          onPointerCancel={locked ? undefined : endPress}
                          onContextMenu={(e) => e.preventDefault()}
                          aria-label={locked && isPlus ? `${g.label}: log a food` : label}
                          aria-pressed={locked && !isPlus ? undefined : filled}
                          role={locked && !isPlus ? "img" : undefined}
                          className="flex items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2"
                          style={{
                            width: box,
                            height: box,
                            background,
                            border,
                            opacity: isPlus ? 0.7 : 1,
                            transform: pop ? "scale(0.88)" : "scale(1)",
                            transition: reduceMotion ? "none" : "transform 120ms ease-out, background 120ms",
                            touchAction: "manipulation",
                            WebkitTouchCallout: "none",
                            userSelect: "none",
                          }}
                        >
                          {filled && <Check size={Math.round(box * 0.5)} strokeWidth={3} color="#FFFFFF" />}
                          {isPlus && <Plus size={Math.round(box * 0.45)} strokeWidth={2} color={isOver ? T.overInk : T.muted} />}
                        </Tag>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3" style={{ borderTop: `1px solid ${T.hair}`, paddingTop: 8, marginTop: 4 }}>
        <p className="text-xs leading-snug" style={{ color: T.muted }}>
          <span style={{ color: T.accent }}>*</span> Starch, Fruit, and Milk/Yogurt boxes can stand in for one another.
          {plan.variants.length > 0 && <> Dashed boxes: {plan.variants.map((v) => v.name).join(" / ")}.</>}
          {locked && <> Boxes are checked by logging foods.</>}
          {weekUsage.map((u) => (
            <span key={u.name}>
              {" "}
              {u.name}: {u.used} of {u.n} day{u.n === 1 ? "" : "s"} used this week.
            </span>
          ))}
        </p>
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={onOpenLog}
            aria-label={`Today's log, ${entryCount} ${entryCount === 1 ? "entry" : "entries"}`}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold focus:outline-none focus-visible:ring-2"
            style={{ color: T.accentDeep, border: `1px solid ${T.hair}`, background: T.surface }}
          >
            <List size={14} strokeWidth={2.5} aria-hidden="true" />
            {entryCount}
          </button>
          <button
            onClick={onAddFood}
            className="flex items-center gap-1 rounded-full pl-2 pr-3 py-1.5 text-xs font-bold focus:outline-none focus-visible:ring-2"
            style={{ background: T.tint, color: T.accentDeep }}
          >
            <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
            Add food
          </button>
        </div>
      </div>
    </>
  );
}

