"""Notificación diaria del informe por Telegram y/o Discord (sin dependencias).

Lee public/data/informes.json (lo genera generar_informe.py) y envía un
resumen corto: total de señales + top 5 novedades + enlace.

Variables de entorno (todas opcionales; sin ellas el script no hace nada y
sale con código 0, para que el workflow nunca se rompa por notificar):
  TELEGRAM_BOT_TOKEN  token de tu bot (BotFather)
  TELEGRAM_CHAT_ID    chat/group id donde publica el bot
  DISCORD_WEBHOOK_URL URL del webhook del canal

Uso local:  python scripts/notificar.py
Workflow:   ya lo ejecuta tras commitear el día; configura los secrets:
  gh secret set TELEGRAM_BOT_TOKEN --body "..."
  gh secret set TELEGRAM_CHAT_ID   --body "..."
  gh secret set DISCORD_WEBHOOK_URL --body "..."
"""
import json
import os
import sys
import urllib.request
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "public" / "data" / "informes.json"
SITE = "https://ai-informe.vercel.app/"
UA = "AI-Informe-notify/1.0"


def latest_day() -> dict | None:
    try:
        days = json.loads(SRC.read_text(encoding="utf-8"))
    except Exception:
        return None
    return days[-1] if days else None


def build_message(day: dict) -> str:
    fecha = str(day.get("fecha", ""))
    total = day.get("total", 0)
    items = (day.get("items") or [])[:5]
    lines = [
        f"📰 *AI Informe* — {fecha}",
        f"{total} señales del día",
        "",
        "*Novedades*",
    ]
    for i, it in enumerate(items, 1):
        lines.append(f"{i}. {it.get('titulo', '—')} — {it.get('fuente', '')}")
    lines += ["", f"👉 {SITE}"]
    return "\n".join(lines)


def post_json(url: str, payload: dict) -> bool:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": UA},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return 200 <= r.status < 300
    except Exception as exc:  # no cortamos el flujo: reportamos y seguimos
        print(f"[notify] fallo POST {url.split('/')[0]}: {exc}")
        return False


def main() -> None:
    tg_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    tg_chat = os.environ.get("TELEGRAM_CHAT_ID")
    discord = os.environ.get("DISCORD_WEBHOOK_URL")

    if not ((tg_token and tg_chat) or discord):
        print("[notify] sin secrets configurados — se omite la notificación")
        return
    day = latest_day()
    if not day:
        print("[notify] no hay informe en public/data/informes.json — nada que notificar")
        return
    text = build_message(day)

    if tg_token and tg_chat:
        ok = post_json(f"https://api.telegram.org/bot{tg_token}/sendMessage", {
            "chat_id": tg_chat,
            "text": text,
            "parse_mode": "Markdown",
            "disable_web_page_preview": False,
        })
        print(f"[notify] telegram: {'ok' if ok else 'fallo'}")

    if discord:
        ok = post_json(discord, {"content": text})
        print(f"[notify] discord: {'ok' if ok else 'fallo'}")


if __name__ == "__main__":
    sys.exit(main())
