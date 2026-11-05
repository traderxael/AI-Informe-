#!/usr/bin/env python3
"""Genera el feed RSS del informe en public/feed.xml (y public/feed.json).

El pipeline consume 33 feeds RSS; este publica el propio output para que
cualquiera pueda suscribirse al informe diario desde su lector.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
INFORMES = ROOT / "informes"
OUT_XML = ROOT / "public" / "feed.xml"
OUT_JSON = ROOT / "public" / "feed.json"

SITE = "https://ai-informe.vercel.app"
REPO_BLOB = "https://github.com/traderxael/AI-Informe-/blob/main/informes"
TITULO_FEED = "AI Informe — noticias de IA en español"
DESCRIPCION_FEED = (
    "Recopilación diaria y automática de noticias de IA: novedades, usos reales, "
    "economía, señales de futuro y seguridad. Un informe por día."
)
MAX_ITEMS = 30

_RE_TITULO = re.compile(r"^#\s+(.+?)\s*$", re.M)
_RE_RESUMEN = re.compile(
    r"^##\s+Resumen del d[ií]a\s*$(.*?)(?=^##\s|\Z)", re.M | re.S
)


def listar_fechas(directorio: Path = INFORMES) -> list[str]:
    """Fechas (YYYY-MM-DD) con informe, de la mas reciente a la mas antigua."""
    if not directorio.exists():
        return []
    fechas = []
    for path in directorio.glob("*.md"):
        nombre = path.stem
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", nombre):
            fechas.append(nombre)
    return sorted(fechas, reverse=True)


def extraer_titulo(texto: str, fecha: str) -> str:
    match = _RE_TITULO.search(texto)
    return match.group(1).strip() if match else f"Informe de IA — {fecha}"


def extraer_resumen(texto: str) -> str:
    """Primer parrafo con contenido del bloque 'Resumen del dia'."""
    match = _RE_RESUMEN.search(texto)
    bloque = match.group(1) if match else texto
    for parrafo in re.split(r"\n\s*\n", bloque):
        limpio = parrafo.strip()
        if limpio and not limpio.startswith(("#", "-", "*", ">")):
            return re.sub(r"\s+", " ", limpio)
    return ""


def escapar(texto: str) -> str:
    return escape(texto or "")


def construir_item(fecha: str, titulo: str, resumen: str) -> str:
    enlace = f"{REPO_BLOB}/{fecha}.md"
    fecha_dt = datetime.strptime(fecha, "%Y-%m-%d").replace(
        hour=9, minute=0, tzinfo=timezone.utc
    )
    return (
        "    <item>\n"
        f"      <title>{escapar(titulo)}</title>\n"
        f"      <link>{escapar(enlace)}</link>\n"
        f"      <guid isPermaLink=\"false\">informe-{fecha}</guid>\n"
        f"      <pubDate>{format_datetime(fecha_dt)}</pubDate>\n"
        f"      <description>{escapar(resumen)}</description>\n"
        "      <category>Inteligencia artificial</category>\n"
        "    </item>"
    )


def construir_xml(items: list[dict]) -> str:
    canal = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n'
        "  <channel>\n"
        f"    <title>{escapar(TITULO_FEED)}</title>\n"
        f"    <link>{escapar(SITE)}</link>\n"
        f"    <description>{escapar(DESCRIPCION_FEED)}</description>\n"
        "    <language>es</language>\n"
        '    <atom:link href="https://ai-informe.vercel.app/feed.xml" '
        'rel="self" type="application/rss+xml"/>\n'
    )
    cuerpo = "\n".join(construir_item(i["fecha"], i["titulo"], i["resumen"]) for i in items)
    return f"{canal}{cuerpo}\n  </channel>\n</rss>\n"


def construir_json_feed(items: list[dict]) -> str:
    payload = {
        "version": "https://jsonfeed.org/version/1.1",
        "title": TITULO_FEED,
        "home_page_url": SITE,
        "feed_url": f"{SITE}/feed.json",
        "description": DESCRIPCION_FEED,
        "language": "es",
        "items": [
            {
                "id": f"informe-{i['fecha']}",
                "url": f"{REPO_BLOB}/{i['fecha']}.md",
                "title": i["titulo"],
                "summary": i["resumen"],
                "date_published": f"{i['fecha']}T09:00:00Z",
            }
            for i in items
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=1)


def recoger_items(directorio: Path = INFORMES, limite: int = MAX_ITEMS) -> list[dict]:
    items = []
    for fecha in listar_fechas(directorio)[:limite]:
        try:
            texto = (directorio / f"{fecha}.md").read_text(encoding="utf-8")
        except OSError:
            continue
        items.append(
            {
                "fecha": fecha,
                "titulo": extraer_titulo(texto, fecha),
                "resumen": extraer_resumen(texto),
            }
        )
    return items


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera el feed RSS/JSON del informe")
    parser.add_argument("--max", type=int, default=MAX_ITEMS, help="máximo de items")
    parser.add_argument("--out", type=Path, default=OUT_XML, help="ruta del RSS")
    parser.add_argument("--out-json", type=Path, default=OUT_JSON, help="ruta del JSON Feed")
    args = parser.parse_args()

    items = recoger_items(limite=args.max)
    if not items:
        print("[warn] no hay informes para publicar en el feed", file=sys.stderr)
        sys.exit(0)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(construir_xml(items), encoding="utf-8")
    args.out_json.parent.mkdir(parents=True, exist_ok=True)
    args.out_json.write_text(construir_json_feed(items), encoding="utf-8")
    print(f"OK -> {args.out} y {args.out_json} ({len(items)} informes)")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[warn] generar_feed no pudo completarse: {exc}", file=sys.stderr)
        sys.exit(0)
