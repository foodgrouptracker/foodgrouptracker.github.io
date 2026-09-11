import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Share2, Upload } from "lucide-react";
import { FREE_ROWS, GROUPS, ROW_LABEL, addedText, halfText, quickLabel, shiftDays } from "../model.js";
import { T } from "../theme.js";
import { storeGet, storeList, storeSet } from "../storage.js";

export function HistoryScreen({ dayKey, today, plan, onBack, onImported }) {
  const [end, setEnd] = useState(dayKey); // last day shown
  const [days, setDays] = useState({}); // key -> record
  const [picked, setPicked] = useState(null);
  const [msg, setMsg] = useState(null);
  const keys = Array.from({ length: 7 }, (_, i) => shiftDays(end, i - 6));

  useEffect(() => {
    let alive = true;
    Promise.all(keys.map((k) => (k === dayKey ? Promise.resolve(today) : storeGet(`fgt:day:${k}`)))).then((recs) => {
      if (!alive) return;
      const m = {};
      keys.forEach((k, i) => {
        if (recs[i]) m[k] = recs[i];
      });
      setDays(m);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, today]);

  // Rows shown: any group that had a target on any of these days (or on the current plan)
  const rowIds = GROUPS.filter((g) => plan.base.counts[g.id] > 0 || plan.variants.some((v) => v.counts[g.id] > 0) || keys.some((k) => (days[k]?.targets?.[g.id] || 0) > 0)).map((g) => g.id);

  const cell = (k, id) => {
    const r = days[k];
    if (!r) return null;
    const have = r.counts?.[id] || 0;
    const target = r.targets?.[id] ?? plan.base.counts[id];
    if (!target && !have) return null;
    return { have, target };
  };
  const dayDone = (k) => {
    const r = days[k];
    if (!r) return false;
    return rowIds.every((id) => {
      const target = r.targets?.[id] ?? plan.base.counts[id];
      return !target || (r.counts?.[id] || 0) >= target;
    });
  };
  const fmtDay = (k) => new Date(k + "T12:00").toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
  const fmtNum = (k) => new Date(k + "T12:00").getDate();
  const range = `${new Date(keys[0] + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(end + "T12:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  const exportAll = async () => {
    const list = await storeList("fgt:");
    const data = {};
    for (const k of list) data[k] = await storeGet(k);
    if (!data["fgt:plan"]) data["fgt:plan"] = plan;
    data[`fgt:day:${dayKey}`] = today;
    const blob = new Blob([JSON.stringify({ app: "food-group-tracker", v: 1, exported: new Date().toISOString(), data }, null, 0)], { type: "application/json" });
    downloadBlob(blob, `food-group-tracker-backup-${dayKey}.json`);
    setMsg("Backup file saved. Keep it somewhere you'll find it on a new phone.");
  };

  const importAll = async (file) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.app !== "food-group-tracker" || !parsed.data) throw new Error("bad");
      const entriesList = Object.entries(parsed.data).filter(([k]) => k.startsWith("fgt:"));
      for (const [k, v] of entriesList) await storeSet(k, v);
      setMsg(`Restored ${entriesList.length} items. Reloading.`);
      setTimeout(onImported, 800);
    } catch {
      setMsg("That file isn't a tracker backup.");
    }
  };

  const shareImage = async () => {
    const blob = await renderWeekImage({ keys, days, rowIds, plan, cell, dayDone, range });
    const file = new File([blob], `food-groups-${end}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Food group tracker" });
        return;
      } catch {
        /* fall through to download */
      }
    }
    downloadBlob(blob, file.name);
    setMsg("Image saved.");
  };

  const pickedRec = picked ? days[picked] : null;

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label="Back to today" className="rounded-full p-1 -ml-2 focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
        <h1 className="text-2xl font-bold" style={{ color: T.accentDeep }}>
          History
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto mt-3" style={{ minHeight: 0 }}>
        <div className="flex items-center justify-between">
          <button onClick={() => setEnd(shiftDays(end, -7))} aria-label="Earlier week" className="rounded-full p-1 focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold">{range}</span>
          <button
            onClick={() => setEnd(shiftDays(end, 7))}
            disabled={end >= dayKey}
            aria-label="Later week"
            className="rounded-full p-1 focus:outline-none focus-visible:ring-2"
            style={{ color: end >= dayKey ? T.hair : T.accentDeep }}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <table className="w-full mt-2 text-xs" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="text-left font-normal pb-1" style={{ color: T.muted }}></th>
              {keys.map((k) => (
                <th key={k} className="pb-1 font-normal">
                  <button
                    onClick={() => setPicked(picked === k ? null : k)}
                    aria-pressed={picked === k}
                    className="w-full rounded-lg py-1 focus:outline-none focus-visible:ring-2"
                    style={{ background: picked === k ? T.tint : "transparent", color: k === dayKey ? T.accentDeep : T.muted, fontWeight: k === dayKey ? 700 : 400 }}
                  >
                    <div>{fmtDay(k)}</div>
                    <div className="text-sm">{fmtNum(k)}</div>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowIds.map((id) => (
              <tr key={id} style={{ borderTop: `1px solid ${T.hair}` }}>
                <td className="py-2 pr-1 font-bold" style={{ width: 72 }}>
                  {ROW_LABEL[id]}
                </td>
                {keys.map((k) => {
                  const c = cell(k, id);
                  if (!c) return <td key={k} className="text-center" style={{ color: T.hair }}>·</td>;
                  const free = FREE_ROWS.includes(id);
                  const done = c.have >= c.target;
                  const over = c.have > c.target && !free;
                  const color = over ? T.overInk : done ? T.accentDeep : T.muted;
                  return (
                    <td key={k} className="text-center py-2" style={{ color, fontWeight: done ? 700 : 400, background: done && !over ? T.tint : "transparent" }}>
                      {halfText(c.have)}
                      <span style={{ color: T.muted, fontWeight: 400 }}>/{c.target}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr style={{ borderTop: `1.5px solid ${T.accent}` }}>
              <td className="py-2 pr-1 font-bold" style={{ color: T.accentDeep }}>
                Complete
              </td>
              {keys.map((k) => (
                <td key={k} className="text-center py-2" style={{ color: T.accentDeep }}>
                  {dayDone(k) ? <Check size={16} strokeWidth={3} className="inline" aria-label="Complete" /> : days[k] ? <span style={{ color: T.hair }}>—</span> : ""}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="text-xs mt-1" style={{ color: T.muted }}>
          Tap a day to see its log.
        </p>

        {picked && (
          <div className="mt-3 rounded-lg p-3" style={{ background: T.surface, border: `1px solid ${T.hair}` }}>
            <div className="flex items-baseline justify-between">
              <b className="text-sm" style={{ color: T.accentDeep }}>
                {new Date(picked + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </b>
              {pickedRec && (
                <span className="text-xs" style={{ color: T.muted }}>
                  {pickedRec.planName} · {Number(pickedRec.kcal).toLocaleString()} cal
                </span>
              )}
            </div>
            {!pickedRec && (
              <p className="text-xs mt-1" style={{ color: T.muted }}>
                Nothing was logged this day.
              </p>
            )}
            {pickedRec && (
              <ul className="mt-1">
                {[...(pickedRec.entries || [])].sort((a, b) => a.t - b.t).map((e) => (
                  <li key={e.t} className="flex items-baseline justify-between gap-3 py-1 text-xs" style={{ borderTop: `1px solid ${T.hair}` }}>
                    <span className="truncate">
                      <span style={{ color: T.muted }}>{new Date(e.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>{" "}
                      {e.type === "food" ? e.name : e.name || quickLabel(e)}
                      {e.type === "food" && e.servings !== 1 ? ` × ${e.servings}` : ""}
                    </span>
                    <span className="shrink-0" style={{ color: T.muted }}>
                      {addedText(e.added)}
                    </span>
                  </li>
                ))}
                {(!pickedRec.entries || pickedRec.entries.length === 0) && (
                  <li className="text-xs py-1" style={{ color: T.muted }}>
                    No entries recorded.
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${T.hair}` }}>
          <div className="text-sm font-bold">Your data</div>
          <p className="text-xs mt-1" style={{ color: T.muted }}>
            Everything lives on this phone. A backup file is the only copy there is; make one before switching phones.
          </p>
          <div className="flex gap-2 flex-wrap mt-3">
            <button onClick={shareImage} className="flex items-center gap-1 rounded-full pl-2 pr-3 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ background: T.accent, color: "#fff" }}>
              <Share2 size={16} aria-hidden="true" />
              Share this week
            </button>
            <button onClick={exportAll} className="flex items-center gap-1 rounded-full pl-2 pr-3 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep, border: `1px solid ${T.hair}`, background: T.surface }}>
              <Download size={16} aria-hidden="true" />
              Back up
            </button>
            <label className="flex items-center gap-1 rounded-full pl-2 pr-3 py-2 text-sm font-bold cursor-pointer focus-within:ring-2" style={{ color: T.accentDeep, border: `1px solid ${T.hair}`, background: T.surface }}>
              <Upload size={16} aria-hidden="true" />
              Restore
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && importAll(e.target.files[0])} />
            </label>
          </div>
          {msg && (
            <p className="text-xs mt-2" role="status" style={{ color: T.accentDeep }}>
              {msg}
            </p>
          )}
        </div>
      </div>
    </>
  );
}


export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Draw the week grid to a PNG for sharing with the dietitian.

export async function renderWeekImage({ keys, days, rowIds, plan, cell, dayDone, range }) {
  const W = 1080;
  const left = 260;
  const colW = (W - left - 40) / keys.length;
  const rowH = 78;
  const top = 200;
  const H = top + (rowIds.length + 1) * rowH + 80;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = "#F6F8F6";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#22594E";
  c.font = "bold 44px system-ui, -apple-system, sans-serif";
  c.fillText("Food Group Tracker", 40, 80);
  c.fillStyle = "#6B7773";
  c.font = "28px system-ui, -apple-system, sans-serif";
  c.fillText(range, 40, 124);
  // day headers
  keys.forEach((k, i) => {
    const d = new Date(k + "T12:00");
    const x = left + i * colW + colW / 2;
    c.textAlign = "center";
    c.fillStyle = "#6B7773";
    c.font = "24px system-ui, -apple-system, sans-serif";
    c.fillText(d.toLocaleDateString(undefined, { weekday: "short" }), x, top - 40);
    c.fillStyle = "#22302B";
    c.font = "bold 30px system-ui, -apple-system, sans-serif";
    c.fillText(String(d.getDate()), x, top - 8);
  });
  c.textAlign = "left";
  rowIds.forEach((id, r) => {
    const y = top + r * rowH;
    c.strokeStyle = "#D6DDD9";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(40, y);
    c.lineTo(W - 40, y);
    c.stroke();
    c.fillStyle = "#22302B";
    c.font = "bold 28px system-ui, -apple-system, sans-serif";
    c.fillText(ROW_LABEL[id], 40, y + 50);
    keys.forEach((k, i) => {
      const v = cell(k, id);
      const x = left + i * colW + colW / 2;
      c.textAlign = "center";
      if (!v) {
        c.fillStyle = "#D6DDD9";
        c.font = "28px system-ui, -apple-system, sans-serif";
        c.fillText("·", x, y + 50);
      } else {
        const free = FREE_ROWS.includes(id);
        const done = v.have >= v.target;
        const over = v.have > v.target && !free;
        if (done && !over) {
          c.fillStyle = "#E3EFEA";
          c.fillRect(left + i * colW + 6, y + 8, colW - 12, rowH - 16);
        }
        c.fillStyle = over ? "#7D6420" : done ? "#22594E" : "#6B7773";
        c.font = `${done ? "bold " : ""}30px system-ui, -apple-system, sans-serif`;
        c.fillText(`${halfText(v.have)}/${v.target}`, x, y + 50);
      }
      c.textAlign = "left";
    });
  });
  // complete row
  const y = top + rowIds.length * rowH;
  c.strokeStyle = "#2F7D6D";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(40, y);
  c.lineTo(W - 40, y);
  c.stroke();
  c.fillStyle = "#22594E";
  c.font = "bold 28px system-ui, -apple-system, sans-serif";
  c.fillText("Complete", 40, y + 50);
  keys.forEach((k, i) => {
    const x = left + i * colW + colW / 2;
    c.textAlign = "center";
    c.font = "bold 34px system-ui, -apple-system, sans-serif";
    c.fillStyle = dayDone(k) ? "#2F7D6D" : "#D6DDD9";
    c.fillText(dayDone(k) ? "✓" : days[k] ? "—" : "", x, y + 52);
    c.textAlign = "left";
  });
  c.fillStyle = "#6B7773";
  c.font = "22px system-ui, -apple-system, sans-serif";
  c.fillText(`${plan.base.name} plan · ${Number(plan.base.kcal).toLocaleString()} calories`, 40, H - 30);
  return new Promise((res) => cv.toBlob(res, "image/png"));
}

