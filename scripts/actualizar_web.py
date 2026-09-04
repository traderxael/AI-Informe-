#!/usr/bin/env python3
"""
Genera TODOS los datos JSON para la web desde los markdowns.
Corre: python scripts/actualizar_web.py
"""
import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INFORMES_DIR = ROOT / "informes"
WEB_DIR = ROOT / "web"

SECCIONES = ["novedades", "usos", "economia", "futuro"]
TITULOS_SECCIONES = {
    "novedades": "Novedades y cambios que se quedan",
    "usos": "Usos de IA en el mundo real",
    "economia": "Economía de la IA",
    "futuro": "Señales de futuro",
}

def parsear_informe(md_path: Path) -> dict:
    """Parsea un markdown de informe y extrae items por sección."""
    text = md_path.read_text(encoding="utf-8")
    lines = text.split("\n")
    
    items = {"novedades": [], "usos": [], "economia": [], "futuro": []}
    current_section = None
    
    for line in lines:
        line_stripped = line.strip()
        
        # Detectar encabezados de sección
        for key, titulo in TITULOS_SECCIONES.items():
            if line_stripped.startswith(f"## {titulo}"):
                current_section = key
                break
        
        # Extraer items
        if current_section and line_stripped.startswith("- ["):
            match = re.match(r"- \[(.+?)\]\((.+?)\) — (.+)", line_stripped)
            if match:
                titulo, url, fuente = match.groups()
                # Clasificar por país
                pais = "global"
                china_words = {"china", "chinese", "beijing", "shanghai", "shenzhen", "hangzhou",
                    "baidu", "alibaba", "tencent", "bytedance", "huawei", "sensetime",
                    "iflytek", "zhipu", "moonshot", "minimax", "stepfun", "yi", "qwen",
                    "deepseek", "pandaily", "technode", "radii", "sixth tone",
                    "wechat", "taobao", "tmall", "jd.com", "pinduoduo", "meituan",
                    "xiaomi", "oppo", "vivo", "tiktok", "douyin", "kuaishou"}
                usa_words = {"openai", "google", "meta", "facebook", "microsoft", "apple",
                    "amazon", "nvidia", "intel", "amd", "tesla", "spacex",
                    "anthropic", "cohere", "perplexity", "huggingface",
                    "techcrunch", "the verge", "ars technica", "venturebeat"}
                
                text_lower = f"{titulo} {fuente}".lower()
                china_score = sum(1 for w in china_words if w in text_lower)
                usa_score = sum(1 for w in usa_words if w in text_lower)
                
                if china_score > usa_score:
                    pais = "china"
                elif usa_score > china_score:
                    pais = "usa"
                
                items[current_section].append({
                    "titulo": titulo,
                    "url": url,
                    "fuente": fuente,
                    "resumen": "",
                    "seccion": current_section,
                    "pais": pais,
                    "fecha": md_path.stem,
                })
    
    # Contar totales
    total = sum(len(v) for v in items.values())
    
    # Obtener resumen del día
    resumen = ""
    in_resumen = False
    for line in lines:
        if line.strip() == "## Resumen del día":
            in_resumen = True
            continue
        if in_resumen and line.strip().startswith("##"):
            break
        if in_resumen and line.strip():
            resumen = line.strip()
            break
    
    return {
        "fecha": md_path.stem,
        "total": total,
        "resumen_dia": resumen,
        "por_seccion": items,
    }


def main():
    informes = []
    
    for md_file in sorted(INFORMES_DIR.glob("*.md")):
        if md_file.name.startswith("_"):
            continue
        print(f"Procesando {md_file.name}...")
        informe = parsear_informe(md_file)
        informes.append(informe)
    
    # Ordenar por fecha
    informes.sort(key=lambda x: x["fecha"])
    
    # Contar por país
    usa_count = sum(1 for d in informes for s in d["por_seccion"].values() for i in s if i.get("pais") == "usa")
    china_count = sum(1 for d in informes for s in d["por_seccion"].values() for i in s if i.get("pais") == "china")
    global_count = sum(1 for d in informes for s in d["por_seccion"].values() for i in s if i.get("pais") == "global")
    
    for d in informes:
        d["por_pais"] = {
            "usa": sum(1 for s in d["por_seccion"].values() for i in s if i.get("pais") == "usa"),
            "china": sum(1 for s in d["por_seccion"].values() for i in s if i.get("pais") == "china"),
            "global": sum(1 for s in d["por_seccion"].values() for i in s if i.get("pais") == "global"),
        }
    
    # Exportar
    out_path = WEB_DIR / "informes-data.json"
    out_path.write_text(
        json.dumps(informes, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    
    # También exportar formato simple para compatibilidad
    simple = [{"fecha": d["fecha"], "total": d["total"], "items": d["por_seccion"]["novedades"]} for d in informes]
    (WEB_DIR / "informes.json").write_text(
        json.dumps(simple, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    
    print(f"\n✅ Exportado: {out_path}")
    print(f"   {len(informes)} días, {sum(d['total'] for d in informes)} noticias totales")
    print(f"   🇺🇸 USA: {usa_count} | 🇨🇳 China: {china_count} | 🌐 Global: {global_count}")


if __name__ == "__main__":
    main()
