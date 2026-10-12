// Verificación visual del rediseño de búsqueda (desktop + tablet + mobile + interacción)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:8080";
const OUT = resolve(process.cwd(), "screenshots");
mkdirSync(OUT, { recursive: true });

const results = { consoleErrors: [], checks: {} };
const browser = await chromium.launch({ channel: "msedge", headless: true });

async function newPage(viewport) {
  const page = await browser.newPage({ viewport });
  page.on("console", (m) => {
    if (m.type() === "error") results.consoleErrors.push(m.text().slice(0, 200));
  });
  page.on("pageerror", (e) => results.consoleErrors.push("PAGEERROR: " + String(e).slice(0, 200)));
  return page;
}

// --- 1. Desktop 1440: input vacío con hint "/" ---
const desktop = await newPage({ width: 1440, height: 900 });
await desktop.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
await desktop.waitForTimeout(2000);
await desktop.screenshot({ path: `${OUT}/busqueda-1-desktop-1440.png` });
results.checks.inputVisible = await desktop.getByTestId("search-input").isVisible();
results.checks.kbdHint = (await desktop.locator("kbd").first().textContent())?.trim();

// --- 2. Escribir query: contador + highlight + URL ---
await desktop.getByTestId("search-input").fill("anthropic");
await desktop.waitForTimeout(700);
results.checks.urlHasQ = desktop.url().includes("q=anthropic");
results.checks.countText = (await desktop.getByTestId("search-count").textContent())?.trim();
results.checks.marks = await desktop.locator("article mark").count();
await desktop.screenshot({ path: `${OUT}/busqueda-2-desktop-query.png` });

// --- 3. Multi-palabra sin acentos: dos tokens AND en la misma señal ---
await desktop.getByTestId("search-input").fill("anthropic claude");
await desktop.waitForTimeout(700);
results.checks.multiWordUrl = desktop.url().includes("q=anthropic");
results.checks.multiWordCount = (await desktop.getByTestId("search-count").textContent())?.trim();
await desktop.screenshot({ path: `${OUT}/busqueda-3-desktop-multiword.png` });

// --- 3b. Query sin resultados: estado vacío con el query citado ---
await desktop.getByTestId("search-input").fill("zzznadieexiste");
await desktop.waitForTimeout(700);
results.checks.emptyState = (await desktop.getByTestId("empty-state").textContent())?.trim();

// --- 4. Escape limpia y restaura lista completa ---
await desktop.getByTestId("search-input").press("Escape");
await desktop.waitForTimeout(500);
results.checks.urlClean = !desktop.url().includes("q=");
results.checks.countGone = (await desktop.getByTestId("search-count").count()) === 0;
await desktop.screenshot({ path: `${OUT}/busqueda-4-desktop-limpio.png` });

// --- 5. Atajo "/" enfoca desde fuera del input ---
await desktop.getByTestId("tab-precios").click();
await desktop.waitForTimeout(400);
await desktop.getByTestId("tab-briefing").click();
await desktop.waitForTimeout(300);
await desktop.locator("h1").click();
await desktop.keyboard.press("/");
await desktop.waitForTimeout(200);
results.checks.focusAfterSlash = await desktop
  .getByTestId("search-input")
  .evaluate((el) => el === document.activeElement);

// --- 6. Botón limpiar (X) ---
await desktop.getByTestId("search-input").fill("china");
await desktop.waitForTimeout(400);
await desktop.getByTestId("search-clear").click();
await desktop.waitForTimeout(400);
results.checks.clearedUrl = !desktop.url().includes("q=");
await desktop.close();

// --- 7. Tablet 768 ---
const tablet = await newPage({ width: 768, height: 1024 });
await tablet.goto(`${BASE}/?q=ia`, { waitUntil: "networkidle", timeout: 60000 });
await tablet.waitForTimeout(1500);
await tablet.screenshot({ path: `${OUT}/busqueda-5-tablet-768.png` });
await tablet.close();

// --- 8. Mobile 375: sin kbd, X accesible ---
const mobile = await newPage({ width: 375, height: 812 });
await mobile.goto(`${BASE}/?q=ia`, { waitUntil: "networkidle", timeout: 60000 });
await mobile.waitForTimeout(1500);
await mobile.screenshot({ path: `${OUT}/busqueda-6-mobile-375.png` });
results.checks.mobileNoKbd = (await mobile.locator("kbd").count()) === 0;
await mobile.close();

await browser.close();
console.log(JSON.stringify(results, null, 2));
