#!/usr/bin/env python3
"""
Scraper de AI Informe con Camoufox (anti-detección browser).
Extrae noticias de fuentes que requieren JS o tienen anti-bot.
"""
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "web"
WEB_DIR.mkdir(exist_ok=True)
HISTORIAL_PATH = WEB_DIR / "informes.json"

# Fuentes para scraping (útil cuando RSS no está disponible o requiere JS)
FUENTES_SCRAPING = {
    "Hacker News": {
        "url": "https://news.ycombinator.com/",
        "selector": ".athing .titleline a",
        "max_items": 8,
    },
    "Product Hunt AI": {
        "url": "https://www.producthunt.com/topics/artificial-intelligence",
        "selector": None,  # requiere JS completo
        "max_items": 5,
    },
}


def scrape_con_camoufox(url: str, selector_css: str) -> list[dict]:
    """
    Scrapea una URL usando Camoufox (browser no-detection).
    Requiere: npm install -g camoufox
    """
    import subprocess, tempfile, os

    # Script Node para Camoufox
    node_script = f"""
const {{ chromium }} = require('camoufox');
(async () => {{
    const browser = await chromium.launch({{ headless: true }});
    const page = await browser.newPage();
    
    await page.goto({json.dumps(url)}, {{ wait_until: 'networkidle', timeout: 30000 }});
    await page.wait_for_timeout(2000);
    
    const items = await page.$$eval({json.dumps(selector_css)}, els => 
        els.slice(0, 10).map(el => ({{
            titulo: el.textContent?.trim() || '',
            url: el.href || ''
        }})).filter(i => i.titulo.length > 5)
    );
    
    console.log(JSON.stringify(items));
    await browser.close();
}})();
"""
    
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
            f.write(node_script)
            script_path = f.name
        
        result = subprocess.run(
            ['node', script_path],
            capture_output=True, text=True, timeout=60,
            cwd=Path.home() / 'camoufox-browser'  # Usa el camofox del usuario
        )
        
        os.unlink(script_path)
        
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout.strip())
    except Exception as e:
        print(f"    ⚠️ Error scraping {url}: {e}")
    
    return []


def scrape_hackernews_simple() -> list[dict]:
    """Scraping de Hacker News via RSS (más confiable)."""
    import xml.etree.ElementTree as ET
    try:
        req = urllib.request.Request(
            "https://news.ycombinator.com/rss",
            headers={"User-Agent": "Mozilla/5.0 (compatible; AI-Informe/1.0)"}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            xml = resp.read().decode("utf-8", errors="ignore")
        
        root = ET.fromstring(xml)
        items = []
        for item in root.iter("item"):
            title = item.findtext("title", "")
            link = item.findtext("link", "")
            desc = item.findtext("description", "")
            # Algunos RSS devuenen "Comments" vacío; usar description si tiene contenido real
            if title and len(title) > 5:
                # Limpiar descripción: quitar HTML y espacios extra
                resumen = desc.strip()[:200] if desc and desc.strip() != "Comments" else re.sub(r"\s+", " ", title)[:120]
                items.append({
                    "titulo": re.sub(r"<[^>]+>", "", title).strip(),
                    "url": link,
                    "fuente": "Hacker News",
                    "resumen": resumen + ("..." if len(resumen) == 200 else "")
                })
        return items[:10]
    except Exception as e:
        print(f"    ⚠️ Error HN: {e}")
        return []


def scrapear_todas_fuentes() -> list[dict]:
    """Scrapea todas las fuentes que tienen RSS limitado o requieren JS."""
    noticias = []
    
    # 1. Hacker News (sin browser, muy rápido)
    print("  📡 Scrapeando Hacker News...")
    noticias.extend(scrape_hackernews_simple())
    
    # 2. Agregar más scrape aquí cuando tengas Camoufox corriendo
    # for nombre, config in FUENTES_SCRAPING.items():
    #     if config.get("selector"):
    #         items = scrape_con_camoufox(config["url"], config["selector"])
    #         noticias.extend(items)
    
    return noticias


def guardar_historial(noticias: list[dict]):
    """Guarda noticias scrapeadas al historial JSON."""
    if not noticias:
        return
    
    fecha = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    historial = []
    if HISTORIAL_PATH.exists():
        try:
            historial = json.loads(HISTORIAL_PATH.read_text(encoding="utf-8"))
        except:
            historial = []
    
    # Agregar nuevas
    historial.append({
        "fecha": fecha,
        "total": len(noticias),
        "items": noticias
    })
    
    # Mantener últimos 30 días
    historial = historial[-30:]
    
    HISTORIAL_PATH.write_text(
        json.dumps(historial, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"    ✅ Guardadas {len(noticias)} noticias en {HISTORIAL_PATH}")


if __name__ == "__main__":
    print("🔍 Scrapeando fuentes con anti-detección...")
    items = scrapear_todas_fuentes()
    print(f"✅ Total: {len(items)} noticias obtenidas")
    guardar_historial(items)
