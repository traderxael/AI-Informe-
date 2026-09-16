// Verificación visual del rediseño de week-view (desktop + mobile + consola)
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:8080";
const OUT = new URL("../screenshots/", import.meta.url).pathname.replace(/^\/([A-Za-z]):/, "$1:");

const results = { consoleErrors: [], checks: {} };

const browser = await chromium.launch({ channel: "msedge", headless: true });

// --- Desktop ---
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (m) => {
  if (m.type() === "error") results.consoleErrors.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => results.consoleErrors.push("PAGEERROR: " + String(e).slice(0, 200)));

await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(2500);

results.checks.h1 = await page.locator("h1").first().textContent();
results.checks.nCards = await page.locator("#signal-results article").count();
results.checks.stats = (await page.locator("main .mt-6.items-baseline").first().textContent())?.trim();
results.checks.moreFiltersBtn = (await page
  .locator("button", { hasText: "filtros" })
  .first()
  .textContent())?.trim();
results.checks.firstCardMeta = (await page
  .locator("#signal-results article .text-\\[11px\\]")
  .first()
  .textContent())?.trim();
results.checks.firstCardTitle = (
  await page.locator("#signal-results article h2").first().textContent()
)?.slice(0, 90);

await page.screenshot({ path: OUT + "redesign-desktop.png", fullPage: false });

// --- Interacción: abrir "Más filtros" ---
await page.locator("button", { hasText: "Más filtros" }).first().click();
await page.waitForTimeout(400);
results.checks.modelChipsVisible = await page.locator('[data-testid^="model-"]').count();
results.checks.countryChipsVisible = await page.locator('[data-testid^="country-"]').count();
await page.screenshot({ path: OUT + "redesign-filtros.png", fullPage: false });

// --- Interacción: expandir primera señal ---
await page.locator("#signal-results article button").first().click();
await page.waitForTimeout(400);
const expanded = page.locator("#signal-results article").first();
results.checks.expandedHasSourceLink = await expanded.locator("a", { hasText: "Leer fuente original" }).count();
results.checks.expandedSummaryDup = await expanded
  .locator("div.border-t p")
  .count(); // 1 = solo contexto extra; el resumen cerrado ya no se repite arriba
await page.screenshot({ path: OUT + "redesign-expand.png", fullPage: false });

// --- Mobile ---
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
mob.on("pageerror", (e) => results.consoleErrors.push("MOBILE PAGEERROR: " + String(e).slice(0, 200)));
await mob.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
await mob.waitForTimeout(2000);
await mob.screenshot({ path: OUT + "redesign-mobile.png", fullPage: false });
const searchBox = mob.locator('input[placeholder*="Buscar"]');
results.checks.mobileSearchHeight = await searchBox.evaluate((el) => el.getBoundingClientRect().height);

await browser.close();
console.log(JSON.stringify(results, null, 2));
