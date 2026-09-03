#!/usr/bin/env python3
"""Genera el informe diario de IA a partir de feeds RSS públicos."""

from __future__ import annotations

import argparse
import html
import json
import re
import ssl
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
INFORMES_DIR = ROOT / "informes"
WEB_DIR = ROOT / "web"

FEEDS = [
    ("OpenAI", "https://openai.com/news/rss.xml"),
    ("Google AI", "https://blog.google/technology/ai/rss/"),
    ("DeepMind", "https://deepmind.google/blog/rss.xml"),
    ("Meta AI", "https://ai.meta.com/blog/rss/"),
    ("Hugging Face", "https://huggingface.co/blog/feed.xml"),
    ("TechCrunch AI", "https://techcrunch.com/category/artificial-intelligence/feed/"),
    ("The Verge AI", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
    ("MIT Tech Review AI", "https://www.technologyreview.com/topic/artificial-intelligence/feed"),
    ("Ars Technica AI", "https://arstechnica.com/ai/feed/"),
    ("VentureBeat AI", "https://venturebeat.com/category/ai/feed/"),
]

SECTIONS = (
    "novedades",
    "usos",
    "economia",
    "futuro",
)

SECTION_TITLES = {
    "novedades": "Novedades y cambios que se quedan",
    "usos": "Usos de IA en el mundo real",
    "economia": "Economía de la IA",
    "futuro": "Señales de futuro",
}

SITE_URL = "https://ai-informe.vercel.app"  # se puede ajustar luego
SITE_NAME = "AI Informe"
SITE_DESC = "Recopilación diaria de novedades, usos reales, economía y señales de futuro de la IA."

DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
         "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def fecha_larga(day: date) -> str:
    dow = DIAS_SEMANA[day.weekday()]
    return f"{dow} {day.day} de {MESES[day.month - 1]} de {day.year}"

KEYWORDS: dict[str, tuple[str, ...]] = {
    "economia": (
        "funding",
        "investment",
        "investor",
        "valuation",
        "ipo",
        "stock",
        "nvidia",
        "revenue",
        "billion",
        "million",
        "acquisition",
        "acquire",
        "deal",
        "layoff",
        "market cap",
        "earnings",
        "profit",
        "cost",
        "pricing",
        "inversión",
        "millones",
        "miles de millones",
        "compra",
        "adquisición",
        "bolsa",
        "economía",
        "economia",
    ),
    "usos": (
        "healthcare",
        "hospital",
        "clinic",
        "education",
        "school",
        "university",
        "manufacturing",
        "factory",
        "customer service",
        "enterprise",
        "government",
        "deployment",
        "production",
        "use case",
        "real-world",
        "real world",
        "farmer",
        "doctor",
        "salud",
        "hospital",
        "educación",
        "educacion",
        "empresa",
        "gobierno",
        "industria",
        "caso de uso",
        "mundo real",
    ),
    "futuro": (
        "regulation",
        "regulator",
        "eu ai act",
        "agi",
        "forecast",
        "prediction",
        "roadmap",
        "policy",
        "safety",
        "future",
        "2030",
        "2027",
        "alignment",
        "legislat",
        "regulación",
        "regulacion",
        "ley",
        "futuro",
        "hoja de ruta",
        "seguridad",
    ),
    "novedades": (
        "model",
        "gpt",
        "claude",
        "gemini",
        "llama",
        "release",
        "launch",
        "update",
        "open source",
        "open-source",
        "paper",
        "research",
        "api",
        "feature",
        "announce",
        "benchmark",
        "weight",
        "checkpoint",
    ),
}

SSL_CONTEXT = ssl.create_default_context()


def fetch_url(url: str, timeout: int = 20) -> bytes | None:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "AI-Informe/1.0 (+https://github.com/traderxael/AI-Informe-)",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CONTEXT) as resp:
            return resp.read()
    except (urllib.error.URLError, TimeoutError, OSError):
        return None


def local_tag(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def text_of(el: ET.Element | None) -> str:
    if el is None:
        return ""
    return "".join(el.itertext()).strip()


def parse_date(value: str) -> datetime | None:
    value = value.strip()
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (TypeError, ValueError, OverflowError):
        pass
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def parse_feed(xml_bytes: bytes) -> list[dict[str, Any]]:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []

    items: list[dict[str, Any]] = []
    for node in root.iter():
        name = local_tag(node.tag).lower()
        if name not in {"item", "entry"}:
            continue
        title = ""
        link = ""
        summary = ""
        published: datetime | None = None
        for child in list(node):
            cname = local_tag(child.tag).lower()
            if cname == "title":
                title = text_of(child)
            elif cname == "link":
                href = child.attrib.get("href") or text_of(child)
                if href:
                    link = href
            elif cname in {"description", "summary", "content"}:
                if not summary:
                    summary = text_of(child)
            elif cname in {"pubdate", "published", "updated", "date"}:
                published = parse_date(text_of(child)) or published
        if title:
            items.append(
                {
                    "title": re.sub(r"\s+", " ", title),
                    "link": link.strip(),
                    "summary": strip_tags(summary)[:400],
                    "published": published,
                }
            )
    return items


def strip_tags(raw: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def classify(title: str, summary: str) -> str:
    blob = f"{title} {summary}".lower()
    scores = {section: 0 for section in SECTIONS}
    for section, words in KEYWORDS.items():
        for word in words:
            if word.lower() in blob:
                scores[section] += 1
    best = max(SECTIONS, key=lambda s: scores[s])
    if scores[best] == 0:
        return "novedades"
    return best


def collect_items(day: date, lookback_hours: int = 168) -> list[dict[str, Any]]:
    cutoff = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
    min_dt = cutoff - timedelta(hours=lookback_hours)
    seen: set[str] = set()
    collected: list[dict[str, Any]] = []

    for source, url in FEEDS:
        payload = fetch_url(url)
        if not payload:
            continue
        for item in parse_feed(payload):
            key = (item.get("link") or item["title"]).lower()
            if key in seen:
                continue
            published = item.get("published")
            if published is not None and published < min_dt:
                continue
            seen.add(key)
            item["source"] = source
            item["section"] = classify(item["title"], item.get("summary") or "")
            collected.append(item)

    collected.sort(key=lambda it: it.get("published") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return collected


def bullet(item: dict[str, Any]) -> str:
    title = item["title"].replace("\n", " ")
    link = item.get("link") or ""
    source = item.get("source") or ""
    if link:
        return f"- [{title}]({link}) — {source}"
    return f"- {title} — {source}"


def render_markdown(day: date, items: list[dict[str, Any]]) -> str:
    by_section: dict[str, list[dict[str, Any]]] = {s: [] for s in SECTIONS}
    for item in items:
        by_section[item["section"]].append(item)

    def block(section: str, empty: str) -> str:
        rows = by_section[section][:12]
        if not rows:
            return empty
        return "\n".join(bullet(it) for it in rows)

    n_nov = len(by_section["novedades"])
    n_uso = len(by_section["usos"])
    n_eco = len(by_section["economia"])
    n_fut = len(by_section["futuro"])
    total = len(items)

    if total:
        resumen = (
            f"Hoy se recopilaron {total} piezas sobre IA "
            f"({n_nov} novedades, {n_uso} usos reales, {n_eco} economía, {n_fut} futuro). "
            "Abajo van las más recientes, agrupadas por tema."
        )
        if items:
            top = items[0]["title"]
            resumen += f" Lo más visible: {top}."
    else:
        resumen = (
            "No llegaron ítems nuevos de los feeds en la ventana de las últimas horas. "
            "Revisa las fuentes o vuelve a ejecutar con `--force` más tarde."
        )

    fuentes = []
    for source, url in FEEDS:
        fuentes.append(f"- {source}: {url}")

    return f"""# Informe de IA — {day.isoformat()}

## Resumen del día

{resumen}

## Novedades y cambios que se quedan

{block("novedades", "- Sin novedades claras en los feeds de hoy.")}

## Usos de IA en el mundo real

{block("usos", "- Sin casos de uso destacados en los feeds de hoy.")}

## Economía de la IA

{block("economia", "- Sin notas económicas destacadas en los feeds de hoy.")}

## Señales de futuro

{block("futuro", "- Sin señales de regulación o horizonte en los feeds de hoy.")}

## Fuentes

{chr(10).join(fuentes)}
"""


def md_to_html(md: str) -> str:
    lines = md.replace("\r\n", "\n").split("\n")
    out: list[str] = []
    in_list = False

    def close_list() -> None:
        nonlocal in_list
        if in_list:
            out.append("</ul>")
            in_list = False

    def inline(text: str) -> str:
        text = html.escape(html.unescape(text))
        text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
        text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2" rel="noopener">\1</a>', text)
        return text

    for line in lines:
        if line.startswith("### "):
            close_list()
            out.append(f"<h3>{inline(line[4:])}</h3>")
        elif line.startswith("## "):
            close_list()
            out.append(f"<h2>{inline(line[3:])}</h2>")
        elif line.startswith("# "):
            close_list()
            out.append(f"<h1>{inline(line[2:])}</h1>")
        elif line.startswith("- "):
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline(line[2:])}</li>")
        elif line.strip() == "":
            close_list()
        else:
            close_list()
            out.append(f"<p>{inline(line)}</p>")
    close_list()
    return "\n".join(out)


def list_informes() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for path in sorted(INFORMES_DIR.glob("*.md"), reverse=True):
        if path.name.startswith("_"):
            continue
        text = path.read_text(encoding="utf-8")
        title = path.stem
        for line in text.splitlines():
            if line.startswith("# "):
                title = line[2:].strip()
                break
        summary = ""
        capture = False
        for line in text.splitlines():
            if line.strip() == "## Resumen del día":
                capture = True
                continue
            if capture:
                if line.startswith("## "):
                    break
                if line.strip():
                    summary = line.strip()
                    break
        rows.append(
            {
                "date": path.stem,
                "title": title,
                "file": f"dias/{path.stem}.html",
                "summary": summary,
            }
        )
    return rows


def write_report_page(day: str, body_html: str, title: str) -> None:
    dest_dir = WEB_DIR / "dias"
    dest_dir.mkdir(parents=True, exist_ok=True)
    page = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <div class="wrap">
    <header>
      <p><a href="../index.html">← Todos los informes</a></p>
    </header>
    <article>
      {body_html}
    </article>
  </div>
</body>
</html>
"""
    (dest_dir / f"{day}.html").write_text(page, encoding="utf-8")


def regenerate_web() -> None:
    WEB_DIR.mkdir(parents=True, exist_ok=True)
    (WEB_DIR / "dias").mkdir(parents=True, exist_ok=True)
    rows = list_informes()
    (WEB_DIR / "informes.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    for path in INFORMES_DIR.glob("*.md"):
        if path.name.startswith("_"):
            continue
        md = path.read_text(encoding="utf-8")
        title = path.stem
        for line in md.splitlines():
            if line.startswith("# "):
                title = line[2:].strip()
                break
        write_report_page(path.stem, md_to_html(md), title)

    nav_items = []
    for i, row in enumerate(rows):
        cls = ' class="active"' if i == 0 else ""
        nav_items.append(
            f'<a href="{html.escape(row["file"])}"{cls}>{html.escape(row["date"])}</a>'
        )
    nav_html = "\n          ".join(nav_items) if nav_items else '<p class="empty">Aún no hay informes.</p>'

    latest_html = '<p class="empty">Todavía no hay un informe. Ejecuta <code>python scripts/generar_informe.py</code>.</p>'
    if rows:
        latest_md = (INFORMES_DIR / f"{rows[0]['date']}.md").read_text(encoding="utf-8")
        latest_html = md_to_html(latest_md)

    index = f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Informe</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="wrap">
    <header>
      <h1>AI Informe</h1>
      <p>Recopilación diaria de novedades, usos reales, economía y señales de futuro de la IA.</p>
    </header>
    <div class="layout">
      <nav>
        <h2>Informes</h2>
          {nav_html}
      </nav>
      <article>
        {latest_html}
      </article>
    </div>
  </div>
</body>
</html>
"""
    (WEB_DIR / "index.html").write_text(index, encoding="utf-8")


def export_web_json(day: date, items: list[dict[str, Any]]) -> None:
    """Exporta los datos del informe a JSON para la web moderna."""
    # Agrupar por secciones
    by_section: dict[str, list[dict[str, Any]]] = {s: [] for s in SECTIONS}
    for item in items:
        by_section[item["section"]].append(item)
    
    # Convertir items a formato JSON
    def item_to_json(item: dict) -> dict:
        return {
            "titulo": item["title"],
            "url": item.get("link", ""),
            "fuente": item.get("source", ""),
            "resumen": item.get("summary", "")[:200] + "..." if len(item.get("summary", "")) > 200 else item.get("summary", ""),
            "seccion": item.get("section", "novedades"),
            "fecha": day.isoformat(),
        }
    
    data = {
        "fecha": day.isoformat(),
        "total": len(items),
        "por_seccion": {
            "novedades": [item_to_json(i) for i in by_section["novedades"][:10]],
            "usos": [item_to_json(i) for i in by_section["usos"][:10]],
            "economia": [item_to_json(i) for i in by_section["economia"][:10]],
            "futuro": [item_to_json(i) for i in by_section["futuro"][:10]],
        },
        "fuentes": [{"nombre": s, "url": u} for s, u in FEEDS],
    }
    
    # Append al historial (últimos 30 días)
    historial_path = WEB_DIR / "informes-data.json"
    historial = []
    if historial_path.exists():
        try:
            historial = json.loads(historial_path.read_text(encoding="utf-8"))
        except:
            historial = []
    
    # Evitar duplicados del mismo día
    historial = [h for h in historial if h.get("fecha") != day.isoformat()]
    historial.append(data)
    historial = historial[-30:]  # Últimos 30 días
    
    historial_path.write_text(
        json.dumps(historial, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )
    
    # También exportar a formato simple para compatibilidad
    simple_data = [{"fecha": day.isoformat(), "total": len(items), "items": data["por_seccion"]["novedades"]}]
    simple_path = WEB_DIR / "informes.json"
    
    existing_simple = []
    if simple_path.exists():
        try:
            existing_simple = json.loads(simple_path.read_text(encoding="utf-8"))
        except:
            existing_simple = []
    
    existing_simple = [x for x in existing_simple if x.get("fecha") != day.isoformat()]
    existing_simple.append(simple_data[0])
    existing_simple = existing_simple[-30:]
    
    simple_path.write_text(
        json.dumps(existing_simple, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )
    
    print(f"  JSON exportado: {historial_path}")


def write_informe(day: date, force: bool) -> Path:
    INFORMES_DIR.mkdir(parents=True, exist_ok=True)
    dest = INFORMES_DIR / f"{day.isoformat()}.md"
    if dest.exists() and not force:
        print(f"Ya existe {dest.name}. Usa --force para regenerarlo.")
        regenerate_web()
        return dest
    items = collect_items(day)
    dest.write_text(render_markdown(day, items), encoding="utf-8")
    export_web_json(day, items)  # Exportar para la web moderna
    regenerate_web()
    print(f"Escrito {dest.relative_to(ROOT)} ({len(items)} ítems).")
    return dest


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera el informe diario de IA.")
    parser.add_argument("--fecha", help="Fecha YYYY-MM-DD (por defecto: hoy UTC).")
    parser.add_argument("--force", action="store_true", help="Sobrescribe el informe si ya existe.")
    parser.add_argument("--solo-web", action="store_true", help="Solo regenera la web a partir de los Markdown.")
    args = parser.parse_args()

    if args.solo_web:
        regenerate_web()
        print("Web actualizada.")
        return

    if args.fecha:
        day = date.fromisoformat(args.fecha)
    else:
        day = datetime.now(timezone.utc).date()
    write_informe(day, force=args.force)


if __name__ == "__main__":
    main()
