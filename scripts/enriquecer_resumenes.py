#!/usr/bin/env python3
"""
Enriquece los informes extrayendo resumen de los artículos.
Uso: python scripts/enriquecer_resumenes.py [--fecha YYYY-MM-DD]
"""
import json
import re
import urllib.request
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"

def extraer_resumen_url(url: str) -> str:
    """Extrae un resumen automático de una URL."""
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; AI-Informe/1.0)"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
        
        # Quitar scripts y styles
        html = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL|re.IGNORECASE)
        html = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL|re.IGNORECASE)
        
        # Buscar primer párrafo relevante
        # Intentar meta description primero
        meta = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)', html, re.IGNORECASE)
        if meta and len(meta.group(1)) > 30:
            return meta.group(1)[:200] + ("..." if len(meta.group(1)) > 200 else "")
        
        # Buscar en el primer <p> largo
        for match in re.finditer(r'<p[^>]*>([^<]{50,500})</p>', html):
            text = re.sub(r"\s+", " ", match.group(1)).strip()
            if len(text) > 60 and "cookie" not in text.lower() and "subscribe" not in text.lower():
                return text[:200]
        
        return ""
    except:
        return ""


def enriquecer_informe(fecha: str = None):
    """Agrega resúmenes a un informe existente."""
    path = WEB_DIR / "informes-data.json"
    if not path.exists():
        print("❌ No existe informes-data.json")
        return False
    
    datos = json.loads(path.read_text(encoding="utf-8"))
    
    if fecha:
        objetivo = [d for d in datos if d["fecha"] == fecha]
        if not objetivo:
            print(f"❌ No hay informe para {fecha}")
            return False
    else:
        objetivo = datos[-1:]
    
    cambios = 0
    for dia in objetivo:
        print(f"Procesando {dia['fecha']}...")
        for seccion, items in dia["por_seccion"].items():
            for item in items:
                if not item.get("resumen"):
                    resumen = extraer_resumen_url(item["url"])
                    if resumen:
                        item["resumen"] = resumen
                        cambios += 1
                        print(f"  ✅ {item['titulo'][:50]}...")
    
    if cambios > 0:
        path.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n✅ {cambios} resúmenes agregados")
    else:
        print("\nℹ️ No había resúmenes faltantes")
    
    return True


if __name__ == "__main__":
    import sys
    fecha = sys.argv[1] if len(sys.argv) > 1 else None
    enriquecer_informe(fecha)
