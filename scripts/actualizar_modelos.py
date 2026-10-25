#!/usr/bin/env python3
"""Actualiza public/data/modelos.json (y copias de compatibilidad) con datos en vivo:
- Elo de LMArena (dataset oficial lmarena-ai/leaderboard-dataset en Hugging Face)
- Precios por token de OpenRouter (api/v1/models)

Uso: python scripts/actualizar_modelos.py [--max N]
Salida: public/data/modelos.json, public/modelos.json, web/modelos.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
OUT_PATHS = [
    ROOT / "web" / "modelos.json",
    ROOT / "public" / "data" / "modelos.json",
    ROOT / "public" / "modelos.json",
]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/152.0.0.0"

HF_ROWS = "https://datasets-server.huggingface.co/rows"
HF_DATASET = "lmarena-ai/leaderboard-dataset"
HF_PAGE = 100
HF_MAX_PAGES = 3

ORG_ALIASES = {
    "alibaba": "qwen",
    "meta": "meta-llama",
    "moonshot": "moonshotai",
    "xai": "x-ai",
    "zai": "z-ai",
}


def http_json(url: str, timeout: int = 30, retries: int = 3, backoff: float = 2.0) -> dict:
    last: Exception | None = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": UA, "Accept": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last = exc
            if attempt < retries:
                time.sleep(backoff * (attempt + 1))
    raise RuntimeError(f"No se pudo leer {url}: {last}")


def _slug(texto: str) -> str:
    t = texto.lower()
    t = re.sub(r"\([^)]*\)", " ", t)
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t


def _nombre_sin_org(nombre: str, org: str) -> str:
    n = _slug(nombre)
    for cand in {_slug(org), ORG_ALIASES.get(_slug(org), _slug(org))}:
        if cand and n.startswith(cand + "-"):
            return n[len(cand) + 1 :]
    return n


def _clave_modelo(nombre: str, org: str) -> str:
    org_key = ORG_ALIASES.get(_slug(org), _slug(org))
    nombre_key = _nombre_sin_org(nombre, org)
    return f"{org_key}-{nombre_key}" if org_key else nombre_key


def normalize_org(org_txt: str) -> str:
    t = org_txt.strip()
    low = t.lower()
    if low in {"xai", "x-ai"} or "spacexai" in low or (low.startswith("spacex") and "ai" in low):
        return "xAI"
    return t


def infer_licencia(org_txt: str) -> str:
    """No usar substring 'open': matcheaba OpenAI y marcaba GPT como open-weight."""
    t = org_txt.lower()
    if re.search(r"\b(mit|apache|bsd|open[-\s]?weight|open[-\s]?source)\b", t):
        return "open"
    return "cerrado"


def arena_desde_filas(filas: list[dict]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for fila in filas:
        if fila.get("category") != "overall":
            continue
        nombre = str(fila.get("model_name") or "").strip()
        rating = fila.get("rating")
        if not nombre or rating is None or nombre in out:
            continue
        org = normalize_org(str(fila.get("organization") or ""))
        licencia_txt = str(fila.get("license") or "")
        rank = fila.get("rank")
        votos = fila.get("vote_count")
        out[nombre] = {
            "elo": round(float(rating)),
            "org": org,
            "licencia": infer_licencia(licencia_txt or org),
            "rank": int(rank) if rank is not None else None,
            "votos": int(votos) if votos is not None else None,
            "fecha_leaderboard": fila.get("leaderboard_publish_date"),
        }
    return out


def fetch_lmarena(board: str = "text", limit: int = 60) -> dict[str, dict]:
    """Lee el leaderboard oficial de LMArena desde el dataset de Hugging Face."""
    if board != "text":
        raise ValueError(f"Leaderboard no soportado: {board}")
    filas: list[dict] = []
    for page in range(HF_MAX_PAGES):
        url = (
            f"{HF_ROWS}?dataset={quote(HF_DATASET, safe='')}"
            f"&config={board}&split=latest&offset={page * HF_PAGE}&length={HF_PAGE}"
        )
        data = http_json(url)
        rows = [r.get("row", {}) for r in data.get("rows", [])]
        filas.extend(rows)
        overall = sum(1 for f in filas if f.get("category") == "overall")
        if overall >= limit or len(rows) < HF_PAGE:
            break
    return arena_desde_filas(filas)


def fetch_openrouter() -> dict[str, dict]:
    """Devuelve {slug_corto: {precio_in, precio_out, context, org}} — precios en $/1M tokens."""
    data = http_json("https://openrouter.ai/api/v1/models", timeout=30)
    out: dict[str, dict] = {}
    for m in data.get("data", []):
        mid = m.get("id")
        if not mid:
            continue
        if ":" in mid and "free" not in mid:  # saltar variantes :batch/:pro/:free
            continue
        p = m.get("pricing", {})
        try:
            pin = float(p.get("prompt", 0) or 0) * 1_000_000
            pout = float(p.get("completion", 0) or 0) * 1_000_000
        except (TypeError, ValueError):
            continue
        slug = mid.split("/", 1)[1] if "/" in mid else mid
        # quedarnos con la variante más barata si hay duplicados
        if slug not in out or pout < out[slug]["precio_out"]:
            out[slug] = {
                "precio_in": round(pin, 3),
                "precio_out": round(pout, 3),
                "context": m.get("context_length"),
                "org": mid.split("/")[0],
                "id_openrouter": mid,
            }
    return out


def _indice_precios(ordr: dict[str, dict]) -> tuple[dict[str, dict], dict[str, dict]]:
    exacto: dict[str, list[dict]] = {}
    por_nombre: dict[str, list[dict]] = {}
    for slug, datos in ordr.items():
        mid = datos.get("id_openrouter") or slug
        exacto.setdefault(_slug(mid), []).append(datos)
        por_nombre.setdefault(_slug(slug), []).append(datos)

    def mas_barato(opciones: list[dict]) -> dict:
        return min(opciones, key=lambda d: d["precio_out"])

    unicos = {
        clave: mas_barato(datos)
        for clave, datos in por_nombre.items()
        if len({d.get("id_openrouter") or clave for d in datos}) == 1
    }
    return {clave: mas_barato(datos) for clave, datos in exacto.items()}, unicos


def match(arena: dict[str, dict], ordr: dict[str, dict]) -> list[dict]:
    """Cruza modelos de LMArena con precios de OpenRouter por org+nombre normalizado."""
    exacto, por_nombre = _indice_precios(ordr)
    rows = []
    for name, a in arena.items():
        best = exacto.get(_clave_modelo(name, a["org"]))
        if best is None:
            best = por_nombre.get(_nombre_sin_org(name, a["org"]))
        row = {
            "modelo": name,
            "elo": a["elo"],
            "org": a["org"],
            "licencia": a["licencia"],
        }
        for extra in ("rank", "votos", "fecha_leaderboard"):
            if a.get(extra) is not None:
                row[extra] = a[extra]
        if best:
            row.update({
                "precio_in": best["precio_in"],
                "precio_out": best["precio_out"],
                "context": best["context"],
            })
        rows.append(row)
    rows.sort(key=lambda r: (r.get("rank") is None, r.get("rank") or 0, -r["elo"]))
    return rows


def construir_payload(
    arena: dict[str, dict],
    ordr: dict[str, dict],
    max_n: int = 60,
    ahora: datetime | None = None,
) -> dict:
    rows = match(arena, ordr)[:max_n]
    if not rows:
        raise ValueError("LMArena no devolvió modelos; no se sobrescribe el JSON anterior")
    con_precio = sum(1 for r in rows if "precio_out" in r)
    return {
        "actualizado": (ahora or datetime.now()).isoformat(timespec="seconds"),
        "fuentes": [
            "huggingface.co/datasets/lmarena-ai/leaderboard-dataset",
            "openrouter.ai/api/v1/models",
        ],
        "total": len(rows),
        "con_precio": con_precio,
        "modelos": rows,
    }


def escribir_payload(payload: dict, paths: list[Path] | None = None) -> None:
    text = json.dumps(payload, ensure_ascii=False, indent=1)
    for path in paths or OUT_PATHS:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=60, help="top N modelos a guardar")
    args = ap.parse_args()

    print("[1/3] LMArena (dataset oficial en Hugging Face)…")
    try:
        arena = fetch_lmarena("text", args.max)
    except Exception as exc:
        print(f"ERROR: no se pudo leer LMArena: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    print(f"      {len(arena)} modelos con Elo")

    print("[2/3] OpenRouter…")
    try:
        ordr = fetch_openrouter()
    except Exception as exc:
        print(f"      [warn] OpenRouter falló: {exc}; se publica solo Elo", file=sys.stderr)
        ordr = {}
    print(f"      {len(ordr)} slugs con precio")

    print("[3/3] Cruce y export…")
    try:
        payload = construir_payload(arena, ordr, args.max)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    escribir_payload(payload)
    print(f"OK -> {OUT_PATHS[1]} ({payload['total']} modelos, {payload['con_precio']} con precio)")


if __name__ == "__main__":
    main()
