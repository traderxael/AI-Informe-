#!/usr/bin/env python3
"""Monitor de clips virales IA/trading via FxEmbed (fxtwitter API v2).

Busca tweets virales de IA/finanzas con video, los rankea por views y guarda
señales para el informe diario + detección de contenido reciclable para
AutoClip (pipeline de clips de Axael).

Uso:
    python fx_viral.py                     # corrida normal
    python fx_viral.py --local             # usar http://localhost:8787 (self-hosted)

Salida: datos/fx_viral_YYYY-MM-DD.json
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "datos"

# API public de fxtwitter (v2). Con UA navegador responde JSON; con UA bot redirige.
DEFAULT_API = "https://api.fxtwitter.com"
LOCAL_API = "http://localhost:8787"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

# Cuentas monitoreadas — mezcla de la red de @traderxael + nichos clave.
# (handle, etiqueta, tema_fijo) — tema_fijo fuerza la clasificación cuando
# la cuenta es temáticamente homogénea.
CUENTAS = [
    # --- IA occidente (de tu following) ---
    ("AnthropicAI", "ia", "seguridad"),
    ("OpenAI", "ia", None),
    ("NousResearch", "ia", None),
    ("HermesWatcher", "ia", None),
    ("GoogleDeepMind", "ia", "investigacion"),
    ("claudeai", "ia", None),
    ("sama", "ia", None),
    # --- IA China (nicho solicitado: china-ai) ---
    ("TencentHunyuan", "china-ai", None),
    ("XiaomiTech_", "china-ai", None),
    # --- Tecnología / hardware ---
    ("JensenHuang", "tech", None),
    ("github", "tech", None),
    ("opencode", "tech", None),
    # --- Trading / cripto ---
    ("polymarket", "trading", "mercado"),
    ("BitcoinMagazine", "trading", "mercado"),
    ("WatcherGuru", "trading", "mercado"),
    # --- Biotecnología / seguridad tech (nicho solicitado) ---
    ("biobio", "bioseguridad", None),  # prensa CL, cubre ciencia/tech
]

# Búsquedas por nicho (search es intermitente; soft-fail):
# (query, etiqueta, tema_fijo)
SEARCHES = [
    ("China AI", "china-ai", "china"),
    ("China AI safety policy", "china-ai", "china"),
    ("AI biotechnology security", "bioseguridad", "biotech"),
    ("AI security vulnerability", "bioseguridad", "seguridad"),
]

MIN_VIEWS = 50_000  # umbral viral para el informe

# Clasificación por tema via keywords en el texto (orden = prioridad)
TEMAS = [
    ("lanzamiento", ["introducing", "announcing", "launch", "roll out", "rollout",
                     "new model", "gpt-", "claude", "gemini", "opus", "welcome"]),
    ("seguridad", ["threat", "security", "safety", "misuse", "abuse", "misalignment",
                   "cyberattack", "influence op", "warning", "danger"]),
    ("politica", ["regulation", "policy", "government", "pace the frontier", "summit",
                  "un ", "law", "act", "senate", "congress"]),
    ("investigacion", ["research", "paper", "enzyme", "discovered", "benchmark", "study",
                       "team is sharing", "mathematic", "proof", "science"]),
    ("producto", ["chatgpt", "pricing", "plan", "usage", "workspace", "voice", "plugins",
                  "app", "devday", "astra"]),
    ("mercado", ["bitcoin", "btc", "eth", "crypto", "etf", "fed", "market", "price",
                 "prediction", "tokeniz", "blackrock", "invest"]),
    ("biotech", ["vaccine", "drug", "protein", "genomic", "gene", "crispr", "cancer",
                 "enzyme", "bacteria", "phage", "clinical"]),
    ("china", ["china", "beijing", "shenzhen", "hangzhou", "chinese", "tencent",
               "xiaomi", "alibaba", "baidu", "huawei", "deepseek", "qwen", "kimi"]),
]


def clasificar(texto: str, tema_fijo: str | None = None) -> str:
    if tema_fijo:
        return tema_fijo
    t = (texto or "").lower()
    for tema, kws in TEMAS:
        if any(k in t for k in kws):
            return tema
    return "otros"


def api_get(base: str, path: str, params: dict) -> dict | None:
    qs = urllib.parse.urlencode(params)
    url = f"{base}{path}?{qs}"
    # Host header requerido solo en local (realm routing)
    req = urllib.request.Request(url, headers=HEADERS)
    if base.startswith("http://localhost"):
        req.add_header("Host", "api.fxtwitter.com")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:  # soft-fail: nunca rompe el informe
        print(f"  [warn] {path}: {e}", file=sys.stderr)
        return None


def fetch_search(base: str, query: str, count: int = 20) -> list[dict]:
    """Search v2 — intermitente (rate-limit X por edge). Nunca rompe."""
    data = api_get(base, "/2/search", {"q": query, "count": count})
    if not data:
        return []
    items = data.get("statuses") or data.get("results") or []
    return [_norm_tweet(t) for t in items if isinstance(t, dict)]


def _norm_tweet(t: dict) -> dict:
    views = t.get("views") or 0
    try:
        views = int(views)
    except (TypeError, ValueError):
        views = 0
    return {
        "id": t.get("id"),
        "autor": (t.get("author") or {}).get("screen_name"),
        "texto": (t.get("text") or "").strip()[:280],
        "views": views,
        "likes": t.get("likes") or 0,
        "reposts": t.get("reposts") or 0,
        "url": f"https://x.com/{(t.get('author') or {}).get('screen_name')}/status/{t.get('id')}",
        "tiene_video": bool((t.get("media") or {}).get("videos")) if isinstance(t.get("media"), dict) else bool(t.get("media")),
        "fecha": (t.get("created_at") or {}).get("iso") if isinstance(t.get("created_at"), dict) else t.get("created_at"),
    }
def fetch_profile_statuses(base: str, handle: str, count: int = 20) -> list[dict]:
    data = api_get(base, f"/2/profile/{handle}/statuses", {"count": count})
    if not data:
        return []
    items = data.get("statuses") or data.get("results") or []
    return [_norm_tweet(t) for t in items if isinstance(t, dict)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", action="store_true", help="usar API local (localhost:8787)")
    ap.add_argument("--count", type=int, default=20)
    args = ap.parse_args()

    base = LOCAL_API if args.local else DEFAULT_API
    print(f"[fx_viral] API: {base}")

    # 1) Trends globales
    trends = []
    tr = api_get(base, "/2/trends", {})
    if tr:
        raw = tr.get("trends") or tr.get("results") or []
        for t in raw[:10]:
            trends.append(t.get("name", t.get("text", "")) if isinstance(t, dict) else str(t))

    # 2) Ultimos posts de las cuentas monitoreadas
    viral, vistos = [], set()
    for handle, etiqueta, tema_fijo in CUENTAS:
        print(f"[fx_viral] perfil: @{handle}")
        for item in fetch_profile_statuses(base, handle, args.count):
            if item["id"] in vistos:
                continue
            vistos.add(item["id"])
            item["etiqueta"] = etiqueta
            item["cuenta"] = handle
            item["tema"] = clasificar(item["texto"], tema_fijo)
            if item["views"] >= MIN_VIEWS:
                viral.append(item)

    # 3) Búsquedas de nicho (China IA, biotech/seguridad) — soft-fail
    for query, etiqueta, tema_fijo in SEARCHES:
        print(f"[fx_viral] search: {query}")
        for item in fetch_search(base, query, 10):
            if item["id"] in vistos:
                continue
            vistos.add(item["id"])
            item["etiqueta"] = etiqueta
            item["cuenta"] = item["autor"]
            item["tema"] = clasificar(item["texto"], tema_fijo)
            item["origen"] = "search"
            # el search trae mucho ruido: umbral bajo pero requiere algo de traccion
            if item["views"] >= 5_000:
                viral.append(item)

    viral.sort(key=lambda x: x["views"], reverse=True)

    hoy = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    OUT_DIR.mkdir(exist_ok=True)
    out = OUT_DIR / f"fx_viral_{hoy}.json"

    # Resumen por tema (counts) para el payload
    from collections import Counter
    por_tema = Counter(v["tema"] for v in viral)
    por_etiqueta = Counter(v["etiqueta"] for v in viral)

    payload = {
        "fecha": hoy,
        "generado": datetime.now(timezone.utc).isoformat(),
        "api": base,
        "trends_x": trends,
        "total_viral": len(viral),
        "resumen_por_tema": dict(por_tema),
        "resumen_por_etiqueta": dict(por_etiqueta),
        "viral": viral[:40],
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[fx_viral] {len(viral)} virales (>= {MIN_VIEWS:,} views) -> {out}")
    print(f"[fx_viral] por tema: {dict(por_tema)}")
    print(f"[fx_viral] por nicho: {dict(por_etiqueta)}")

    # Resumen consola
    for v in viral[:8]:
        print(f"  {v['views']:>9,} views | @{v['autor']}: {v['texto'][:60]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
