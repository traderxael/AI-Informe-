import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  foldText,
  foldWithMap,
  matchRanges,
  matchesQuery,
  parseInformeSearch,
  queryTokens,
  type Signal,
} from "./informe-data.ts";

function signal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: "s1",
    title: "Anthropic lanza Claude próximamente en español",
    summary: "El laboratorio anuncia un modelo con acentos: ñandú y días.",
    detail: "Detalle largo de la señal.",
    region: "west",
    models: ["claude"],
    source: "lab",
    sourceLabel: "Anthropic",
    sourceUrl: "https://example.com",
    ...overrides,
  };
}

describe("foldText", () => {
  it("quita acentos, diéresis y pasa a minúsculas", () => {
    assert.equal(foldText("Próximamente ÑANDÚ días Ía"), "proximamente nandu dias ia");
  });
});

describe("foldWithMap", () => {
  it("mapea cada carácter plegado a su posición original", () => {
    const { folded, map } = foldWithMap("Ñoño");
    assert.equal(folded, "nono");
    assert.deepEqual(map, [0, 1, 2, 3]);
  });

  it("los rangos del mapa apuntan al texto original con acentos", () => {
    const { folded, map } = foldWithMap("días ñandú");
    assert.equal(folded, "dias nandu");
    // 'i' plegada sigue apuntando a la 'i' original (í es 1 char NFD-compuesta).
    assert.equal(map[1], 1);
    assert.equal(map[6], 6);
  });
});

describe("queryTokens", () => {
  it("divide en tokens y descarta vacíos", () => {
    assert.deepEqual(queryTokens("  Claude   SONNET "), ["claude", "sonnet"]);
  });

  it("query con solo espacios no produce tokens", () => {
    assert.deepEqual(queryTokens("   "), []);
  });
});

describe("matchesQuery", () => {
  it("encuentra sin acentos aunque el título los lleve", () => {
    assert.equal(matchesQuery(signal(), "proximamente"), true);
    assert.equal(matchesQuery(signal(), "PRÓXIMAMENTE"), true);
    assert.equal(matchesQuery(signal(), "nandu"), true);
  });

  it("exige todos los tokens (AND)", () => {
    assert.equal(matchesQuery(signal(), "anthropic proximamente"), true);
    assert.equal(matchesQuery(signal(), "anthropic deepseek"), false);
  });

  it("query vacío no filtra nada", () => {
    assert.equal(matchesQuery(signal(), ""), true);
    assert.equal(matchesQuery(signal(), "   "), true);
  });

  it("busca en summary, sourceLabel y modelos", () => {
    assert.equal(matchesQuery(signal(), "acento"), true);
    assert.equal(matchesQuery(signal(), "anthropic"), true);
    assert.equal(matchesQuery(signal(), "claude"), true);
    assert.equal(matchesQuery(signal(), "inexistente"), false);
  });
});

describe("matchRanges", () => {
  it("devuelve rangos sobre el texto ORIGINAL con acentos", () => {
    const text = "Los días de IA";
    const ranges = matchRanges(text, ["dias"]);
    assert.equal(ranges.length, 1);
    const [start, end] = ranges[0];
    assert.equal(text.slice(start, end), "días");
  });

  it("resalta cada aparición y respeta mayúsculas originales", () => {
    const text = "IA y ia e IA";
    const ranges = matchRanges(text, ["ia"]);
    assert.deepEqual(ranges, [
      [0, 2],
      [5, 7],
      [10, 12],
    ]);
    assert.equal(ranges.map(([a, b]) => text.slice(a, b)).join("|"), "IA|ia|IA");
  });

  it("sin tokens o sin matches devuelve vacío", () => {
    assert.deepEqual(matchRanges("hola", []), []);
    assert.deepEqual(matchRanges("hola", ["xyz"]), []);
  });
});

describe("parseInformeSearch", () => {
  it("acepta q y la normaliza (espacios, largo)", () => {
    const parsed = parseInformeSearch({ q: "  ia   agéntica  " });
    assert.equal(parsed.q, "ia agéntica");
    assert.equal(parseInformeSearch({ q: "x".repeat(200) }).q?.length, 140);
  });

  it("q vacío o ausente queda undefined (el router descarga el parámetro)", () => {
    const parsed = parseInformeSearch({});
    assert.deepEqual(parsed, { region: "all", model: "all", tab: "briefing", q: undefined });
    assert.equal(parseInformeSearch({ q: "   " }).q, undefined);
  });
});
