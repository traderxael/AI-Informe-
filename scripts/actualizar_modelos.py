#!/usr/bin/env python3
"""Actualiza web/modelos.json con datos en vivo:
- Elo de LMArena (arena.ai, tablas server-rendered)
- Precios por token de OpenRouter (api/v1/models)

Uso: python scripts/actualizar_modelos.py [--max N]
Salida: web/modelos.json
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "modelos.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/152.0.0.0"

BOARDS = {
    "text": "Texto",
    "code/webdev": "WebDev",
}


def curl(url: str, timeout: int = 30) -> str:
    r = subprocess.run(
        ["curl", "-s", "--max-time", str(timeout), url, "-H", f"User-Agent: {UA}"],
        capture_output=True, text=True, timeout=timeout + 10,
    )
    return r.stdout


def fetch_lmarena(board: str) -> dict[str, dict]:
    """Parsea la tabla server-rendered de arena.ai. Devuelve {modelo: {elo, org}}."""
    html = curl(f"https://arena.ai/leaderboard/{board}")
    out: dict[str, dict] = {}
    for m in re.finditer(r'title="([a-z0-9\.\-_:]+)"', html):
        model = m.group(1)
        if model in out:
            continue
        seg = html[m.end(): m.end() + 2500]
        elo = re.search(r'<span class="body-sm">(\d{3,4})</span>', seg)
        org = re.search(
            r'<span class="text-text-secondary truncate text-xs">([^<]+)</span>', seg
        )
        if elo:
            org_txt = org.group(1) if org else ""
            lic = "open" if any(
                k in org_txt.lower() for k in ("mit", "apache", "license", "open")
            ) else "cerrado"
            out[model] = {"elo": int(elo.group(1)), "org": org_txt, "licencia": lic}
    return out


def fetch_openrouter() -> dict[str, dict]:
    """Devuelve {slug_corto: {precio_in, precio_out, context, org}} — precios en $/1M tokens."""
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/models", headers={"User-Agent": UA}
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    out = {}
    for m in data.get("data", []):
        mid = m["id"]
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


def _variantes(name: str) -> list[str]:
    """Genera candidatas quitando sufijos de esfuerzo: -high/-max/-xhigh/-thinking."""
    cands = [name]
    base = re.sub(r"-(x?high|max|thinking|minimal)$", "", name)
    if base != name:
        cands.append(base)
    return cands


def match(arena: dict[str, dict], ordr: dict[str, dict]) -> list[dict]:
    """Cruza modelos de LMArena con precios de OpenRouter por slug."""
    rows = []
    for name, a in arena.items():
        best = None
        for cand in _variantes(name):
            if cand in ordr:
                best = ordr[cand]
                break
            pref = [s for s in ordr if s.startswith(cand)]
            if pref:
                best = ordr[min(pref, key=len)]
                break
        row = {
            "modelo": name,
            "elo": a["elo"],
            "org": a["org"],
            "licencia": a["licencia"],
        }
        if best:
            row.update({
                "precio_in": best["precio_in"],
                "precio_out": best["precio_out"],
                "context": best["context"],
            })
        rows.append(row)
    rows.sort(key=lambda r: -r["elo"])
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=60, help="top N modelos a guardar")
    args = ap.parse_args()

    print("[1/3] LMArena…")
    arena = fetch_lmarena("text")
    print(f"      {len(arena)} modelos con Elo")
    print("[2/3] OpenRouter…")
    ordr = fetch_openrouter()
    print(f"      {len(ordr)} slugs con precio")
    print("[3/3] Cruce y export…")
    rows = match(arena, ordr)[: args.max]
    con_precio = sum(1 for r in rows if "precio_out" in r)

    payload = {
        "actualizado": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "fuentes": ["arena.ai/leaderboard/text", "openrouter.ai/api/v1/models"],
        "total": len(rows),
        "con_precio": con_precio,
        "modelos": rows,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK -> {OUT} ({len(rows)} modelos, {con_precio} con precio)")


if __name__ == "__main__":
    main()
