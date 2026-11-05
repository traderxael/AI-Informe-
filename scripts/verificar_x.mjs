/**
 * Verificación de la sección de X de la portada, con la CSP de producción.
 *
 * Comprueba:
 *   1. que las tarjetas de X se pintan,
 *   2. que las imágenes de la caché local (/data/x-img/) cargan de verdad,
 *   3. que no hay errores de consola ni de página.
 *
 * Los avatares vienen por hotlink de pbs.twimg.com: se reportan aparte (no
 * son parte de la caché local y su fallo no depende de este repo).
 *
 * Uso: node scripts/verificar_x.mjs [http://localhost:8765]
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:8765";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const erroresConsola = [];
const erroresPagina = [];
const peticionesFallidas = [];

page.on("console", (msg) => {
  if (msg.type() === "error") erroresConsola.push(msg.text());
});
page.on("pageerror", (err) => erroresPagina.push(String(err)));
page.on("requestfailed", (req) => {
  peticionesFallidas.push(`${req.url()} :: ${req.failure()?.errorText}`);
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector("#xGrid .x-card", { timeout: 15000 });

// Las imágenes de la sección usan loading="lazy": hay que bringar la rejilla
// a la vista para que el navegador las pida.
await page.locator("#xGrid").scrollIntoViewIfNeeded();
await page.waitForTimeout(2500);

const datos = await page.evaluate(() => {
  const tarjetas = [...document.querySelectorAll("#xGrid .x-card")];
  return {
    total: tarjetas.length,
    conError: document.querySelectorAll("#xGrid .x-media-fail").length,
    imagenes: tarjetas.map((t) => {
      const img = t.querySelector(".x-media img");
      return {
        src: img ? img.currentSrc || img.src : "",
        natural: img ? img.naturalWidth : 0,
        completa: img ? img.complete : false,
      };
    }),
    avatares: [...document.querySelectorAll("#xGrid img.x-avatar")].map((i) => ({
      src: i.currentSrc || i.src,
      natural: i.naturalWidth,
    })),
    conteo: document.getElementById("xCount")?.textContent || "",
  };
});

const desdeCache = datos.imagenes.filter((i) => i.src.includes("/data/x-img/"));
const hotlink = datos.imagenes.filter((i) => !i.src.includes("/data/x-img/"));
const cacheadas = desdeCache.filter((i) => i.natural > 0);

console.log("URL base:", BASE);
console.log("tarjetas pintadas:", datos.total, "| conteo en pantalla:", datos.conteo);
console.log("imágenes de la sección:", datos.imagenes.length);
console.log("  desde /data/x-img/:", desdeCache.length, "| cargadas:", cacheadas.length);
console.log("  hotlink externo:", hotlink.length,
  hotlink.map((i) => `${i.src.slice(0, 55)} (pixels: ${i.natural})`));
console.log("imágenes rotas (x-media-fail):", datos.conError);
console.log("avatares (hotlink):", datos.avatares.length,
  "| con pixels:", datos.avatares.filter((a) => a.natural > 0).length);
console.log("errores de consola:", erroresConsola.length, erroresConsola);
console.log("errores de página:", erroresPagina.length, erroresPagina);
console.log("peticiones fallidas:", peticionesFallidas.length, peticionesFallidas.slice(0, 5));

await page.screenshot({
  path: "C:/Users/USUARIO/AppData/Local/Temp/opencode/x-portada.png",
  fullPage: false,
});
await browser.close();

const problemas = [];
if (datos.total === 0) problemas.push("no se pintó ninguna tarjeta de X");
if (cacheadas.length !== desdeCache.length) {
  problemas.push(`${desdeCache.length - cacheadas.length} imágenes de la caché local sin cargar`);
}
if (datos.conError) problemas.push(`${datos.conError} tarjetas con imagen rota`);
if (erroresConsola.length) problemas.push(`${erroresConsola.length} errores de consola`);
if (erroresPagina.length) problemas.push(`${erroresPagina.length} errores de página`);
if (peticionesFallidas.length) problemas.push(`${peticionesFallidas.length} peticiones fallidas`);

if (problemas.length) {
  console.log("\nFALLO:", problemas.join(" | "));
  process.exit(1);
}
console.log("\nOK: tarjetas pintadas, imágenes de la caché local cargadas, sin errores de consola.");
