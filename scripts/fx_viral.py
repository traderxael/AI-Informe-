#!/usr/bin/env python3
"""Monitor de clips virales IA/trading via FxEmbed (fxtwitter API v2).

Busca tweets virales de IA/finanzas con video, los rankea por views y guarda
señales para el informe diario + detección de contenido reciclable para
AutoClip (pipeline de clips de traderxael).

Uso:
    python fx_viral.py                     # corrida normal
    python fx_viral.py --local             # usar http://localhost:8787 (self-hosted)

Salida: datos/fx_viral_YYYY-MM-DD.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "datos"
# Cache local de imagenes: public/data/x-img/ -> servidas por el propio repo.
IMG_DIR = ROOT / "public" / "data" / "x-img"
# Dias que se conservan las imagenes cacheadas (el arbol no crece sin limite).
IMG_DIAS = 5
# Tope por imagen: las mayores se siguen sirviendo por hotlink.
IMG_MAX_BYTES = 80_000
# Ventana de recencia de los posts: una cuenta que publica poco deja posts
# viejos con muchas views en su "ultimos 20", y sin este filtro el informe
# de hoy contaria como señal de hoy una nota de hace dos semanas.
VENTANA_DIAS = 7

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
#
# Todas las cuentas de acá se verificaron contra la API (responden con posts
# PROPIOS, no solo retweets) el 05-nov-2026. Una cuenta que 404 o que solo
# retuitea no aporta: el filtro de autoría la deja vacía.
CUENTAS = [
    # --- IA occidente (de tu following) ---
    ("AnthropicAI", "ia", "seguridad"),
    ("OpenAI", "ia", None),
    ("NousResearch", "ia", None),
    ("HermesWatcher", "ia", None),
    ("GoogleDeepMind", "ia", "investigacion"),
    ("claudeai", "ia", None),
    ("sama", "ia", None),
    # --- Laboratorios y empresas de IA (verificados: publican posts propios) ---
    ("googleai", "ia", None),
    ("MistralAI", "ia", None),
    ("microsoftAI", "ia", None),
    ("perplexity_ai", "ia", None),
    ("huggingface", "ia", None),
    ("Cursor_AI", "ia", "producto"),
    ("RunwayML", "ia", "producto"),
    # --- IA China (nicho solicitado: china-ai) ---
    ("TencentHunyuan", "china-ai", None),
    ("XiaomiTech_", "china-ai", None),
    ("Alibaba_Qwen", "china-ai", None),
    ("Kimi_Moonshot", "china-ai", None),
    ("deepseek_ai", "china-ai", None),
    ("MiniMax_AI", "china-ai", None),
    # --- Tecnología / hardware ---
    ("JensenHuang", "tech", None),
    ("github", "tech", None),
    ("opencode", "tech", None),
    ("nvidia", "tech", None),
    ("AIatAMD", "tech", None),
    ("vercel", "tech", None),
    ("Supabase", "tech", None),
    # --- Gente que explica IA en la práctica (usos y herramientas) ---
    ("bindureddy", "ia", None),
    ("goodside", "ia", None),
    ("emollick", "ia", None),
    # --- Trading / cripto ---
    ("polymarket", "trading", "mercado"),
    ("BitcoinMagazine", "trading", "mercado"),
    ("WatcherGuru", "trading", "mercado"),
    # --- Biotecnología / seguridad tech (nicho solicitado) ---
    ("biobio", "bioseguridad", None),  # prensa CL, cubre ciencia/tech
    # --- Ciberseguridad (publica en árabe; tema_fijo evita depender de
    # keywords en inglés para clasificar) ---
    ("UCybersX", "seguridad", "seguridad"),
]

# Búsquedas por nicho (search es intermitente; soft-fail):
# (query, etiqueta, tema_fijo)
SEARCHES = [
    ("China AI", "china-ai", "china"),
    ("China AI safety policy", "china-ai", "china"),
    ("AI biotechnology security", "bioseguridad", "biotech"),
    ("AI security vulnerability", "bioseguridad", "seguridad"),
    #Arabic: audit/pen-test de redes (el nicho de @UCybersX)
    ("أمن الشبكات", "seguridad", "seguridad"),
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


def api_get(base: str, path: str, params: dict, intentos: int = 3,
            espera: float = 3.0) -> dict | None:
    """Pide a la API y reintenta los errores transitorios.

    El 404 de FxTwitter es TRANSITORIO (rate limit de X por IP): medido, en
    rafaga 12 de 25 requests contestaron 404 y con hasta 3 intentos las 10
    cuentas probadas respondieron. Sin reintento, la mitad de las cuentas
    monitoreadas se perdian en cada corrida.
    """
    qs = urllib.parse.urlencode(params)
    url = f"{base}{path}?{qs}"
    # Host header requerido solo en local (realm routing)
    req = urllib.request.Request(url, headers=HEADERS)
    if base.startswith("http://localhost"):
        req.add_header("Host", "api.fxtwitter.com")
    transitorios = (404, 408, 425, 429, 500, 502, 503, 504)
    for intento in range(1, max(1, intentos) + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code not in transitorios or intento >= intentos:
                print(f"  [warn] {path}: {e}", file=sys.stderr)
                return None
            print(f"  [retry] {path}: HTTP {e.code} (intento {intento}/{intentos})",
                  file=sys.stderr)
            time.sleep(espera)
        except Exception as e:  # soft-fail: nunca rompe el informe
            print(f"  [warn] {path}: {e}", file=sys.stderr)
            return None
    return None


def fetch_search(base: str, query: str, count: int = 20) -> list[dict]:
    """Search v2 — intermitente (rate-limit X por edge). Nunca rompe."""
    data = api_get(base, "/2/search", {"q": query, "count": count})
    if not data:
        return []
    items = data.get("statuses") or data.get("results") or []
    return [_norm_tweet(t) for t in items if isinstance(t, dict)]


def mini(url: str) -> str:
    """Pide la version liviana de una imagen del CDN de X (680px en vez de la original)."""
    if not url or "pbs.twimg.com" not in url:
        return url
    partes = urllib.parse.urlsplit(url)
    query = urllib.parse.parse_qsl(partes.query, keep_blank_values=True)
    query = [(k, v) for k, v in query if k not in ("format", "name")]
    query += [("format", "jpg"), ("name", "small")]
    return urllib.parse.urlunsplit(
        (partes.scheme, partes.netloc, partes.path, urllib.parse.urlencode(query), partes.fragment)
    )


def imagenes(tweet: dict) -> list[dict]:
    """Imagenes publicables de un tweet: fotos y posters de video.

    La API v2 devuelve media.all con type=photo (url) o type=video (thumbnail_url).
    """
    media = tweet.get("media")
    if not isinstance(media, dict):
        return []
    salida: list[dict] = []
    for m in media.get("all") or []:
        if not isinstance(m, dict):
            continue
        tipo = m.get("type") or ""
        url = m.get("url") or ""
        thumb = m.get("thumbnail_url") or ""
        if tipo == "photo" and url:
            salida.append({"url": mini(url), "thumb": mini(thumb or url), "tipo": "foto"})
        elif thumb:
            # El video no se reproduce en la portada: se usa su poster.
            salida.append({"url": mini(thumb), "thumb": mini(thumb), "tipo": "poster"})
    return salida[:4]


def _fecha_dt(valor: str | None) -> datetime | None:
    """Fecha del post. La API la manda en RFC 2822 o en ISO."""
    if not valor:
        return None
    txt = str(valor).strip()
    dt = None
    try:
        dt = parsedate_to_datetime(txt)
    except (TypeError, ValueError, OverflowError):
        dt = None
    if dt is None:
        try:
            dt = datetime.fromisoformat(txt.replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def es_reciente(valor: str | None, dias: int = VENTANA_DIAS,
                ahora: datetime | None = None) -> bool:
    """True si el post cae dentro de la ventana de recencia.

    Sin fecha legible NO se descarta: si la API cambia el formato, preferimos
    perder el filtro a perder la señal.
    """
    dt = _fecha_dt(valor)
    if dt is None:
        return True
    ref = ahora or datetime.now(timezone.utc)
    return ref - timedelta(days=dias) <= dt <= ref + timedelta(days=1)


def nombre_imagen(tweet_id: str, ext: str = "jpg") -> str:
    """Nombre de archivo seguro a partir del id del tweet.

    El id viene de la API, pero se sanea igual: nada de rutas ni separadores.
    """
    limpio = re.sub(r"[^A-Za-z0-9_-]", "", str(tweet_id or ""))[:64]
    if not limpio:
        limpio = "img"
    e = (ext or "jpg").lower().lstrip(".")
    if e not in {"jpg", "jpeg", "png", "webp", "gif"}:
        e = "jpg"
    return f"{limpio}.{e}"


def debe_cachear(url: str, bytes_descargados: int) -> bool:
    """True si la imagen vale la pena cachear (https y no enorme)."""
    if not url or not url.startswith("https://"):
        return False
    return 0 < bytes_descargados <= IMG_MAX_BYTES


def cachear_imagen(url: str, tweet_id: str, destino_dir: Path,
                   timeout: int = 25) -> Path | None:
    """Descarga la imagen al disco. Nunca levanta: devuelve None si falla.

    Motivo: si X cambia su CDN o bloquea el hotlink, la seccion de la portada
    se queda sin fotos. Con la cache, las imagenes se sirven desde el repo.
    """
    if not url or not url.startswith("https://"):
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": HEADERS["User-Agent"],
                                                   "Referer": "https://x.com/"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read()
    except Exception as e:  # soft-fail: la imagen faltante no rompe nada
        print(f"  [warn] cache imagen: {e}", file=sys.stderr)
        return None
    if not debe_cachear(url, len(data)):
        return None
    try:
        destino_dir.mkdir(parents=True, exist_ok=True)
        # La extension real viene del CDN; se usa jpg salvo que sea png/webp.
        ext = "jpg"
        low = url.lower()
        if ".png" in low:
            ext = "png"
        elif ".webp" in low:
            ext = "webp"
        destino = destino_dir / nombre_imagen(tweet_id, ext)
        destino.write_bytes(data)
        return destino
    except OSError as e:
        print(f"  [warn] cache escritura: {e}", file=sys.stderr)
        return None


def limpiar_cache(dias: int = IMG_DIAS) -> int:
    """Borra las imagenes cacheadas de hace mas de `dias` dias."""
    if not IMG_DIR.exists():
        return 0
    limite = datetime.now(timezone.utc).timestamp() - dias * 86400
    borradas = 0
    for f in IMG_DIR.glob("*.jpg"):
        try:
            if f.stat().st_mtime < limite:
                f.unlink()
                borradas += 1
        except OSError:
            pass
    for f in IMG_DIR.glob("*.png"):
        try:
            if f.stat().st_mtime < limite:
                f.unlink()
                borradas += 1
        except OSError:
            pass
    for f in IMG_DIR.glob("*.webp"):
        try:
            if f.stat().st_mtime < limite:
                f.unlink()
                borradas += 1
        except OSError:
            pass
    return borradas


def es_propio(tweet: dict, handle: str) -> bool:
    """True si el tweet lo escribió la propia cuenta (no es un retweet).

    La API /2/profile/<handle>/statuses devuelve tambien lo que la cuenta
    retuiteo, con `author` = autor original y `reposted_by` = la cuenta.
    Medido: zai_org devolvia 19 items de los que solo 3 eran suyos.
    """
    autor = (tweet.get("author") or {}).get("screen_name") or ""
    if not autor:
        return False
    if tweet.get("reposted_by"):
        return False
    return autor.lower() == (handle or "").lower()


def filtrar_por_autoria(tweets: list[dict], handle: str,
                         incluir_retweets: bool = False) -> list[dict]:
    """Deja solo los posts propios de la cuenta.

    Con incluir_retweets=True se aceptan tambien los retweets, marcados con
    `repost_de` para que la UI pueda distinguirlos del post original.
    """
    if incluir_retweets:
        salida = []
        for t in tweets:
            if not isinstance(t, dict):
                continue
            autor = (t.get("author") or {}).get("screen_name") or ""
            rb = (t.get("reposted_by") or {}).get("screen_name") or ""
            if autor.lower() == (handle or "").lower() and not rb:
                salida.append(t)
            elif rb.lower() == (handle or "").lower():
                t = dict(t)
                t["repost_de"] = handle
                salida.append(t)
        return salida
    return [t for t in tweets if isinstance(t, dict) and es_propio(t, handle)]


def _norm_tweet(t: dict) -> dict:
    views = t.get("views") or 0
    try:
        views = int(views)
    except (TypeError, ValueError):
        views = 0
    autor = t.get("author") or {}
    return {
        "id": t.get("id"),
        "autor": autor.get("screen_name"),
        "avatar": autor.get("avatar_url") or "",
        "texto": (t.get("text") or "").strip()[:280],
        "views": views,
        "likes": t.get("likes") or 0,
        "reposts": t.get("reposts") or 0,
        "url": f"https://x.com/{autor.get('screen_name')}/status/{t.get('id')}",
        "tiene_video": bool((t.get("media") or {}).get("videos")) if isinstance(t.get("media"), dict) else bool(t.get("media")),
        "imagenes": imagenes(t),
        "fecha": (t.get("created_at") or {}).get("iso") if isinstance(t.get("created_at"), dict) else t.get("created_at"),
    }
def fetch_profile_statuses(base: str, handle: str, count: int = 20,
                           incluir_retweets: bool = False) -> list[dict]:
    """Posts de una cuenta, YA normalizados.

    Filtra por autoria: la API devuelve tambien los retweets de la cuenta
    (autor original distinto), que no son publicaciones propias.
    """
    data = api_get(base, f"/2/profile/{handle}/statuses", {"count": count})
    if not data:
        return []
    items = data.get("statuses") or data.get("results") or []
    propios = filtrar_por_autoria(items, handle, incluir_retweets)
    out = []
    for t in propios:
        norm = _norm_tweet(t)
        if t.get("repost_de"):
            norm["repost_de"] = t["repost_de"]
        out.append(norm)
    return out


def payload_web(viral: list[dict], hoy: str, generado: str, limite: int = 24,
                cache_dir: Path | None = None) -> dict:
    """Payload para la portada: solo los tweets que traen imagen.

    Es lo que se publica en public/data/x-viral.json y consume static-x.js.

    Si `cache_dir` viene dado, cada imagen se descarga al repo y el payload
    apunta a la copia local (`/data/x-img/<id>.jpg`). Asi la seccion no
    depende de que el CDN de X siga sirviendo el hotlink.
    """
    items = []
    cacheados = 0
    for v in viral:
        imgs = v.get("imagenes") or []
        if not imgs:
            continue
        principal = imgs[0]
        img_url = principal.get("thumb") or principal.get("url") or ""
        img_full = principal.get("url") or img_url
        tweet_id = str(v.get("id") or "")

        # Intento de cache local (nunca falla el pipeline).
        if cache_dir is not None and img_url:
            destino = cachear_imagen(img_url, tweet_id, cache_dir)
            if destino is not None:
                relativo = f"/data/x-img/{destino.name}"
                img_url = relativo
                img_full = relativo
                cacheados += 1

        items.append(
            {
                "id": v.get("id"),
                "autor": v.get("autor") or "",
                "avatar": v.get("avatar") or "",
                "texto": (v.get("texto") or "").strip()[:240],
                "url": v.get("url") or "",
                "views": v.get("views") or 0,
                "likes": v.get("likes") or 0,
                "tema": v.get("tema") or "otros",
                "etiqueta": v.get("etiqueta") or "",
                "imagen": img_url,
                "imagen_full": img_full,
                "tipo_media": principal.get("tipo") or "foto",
                "tiene_video": bool(v.get("tiene_video")),
                "fecha": v.get("fecha") or "",
            }
        )
        if len(items) >= limite:
            break
    return {
        "fecha": hoy,
        "generado": generado,
        "total": len(items),
        "cacheados": cacheados,
        "items": items,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", action="store_true", help="usar API local (localhost:8787)")
    ap.add_argument("--count", type=int, default=20)
    ap.add_argument("--incluir-retweets", action="store_true",
                    help="incluye tambien los retweets de las cuentas (marcados)")
    ap.add_argument("--sin-cache", action="store_true",
                    help="no descarga las imagenes al repo (solo hotlink)")
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
        for item in fetch_profile_statuses(base, handle, args.count,
                                          incluir_retweets=args.incluir_retweets):
            if item["id"] in vistos:
                continue
            vistos.add(item["id"])
            item["etiqueta"] = etiqueta
            item["cuenta"] = handle
            item["tema"] = clasificar(item["texto"], tema_fijo)
            if not es_reciente(item.get("fecha")):
                continue
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
            if not es_reciente(item.get("fecha")):
                continue
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

    # Payload para la portada: los virales que traen imagen.
    # Con cache local: la imagen se descarga al repo y se sirve desde /data/x-img/.
    cache_dir = None if args.sin_cache else IMG_DIR
    web = payload_web(viral, hoy, payload["generado"], cache_dir=cache_dir)
    out_web = ROOT / "public" / "data" / "x-viral.json"
    out_web.parent.mkdir(parents=True, exist_ok=True)
    out_web.write_text(json.dumps(web, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[fx_viral] {web['total']} con imagen -> {out_web}")
    if cache_dir is not None:
        print(f"[fx_viral] {web.get('cacheados', 0)} imagenes cacheadas en {cache_dir}")
        borradas = limpiar_cache()
        if borradas:
            print(f"[fx_viral] {borradas} imagenes viejas (> {IMG_DIAS} dias) borradas")

    # Resumen consola
    for v in viral[:8]:
        print(f"  {v['views']:>9,} views | @{v['autor']}: {v['texto'][:60]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
