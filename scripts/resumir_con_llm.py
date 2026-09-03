#!/usr/bin/env python3
"""
Resúmenes con LLM para AI Informe.
Genera resúmenes en español de noticias en inglés.
"""
import os
import sys
import urllib.request
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def cargar_api_key() -> dict:
    """Carga la API key desde .env o variables de entorno."""
    # Buscar .env en el proyecto
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                key, _, val = line.partition("=")
                os.environ[key.strip()] = val.strip()
    
    return {
        "moonshot": os.environ.get("MOONSHOT_API_KEY", ""),
        "openai": os.environ.get("OPENAI_API_KEY", ""),
        "anthropic": os.environ.get("ANTHROPIC_API_KEY", ""),
        "google": os.environ.get("GOOGLE_API_KEY", ""),
    }


def resumir_con_moonshot(texto: str, api_key: str) -> str:
    """Resumen usando Moonshot AI (Kimi)."""
    import urllib.request
    
    prompt = f"""Resume esta noticia de IA en 2-3 oraciones muy concisas en español:

Título: """ + texto + """

Resumen (máximo 100 caracteres):"""
    
    try:
        req = urllib.request.Request(
            "https://api.moonshot.cn/v1/chat/completions",
            data=json.dumps({
                "model": "moonshot-v1-8k",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 80,
                "temperature": 0.3,
            }).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return ""


def resumir_con_openai(texto: str, api_key: str) -> str:
    """Resumen usando OpenAI."""
    try:
        import urllib.request
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps({
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": f"Resume en 2 oraciones en español: {texto[:500]}"}],
                "max_tokens": 80,
            }).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return ""


def resumen_simple(texto: str) -> str:
    """Fallback: extracto corto del texto."""
    palabras = texto.split()[:30]
    return " ".join(palabras) + ("..." if len(texto.split()) > 30 else "")


def generar_resumen_noticia(titulo: str, fuente: str, contenido: str = "") -> str:
    """Genera un resumen automático de una noticia."""
    keys = cargar_api_key()
    
    # Limpiar texto
    texto_limpio = re.sub(r"<[^>]+>", "", contenido or titulo)
    texto_limpio = re.sub(r"\s+", " ", texto_limpio).strip()
    
    # Intentar resúmenes en orden de preferencia
    if keys["moonshot"]:
        res = resumir_con_moonshot(f"{titulo} — {texto_limpio[:300]}", keys["moonshot"])
        if res:
            return f"[AI] {res}"
    
    if keys["openai"]:
        res = resumir_con_openai(f"{titulo} — {texto_limpio[:300]}", keys["openai"])
        if res:
            return f"[AI] {res}"
    
    # Fallback
    return resumen_simple(texto_limpio)


def agregar_resumenes_a_noticias(noticias: list[dict]) -> list[dict]:
    """Agrega campo 'resumen' a cada noticia."""
    for n in noticias:
        if not n.get("resumen"):
            n["resumen"] = generar_resumen_noticia(
                n.get("titulo", ""),
                n.get("fuente", ""),
                n.get("contenido", "")
            )
    return noticias


if __name__ == "__main__":
    # Test
    keys = cargar_api_key()
    print(f"Claves detectadas: {list(k for k, v in keys.items() if v)}")
    
    noticia_ejemplo = {
        "titulo": "Google announces new Gemini 2.0 model with agentic capabilities",
        "fuente": "Google AI Blog",
        "contenido": "Google today announced Gemini 2.0, their latest large language model with improved reasoning and agentic capabilities..."
    }
    
    res = generar_resumen_noticia(**noticia_ejemplo)
    print(f"Resumen: {res}")
