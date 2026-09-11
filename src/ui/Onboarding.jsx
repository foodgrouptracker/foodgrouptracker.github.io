import { useState } from "react";
import { T } from "../theme.js";

const STEPS = [
  { title: "One box, one serving", body: "Tap a box when you eat a serving. Press and hold an empty box for a half serving. Tap a filled box to take the last one back." },
  { title: "Add food when you're not sure", body: "Use Add food for anything you'd have to look up. Search the built-in food database, type the numbers from a nutrition label, or build a recipe from ingredients. Everything you log is one tap next time." },
  { title: "Everything is in the log", body: "Every box you check and every food you log is listed with a time. Change servings or remove an entry and the boxes follow." },
  { title: "The week, and a backup", body: "Tap the date to see the week at a glance and share it with your dietitian. Everything lives on this phone only, so make a backup file before you switch phones." },
];

export function Onboarding({ onDone }) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex gap-1.5 mb-6" aria-hidden="true">
          {STEPS.map((_, k) => (
            <span key={k} className="h-1.5 rounded-full" style={{ width: k === i ? 24 : 8, background: k === i ? T.accent : T.hair, transition: "width 200ms" }} />
          ))}
        </div>
        <h1 className="text-2xl font-bold" style={{ color: T.accentDeep }}>
          {STEPS[i].title}
        </h1>
        <p className="text-base mt-3 leading-relaxed">{STEPS[i].body}</p>
      </div>
      <div className="flex items-center justify-between pb-4">
        <button onClick={onDone} className="text-sm focus:outline-none focus-visible:ring-2" style={{ color: T.muted }}>
          Skip
        </button>
        <button onClick={() => (last ? onDone() : setI(i + 1))} className="rounded-full px-6 py-2.5 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ background: T.accent, color: "#fff" }}>
          {last ? "Start" : "Next"}
        </button>
      </div>
    </div>
  );
}
