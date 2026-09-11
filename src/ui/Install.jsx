import { useEffect, useState } from "react";
import { Share, PlusSquare, Copy, Check } from "lucide-react";
import { T } from "../theme.js";
import { canPromptInstall, promptInstall, isIOS, isAndroid, isSafari } from "../platform.js";

// Shown whenever the tracker is opened in a browser tab rather than from the home screen.
// Everything logged must live in the installed app, so we don't let logging start here.
export function InstallScreen({ planCode, planSummary }) {
  const [installable, setInstallable] = useState(canPromptInstall());
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const on = () => setInstallable(true);
    window.addEventListener("fgt-installable", on);
    return () => window.removeEventListener("fgt-installable", on);
  }, []);

  const copyPlan = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* selection fallback below */
    }
  };

  const ios = isIOS();
  const android = isAndroid();

  return (
    <div className="flex flex-col h-full">
      <h1 className="text-2xl font-bold mt-2" style={{ color: T.accentDeep }}>
        Food Group Tracker
      </h1>
      <p className="text-sm mt-1" style={{ color: T.muted }}>
        Check one box for each serving you eat. Everything stays on your phone.
      </p>

      {planCode && (
        <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: T.tint }}>
          <div className="font-bold" style={{ color: T.accentDeep }}>
            Your plan is in this link{planSummary ? `: ${planSummary}` : ""}.
          </div>
          <div className="mt-1">Install the app below and it will open with this plan already set.</div>
        </div>
      )}

      <div className="mt-6">
        <div className="text-sm font-bold">First, add it to your home screen</div>
        <p className="text-xs mt-1" style={{ color: T.muted }}>
          The tracker only saves when it runs from the home screen. Logging here in the browser would be lost.
        </p>

        {installable && (
          <button
            onClick={promptInstall}
            className="mt-3 rounded-full px-5 py-2.5 text-sm font-bold focus:outline-none focus-visible:ring-2"
            style={{ background: T.accent, color: "#fff" }}
          >
            Install app
          </button>
        )}

        {ios && (
          <ol className="mt-3 text-sm space-y-3">
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: T.tint, color: T.accentDeep }}>1</span>
              <span>
                Tap the <b>Share</b> button <Share size={16} className="inline -mt-1" aria-label="Share icon" /> {isSafari() ? "at the bottom of Safari" : "in your browser's menu"}.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: T.tint, color: T.accentDeep }}>2</span>
              <span>
                Scroll and tap <b>Add to Home Screen</b> <PlusSquare size={16} className="inline -mt-1" aria-label="Add icon" />, then <b>Add</b>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: T.tint, color: T.accentDeep }}>3</span>
              <span>Open <b>Food Group Tracker</b> from your home screen.</span>
            </li>
          </ol>
        )}

        {android && !installable && (
          <ol className="mt-3 text-sm space-y-3">
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: T.tint, color: T.accentDeep }}>1</span>
              <span>Open the browser menu (three dots).</span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: T.tint, color: T.accentDeep }}>2</span>
              <span>
                Tap <b>Install app</b> or <b>Add to Home screen</b>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: T.tint, color: T.accentDeep }}>3</span>
              <span>Open <b>Food Group Tracker</b> from your home screen.</span>
            </li>
          </ol>
        )}

        {!ios && !android && (
          <p className="mt-3 text-sm">On a phone, open this link in Safari (iPhone) or Chrome (Android) and add it to your home screen. On a computer, look for an install icon in the address bar.</p>
        )}
      </div>

      {planCode && ios && (
        <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${T.hair}` }}>
          <div className="text-sm font-bold">Already installed?</div>
          <p className="text-xs mt-1" style={{ color: T.muted }}>
            iPhone opens links in Safari, not in the app. Copy this link, open the app from your home screen, and paste it on the Plan screen.
          </p>
          <button
            onClick={copyPlan}
            className="mt-2 flex items-center gap-1 rounded-full pl-3 pr-4 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2"
            style={{ background: T.surface, color: T.accentDeep, border: `1px solid ${T.hair}` }}
          >
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? "Copied" : "Copy plan link"}
          </button>
        </div>
      )}

      <p className="mt-auto pt-6 text-xs" style={{ color: T.muted }}>
        No account. No server. Nothing is collected or sent anywhere.
      </p>
    </div>
  );
}
