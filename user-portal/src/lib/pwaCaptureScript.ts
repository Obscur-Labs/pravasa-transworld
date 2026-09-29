// Plain module (no "use client") so the server layout can inline it.
/**
 * Runs before React loads (see layout.tsx). Chromium browsers fire beforeinstallprompt
 * once, often before hydration, so it has to be caught early and parked on window.
 */
export const PWA_CAPTURE_SCRIPT = `
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__pwaInstallEvent = e;
  window.dispatchEvent(new Event('pwa-installable'));
});
window.addEventListener('appinstalled', function () {
  window.__pwaInstallEvent = null;
  window.dispatchEvent(new Event('pwa-installed'));
});`;
