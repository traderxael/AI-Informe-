// AI Informe · analítica first-party. Sin cookies, sin terceros.
// Respeta la CSP: el beacon va a /api/ping (connect-src 'self') y este
// archivo es same-origin (script-src 'self').
(() => {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
  try {
    const payload = JSON.stringify({
      path: location.pathname,
      ref: document.referrer || "",
      ua: navigator.userAgent,
      ts: new Date().toISOString(),
    });
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/ping", blob);
  } catch (e) {
    /* la analítica nunca debe romper la app */
  }
})();
