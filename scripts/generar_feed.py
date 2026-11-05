"""Genera public/feed.xml (RSS 2.0) y public/feed.atom (Atom 1.0) desde informes.json.

Sin red: lee public/data/informes.json (30 días de señales, cada item con
titulo/url/fuente/resumen/seccion/pais). Lo ejecuta el workflow diario justo
antes del commit, así los alimentadores se actualizan igual que el resto.

Uso:  python scripts/generar_feed.py
"""
import json
import re
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "data" / "informes.json"
OUT_RSS = ROOT / "public" / "feed.xml"
OUT_ATOM = ROOT / "public" / "feed.atom"
SITE = "https://ai-informe.vercel.app/"
TITLE = "AI Informe — el pulso de la IA"
DESC = "Recopilación diaria de noticias de IA: modelos, usos reales, economía y seguridad."
MAX_ITEMS = 25


def _parse_fecha(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(value, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", value)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
    return None


def load_items() -> list[dict]:
    days = json.loads(SRC.read_text(encoding="utf-8"))
    flat: list[dict] = []
    for day in days:
        for item in day.get("items", []):
            flat.append(item)
    # Más recientes primero: día descendente, título como desempate estable.
    flat.sort(key=lambda x: str(x.get("fecha") or ""), reverse=True)
    return flat[:MAX_ITEMS]


def rss(items: list[dict], now: datetime) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        "  <channel>",
        f"    <title>{escape(TITLE)}</title>",
        f"    <link>{SITE}</link>",
        "    <description>" + escape(DESC) + "</description>",
        "    <language>es-CL</language>",
        f"    <lastBuildDate>{format_datetime(now)}</lastBuildDate>",
        f'    <atom:link href="{SITE}feed.xml" rel="self" type="application/rss+xml"/>',
        "    <generator>AI-Informe (scripts/generar_feed.py)</generator>",
    ]
    for item in items:
        titulo = escape(str(item.get("titulo") or "Sin título"))
        link = escape(str(item.get("url") or SITE))
        fecha = _parse_fecha(str(item.get("fecha") or ""))
        pub_date = format_datetime(fecha) if fecha else format_datetime(now)
        resumen = escape(str(item.get("resumen") or ""))
        fuente = escape(str(item.get("fuente") or ""))
        seccion = escape(str(item.get("seccion") or ""))
        description = resumen + ((" Fuente: " + fuente) if fuente else "") + ((" · " + seccion) if seccion else "")
        lines += [
            "    <item>",
            f"      <title>{titulo}</title>",
            f"      <link>{link}</link>",
            f"      <guid isPermaLink=\"true\">{link}</guid>",
            f"      <pubDate>{pub_date}</pubDate>" if pub_date else "",
            f"      <description>{description}</description>",
            "    </item>",
        ]
    lines += ["  </channel>", "</rss>", ""]
    return "\n".join(lines)


def atom(items: list[dict], now: datetime) -> str:
    entries = []
    for item in items:
        title = escape(str(item.get("titulo") or "Sin título"))
        link = escape(str(item.get("url") or SITE))
        updated = _parse_fecha(str(item.get("fecha") or "")) or now
        updated = updated.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        summary = escape(str(item.get("resumen") or ""))
        entries.append(
            "  <entry>\n"
            f"    <title>{title}</title>\n"
            f"    <link href=\"{link}\"/>\n"
            f"    <id>{link}</id>\n"
            f"    <updated>{updated}</updated>\n"
            f"    <summary>{summary}</summary>\n"
            "  </entry>"
        )
    now_s = now.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<feed xmlns="http://www.w3.org/2005/Atom">\n'
        f"  <title>{escape(TITLE)}</title>\n"
        f"  <subtitle>{escape(DESC)}</subtitle>\n"
        f"  <link href=\"{SITE}feed.atom\" rel=\"self\"/>\n"
        f"  <link href=\"{SITE}\"/>\n"
        f"  <id>{SITE}feed.atom</id>\n"
        f"  <updated>{now_s}</updated>\n"
        + "\n".join(entries)
        + "\n</feed>\n"
    )


def main() -> None:
    SRC.exists() or (_ for _ in ()).throw(SystemExit(f"falta {SRC}"))
    items = load_items()
    if not items:
        raise SystemExit("informes.json sin items: feed no generado")
    now = datetime.now(timezone.utc)
    OUT_RSS.write_text(rss(items, now), encoding="utf-8")
    OUT_ATOM.write_text(atom(items, now), encoding="utf-8")
    print(f"OK feed -> {OUT_RSS} ({len(items)} entradas) y {OUT_ATOM}")


if __name__ == "__main__":
    main()
