import { useState } from "react";
import { T } from "../theme.js";
import { decodePlan, normalizePlan, GROUPS } from "../model.js";
import { PlanEditor } from "./Plan.jsx";

// First run with no plan yet.
export function SetupScreen({ onApply }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);

  const apply = () => {
    try {
      onApply(decodePlan(code));
    } catch {
      setErr("That doesn't look like a plan link. Paste the whole link your dietitian sent.");
    }
  };
  const startOwn = () => {
    setDraft({
      v: 1,
      base: { name: "Standard", kcal: 0, counts: Object.fromEntries(GROUPS.map((g) => [g.id, 0])) },
      variants: [],
      notes: "",
      requireFoods: false,
    });
    setEditing(true);
  };

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-2xl font-bold mt-2" style={{ color: T.accentDeep }}>
        Food Group Tracker
      </h1>
      {!editing && (
        <>
          <p className="text-sm mt-1" style={{ color: T.muted }}>
            Your dietitian sets your plan and sends it as a link. Open that link, or paste it here.
          </p>
          <label htmlFor="setupCode" className="text-sm font-bold block mt-6">
            Paste your plan link
          </label>
          <div className="flex gap-2 mt-2">
            <input
              id="setupCode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="https://…#plan=…"
              className="flex-1 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2"
              style={{ border: `1px solid ${T.hair}`, background: T.surface, color: T.ink, minWidth: 0 }}
            />
            <button onClick={apply} disabled={!code.trim()} className="rounded-full px-4 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ background: T.accent, color: "#fff", opacity: code.trim() ? 1 : 0.5 }}>
              Apply
            </button>
          </div>
          {err && (
            <p className="text-sm mt-2" role="status" style={{ color: "#9A3B2E" }}>
              {err}
            </p>
          )}
          <div className="mt-8 pt-4 text-sm" style={{ borderTop: `1px solid ${T.hair}` }}>
            <div style={{ color: T.muted }}>No link? You can set up a plan yourself.</div>
            <button onClick={startOwn} className="mt-2 font-bold focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
              Set up my own plan
            </button>
          </div>
        </>
      )}
      {editing && draft && (
        <div className="flex-1 overflow-y-auto mt-3" style={{ minHeight: 0 }}>
          <PlanEditor draft={draft} setDraft={setDraft} onCancel={() => setEditing(false)} onSave={() => onApply(normalizePlan(draft))} />
        </div>
      )}
    </div>
  );
}
