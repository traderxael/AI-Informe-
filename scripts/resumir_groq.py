#!/usr/bin/env python3
"""
Resúmenes LLM (Groq) para AI Informe — Fase 2.

1. Genera el "Resumen del día" en español natural (web/informes-data.json
   + public/data/informes-data.json).
2. Traduce/reescribe los `summary` de public/data/signals-first.json al
   español (el original se conserva en `summary_orig`).

Uso: python scripts/resumir_groq.py [--max N] [--force]
Sin GROQ_API_KEY sale suave (sin cambios) para no romper el workflow.

Modelos: openai/gpt-oss-120b (free tier 30 RPM / 1K RPD / 8K TPM / 200K TPD)
con fallback rotativo por si el modelo sale de EOL (los modelos mueren rápido).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA = ROOT / "public" / "data"
WEB_DIR = ROOT / "web"
SIGNALS_FIRST = PUBLIC_DATA / "signals-first.json"

# Fallback rotativo: si un modelo devuelve 400/404 (EOL/removed), prueba el siguiente.
MODELOS = [
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "groq/compound-mini",
]

UA = {"User-Agent": "Mozilla/5.0 (compatible; AI-Informe/1.0)"}
PAUSA_ENTRE_CALLS = 2.5  # ~24 RPM, bajo el límite de 30 RPM del free tier


def cargar_api_key() -> str:
    """GROQ_API_KEY desde entorno o .env del proyecto (nunca en el repo)."""
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8", errors="replace").splitlines():
            if "=" in line and not line.startswith("#"):
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip())
    return os.environ.get("GROQ_API_KEY", "")


def groq_chat(prompt: str, api_key: str, max_tokens: int, modelo: str) -> str:
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps({
            "model": modelo,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.2,
        }).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = json.loads(resp.read().decode("utf-8", "replace"))
    return (data["choices"][0]["message"]["content"] or "").strip()


def groq_chat_robusto(prompt: str, api_key: str, max_tokens: int) -> tuple[str, str]:
    """Llama a Groq rotando modelos ante EOL; reintentos con backoff ante 429.

    Devuelve (texto, modelo_usado) o ("", "") si todo falla.
    """
    global _modelo_activo
    intentos = 0
    while intentos < 3:
        try:
            texto = groq_chat(prompt, api_key, max_tokens, _modelo_activo)
            if texto:
                return texto, _modelo_activo
            intentos += 1
        except urllib.error.HTTPError as e:
            if e.code in (400, 404):
                # Modelo muerto o no servido → rotar al siguiente.
                idx = MODELOS.index(_modelo_activo) if _modelo_activo in MODELOS else 0
                if idx + 1 < len(MODELOS):
                    print(f"  ⚠️ {_modelo_activo} no disponible ({e.code}) → rotando a {MODELOS[idx + 1]}")
                    _modelo_activo = MODELOS[idx + 1]
                    continue
                print(f"  ⚠️ todos los modelos fallaron ({e.code})")
                return "", ""
            if e.code == 429:
                wait = 20 * (intentos + 1)
                print(f"  ⚠️ 429 rate limit → espero {wait}s")
                time.sleep(wait)
                intentos += 1
                continue
            print(f"  ⚠️ HTTP {e.code}")
            return "", ""
        except (OSError, ValueError, KeyError) as e:
            print(f"  ⚠️ error de red/parseo: {e}")
            intentos += 1
            time.sleep(5)
    return "", ""


_modelo_activo = MODELOS[0]


def es_espanol(texto: str) -> bool:
    """Heurística liviana: stopwords españolas presentes."""
    t = f" {texto.lower()} "
    marcadores = [" el ", " la ", " de ", " que ", " y ", " en ", " para ", " con ", " los ", " las ", " se "]
    return sum(1 for m in marcadores if m in t) >= 2


def resumen_dia(api_key: str, force: bool) -> bool:
    """Escribe resumen_dia del día más reciente en informes-data.json (web + public)."""
    if not SIGNALS_FIRST.exists():
        print("⚠️ sin signals-first.json, salto resumen del día")
        return False
    cambios = 0
    for path in (WEB_DIR / "informes-data.json", PUBLIC_DATA / "informes-data.json"):
        if not path.exists():
            continue
        datos = json.loads(path.read_text(encoding="utf-8"))
        if not datos:
            continue
        ultimo = datos[-1]
        actual = (ultimo.get("resumen_dia") or "").strip()
        if actual and es_espanol(actual) and not force:
            continue
        # Referencia: títulos de las secciones del día (máx 14, por orden).
        titulos = []
        for sec in ("novedades", "usos", "economia", "futuro"):
            for it in ultimo.get("por_seccion", {}).get(sec, [])[:5]:
                titulos.append(f"- {it.get('titulo', '')} ({it.get('fuente', '')})")
        prompt = (
            "Eres el editor de un boletín diario de IA en español. Escribe el resumen "
            "del día en 2-3 oraciones naturales: menciona los temas principales que "
            "aparecen abajo (empresas, productos, tendencias), sin listar URLs ni "
            "repetir los títulos literalmente. Devuelve SOLO el texto del resumen.\n\n"
            "Titulares del día:\n" + "\n".join(titulos[:14])
        )
        texto, modelo = groq_chat_robusto(prompt, api_key, 220)
        if not texto:
            print(f"⚠️ LLM no disponible para resumen_dia ({path.name})")
            continue
        texto = texto.strip().strip('"').strip()
        ultimo["resumen_dia"] = texto
        path.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        cambios += 1
        print(f"  ✅ resumen_dia ({path.relative_to(ROOT)}) [{modelo}]: {texto[:90]}...")
        time.sleep(PAUSA_ENTRE_CALLS)
    return cambios > 0


def traducir_signals(api_key: str, max_items: int, force: bool) -> bool:
    """Traduce los summary de signals-first.json al español."""
    if not SIGNALS_FIRST.exists():
        print("⚠️ sin signals-first.json")
        return False
    datos = json.loads(SIGNALS_FIRST.read_text(encoding="utf-8"))
    señales = datos.get("signals", [])[:max_items]
    cambios = 0
    for s in señales:
        summary = (s.get("summary") or "").strip()
        if not summary or summary == (s.get("title") or "").strip():
            continue
        if es_espanol(summary) and not force:
            continue
        if not s.get("summary_orig"):
            s["summary_orig"] = summary
        prompt = (
            "Traduce al español y pule este extracto de una noticia de IA. "
            "Devuelve 1 oración natural (máximo 160 caracteres), SOLO el texto "
            "traducido, sin comillas ni prefijos:\n\n" + summary[:400]
        )
        texto, modelo = groq_chat_robusto(prompt, api_key, 100)
        if not texto:
            print("  ⚠️ LLM no disponible, corto la traducción")
            break
        s["summary"] = texto.strip().strip('"').strip()
        cambios += 1
        print(f"  ✅ {s.get('title', '')[:55]} → {s['summary'][:70]}")
        time.sleep(PAUSA_ENTRE_CALLS)
    if cambios:
        datos["generated_at"] = datos.get("generated_at")
        SIGNALS_FIRST.write_text(
            json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    return cambios > 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Resúmenes LLM (Groq) para el informe.")
    parser.add_argument("--max", type=int, default=24, help="Máximo de señales a traducir (default 24).")
    parser.add_argument("--force", action="store_true", help="Regenera aunque ya esté en español.")
    args = parser.parse_args()

    api_key = cargar_api_key()
    if not api_key:
        print("ℹ️ GROQ_API_KEY no configurada — sin cambios (fallback: extractos originales)")
        return 0
    print(f"🔑 GROQ_API_KEY detectada (modelo: {_modelo_activo})")

    print("1/2 Resumen del día...")
    resumen_dia(api_key, args.force)
    print("2/2 Traducción de señales (first)...")
    traducir_signals(api_key, args.max, args.force)
    return 0


if __name__ == "__main__":
    sys.exit(main())
