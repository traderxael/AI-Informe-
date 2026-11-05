import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// La política de URLs de la sección de X vive en public/static-x.js (script
// externo, CSP-safe). Se carga aquí para probar el archivo que realmente se
// sirve, sin depender del DOM.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = readFileSync(join(RAIZ, "public", "static-x.js"), "utf8");

function cargarSoloHttps(origen) {
  const m = SRC.match(/function soloHttps\(url\) \{[\s\S]*?\n {2}\}/);
  assert.ok(m, "no se encontró soloHttps() en public/static-x.js");
  return new Function("window", `${m[0]}\nreturn soloHttps;`)({
    location: { origin: origen },
  });
}

test("acepta la caché local de imágenes (mismo origen)", () => {
  const fn = cargarSoloHttps("http://localhost:8765");
  assert.equal(
    fn("/data/x-img/2116220869479428500.jpg"),
    "http://localhost:8765/data/x-img/2116220869479428500.jpg",
  );
});

test("acepta la caché local también en producción (https)", () => {
  const fn = cargarSoloHttps("https://ai-informe.vercel.app");
  assert.equal(
    fn("/data/x-img/1.jpg"),
    "https://ai-informe.vercel.app/data/x-img/1.jpg",
  );
});

test("acepta un https externo (CDN de X)", () => {
  const fn = cargarSoloHttps("https://ai-informe.vercel.app");
  assert.equal(
    fn("https://pbs.twimg.com/media/a.jpg"),
    "https://pbs.twimg.com/media/a.jpg",
  );
});

test("rechaza esquemas peligrosos", () => {
  const fn = cargarSoloHttps("https://ai-informe.vercel.app");
  assert.equal(fn("javascript:alert(1)"), "");
  assert.equal(fn("data:image/png;base64,AAA"), "");
  assert.equal(fn(""), "");
});
