import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:4177";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(e.message));
await page.goto(base, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(2500);

const d = await page.evaluate(() => {
  const t = (document.body.innerText || "").replace(/\s+/g, " ");
  const q = (s) => document.querySelector(s);
  // ¿está el estado `loading` resuelto (o sea, el contenido real ya cargó)?
  return {
    loadingSkeletons: document.querySelectorAll('[class*="animate-pulse"]').length,
    h1: q("h1")?.innerText?.slice(0, 80),
    // contenido de la página
    muestraTitulo: t.slice(0, 220),
    // filtros de region/model/tab
    tabs: [...document.querySelectorAll('button,a')].map((b) => b.innerText.trim())
      .filter((x) => /^(west|china|occidente|china|briefing|precios|global)/i.test(x)).slice(0, 8),
    // items de señal renderizados
    linksSenales: [...document.querySelectorAll('a[href*="http"]')].length,
    // el search param en la URL
    url: location.href,
  };
});
console.log(JSON.stringify(d, null, 2));
console.log("ERRORES_JS:", jsErrors.length ? jsErrors : "ninguno");

// Probar navegación con search params (valida validateSearch)
await page.goto(base + "/?region=china&tab=precios", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const tras = await page.evaluate(() => ({
  url: location.href,
  largo: (document.body.innerText || "").length,
  tienePrecios: /precio|usd|\$/i.test(document.body.innerText || ""),
}));
console.log("CON_QUERY:", JSON.stringify(tras));
console.log("ERRORES_JS_FINAL:", jsErrors.length ? jsErrors : "ninguno");
await browser.close();
