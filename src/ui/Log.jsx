import { useState } from "react";
import { ChevronLeft, Trash2 } from "lucide-react";
import { addedText, quickLabel } from "../model.js";
import { T } from "../theme.js";
import { ServingsPicker, Tags } from "./shared.jsx";

export function LogScreen({ entries, counts, targets, onRemove, onChangeServings, onBack }) {
  const [editing, setEditing] = useState(null); // entry t being edited
  const list = [...entries].sort((a, b) => b.t - a.t);
  const time = (t) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="Back to today" className="rounded-full p-1 -ml-2 focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
        <h1 className="text-2xl font-bold" style={{ color: T.accentDeep }}>
          Today's log
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto mt-3" style={{ minHeight: 0 }}>
        {list.length === 0 && (
          <p className="text-sm mt-6 text-center" style={{ color: T.muted }}>
            Nothing logged yet. Every box you check or food you log shows up here.
          </p>
        )}
        <ul>
          {list.map((e) => {
            const isFood = e.type === "food";
            const label = isFood ? e.name : e.name || quickLabel(e);
            const summary = addedText(e.added) || "No boxes";
            const isEditing = editing === e.t;
            return (
              <li key={e.t} className="py-3" style={{ borderTop: `1px solid ${T.hair}` }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs" style={{ color: T.muted }}>
                      {time(e.t)}
                    </div>
                    <div className="text-sm font-bold truncate">
                      {label}
                      {isFood && e.servings !== 1 ? ` × ${e.servings === 0.5 ? "½" : e.servings === 1.5 ? "1½" : e.servings}` : ""}
                    </div>
                    <div className="text-xs" style={{ color: T.muted }}>
                      {summary}
                    </div>
                    {isFood && <Tags food={e} />}
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    {isFood && (
                      <button
                        onClick={() => setEditing(isEditing ? null : e.t)}
                        className="rounded-full px-3 py-1 text-xs font-bold focus:outline-none focus-visible:ring-2"
                        style={{ background: T.tint, color: T.accentDeep }}
                      >
                        {isEditing ? "Done" : "Edit"}
                      </button>
                    )}
                    <button onClick={() => onRemove(e.t)} aria-label={`Remove ${label}`} className="rounded-full p-2 focus:outline-none focus-visible:ring-2" style={{ color: T.muted }}>
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {isEditing && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold">Servings:</span>
                    <ServingsPicker
                      value={e.servings}
                      onChange={(sv) => {
                        onChangeServings(e.t, sv);
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {list.length > 0 && (
          <p className="text-xs mt-4" style={{ color: T.muted }}>
            Removing an entry takes its boxes back off today's rows.
          </p>
        )}
      </div>
    </>
  );
}

