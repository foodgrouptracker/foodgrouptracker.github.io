import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { DAYS_SHORT, GROUPS, HARD_MAX, decodePlan, isoDate, normalizePlan, scheduleText } from "../model.js";
import { T } from "../theme.js";

export function PlanScreen({ plan, onApply, onBack }) {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState(null); // {ok, text}
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  const apply = () => {
    try {
      const p = decodePlan(code);
      onApply(p);
      setCode("");
      setMsg({ ok: true, text: `Plan updated: ${p.base.name}, ${p.base.kcal.toLocaleString()} calories.` });
    } catch {
      setMsg({ ok: false, text: "That doesn't look like a plan link. Paste the whole link your dietitian sent." });
    }
  };

  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(plan)));
    setEditing(true);
    setMsg(null);
  };
  const saveEdit = () => {
    onApply(normalizePlan(draft));
    setEditing(false);
    setMsg({ ok: true, text: "Plan saved." });
  };

  const options = [plan.base, ...plan.variants];

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="Back to today" className="rounded-full p-1 -ml-2 focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
        <h1 className="text-2xl font-bold" style={{ color: T.accentDeep }}>
          Plan
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto mt-3" style={{ minHeight: 0 }}>
        {!editing && (
          <>
            <div className="grid gap-3">
              {options.map((p, pi) => (
                <PlanCard key={pi} p={p} base={plan.base} />
              ))}
            </div>

            {plan.requireFoods && (
              <p className="mt-3 text-xs" style={{ color: T.muted }}>
                Boxes on this plan are checked by logging foods, not by tapping.
              </p>
            )}
            {plan.notes && (
              <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: T.tint, color: T.ink }}>
                <div className="text-xs font-bold mb-1" style={{ color: T.accentDeep }}>
                  From your dietitian
                </div>
                {plan.notes}
              </div>
            )}

            <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${T.hair}` }}>
              <label htmlFor="planCode" className="text-sm font-bold block">
                Have a link from your dietitian?
              </label>
              <p className="text-xs mt-1" style={{ color: T.muted }}>
                Paste it here. In the installed app, opening the link does this automatically.
              </p>
              <div className="flex gap-2 mt-2">
                <input
                  id="planCode"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="https://…#plan=…"
                  className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
                  style={{ border: `1px solid ${T.hair}`, background: T.surface, color: T.ink, minWidth: 0 }}
                />
                <button
                  onClick={apply}
                  disabled={!code.trim()}
                  className="rounded-full px-4 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2"
                  style={{ background: T.accent, color: "#fff", opacity: code.trim() ? 1 : 0.5 }}
                >
                  Apply
                </button>
              </div>
              {msg && (
                <p className="text-sm mt-2" style={{ color: msg.ok ? T.accent : "#9A3B2E" }} role="status">
                  {msg.text}
                </p>
              )}
            </div>

            <div className="mt-5 pt-4 text-xs" style={{ borderTop: `1px solid ${T.hair}`, color: T.muted }}>
              Your dietitian set this plan. You can change it here, but changes are yours, not theirs.
              <div className="mt-2">
                <button onClick={startEdit} className="font-bold focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
                  Edit plan
                </button>
              </div>
            </div>
            <p className="mt-4 text-xs" style={{ color: T.muted }}>
              Everything is saved on this device only.
            </p>
          </>
        )}

        {editing && draft && (
          <PlanEditor
            draft={draft}
            setDraft={setDraft}
            onCancel={() => setEditing(false)}
            onSave={saveEdit}
          />
        )}
      </div>
    </>
  );
}


export function PlanCard({ p, base }) {
  return (
    <div className="rounded-lg p-3" style={{ background: T.surface, border: `1px solid ${T.hair}` }}>
      <div className="flex items-baseline justify-between mb-1">
        <b style={{ color: T.accentDeep }}>{p.name}</b>
        <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: T.accent, color: "#fff" }}>
          {p.kcal.toLocaleString()} calories
        </span>
      </div>
      {p.schedule && (
        <div className="text-xs mb-1" style={{ color: T.muted }}>
          {scheduleText(p.schedule)}
        </div>
      )}
      {GROUPS.filter((g) => p.counts[g.id] > 0).map((g) => {
        const n = p.counts[g.id];
        const b = base.counts[g.id];
        return (
          <div key={g.id} className="flex items-center justify-between py-1 text-sm" style={{ borderTop: `1px solid ${T.hair}` }}>
            <span>
              {g.label}
              {g.unit ? ` (${g.unit})` : ""}
            </span>
            <span className="flex gap-1 items-center flex-wrap justify-end" style={{ maxWidth: 170 }}>
              <span className="text-xs mr-1" style={{ color: T.muted }}>
                {n}
              </span>
              {Array.from({ length: n }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 2,
                    border: i >= b ? `1.5px dashed ${T.accent}` : `1.5px solid #9AA6A1`,
                    background: T.surface,
                    display: "inline-block",
                  }}
                />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}


export function PlanEditor({ draft, setDraft, onCancel, onSave }) {
  const upd = (fn) => setDraft((d) => {
    const n = JSON.parse(JSON.stringify(d));
    fn(n);
    return n;
  });
  const options = [draft.base, ...draft.variants];

  const Stepper = ({ value, onChange, label }) => (
    <span className="inline-flex items-center rounded-full overflow-hidden" style={{ border: `1px solid ${T.hair}`, background: T.surface }}>
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(0, value - 1))} className="w-9 h-8 text-lg focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={`${label} servings`}
        value={value}
        min={0}
        max={HARD_MAX}
        onChange={(e) => onChange(Math.max(0, Math.min(HARD_MAX, Math.round(Number(e.target.value) || 0))))}
        className="w-10 h-8 text-center text-sm font-bold focus:outline-none"
        style={{ border: "none", background: "transparent", MozAppearance: "textfield" }}
      />
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(Math.min(HARD_MAX, value + 1))} className="w-9 h-8 text-lg focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
        +
      </button>
    </span>
  );

  const DayChips = ({ days, onChange }) => (
    <div className="flex gap-1.5 flex-wrap mt-1">
      {DAYS_SHORT.map((d, di) => {
        const on = days.includes(di);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? days.filter((x) => x !== di) : [...days, di].sort())}
            className="rounded-full text-xs focus:outline-none focus-visible:ring-2"
            style={{
              width: 36,
              height: 30,
              border: `1px solid ${on ? T.accent : T.hair}`,
              background: on ? T.accent : T.surface,
              color: on ? "#fff" : T.muted,
              fontWeight: on ? 700 : 400,
            }}
          >
            {d}
          </button>
        );
      })}
    </div>
  );

  return (
    <div>
      {options.map((p, pi) => (
        <div key={pi} className="rounded-lg p-3 mb-3" style={{ background: T.surface, border: `1px solid ${T.hair}` }}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold" style={{ color: T.accentDeep }}>
              {pi === 0 ? "Standard plan" : `Variant ${pi}`}
            </span>
            {pi > 0 && (
              <button onClick={() => upd((n) => n.variants.splice(pi - 1, 1))} className="text-xs focus:outline-none focus-visible:ring-2" style={{ color: T.muted }}>
                Remove
              </button>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              aria-label="Plan name"
              value={p.name}
              maxLength={24}
              onChange={(e) => upd((n) => ((pi === 0 ? n.base : n.variants[pi - 1]).name = e.target.value))}
              className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
              style={{ border: `1px solid ${T.hair}`, minWidth: 0 }}
            />
            <div className="flex items-center gap-1">
              <input
                aria-label="Calories"
                type="number"
                inputMode="numeric"
                value={p.kcal}
                step={50}
                onChange={(e) => upd((n) => ((pi === 0 ? n.base : n.variants[pi - 1]).kcal = Number(e.target.value) || 0))}
                className="w-20 rounded-lg px-2 py-2 text-sm focus:outline-none focus-visible:ring-2"
                style={{ border: `1px solid ${T.hair}` }}
              />
              <span className="text-xs" style={{ color: T.muted }}>
                cal
              </span>
            </div>
          </div>
          {pi > 0 && (
            <div className="mt-2">
              <label className="text-xs block" style={{ color: T.muted }}>
                Schedule
              </label>
              <select
                value={p.schedule?.type || ""}
                onChange={(e) =>
                  upd((n) => {
                    const t = e.target.value;
                    n.variants[pi - 1].schedule =
                      t === "weekly" ? { type: "weekly", days: [] } : t === "every" ? { type: "every", n: 3, start: isoDate(new Date()) } : t === "perweek" ? { type: "perweek", n: 2 } : null;
                  })
                }
                className="w-full mt-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
                style={{ border: `1px solid ${T.hair}`, background: T.surface }}
              >
                <option value="">None, I switch to it by hand</option>
                <option value="weekly">Certain days of the week</option>
                <option value="every">Every N days</option>
                <option value="perweek">N days a week, my choice</option>
              </select>
              {p.schedule?.type === "weekly" && (
                <DayChips days={p.schedule.days} onChange={(days) => upd((n) => (n.variants[pi - 1].schedule.days = days))} />
              )}
              {p.schedule?.type === "every" && (
                <div className="flex items-center gap-2 mt-2 text-sm flex-wrap">
                  Every
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={14}
                    value={p.schedule.n}
                    onChange={(e) => upd((n) => (n.variants[pi - 1].schedule.n = Math.max(2, Math.min(14, Math.round(Number(e.target.value)) || 3))))}
                    className="w-14 rounded-lg px-2 py-1 text-sm focus:outline-none focus-visible:ring-2"
                    style={{ border: `1px solid ${T.hair}` }}
                  />
                  days, starting
                  <input
                    type="date"
                    value={p.schedule.start}
                    onChange={(e) => upd((n) => (n.variants[pi - 1].schedule.start = e.target.value || isoDate(new Date())))}
                    className="rounded-lg px-2 py-1 text-sm focus:outline-none focus-visible:ring-2"
                    style={{ border: `1px solid ${T.hair}` }}
                  />
                </div>
              )}
              {p.schedule?.type === "perweek" && (
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={6}
                    value={p.schedule.n}
                    onChange={(e) => upd((n) => (n.variants[pi - 1].schedule.n = Math.max(1, Math.min(6, Math.round(Number(e.target.value)) || 2))))}
                    className="w-14 rounded-lg px-2 py-1 text-sm focus:outline-none focus-visible:ring-2"
                    style={{ border: `1px solid ${T.hair}` }}
                  />
                  days a week
                </div>
              )}
            </div>
          )}
          {GROUPS.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-1.5 text-sm" style={{ borderTop: `1px solid ${T.hair}` }}>
              <span>{g.label}</span>
              <Stepper
                label={g.label}
                value={p.counts[g.id]}
                onChange={(v) => upd((n) => ((pi === 0 ? n.base : n.variants[pi - 1]).counts[g.id] = v))}
              />
            </div>
          ))}
        </div>
      ))}

      {draft.variants.length < 8 && (
        <button
          onClick={() => upd((n) => n.variants.push({ name: "", kcal: n.base.kcal, counts: { ...n.base.counts }, schedule: null }))}
          className="text-sm font-bold focus:outline-none focus-visible:ring-2"
          style={{ color: T.accentDeep }}
        >
          Add a variant
        </button>
      )}

      <label className="flex items-center gap-2 mt-4 text-sm">
        <input type="checkbox" checked={!!draft.requireFoods} onChange={(e) => upd((n) => (n.requireFoods = e.target.checked))} />
        Boxes can only be checked by logging a food
      </label>

      <label className="block text-xs font-bold mt-4" style={{ color: T.accentDeep }}>
        Notes
      </label>
      <textarea
        value={draft.notes}
        maxLength={300}
        onChange={(e) => upd((n) => (n.notes = e.target.value))}
        className="w-full mt-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus-visible:ring-2"
        style={{ border: `1px solid ${T.hair}`, minHeight: 60 }}
      />

      <div className="flex gap-2 mt-4 mb-2">
        <button onClick={onSave} className="rounded-full px-5 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ background: T.accent, color: "#fff" }}>
          Save plan
        </button>
        <button onClick={onCancel} className="rounded-full px-4 py-2 text-sm focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep, border: `1px solid ${T.hair}` }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

