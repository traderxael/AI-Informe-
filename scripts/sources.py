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
    ("Meta AI", "https://ai.meta.com/blog/rss/"),
    ("Hugging Face", "https://huggingface.co/blog/feed.xml"),
    ("TechCrunch AI", "https://techcrunch.com/category/artificial-intelligence/feed/"),
    ("The Verge AI", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
    ("MIT Tech Review AI", "https://www.technologyreview.com/topic/artificial-intelligence/feed"),
    ("Ars Technica AI", "https://arstechnica.com/ai/feed/"),
    ("VentureBeat AI", "https://venturebeat.com/category/ai/feed/"),
    # --- China ---
    ("Synced", "https://syncedreview.com/feed/"),
    ("36Kr AI", "https://36kr.com/feed"),
    ("QbitAI", "https://www.qbitai.com/feed"),
    ("DeepSeek", "https://www.deepseek.com/rss.xml"),
    # --- Finanzas China ---
    ("SCMP Business", "https://www.scmp.com/rss/92/feed"),
    # --- Tecnologia general ---
    ("The Verge", "https://www.theverge.com/rss/index.xml"),
    ("Wired", "https://www.wired.com/feed/rss"),
    ("Hacker News", "https://hnrss.org/frontpage"),
    # --- Video / analisis (YouTube) ---
    ("AI Revolution", "https://www.youtube.com/feeds/videos.xml?channel_id=UC5l7RouTQ60oUjLjt1Nh-UQ"),
]

# Alias: collect_signals.py históricamente llama a LAB_FEEDS
LAB_FEEDS = FEEDS

# Fuentes clasificadas por país
FUENTES_USA = {
    "OpenAI", "Google AI", "DeepMind", "Meta AI", "Hugging Face",
    "TechCrunch AI", "The Verge AI", "MIT Tech Review AI",
    "Ars Technica AI", "VentureBeat AI", "Anthropic", "Microsoft AI",
    "NVIDIA", "Apple AI", "Amazon AI", "xAI", "Cohere", "Perplexity",
    "The Verge", "Wired", "Hacker News", "AI Revolution",
}

FUENTES_CHINA = {
    "Synced", "36Kr AI", "QbitAI", "DeepSeek", "Baidu", "Alibaba",
    "Tencent", "ByteDance", "Huawei", "SenseTime", "iFlytek",
    "Zhipu AI", "Moonshot", "MiniMax", "StepFun", "Yi", "Qwen",
    "Pandaily", "Technode", "Radii", "Sixth Tone",
    "SCMP Business", "Caixin", "Nikkei Asia",
}
