#!/usr/bin/env python3
"""Fuente única de verdad para feeds y clasificación de países de AI-Informe-.

Leído por generar_informe.py y collect_signals.py: agregar o cambiar una
fuente AQUÍ propaga a informe y señales (reemplaza la duplicación FEEDS /
LAB_FEEDS — hallazgo 4 de la auditoría del pipeline).
"""
from __future__ import annotations

# (nombre, url) — Estados Unidos / Occidente + China
FEEDS = [
    # --- Estados Unidos / Occidente ---
    ("OpenAI", "https://openai.com/news/rss.xml"),
    ("Google AI", "https://blog.google/technology/ai/rss/"),
    ("DeepMind", "https://deepmind.google/blog/rss.xml"),
    # Meta AI (ai.meta.com/blog/rss/) -> 404; VentureBeat -> 429 permanente.
    # Ambos reemplazados por feeds vivos verificados el 24-sep-2026 con
    # scripts/auditar_feeds.py (que usa el fetch_url real del pipeline).
    ("NVIDIA Blog", "https://blogs.nvidia.com/feed/"),
    ("Microsoft Research", "https://www.microsoft.com/en-us/research/feed/"),
    ("MarkTechPost", "https://www.marktechpost.com/feed/"),
    ("BAIR Berkeley", "https://bair.berkeley.edu/blog/feed.xml"),
    ("Google Developers", "https://developers.googleblog.com/feeds/posts/default"),
    ("Hugging Face", "https://huggingface.co/blog/feed.xml"),
    ("TechCrunch AI", "https://techcrunch.com/category/artificial-intelligence/feed/"),
    ("The Verge AI", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
    ("MIT Tech Review AI", "https://www.technologyreview.com/topic/artificial-intelligence/feed"),
    ("Ars Technica AI", "https://arstechnica.com/ai/feed/"),
    # --- China ---
    ("Synced", "https://syncedreview.com/feed/"),
    ("QbitAI", "https://www.qbitai.com/feed"),
    # 36Kr (36kr.com/feed) devuelve HTML sin items -> retirado; RSSHub local
    # en docker/rsshub/ lo cubre si se levanta la instancia.
    # DeepSeek RSS -> 404 desde 2024; sus lanzamientos llegan vía
    # Synced/QbitAI + el monitor de X (scripts/fx_viral.py).
    ("SCMP Business", "https://www.scmp.com/rss/92/feed"),
    # --- Papers ---
    ("arXiv cs.AI", "https://rss.arxiv.org/rss/cs.AI"),
    ("arXiv cs.CL", "https://rss.arxiv.org/rss/cs.CL"),
    # --- Tecnologia general ---
    ("The Verge", "https://www.theverge.com/rss/index.xml"),
    ("Wired", "https://www.wired.com/feed/rss"),
    # --- Ciencia + biotech (nicho 23-sep-2026) ---
    ("ScienceDaily AI", "https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml"),
    ("ScienceDaily Biotech", "https://www.sciencedaily.com/rss/plants_animals/biotechnology.xml"),
    ("Nature Biotech", "https://www.nature.com/nbt/rss/current"),
    # --- Cripto ---
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("Cointelegraph", "https://cointelegraph.com/rss"),
    # --- Seguridad tecnológica ---
    ("The Hacker News", "https://feeds.feedburner.com/TheHackersNews"),
    ("Schneier on Security", "https://www.schneier.com/feed/atom/"),
    ("Krebs on Security", "https://krebsonsecurity.com/feed/"),
    # Ciberseguridad general (nicho 24-sep-2026, pedido de Axael). Los 5
    # verificados con scripts/auditar_feeds.py + el fetch_url real del pipeline:
    # BleepingComputer 15, SecurityWeek 10, Dark Reading 50, CISA 30,
    # Google Security Blog 25. Troy Hunt (/blog/rss/) devolvio 0 items: excluido.
    ("BleepingComputer", "https://www.bleepingcomputer.com/feed/"),
    ("SecurityWeek", "https://www.securityweek.com/feed/"),
    ("Dark Reading", "https://www.darkreading.com/rss.xml"),
    ("CISA Advisories", "https://www.cisa.gov/cybersecurity-advisories/all.xml"),
    ("Google Security Blog", "https://security.googleblog.com/feeds/posts/default"),
    # --- RSS editorial ---
    # El feed Atom de YouTube del antiguo "AI Revolution" devuelve 404.
    # Reemplazo verificado con el parser real del pipeline: 12 items.
    ("AI News", "https://www.artificialintelligence-news.com/feed/"),
]

# Alias: collect_signals.py históricamente llama a LAB_FEEDS
LAB_FEEDS = FEEDS

# Fuentes clasificadas por país
FUENTES_USA = {
    "OpenAI", "Google AI", "DeepMind", "Meta AI", "Hugging Face",
    "TechCrunch AI", "The Verge AI", "MIT Tech Review AI",
    "Ars Technica AI", "VentureBeat AI", "Anthropic", "Microsoft AI",
    "NVIDIA", "Apple AI", "Amazon AI", "xAI", "Cohere", "Perplexity",
    "The Verge", "Wired", "AI Revolution", "arXiv cs.AI", "arXiv cs.CL",
    # Reemplazos de los feeds caidos, verificados 24-sep-2026.
    "NVIDIA Blog", "Microsoft Research", "MarkTechPost",
    "BAIR Berkeley", "Google Developers",
}

FUENTES_CHINA = {
    "Synced", "36Kr AI", "QbitAI", "DeepSeek", "Baidu", "Alibaba",
    "Tencent", "ByteDance", "Huawei", "SenseTime", "iFlytek",
    "Zhipu AI", "Moonshot", "MiniMax", "StepFun", "Yi", "Qwen",
    "Pandaily", "Technode", "Radii", "Sixth Tone",
    "SCMP Business", "Caixin", "Nikkei Asia",
}
