import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  categorizeSignal,
  detectLang,
  enrichSignals,
  filterByCategory,
  groupByCategory,
  sortNoticias,
} from "./noticias-data.ts";
import type { Signal } from "./informe-data.ts";

function signal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: "s1",
    title: "Título genérico",
    summary: "resumen genérico",
    detail: "detalle",
    region: "west",
    models: [],
    source: "market",
    sourceLabel: "Fuente",
    ...overrides,
  };
}

describe("categorizeSignal", () => {
  it("clasifica noticias de IA por defecto", () => {
    assert.equal(categorizeSignal(signal({ title: "Nuevo modelo LLM de inteligencia artificial" })), "ia");
  });
  it("region china manda sobre el resto", () => {
    assert.equal(categorizeSignal(signal({ region: "china", title: "DeepSeek V4 release" })), "china");
  });
  it("detecta ciencia", () => {
    assert.equal(categorizeSignal(signal({ title: "Quantum computing breakthrough in new study" })), "ciencia");
  });
  it("detecta política (regulación/gobierno)", () => {
    assert.equal(categorizeSignal(signal({ title: "EU government proposes AI regulation law" })), "politica");
  });
  it("detecta seguridad", () => {
    assert.equal(categorizeSignal(signal({ title: "New vulnerability exploited in malware campaign" })), "seguridad");
  });
  it("detecta economía", () => {
    assert.equal(categorizeSignal(signal({ title: "Startup raises billion in funding round" })), "economia");
  });
});

describe("detectLang", () => {
  it("detecta chino por caracteres", () => {
    assert.equal(detectLang("人工智能 新模型"), "zh");
  });
  it("detecta español por acentos y stopwords", () => {
    assert.equal(detectLang("La inteligencia artificial llegó a España con más inversión"), "es");
  });
  it("detecta inglés", () => {
    assert.equal(detectLang("the model is for release in the market and more"), "en");
  });
  it("other cuando no hay señales suficientes", () => {
    assert.equal(detectLang("xyzzy plugh"), "other");
  });
});

describe("sortNoticias", () => {
  it("prioriza español sobre inglés y luego newest first", () => {
    const enriched = enrichSignals([
      signal({ id: "en-new", title: "the model release is for the market and more", published: "2026-10-29" }),
      signal({ id: "es-old", title: "La inteligencia artificial en España con más", published: "2026-10-27" }),
      signal({ id: "es-new", title: "Más inteligencia artificial en España la semana", published: "2026-10-28" }),
    ]);
    const sorted = sortNoticias(enriched);
    assert.deepEqual(
      sorted.map((n) => n.id),
      ["es-new", "es-old", "en-new"],
    );
  });
});

describe("filterByCategory / groupByCategory", () => {
  const list = enrichSignals([
    signal({ id: "a", region: "china", title: "Alibaba Qwen" }),
    signal({ id: "b", title: "AI model update" }),
    signal({ id: "c", title: "Malware security breach hack" }),
  ]);
  it('"todas" devuelve todo', () => {
    assert.equal(filterByCategory(list, "todas").length, 3);
  });
  it("filtra por categoría exacta", () => {
    assert.deepEqual(
      filterByCategory(list, "seguridad").map((n) => n.id),
      ["c"],
    );
  });
  it("agrupa preservando orden relativo", () => {
    const grupos = groupByCategory(list);
    assert.deepEqual(
      grupos.map((g) => g.categoria),
      ["china", "seguridad", "ia"],
    );
  });
});
