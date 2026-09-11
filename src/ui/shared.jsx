import { GROUPS, SERVING_CHOICES, addedText, applyExchanges, roundBoxes, tagsFor } from "../model.js";
import { T } from "../theme.js";

export function ServingsPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Servings eaten">
      {SERVING_CHOICES.map((s) => {
        const on = s === value;
        return (
          <button
            key={s}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(s)}
            className="rounded-full px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2"
            style={{ background: on ? T.accent : T.surface, color: on ? "#fff" : T.ink, border: `1px solid ${on ? T.accent : T.hair}`, fontWeight: on ? 700 : 400 }}
          >
            {s === 0.5 ? "½" : s === 1.5 ? "1½" : s}
          </button>
        );
      })}
    </div>
  );
}


export function PreviewAdd({ per, servings, counts, targets }) {
  const add = Object.fromEntries(GROUPS.map((g) => [g.id, roundBoxes(g.id, (per[g.id] || 0) * servings)]));
  const r = applyExchanges(counts, targets, add);
  const txt = addedText(r.added);
  return (
    <div className="rounded-lg p-3 text-sm" style={{ background: T.tint }}>
      <div className="font-bold" style={{ color: T.accentDeep }}>
        {txt ? `Will check: ${txt}` : "Adds no boxes"}
      </div>
      {r.notes.map((n, i) => (
        <div key={i} className="mt-0.5 text-xs" style={{ color: T.muted }}>
          {n}
        </div>
      ))}
    </div>
  );
}


export function Tags({ food }) {
  const t = tagsFor(food);
  if (!t.length) return null;
  return (
    <span className="flex gap-1 flex-wrap mt-1">
      {t.map((x) => (
        <span key={x} className="rounded-full px-2 py-0.5 text-xs" style={{ background: x.startsWith("High") ? "#F3E9D2" : T.tint, color: x.startsWith("High") ? T.overInk : T.accentDeep }}>
          {x}
        </span>
      ))}
    </span>
  );
}

