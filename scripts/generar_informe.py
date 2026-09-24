#!/usr/bin/env python3
"""Genera el informe diario de IA a partir de feeds RSS públicos."""

from __future__ import annotations

import argparse
import gzip
import html
import json
import re
import ssl
import time
import unicodedata
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

# Fuente única de verdad: ver scripts/sources.py (hallazgo 4 de la auditoría)
from sources import FEEDS, FUENTES_CHINA, FUENTES_USA  # noqa: E402

SECTIONS = (
    "novedades",
    "usos",
    "economia",
    "futuro",
    "seguridad",
)

# Orden de desempate cuando dos secciones empatan en puntaje, de mas especifica
# a mas difusa. "seguridad" describe un riesgo concreto (CVE, exploit, fuga) y
# sus titulares casi siempre mencionan tambien "hospital"/"government", que
# suman a "usos"; sin este orden la nota se va a la seccion equivocada.
SECTION_DESEMPATE = ("seguridad", "economia", "futuro", "usos", "novedades")

SECTION_TITLES = {
    "novedades": "Novedades y cambios que se quedan",
    "usos": "Usos de IA en el mundo real",
    "economia": "Economía de la IA",
    "futuro": "Señales de futuro",
    "seguridad": "Ciberseguridad y riesgos",
}

SITE_URL = "https://ai-informe-dashboard.vercel.app"
SITE_NAME = "AI Informe"
SITE_DESC = ("Recopilación diaria de novedades, usos reales, economía, señales de "
             "futuro y ciberseguridad de la IA.")

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
        # Formas abreviadas: "$150M", "$6.4B", "USD 400M". Con \b el "150m" de
        # "$150M" no matcheaba "million" y la nota caia en "novedades".
        r"\$\d+(?:\.\d+)?[bm]\b",
        r"usd\s?\d+(?:\.\d+)?[bm]\b",
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
        "educación",
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
        "ley",
        "futuro",
        "hoja de ruta",
        # "seguridad" se movió a su propia sección (arregla el solape: las
        # alertas de CISA/Hacker News caían acá en vez de en seguridad).
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
    # Ciberseguridad (seccion propia, 24-sep-2026). Se evalua con la misma
    # regla de limites de palabra que el resto; "seguridad" sola quedo en
    # "futuro" y por eso las alertas de CISA/Hacker News caian ahi.
"seguridad": (
        # Las keywords se matchean por palabra COMPLETA (\b), asi que la forma
        # singular y la plural tienen que estar las dos: un titular con
        # "vulnerability" (singular) no matcheaba "vulnerabilities" y caia en
        # "novedades". Mismo criterio para exploit/exploited, breach/breaches.
        "vulnerability",
        "vulnerabilities",
        "vulnerability's",
        "exploit",
        "exploited",
        "exploits",
        "zero-day",
        "zero day",
        "ransomware",
        "malware",
        "phishing",
        "breach",
        "backdoor",
        "botnet",
        "trojan",
        "spyware",
        "cve-",
        "cve ",
        "patch",
        "vulnerability scanner",
        "penetration test",
        "pen test",
        "infostealer",
        "credential",
        "supply chain",
        "ddos",
        "cybersecurity",
        "cyber attack",
        "security flaw",
        "security bug",
        "security advisory",
        "compromise",
        "attackers",
        "hackers",
        "infostealers",
        "data leak",
        "wiper",
        # Castellano (24-sep): el paso "Resúmenes LLM (Groq)" traduce los
        # summary de signals Y el informe se arma sobre titulares ya traducidos en
        # algunas corridas, asi que un titular como "OpenAI agents hacked an
        # Australian government website" llega en español ("hackearon") y las
        # keywords en ingles dejan de matchear -> caia en "usos" o "economia".
        "hack",
        "hackear",
        "hackearon",
        "ciberataque",
        "ciberataques",
        "infiltracion",
        "infiltraron",
        "filtracion de datos",
        "robo de datos",
        "vulnerabilidades",
        "vulnerabilidad",
        # Formas verbales/singulares en ingles. 24-sep: "Autonomous AI Hacks
        # Raise Thorny Questions" daba 0 matches porque la lista solo tenia
        # "hackers"/"hacked" en pasado y no el sustantivo "hacks" ni el verbo
        # "hack" en presente; "Australia says OpenAI agent hacked government
        # site" caia en "usos" porque "government" suma ahi y "hacked" no
        # matcheaba nada. Con \b hace falta la raiz en las tres formas.
        "hacks",
        "hacked",
        "hacking",
        "crack",
        "cracks",
        "cracked",
        "breaches",
        "leak",
        "leaks",
        "leaked",
        "intrusion",
        "attack",
        "attacks",
        "attacked",
        "attacker",
        "malicious",
        "backdoors",
        "software malicioso",
        "ciberdelito",
        "ciberdelincuencia",
        "suplantacion",
        "ingenieria social",
        "estafa",
        "fraude",
        "chantaje",
        "rescate",
        "atacar",
        "ataque",
        "ataques",
        "brecha",
        "brechas",
        "amenaza",
        "amenazas",
        "defensa",
        "parche",
        "parches",
        "cve",
    ),
}

SSL_CONTEXT = ssl.create_default_context()


def fetch_url(url: str, timeout: int = 20, retries: int = 2, backoff: float = 2.0) -> bytes | None:
    """Fetch con reintentos exponenciales (hallazgo 8: feeds que bloquean
    transitoriamente, p. ej. 36Kr, ya no se pierden en silencio).

    Además descomprime gzip: algunos servidores (DeepMind) responden
    Content-Encoding: gzip según el cliente, y parse_feed() solo entiende XML
    plano — sin esto el feed devolvía 0 items y se perdían en silencio.
    """
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "AI-Informe/1.0 (+https://github.com/traderxael/AI-Informe-)",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
            "Accept-Encoding": "gzip",
        },
    )
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=SSL_CONTEXT) as resp:
                raw = resp.read()
                if raw[:2] == b"\x1f\x8b":  # magic gzip
                    try:
                        raw = gzip.decompress(raw)
                    except OSError:
                        raw = b""  # cuerpo gzip corrupto: tratalo como fallo blando
                return raw
        except (urllib.error.URLError, TimeoutError, OSError, gzip.BadGzipFile):
            if attempt < retries:
                time.sleep(backoff * (attempt + 1))
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
            elif cname == "group":
                # Feeds Atom de YouTube/Media: la descripcion vive dentro de
                # <media:group><media:description>. Sin esto, los videos entran
                # sin resumen y caen en el ranking de relevancia.
                for sub in child.iter():
                    if local_tag(sub.tag).lower() == "description" and not summary:
                        summary = text_of(sub)
                        break
            elif cname in {"pubdate", "published", "updated", "date"}:
                published = parse_date(text_of(child)) or published
        if title:
            items.append(
                {
                    # html.unescape: algunos feeds escapan comillas/guiones como
                    # entidades (&#8216;) y se veian crudos en la web.
                    "title": re.sub(r"\s+", " ", html.unescape(title)).strip(),
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


def _norm(texto: str) -> str:
    """Minúsculas sin acentos: "filtración" y "filtracion" deben matchear igual."""
    return "".join(
        c for c in unicodedata.normalize("NFD", texto.lower())
        if unicodedata.category(c) != "Mn"
    )


def _keyword_hay(blob: str, word: str) -> bool:
    """True si `word` aparece como palabra completa dentro de `blob`.

    Una keyword que ya empieza con un metacarácter se trata como regex
    (ej. r"\\d+b\\b" para "$6.4B") y se usa TAL CUAL, sin envolverla en \\b otra
    vez — hacerlo produce "\\b\\d+b\\b\\b", que exige dos limites de palabra
    seguidos y nunca matchea. Las keywords literales si llevan \\b para que
    "api" no matchee "capital" ni "hack" matchee "shack".
    """
    if word[:1] in r"\\^$.|?*+()[":
        return bool(re.search(word, blob))
    return bool(re.search(rf"\b{re.escape(word)}\b", blob))


def classify(title: str, summary: str) -> str:
    blob = _norm(f"{title} {summary}")
    scores = {section: 0 for section in SECTIONS}
    for section, words in KEYWORDS.items():
        for word in words:
            if _keyword_hay(blob, word):
                scores[section] += 1
    best = max(scores.values())
    if best == 0:
        return "novedades"
    # Desempate por especificidad de seccion. 24-sep: "Researchers find data
    # breach in hospital AI triage system" daba usos=2 (porque "hospital" estaba
    # DUPLICADO en la lista, ingles + espanol) contra seguridad=1 ("breach"), y
    # ganaba usos. Lo mismo con "government"/"gobierno" en titulares de
    # ciberseguridad. Seguridad describe un RIESGO concreto, asi que si empata
    # con una seccion mas difusa, gana seguridad.
    for section in SECTION_DESEMPATE:
        if scores[section] == best:
            return section
    return "novedades"


def classify_country(title: str, source: str) -> str:
    """Clasifica por país: 'usa', 'china', o 'global'."""
    text = f"{title} {source}".lower()

    # Palabras clave China (mucho más específicas)
    china_words = {
        "china", "chinese", "beijing", "shanghai", "shenzhen", "hangzhou",
        "baidu", "alibaba", "tencent", "bytedance", "huawei", "sensetime",
        "iflytek", "zhipu", "moonshot", "minimax", "stepfun", "yi", "qwen",
        "deepseek", "pandaily", "technode", "radii", "sixth tone",
        "wechat", "taobao", "tmall", "jd.com", "pinduoduo", "meituan",
        "xiaomi", "oppo", "vivo", "tiktok", "douyin", "kuaishou",
        "binance", "okx", "bybit", "gate.io", "huobi",
        "mandarin", "cantonese", "simplified chinese", "traditional chinese"
    }

    # Palabras clave USA (más específicas)
    usa_words = {
        "openai", "google", "meta", "facebook", "microsoft", "apple",
        "amazon", "nvidia", "intel", "amd", "tesla", "spacex",
        "anthropic", "cohere", "perplexity", "huggingface",
        "techcrunch", "the verge", "ars technica", "venturebeat",
        "wired", "bloomberg", "reuters", "ap", "nyt", "washington post",
        "silicon valley", "san francisco", "new york", "boston", "seattle",
        "austin", "palo alto", "cupertino", "menlo park", "mountain view",
        "federal", "congress", "senate", "white house", "pentagon",
        "nasdaq", "nyse", "sec", "ftc", "fcc", "fda", "nih", "nasa",
        "stanford", "mit", "harvard", "princeton", "yale", "columbia",
        "uc berkeley", "cmu", "uiuc", "gatech", "caltech"
    }

    # Contadores. Se usan límites de palabra (\b) en vez de `w in text`: las
    # palabras cortas (ap, yi, sec, amd) matcheaban como substring dentro de
    # "capable", "happens", "graph" y clasificaban la noticia como USA/China
    # sin ningún indicio real del país.
    def _hits(words: set[str]) -> int:
        return sum(1 for w in words if re.search(rf"\b{re.escape(w)}\b", text))

    china_score = _hits(china_words)
    usa_score = _hits(usa_words)

    # Bonus por fuente conocida
    if source in FUENTES_CHINA:
        china_score += 5
    elif source in FUENTES_USA:
        usa_score += 5

    if china_score > usa_score:
        return "china"
    elif usa_score > china_score:
        return "usa"
    return "global"


# Ranking de relevancia (hallazgo 7): score = recencia × peso de fuente.
# Los HN points y Reddit score viven en collect_signals.py (señales), no aquí.
RELEVANCIA_WEIGHTS = {
    "OpenAI": 1.5, "Google AI": 1.5, "DeepMind": 1.5, "Meta AI": 1.4,
    "Anthropic": 1.5, "TechCrunch AI": 1.3, "The Verge AI": 1.3,
    "MIT Tech Review AI": 1.4, "Ars Technica AI": 1.3,
    "VentureBeat AI": 1.2, "Hugging Face": 1.2,
    "Synced": 1.1, "QbitAI": 1.1, "36Kr AI": 1.0, "DeepSeek": 1.4,
    "The Verge": 1.2, "Wired": 1.2, "Hacker News": 1.1,
    "AI Revolution": 1.3,  # canal de resumen de noticias IA: mismo tier que TechCrunch/The Verge AI
}
DEFAULT_WEIGHT = 1.0
RECENCY_DECAY_HOURS = 36.0  # la recencia decae a ~1/e en 36h


def relevancia(item: dict[str, Any], now: datetime) -> float:
    w = RELEVANCIA_WEIGHTS.get(item.get("source", ""), DEFAULT_WEIGHT)
    pub = item.get("published")
    if pub is None:
        return w * 0.5  # sin fecha: mitad de peso
    hours = max(0.0, (now - pub).total_seconds() / 3600.0)
    recency = pow(2.718281828, -hours / RECENCY_DECAY_HOURS)
    bonus = 0.1 if item.get("summary") else 0.0
    return w * (0.3 + 0.7 * recency) + bonus


def _fetch_one(feed: tuple[str, str]) -> tuple[str, bytes | None]:
    source, url = feed
    # Cada feed se pide en paralelo con su propio timeout; un feed lento
    # (p. ej. 36Kr que suele bloquear) ya no ralentiza al resto.
    return source, fetch_url(url, timeout=10)


# ─────────────────────────────────────────────────────────────────────────────
# Filtro de relevancia (24-sep-2026). Los feeds "generalistas" (Wired completo,
# The Verge completo, Cointelegraph, CoinDesk) aportan-BAJA de AI real pero
# inundan el informe con ofertas, clima, salud general y vida adulta. Sin este
# filtro, 9 de los 20 titulares principales del dia eran publicidad o notas
# que nada tenian que ver con IA.
#
# REGLA: una noticia de una fuente generalista solo entra si su titular (o su
# resumen) tiene senal de IA. Las fuentes que ya son exclusivamente de IA
# (OpenAI, DeepMind, Hugging Face, TechCrunch AI...) NO se filtran: alli el
# filtro solo produciria falsos negativos.
# ─────────────────────────────────────────────────────────────────────────────

# Weighted token matching: "AI" no matchea "said"/"rain" (word boundary), pero
# si matchea "AI-powered" / "AI." porque el guion y el punto son separadores.
AI_SIGNAL = re.compile(
    r"\b(?:"
    # "AI" y sus plurales/guiones. \b despues de "ai" NO matchea "AIs"
    # (la S es alfanumerica, no un separador), asi que "ais" va explicito.
    r"ai|ais|aix|a\.i\.|"
    r"artificial intelligence|machine learning|deep learning|neural|llm|large language model|"
    r"genai|generative|rpa|"
    r"gpt|chatgpt|openai|anthropic|claude|gemini|deepmind|deepseek|qwen|llama|mistral|"
    r"grok|gemini|kimi|manus|perplexity|hugging ?face|transformer|diffusion|"
    r"copilot|chatbot|chatbots|prompt|prompts|prompting|token|tokens|context window|"
    r"fine-?tun|inference|embedding|embeddings|multimodal|agentic|ai agent|agents|"
    r"open-?weight|foundation model|"
    r"robot|robotics|humanoid|"
    r"superintelligence|singularity|"
    r"automatiz|inteligencia artificial|aprendizaje automatico|redes neuronales|modelo de lenguaje|"
    r"robotica|robotico|agente"
    r")\b",
    re.IGNORECASE,
)

# Fuentes que por definicion hablan de IA: no se les exige senal de IA.
AI_NATIVE_SOURCES = frozenset({
    "OpenAI", "Google AI", "DeepMind", "Anthropic", "Meta AI", "MIT Tech Review AI",
    "TechCrunch AI", "The Verge AI", "Ars Technica AI", "VentureBeat AI", "Hugging Face",
    "Synced", "QbitAI", "DeepSeek", "36Kr AI", "BAAI", "Google Developers",
    "Microsoft Research", "NVIDIA Blog", "MarkTechPost", "AI Revolution",
    "BAIR Berkeley", "NVIDIA Developer", "Mistral AI", "Stability AI",
    # arXiv por categoria: cs.AI y cs.CL son IA por definicion, pero sus
    # titulares usan vocabulario academico que AI_SIGNAL no cubre ("Which
    # Objectives Need a Dial?", "Are Stated Reasoning Steps Causally
    # Load-Bearing?"). Filtrarlos dejaba fuera 128 papers legitimos.
    "arXiv cs.AI", "arXiv cs.CL", "arXiv cs.LG", "arXiv stat.ML",
    # The Hacker News es 100% ciberseguridad: sus titulares dicen "Unpatched
    # OnePlus Flaws", "CVE-2026-87902", "ClickFix", "Spyware", "Exploit" sin
    # mencionar IA. AI_SIGNAL solo exigiria "ai"/"model"/"agent" y descartaria
    # 35 alertas reales. Sigue pasando por es_promo() (no es publicidad).
    "The Hacker News",
    # Las 6 fuentes de seguridad son seguridad POR DEFINICION. Sus titulares son
    # nomenclatura de producto ("Eufy Omni C20", "Botslab G980H Dashcams",
    # "Siemens Mendix Runtime") sin una sola palabra de IA, y el filtro las
    # tiraba. Para un informe de IA, una vulnerabilidad que rompe un modelo o
    # una cadena de suministro de chips sigue siendo relevante como riesgo.
    "CISA Advisories", "BleepingComputer", "SecurityWeek", "Dark Reading",
    "Google Security Blog",
})

# Estructura de titulo comercial/oferta. Se evalua sobre el TITULAR original
# en ingles (no sobre el resumen en espanol, que ya no trae el ruido).
# Todo lo que se ve seguido en informes reales cabia en estos 4 grupos:
#   1) codigo promocional / cupon
#   2) descuento monetario o porcentual  ("$100 Off", "40% Off", "25% Off")
#   3) urgencia temporal de venta     ("2 days left to save up to $200")
#   4) catalogo de producto + oferta  ("Best Prime Day Robot Vacuum Sales")
PROMO_PATTERN = re.compile(
    r"(?:"
    r"\b(?:promo ?codes?|coupons?|vouchers?|discount codes?)\b|"
    r"\$\s?\d+(?:\.\d+)?\s?(?:off\b|was\b|now\b)|"
    r"\b\d{1,3}\s?%\s?off\b|"
    r"\b\d+\s?(?:days?|hours?)\s+(?:left|remaining|to go)\b|"
    r"\bsave up to\b|\blast (?:chance|days?)\b|"
    r"\b(?:best|top|prime|early|best early)\s+\w*\s*(?:deals?|sales|discounts?)\b|"
    r"\bdeals? of the (?:day|week)\b|"
    r"\bbest .+? (?:robot vacuum|gaming mouse|earbuds|headphones|laptop|phone|camera|monitor|sale)\b|"
    r"\bsubscribe(?: now)?\b|"
    r"\b(?:limited time|while supplies last|free trial|giveaway)\b|"
    # 5) eventos y conferences. 24-sep: sobrevivieron
    # "TechCrunch Disrupt 2026: Cal AI's Zach Yadegari on how to create viral
    # growth" y "[Virtual Event] Cybersecurity Outlook 2027" porque ninguna
    # regla anterior cubre un nombre de conferencia. El filtro de senal IA
    # tampoco las frena: son fuentes en AI_NATIVE_SOURCES, asi que pasaban
    # directo a la seccion "Lo mas visible".
    r"\b(?:disrupt|summit|confex|conf|expo|devday|devfest|keynote)\s*'?20\d\d\b|"
    r"\[\s*virtual event\s*\]|"
    r"\bvirtual (?:event|conference|summit)\b|"
    r"\b(?:live|online) (?:webinar|event|stream)\b|"
    r"\bwebinar\b|"
    r"\bregister (?:now|for|at)\b|"
    r"\bjoin us (?:live|online|for|at)\b|"
    r"\bstartup battlefield\b|"
    r"\beverything you need to know about\b"
    r")",
    re.IGNORECASE,
)


def es_promo(titulo: str, resumen: str = "") -> bool:
    """True si el titular es publicidad/oferta y no una noticia.

    Solo mira el TITULAR: un resumen de oferta puede colarse en la nota real
    ("...con descuento en planes") y el filtro no debe descartar la noticia.
    """
    return bool(PROMO_PATTERN.search(titulo))

def tiene_senal_ia(titulo: str, resumen: str = "") -> bool:
    """True si el titular o el resumen mencionan IA/modelos/agentes/robotica."""
    return bool(AI_SIGNAL.search(f"{titulo}\n{resumen}"))


def filtrar_items(items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Aplica los filtros de relevancia y publicidad.

    Devuelve (items_limpios, stats) con stats = {fuente: items_descartados}.
    Se invoca desde collect_items, despues de clasificar, para que el markdown,
    el JSON y los tests vean exactamente la misma lista.
    """
    stats: dict[str, int] = {}
    limpio: list[dict[str, Any]] = []
    for item in items:
        title = (item.get("title") or "").strip()
        summary = (item.get("summary") or "").strip()
        source = item.get("source") or ""

        # 1) publicidad: se descarta siempre, sin importar la fuente
        if es_promo(title, summary):
            stats[source] = stats.get(source, 0) + 1
            continue

        # 2) senal de IA: solo exigida a las fuentes generalistas
        if source not in AI_NATIVE_SOURCES and not tiene_senal_ia(title, summary):
            stats[source] = stats.get(source, 0) + 1
            continue

        limpio.append(item)
    return limpio, stats


def collect_items(day: date, lookback_hours: int = 168, parallel: bool = True) -> list[dict[str, Any]]:
    from concurrent.futures import ThreadPoolExecutor

    cutoff = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
    min_dt = cutoff - timedelta(hours=lookback_hours)
    seen: set[str] = set()
    collected: list[dict[str, Any]] = []

    if parallel and len(FEEDS) > 1:
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(_fetch_one, FEEDS))
    else:
        results = [(f[0], fetch_url(f[1])) for f in FEEDS]

    for source, payload in results:
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
            item["country"] = classify_country(item["title"], source)
            collected.append(item)

    collected.sort(key=lambda it: it.get("published") or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

    # Filtro de relevancia + publicidad (24-sep-2026). Aplica a la lista final,
    # antes de que llegue al markdown, al JSON y a la web: asi las tres salidas
    # ven exactamente los mismos items.
    limpio, stats = filtrar_items(collected)
    if stats:
        total_descartados = sum(stats.values())
        detalle = ", ".join(f"{k or '?':24s} {v}" for k, v in sorted(stats.items(), key=lambda kv: -kv[1])[:6])
        print(f"  Filtro: {len(collected)} -> {len(limpio)} items ({total_descartados} descartados). {detalle}")
    return limpio


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

    now = datetime.now(timezone.utc)

    def block(section: str, empty: str) -> str:
        # Novedades muestra mas (20) porque es la seccion mas densa; el resto 12.
        limite = 20 if section == "novedades" else 12
        rows = sorted(by_section[section],
                      key=lambda _it: relevancia(_it, now), reverse=True)[:limite]
        if not rows:
            return empty
        txt = "\n".join(bullet(_it) for _it in rows)
        resto = len(by_section[section]) - len(rows)
        if resto > 0:
            txt += f"\n- _(y {resto} piezas más en esta sección)_"
        return txt

    n_total = len(items)
    total = n_total

    fuentes = []
    for source, url in FEEDS:
        fuentes.append(f"- {source}: {url}")

    # Los bloques de sección se generan desde SECTION_TITLES: antes el markdown
    # tenía las 4 secciones escritas a mano y la nueva "seguridad" (24-sep) no
    # aparecía en el informe, solo en el JSON.
    _vacio = {
        "novedades": "- Sin novedades claras en los feeds de hoy.",
        "usos": "- Sin casos de uso destacados en los feeds de hoy.",
        "economia": "- Sin notas económicas destacadas en los feeds de hoy.",
        "futuro": "- Sin señales de regulación o horizonte en los feeds de hoy.",
        "seguridad": "- Sin alertas de ciberseguridad en los feeds de hoy.",
    }
    secciones_md = "\n\n".join(
        f"## {SECTION_TITLES[s]}\n\n{block(s, _vacio.get(s, '- Sin nada en esta sección.'))}"
        for s in SECTIONS
    )

    _corto = {"novedades": "novedades", "usos": "usos reales", "economia": "economía",
              "futuro": "señales de futuro", "seguridad": "seguridad"}
    conteo = ", ".join(
        f"{len(by_section[s])} {_corto.get(s, s)}" for s in SECTIONS if by_section[s]
    )
    if total:
        resumen = (
            f"Hoy se recopilaron {total} piezas sobre IA ({conteo}). "
            "Abajo van las más recientes, agrupadas por tema."
        )
        # El destacado sale del ranking de relevancia (no del orden crudo).
        top = max(items, key=lambda _it: relevancia(_it, now))
        resumen += f" Lo más visible: {top['title']} ({top.get('source', '')})."
    else:
        resumen = (
            "No llegaron ítems nuevos de los feeds en la ventana de las últimas horas. "
            "Revisa las fuentes o vuelve a ejecutar con `--force` más tarde."
        )

    return f"""# Informe de IA — {day.isoformat()}

## Resumen del día

{resumen}

{secciones_md}

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
            "pais": item.get("country", "global"),
            "fecha": day.isoformat(),
        }

    # Contar por país
    usa_count = sum(1 for i in items if i.get("country") == "usa")
    china_count = sum(1 for i in items if i.get("country") == "china")
    global_count = sum(1 for i in items if i.get("country") == "global")

    # Mismo ranking de relevancia que el markdown: antes el JSON exportaba los
    # primeros 10 en orden crudo y la web en vivo mostraba piezas distintas.
    _now = datetime.now(timezone.utc)

    def _top(section: str, limite: int = 15) -> list:
        return sorted(by_section[section],
                      key=lambda _it: relevancia(_it, _now), reverse=True)[:limite]

    # Tope por sección. El dict se construye desde SECTIONS para que agregar una
    # sección nueva (ej. "seguridad", 24-sep) no requiera editar este bloque y
    # volver a olvidarlo: antes por_seccion estaba hardcodeado con 4 claves y la
    # sección nueva se perdía silenciosamente en el JSON de la web.
    _TOP_POR_SECCION = {"novedades": 25, "usos": 20, "economia": 20,
                        "futuro": 20, "seguridad": 20}
    data = {
        "fecha": day.isoformat(),
        "total": len(items),
        "por_seccion": {
            section: [item_to_json(i) for i in _top(section, _TOP_POR_SECCION.get(section, 20))]
            for section in SECTIONS
        },
        "por_pais": {
            "usa": usa_count,
            "china": china_count,
            "global": global_count,
        },
        "fuentes": [{"nombre": s, "url": u} for s, u in FEEDS],
    }

    # Append al historial (últimos 30 días)
    historial_path = WEB_DIR / "informes-data.json"
    public_data_dir = ROOT / "public" / "data"
    public_historial_path = public_data_dir / "informes-data.json"

    def _load(path) -> list:
        if path.exists():
            try:
                return json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                return []
        return []

    # Fusionar web/ + public/data/ por fecha: cualquiera de los dos puede tener
    # días que el otro no (antes se perdían). Se conserva la versión más nueva.
    merged: dict[str, dict] = {}
    for entry in _load(historial_path) + _load(public_historial_path):
        fecha = entry.get("fecha")
        if fecha:
            merged[fecha] = entry
    historial = [merged[f] for f in sorted(merged)]
    # Evitar duplicados del mismo día y quedarse con los últimos 30 días
    historial = [h for h in historial if h.get("fecha") != day.isoformat()]
    historial.append(data)
    historial = sorted(historial, key=lambda h: h.get("fecha", ""))[-30:]

    payload = json.dumps(historial, ensure_ascii=False, indent=2) + "\n"
    historial_path.write_text(payload, encoding="utf-8")
    # El sitio desplegado (app React en Vercel) lee public/data/; antes este
    # directorio quedaba huérfano y la web en vivo se congelaba (bug detectado).
    if public_data_dir.exists():
        public_historial_path.write_text(payload, encoding="utf-8")

    # También exportar a formato simple para compatibilidad
    simple_data = [{"fecha": day.isoformat(), "total": len(items), "items": data["por_seccion"]["novedades"]}]
    simple_path = WEB_DIR / "informes.json"
    public_simple_path = public_data_dir / "informes.json"

    simple_merged: dict[str, dict] = {}
    for entry in _load(simple_path) + _load(public_simple_path):
        f = entry.get("fecha")
        if f:
            simple_merged[f] = entry
    existing_simple = [simple_merged[f] for f in sorted(simple_merged)]
    existing_simple = [x for x in existing_simple if x.get("fecha") != day.isoformat()]
    existing_simple.append(simple_data[0])
    existing_simple = sorted(existing_simple, key=lambda x: x.get("fecha", ""))[-30:]

    simple_payload = json.dumps(existing_simple, ensure_ascii=False, indent=2) + "\n"
    simple_path.write_text(simple_payload, encoding="utf-8")
    if public_data_dir.exists():
        public_simple_path.write_text(simple_payload, encoding="utf-8")

    print(f"  JSON exportado: {historial_path} (+ public/data/)")


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
