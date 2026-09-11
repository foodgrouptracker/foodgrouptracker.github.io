// Where and how the app is running.
export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isAndroid = () => /Android/.test(navigator.userAgent);
export const isSafari = () => isIOS() && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

// The plan code carried in the URL, if any.
export const planCodeFromLocation = () => {
  const m = window.location.hash.match(/plan=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
};

// Remove the plan from the address bar without reloading (cosmetic; the code is already applied).
export const clearPlanFromLocation = () => {
  if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
};

// Chrome/Edge on Android expose a real install prompt; capture it for the Install screen.
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.dispatchEvent(new Event("fgt-installable"));
});
export const canPromptInstall = () => !!deferredPrompt;
export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === "accepted";
}
