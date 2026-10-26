#!/usr/bin/env python3
"""Publica la salud de las fuentes del pipeline en public/data/feed_health.json."""
from __future__ import annotations

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path

import generar_informe as gi
import sources as S

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "feed_health.json"
MODELOS = ROOT / "public" / "data" / "modelos.json"
MAX_WORKERS = 8
RANKING_STALE_H = 48


def probar_feed(nombre: str, url: str) -> dict:
    base = {"nombre": nombre, "url": url, "items": 0, "estado": "error", "detalle": ""}
    try:
        raw = gi.fetch_url(url, timeout=12, retries=1)
    except Exception as exc:
        return {**base, "detalle": f"fetch: {exc}"[:160]}
    if not raw:
        return {**base, "detalle": "sin respuesta"}
    try:
        items = gi.parse_feed(raw)
    except Exception as exc:
        return {**base, "detalle": f"parse: {exc}"[:160]}
    if not items:
        return {**base, "estado": "vacio", "detalle": "0 items"}
    return {**base, "items": len(items), "estado": "ok"}


def estado_ranking(payload: dict | None, ahora: datetime | None = None) -> dict:
    ahora = ahora or datetime.now()
    if not isinstance(payload, dict) or not payload.get("modelos"):
        actualizado = payload.get("actualizado") if isinstance(payload, dict) else None
        return {"estado": "sin_datos", "total": 0, "actualizado": actualizado}
    actualizado = payload.get("actualizado")
    estado = "ok"
    try:
        fecha = datetime.fromisoformat(str(actualizado))
        if ahora - fecha > timedelta(hours=RANKING_STALE_H):
            estado = "stale"
    except (TypeError, ValueError):
        estado = "stale"
    return {
        "estado": estado,
        "total": payload.get("total", len(payload.get("modelos", []))),
        "actualizado": actualizado,
    }


def construir_health(
    resultados: list[dict], ranking: dict, ahora: datetime | None = None
) -> dict:
    ahora = ahora or datetime.now()
    return {
        "generado": ahora.isoformat(timespec="seconds"),
        "total_feeds": len(resultados),
        "ok": sum(1 for r in resultados if r["estado"] == "ok"),
        "vacios": sum(1 for r in resultados if r["estado"] == "vacio"),
        "rotos": sum(1 for r in resultados if r["estado"] == "error"),
        "feeds": resultados,
        "ranking": ranking,
    }


def leer_ranking() -> dict | None:
    try:
        return json.loads(MODELOS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def main() -> None:
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        resultados = list(pool.map(lambda f: probar_feed(*f), S.FEEDS))
    payload = construir_health(resultados, estado_ranking(leer_ranking()))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(
        f"OK -> {OUT} ({payload['ok']}/{payload['total_feeds']} feeds vivos, "
        f"{payload['vacios']} vacios, {payload['rotos']} rotos, "
        f"ranking={payload['ranking']['estado']})"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[warn] feed_health no pudo completarse: {exc}", file=sys.stderr)
        sys.exit(0)
