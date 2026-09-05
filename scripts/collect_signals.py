#!/usr/bin/env python3
"""Recolector de señales de IA con datos REALES y enlazables.

Fuentes (solo datos públicos y confiables, sin APIs de pago):
  - Google News RSS (multi-idioma / multi-país)  <-- pilar
  - RSS de laboratorios y medios (OpenAI, Google, Meta, TechCrunch, ...)
  - Hacker News RSS
  - Reddit RSS (opcional / degradación suave)

Emite web/signals.json con un campo sourceUrl REAL por cada señal.
No usa LLM: el resumen es el extracto original (idioma de origen).
"""

from __future__ import annotations

import hashlib
import json as _json
import os
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor as _TPE
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "public"
OUT = WEB_DIR / "signals.json"

SSL_CONTEXT = ssl.create_default_context()
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36 AI-Informe/1.0",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}


# ---------------------------------------------------------------- fuentes ---
# RSS de laboratorios / medios (reutilizado de generar_informe.py)
LAB_FEEDS = [
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
    ("Synced", "https://syncedreview.com/feed/"),
    ("36Kr AI", "https://36kr.com/feed"),
    ("QbitAI", "https://www.qbitai.com/feed"),
    ("DeepSeek", "https://www.deepseek.com/rss.xml"),
]

# Google News: (etiqueta, query, idioma/región, país_hint)
GNEWS_QUERIES = [
    ("IA global", "artificial intelligence", "en-US", "global"),
    ("IA LATAM", "inteligencia artificial", "es-419", "global"),
    ("IA China (zh)", "AI 人工智能", "zh-CN", "china"),
    ("IA China modelos", "deepseek qwen kimi modelo AI china", "es-419", "china"),
    ("IA Alemania", "KI künstliche Intelligenz", "de-DE", "germany"),
    ("IA Francia", "intelligence artificielle IA", "fr-FR", "france"),
    ("IA Japón", "AI 人工知能", "ja-JP", "japan"),
    ("IA Corea", "AI 인공지능", "ko-KR", "korea"),
    ("IA Rusia", "ИИ искусственный интеллект", "ru-RU", "russia"),
]

REDDIT_SUBS = ["artificial", "MachineLearning", "LocalLLaMA", "singularity"]

# ------------------------------------------------------------- registros ---
# Los ~25 modelos de la portada + los que ya aparecen en fuentes reales.
MODEL_KEYWORDS: dict[str, tuple[str, ...]] = {
    "claude": ("claude", "anthropic"),
    "gpt": ("openai", "chatgpt", "gpt-5", "gpt5", "o3", "sora", "dall"),
    "grok": ("grok", "xai"),
    "gemini": ("gemini", "google deepmind", "deepmind"),
    "llama": ("llama", "meta ai", "facebook ai"),
    "glm": ("glm", "zhipu", "chatglm"),
    "qwen": ("qwen", "alibaba", "通义"),
    "kimi": ("kimi", "moonshot", "月之暗面"),
    "deepseek": ("deepseek", "深度求索"),
    "minimax": ("minimax", "海螺"),
    "hunyuan": ("hunyuan", "tencent", "混元"),
    "ernie": ("ernie", "baidu", "文心"),
    "doubao": ("doubao", "bytedance", "豆包"),
    "mistral": ("mistral", "mixtral"),
    "aleph-alpha": ("aleph alpha", "aleph-alpha"),
    "black-forest": ("black forest", "flux"),
    "stability": ("stability ai", "stable diffusion", "stable video"),
    "deepl": ("deepl",),
    "lighton": ("lighton",),
    "cohere": ("cohere", "command r"),
    "perplexity": ("perplexity",),
    "copilot": ("copilot", "microsoft ai"),
    "titan": ("amazon ai", "titan", "aws ai", "novaa"),
    "fugaku": ("fugaku", "riken"),
    "hyperclova": ("hyperclova", "naver"),
    "gigachat": ("gigachat", "sber", "kandinsky"),
    "falcon": ("falcon", "tii"),
}

COUNTRY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "usa": ("united states", "us ", "u.s.", "america", "silicon valley", "openai",
            "google", "microsoft", "nvidia", "anthropic", "meta", "tesla", "mit",
            "stanford", "california", "new york"),
    "china": ("china", "chinese", "beijing", "shanghai", "shenzhen", "baidu",
              "alibaba", "tencent", "bytedance", "huawei", "deepseek", "qwen",
              "moonshot", "zhipu", "minimax", "senseTime", "iflytek"),
    "japan": ("japan", "japanese", "tokyo", "softbank", "hitachi", "ntt", "riken"),
    "germany": ("germany", "german", "berlin", "munich", "aleph alpha", "deepl",
                "sap", "bosch", "black forest labs"),
    "france": ("france", "french", "paris", "mistral", "lighton"),
    "korea": ("korea", "korean", "south korea", "seoul", "naver", "samsung",
              "hyperclova"),
    "canada": ("canada", "canadian", "toronto", "montreal", "cohere"),
    "russia": ("russia", "russian", "moscow", "sber", "gigachat", "kandinsky"),
    "uae": ("uae", "emirates", "united arab", "abu dhabi", "dubai", "falcon"),
    "uk": ("uk ", "united kingdom", "britain", "london", "deepmind"),
}


# ----------------------------------------------------------------- utilidades
def get(url: str, timeout: int = 18) -> bytes | None:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CONTEXT) as r:
            return r.read()
    except (urllib.error.URLError, TimeoutError, OSError):
        return None


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def txt(el: ET.Element | None) -> str:
    return "".join(el.itertext()).strip() if el is not None else ""


def parse_date(v: str) -> str | None:
    from email.utils import parsedate_to_datetime
    try:
        dt = parsedate_to_datetime(v)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except (TypeError, ValueError, OverflowError):
        return None


# ------------------------------------------------------------------ parseo ---
def parse_rss_items(data: bytes) -> list[dict[str, Any]]:
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        return []
    items: list[dict[str, Any]] = []
    for node in root.iter():
        if local(node.tag).lower() not in {"item", "entry"}:
            continue
        title = link = summary = ""
        published = None
        for child in list(node):
            c = local(child.tag).lower()
            if c == "title":
                title = re.sub(r"\s+", " ", txt(child))
            elif c == "link":
                href = child.attrib.get("href") or txt(child)
                if href:
                    link = href.strip()
            elif c in {"description", "summary", "content"} and not summary:
                summary = re.sub(r"<[^>]+>", " ", txt(child))
                summary = re.sub(r"\s+", " ", summary).strip()[:400]
            elif c in {"pubdate", "published", "updated", "date"}:
                published = parse_date(txt(child)) or published
        if title:
            items.append({"title": title, "url": link, "summary": summary,
                          "published": published})
    return items


def query_gnews(q: str, hl: str, gl: str) -> list[dict[str, Any]]:
    import urllib.parse
    url = ("https://news.google.com/rss/search?q=" + urllib.parse.quote(q) +
           f"&hl={hl}&gl={gl}&ceid={gl}:{hl}")
    data = get(url)
    if not data:
        return []
    return parse_rss_items(data)[:20]


def classify_models(blob: str) -> list[str]:
    b = blob.lower()
    return [m for m, kws in MODEL_KEYWORDS.items()
            if any(k in b for k in kws)]


def classify_country(title: str, source: str, hint: str) -> str:
    blob = f"{title} {source}".lower()
    scored: list[tuple[int, str]] = []
    for c, kws in COUNTRY_KEYWORDS.items():
        s = sum(1 for k in kws if k.lower() in blob)
        if c == hint:
            s += 2  # el idioma/región de la query es una pista fuerte
        if s:
            scored.append((s, c))
    if not scored:
        return hint if hint != "global" else "global"
    scored.sort(reverse=True)
    return scored[0][1]


def source_kind(model_ids: list[str], source: str) -> str:
    src = source.lower()
    if any(k in src for k in ("hacker news", "reddit")):
        return "social"
    if any(k in src for k in ("arxiv", "mit", "research", "deepmind")):
        return "research"
    if model_ids:
        return "lab"
    return "news"


# ------------------------------------------------------- traducción gratis ---
# Google (gtx) y LibreTranslate/lingva están bloqueados desde IPs de datacenter
# (429/403). MyMemory responde 200 sin clave. Cuota anónima ~5.000 chars/día;
# se respeta con fallback suave (si falla, se queda el original).
def detect_lang(text: str) -> str:
    if re.search(r"[\u3040-\u30ff]", text):          # kana → japonés
        return "ja"
    if re.search(r"[\u4e00-\u9fff]", text):          # han → chino
        return "zh"
    if re.search(r"[\uac00-\ud7af]", text):          # hangul → coreano
        return "ko"
    if re.search(r"[\u0400-\u04ff]", text):          # cirílico → ruso
        return "ru"
    if re.search(r"[äöß]|\b(der|die|das|und|mit|für|nicht|eine|nach)\b",
                 text, re.I):
        return "de"
    if re.search(r"[çàèùœêë]|\b(le|la|les|des|du|une|dans|pour|avec|sur|par)\b",
                 text, re.I):
        return "fr"
    if re.search(r"[áéíóúñü¿¡]", text.lower()):
        return "es"
    return "en"


def translate_es(text: str, src_lang: str) -> str:
    pair = {"zh": "zh-CN|es", "en": "en|es", "ja": "ja|es", "ko": "ko|es",
            "ru": "ru|es", "de": "de|es", "fr": "fr|es"}.get(src_lang)
    if not pair:
        return text
    email = os.environ.get("MYMEMORY_EMAIL", "")
    url = ("https://api.mymemory.translated.net/get?q="
           + urllib.parse.quote(text) + "&langpair=" + pair
           + (f"&de={urllib.parse.quote(email)}" if email else ""))
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA),
                                    timeout=10) as r:
            data = _json.loads(r.read().decode("utf-8", "replace"))
        t = (data.get("responseData") or {}).get("translatedText")
        if t and t.strip() and t.strip().lower() != text.lower():
            return t.strip()
    except Exception:
        pass
    return text


# -------------------------------------------------- capa social (opt-in) ----
def social_feeds() -> list[tuple[dict[str, Any], str]]:
    """X / Instagram / TikTok / Xiaohongshu vía tu propia instancia RSSHub.

    Sin credenciales NO hay datos públicos: estas redes no tienen API abierta
    y bloquean bots sin login. Activación opcional:
      - `RSSHUB_BASE_URL=https://tu-rsshub.com` (instancia con tus cookies)
      - `social_sources.json` con las cuentas a seguir
    Si falta cualquiera, devuelve [] y el pipeline sigue sin romperse.
    """
    base = os.environ.get("RSSHUB_BASE_URL", "").rstrip("/")
    cfg_path = ROOT / "social_sources.json"
    if not base or not cfg_path.exists():
        return []
    try:
        cfg = _json.loads(cfg_path.read_text(encoding="utf-8"))
    except Exception:
        return []
    feeds: list[tuple[dict[str, Any], str]] = []
    for platform in cfg.get("platforms", []):
        name = platform.get("name", "Social")
        for route in platform.get("routes", []):
            if not route.startswith("/"):
                continue
            data = get(f"{base}{route}")
            if data:
                for it in parse_rss_items(data)[:15]:
                    feeds.append((it, name))
    return feeds


# ------------------------------------------------------------------ rutina ---
def recolectar() -> list[dict[str, Any]]:
    seen: set[str] = set()
    items: list[dict[str, Any]] = []

    def add(it: dict[str, Any], source: str, hint: str) -> None:
        key = (it.get("url") or it["title"]).lower()
        if key in seen:
            return
        seen.add(key)
        title = it["title"]
        models = classify_models(f"{title} {source}")
        country = classify_country(title, source, hint)
        items.append({
            "id": hashlib.sha1(key.encode()).hexdigest()[:12],
            "title": title,
            "summary": it.get("summary") or "",
            "sourceUrl": it.get("url") or "",
            "sourceLabel": source,
            "region": ("china" if country == "china" else
                       "west" if country in
                       {"usa", "japan", "germany", "france", "korea", "canada",
                        "russia", "uae", "uk"} else "global"),
            "country": country,
            "models": models,
            "source": source_kind(models, source),
            "published": it.get("published"),
        })

    # 1) Google News (pilar, multi-país)
    for label, q, hl, hint in GNEWS_QUERIES:
        gl = {"en-US": "US", "es-419": "CL", "zh-CN": "CN", "de-DE": "DE",
              "fr-FR": "FR", "ja-JP": "JP", "ko-KR": "KR", "ru-RU": "RU"}.get(hl, "US")
        for it in query_gnews(q, hl, gl):
            add(it, f"Google News — {label}", hint)

    # 2) RSS de laboratorios
    for name, url in LAB_FEEDS:
        data = get(url)
        if not data:
            continue
        for it in parse_rss_items(data)[:10]:
            # el país de la fuente lab no lo forzamos; se clasifica por keywords
            add(it, name, "global")

    # 3) Hacker News
    hn = get("https://news.ycombinator.com/rss")
    if hn:
        for it in parse_rss_items(hn)[:15]:
            add(it, "Hacker News", "usa")

    # 4) Reddit (degradación suave; 429/403 son esperables)
    import time
    for sub in REDDIT_SUBS:
        data = get(f"https://www.reddit.com/r/{sub}/top.rss?t=week")
        if data:
            for it in parse_rss_items(data)[:10]:
                add(it, f"Reddit r/{sub}", "global")
        time.sleep(1.5)

    # 5) Capa social opt-in (X / Instagram / TikTok / Xiaohongshu vía RSSHub)
    for it, src in social_feeds():
        add(it, src, "global")

    # ordenar por fecha desc
    items.sort(key=lambda x: x.get("published") or "", reverse=True)
    return items


def main() -> int:
    WEB_DIR.mkdir(parents=True, exist_ok=True)
    signals = recolectar()

    # filtrar antigüedad (21 días) y balancear por país
    from datetime import timedelta
    from collections import Counter
    cutoff = (datetime.now(timezone.utc) - timedelta(days=21)).isoformat()
    fresh = [s for s in signals
             if (s.get("published") is None or s["published"] >= cutoff)]

    # priorizar señales con modelo detectado, luego por fecha
    fresh.sort(key=lambda s: (len(s.get("models") or []) > 0,
                              s.get("published") or ""),
               reverse=True)

    MAX_PER_COUNTRY = 60
    MAX_TOTAL = 300
    budget: dict[str, int] = {}
    final: list[dict[str, Any]] = []
    for s in fresh:
        c = s["country"]
        if budget.get(c, 0) >= MAX_PER_COUNTRY:
            continue
        budget[c] = budget.get(c, 0) + 1
        final.append(s)
        if len(final) >= MAX_TOTAL:
            break

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(final),
        "sources": sorted({s["sourceLabel"] for s in final}),
        "signals": final,
    }

    # Traducción gratuita de títulos (MyMemory, sin clave). Falla suave →
    # conserva el original. El título original se guarda en `title_orig`.
    def _tr(s: dict[str, Any]) -> None:
        lang = detect_lang(s["title"])
        if lang == "es":
            return
        s["title_orig"] = s["title"]
        s["title"] = translate_es(s["title"], lang)

    if os.environ.get("SKIP_TRANSLATE") != "1":
        with _TPE(max_workers=5) as ex:
            list(ex.map(_tr, final))

    OUT.write_text(
        _json.dumps(out, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    by_country = Counter(s["country"] for s in final)
    with_model = sum(1 for s in final if s["models"])
    print(f"✅ {len(final)} señales reales curadas -> {OUT}")
    print(f"   países: {dict(by_country)}")
    print(f"   con modelo detectado: {with_model}/{len(final)}")
    print(f"   fuentes: {len(out['sources'])}")
    top = Counter(m for s in final for m in s["models"]).most_common(14)
    print(f"   modelos top: {top}")
    return 0


if __name__ == "__main__":
    sys.exit(main())