import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { T } from "../theme.js";

// How the tracker works, in plain language. Original text; nothing here is taken from the food-list
// booklet, and nothing here says what is healthy. That part belongs to the client's dietitian.

export const TOPICS = [
  {
    id: "boxes",
    title: "One box, one serving",
    body: [
      "Your dietitian has given you a plan: a number of servings from each food group for the day. Each box on the Today screen is one serving. When you eat one, check one.",
      "That's the whole method. You don't count calories, weigh food, or add anything up. The plan already did the arithmetic; your job is to fill the rows.",
      "When every row is full, the day is done. If you're still hungry, look for a row that has a box open and eat something from that group.",
    ],
  },
  {
    id: "rows",
    title: "The food groups",
    body: [
      "Starch / Carbohydrate: bread, rice, pasta, cereal, potatoes, corn, peas, beans, crackers, and most sweets and snacks.",
      "Fruits: whole fruit, dried fruit, and 100% juice.",
      "Milk / Yogurt: milk, yogurt, and milk substitutes.",
      "Vegetables: the non-starchy ones, like greens, broccoli, tomatoes, peppers, carrots, and salad. Extra servings here are always fine.",
      "Meat / Cheese / Eggs: meat, poultry, fish, eggs, cheese, tofu, and other protein foods.",
      "Fats: oils, butter, dressings, nuts, seeds, avocado.",
      "Water is counted in cups.",
      "Starch, Fruit, and Milk/Yogurt can stand in for one another. If the Starch row is full and you have a piece of fruit's worth of carbohydrate to place, an open Fruit or Milk box is fine. The app does this for you when you log a food.",
    ],
  },
  {
    id: "checking",
    title: "Checking boxes",
    body: [
      "Tap an empty box to check it. Press and hold an empty box for half a serving; it fills diagonally. Tap the half box to complete it.",
      "Tap any filled box to take the last one back.",
      "Every tap is written to today's log with the time, so you can always see where a box came from.",
    ],
  },
  {
    id: "adding",
    title: "Adding a food",
    body: [
      "Use Add food when you're not sure how something counts. There are three ways to enter a food:",
      "My food lists: type in what your food-list book says one serving counts as. This is the right path for anything in the book, including combination foods like lasagna or a burrito.",
      "Nutrition label: type the serving size and the five numbers from the panel (carbohydrate, protein, fat, fiber, sodium). The app works out the boxes and shows you its arithmetic. This is the path for packaged foods.",
      "USDA: search a plain name like \"brown rice cooked\" or \"chicken breast roasted,\" pick a portion, and the app fills in the numbers from the U.S. government's food database. This is the path for generic, unpackaged foods.",
      "Check \"Save to my foods\" and next time it's one tap from the list.",
    ],
  },
  {
    id: "mixed",
    title: "Mixed foods and meals you didn't make",
    body: [
      "For a plate of food, count what's on it: the rice is Starch, the chicken is Meat, the broccoli is Vegetable, the oil it was cooked in is Fat. Check a box for each part, or add each part as a food.",
      "For a dish with everything mixed together, your food-list book has a section on combination foods that gives the servings for the whole thing. Enter those on the My food lists path.",
      "When you have no idea, estimate and move on. The plan is meant to build habits over weeks, not to be exact at every meal.",
    ],
  },
  {
    id: "label",
    title: "How the app reads a label",
    body: [
      "The food groups are defined by nutrients, and that's what the app uses. About 15 grams of carbohydrate is one Starch or one Fruit serving; a dairy serving is measured by its calories at its fat level; about 5 grams of carbohydrate is one Vegetable serving; about 7 grams of protein is one Meat serving; about 5 grams of fat is one Fat serving. Small amounts of everything count as a free food with no box.",
      "Protein that comes with a carbohydrate food (like the protein in bread) is part of that serving, not an extra Meat. Fat that comes with a protein food is part of that serving, not an extra Fat. Meat, poultry, fish, and cheese are counted by weight: one ounce is one serving, the same rule your food lists use.",
      "The one thing you decide is which row the carbohydrate belongs in. The app suggests one; change it if it guessed wrong.",
      "Boxes are rounded to the nearest half. Meat rounds down unless it's very close to the next box. Expect the app and the book to disagree by half a serving now and then; either is fine.",
    ],
  },
  {
    id: "over",
    title: "Going past the plan",
    body: [
      "If a row is full and you eat another serving from that group, the app adds a box in a warm color and the row says how many over. That's information, not a judgment. Vegetables and water never show this; extra servings there are always fine.",
      "If you tap the small + at the end of a full row, you can add past the plan by hand too.",
    ],
  },
  {
    id: "variants",
    title: "Plan variants",
    body: [
      "Your dietitian may have given you more than one version of the plan, for example a standard day and an active day. Switch between them with the selector next to \"Today.\" Boxes that exist only in a variant are drawn dashed.",
      "If a variant has a schedule (certain weekdays, every few days), the app selects it for you on those days. You can always switch.",
    ],
  },
  {
    id: "log",
    title: "The log, history, and backup",
    body: [
      "The list button at the bottom of Today opens today's log: every box and food with its time. Edit servings or remove an entry and the boxes update.",
      "Tap the date at the top of Today to see the week. Tap a day to read its log. Share this week sends an image of the grid to whoever you choose.",
      "Everything lives on this phone. There is no account and no copy anywhere else. Before you switch phones, use Back up on the History screen to save a file, then Restore on the new phone.",
    ],
  },
];

// Public sources the client can open in their browser. The dietitian can replace this list.
export const RESOURCES = [
  { title: "MyPlate", url: "https://www.myplate.gov", note: "U.S. Department of Agriculture: food groups and portions, in plain language." },
  { title: "Dietary Guidelines for Americans", url: "https://www.dietaryguidelines.gov", note: "The current national nutrition guidance, from USDA and HHS." },
  {
    title: "How to read the Nutrition Facts label",
    url: "https://www.fda.gov/food/nutrition-facts-label/how-understand-and-use-nutrition-facts-label",
    note: "U.S. Food and Drug Administration's guide to the panel this app reads.",
  },
  { title: "NIDDK: Diet and nutrition", url: "https://www.niddk.nih.gov/health-information/diet-nutrition", note: "National Institutes of Health health information." },
  { title: "USDA FoodData Central", url: "https://fdc.nal.usda.gov", note: "The public database behind this app's food search." },
];

export const PRIVACY =
  "This app keeps everything on your phone. There is no account, no sign-in, and no server. Nothing you enter is collected, sent, or shared with anyone, including your dietitian, unless you choose to share an image or a backup file yourself. The only network use is downloading the app itself and opening links on the Resources page in your browser. If you delete the app, its data is deleted with it; a backup file is the only other copy.";

export function HelpScreen({ start, onBack }) {
  const [topic, setTopic] = useState(start || null); // null = index; "resources" | "privacy" | topic id

  const back = () => (topic ? setTopic(null) : onBack());
  const title = topic === "resources" ? "Resources" : topic === "privacy" ? "Privacy" : topic ? TOPICS.find((t) => t.id === topic)?.title : "How it works";

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={back} aria-label={topic ? "Back to topics" : "Back to plan"} className="rounded-full p-1 -ml-2 focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
        <h1 className="text-2xl font-bold leading-tight" style={{ color: T.accentDeep }}>
          {title}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto mt-3" style={{ minHeight: 0 }}>
        {!topic && (
          <>
            <ul>
              {TOPICS.map((t) => (
                <li key={t.id} style={{ borderTop: `1px solid ${T.hair}` }}>
                  <button onClick={() => setTopic(t.id)} className="w-full text-left py-3 flex items-center justify-between gap-3 text-sm font-bold focus:outline-none focus-visible:ring-2">
                    {t.title}
                    <ChevronRight size={18} style={{ color: T.muted }} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${T.hair}` }}>
              {[
                ["resources", "Resources"],
                ["privacy", "Privacy"],
              ].map(([id, label]) => (
                <button key={id} onClick={() => setTopic(id)} className="w-full text-left py-3 flex items-center justify-between gap-3 text-sm font-bold focus:outline-none focus-visible:ring-2" style={{ color: T.accentDeep }}>
                  {label}
                  <ChevronRight size={18} style={{ color: T.muted }} aria-hidden="true" />
                </button>
              ))}
            </div>
          </>
        )}

        {topic && topic !== "resources" && topic !== "privacy" && (
          <div className="text-base leading-relaxed space-y-3 pb-6">
            {TOPICS.find((t) => t.id === topic)?.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}

        {topic === "resources" && (
          <div className="pb-6">
            <p className="text-sm" style={{ color: T.muted }}>
              Public sources, chosen with your dietitian. Each opens in your browser. Questions about what to eat go to your dietitian, not to this app.
            </p>
            <ul className="mt-3">
              {RESOURCES.map((r) => (
                <li key={r.url} style={{ borderTop: `1px solid ${T.hair}` }}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="block py-3 focus:outline-none focus-visible:ring-2">
                    <span className="flex items-center justify-between gap-3 text-sm font-bold" style={{ color: T.accentDeep }}>
                      {r.title}
                      <ExternalLink size={16} style={{ color: T.muted }} aria-hidden="true" />
                    </span>
                    <span className="block text-xs mt-0.5" style={{ color: T.muted }}>
                      {r.note}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {topic === "privacy" && <p className="text-base leading-relaxed pb-6">{PRIVACY}</p>}
      </div>
    </>
  );
}
