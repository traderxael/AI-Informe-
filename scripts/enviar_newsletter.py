"""Envía el resumen diario por email con la API de Resend (sin dependencias).

Sin secrets no hace nada y sale con código 0 — el flujo diario nunca se rompe.
Necesitas cuenta en resend.com (gratis: 100 emails/día) y un dominio verificado.

Variables de entorno:
  RESEND_API_KEY     API key de Resend
  NEWSLETTER_FROM    remitente verificado, p.ej. "AI Informe <informe@tudominio.cl>"
  NEWSLETTER_TO      lista de destinatarios separada por comas
                     "amigo@a.cl,colega@b.cl"

Configura los secrets:
  gh secret set RESEND_API_KEY --body "re_..."
  gh secret set NEWSLETTER_FROM --body "AI Informe <informe@tudominio.cl>"
  gh secret set NEWSLETTER_TO --body "amigo@a.cl,colega@b.cl"
"""
import json
import os
import sys
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

SRC = Path(__file__).resolve().parents[1] / "public" / "data" / "informes.json"
SITE = "https://ai-informe.vercel.app/"
UA = "AI-Informe/1.0"


def latest_day() -> dict | None:
    try:
        days = json.loads(SRC.read_text(encoding="utf-8"))
        return days[-1] if days else None
    except Exception:
        return None


def build_html(day: dict) -> str:
    fecha = str(day.get("fecha", ""))
    total = day.get("total", 0)
    items = (day.get("items") or [])[:10]

    def card(it: dict, i: int) -> str:
        t = escape(str(it.get("titulo") or "—"))
        u = escape(str(it.get("url") or SITE))
        f = escape(str(it.get("fuente") or ""))
        s = escape(str(it.get("seccion") or ""))
        return f"""
        <div class="item">
          <div class="num">{i:02d}</div>
          <div>
            <a href="{u}" style="color:#e8eaed;text-decoration:none;font-weight:700">{t}</a>
            <div class="meta">{f}{' · ' + s if s else ''}</div>
          </div>
        </div>"""

    rows = "\n".join(card(it, i + 1) for i, it in enumerate(items))
    top = f"""
        <div class="metric"><strong>{total}</strong><span>señales del día</span></div>
"""
    return f"""
<!doctype html><html lang="es"><head><meta charset="utf-8"><title>AI Informe — {escape(fecha)}</title></head>
<body style="margin:0;background:#0b0d10;color:#e8eaed;font-family:-apple-system,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:28px 22px 36px">
    <div style="color:#83e5be;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase">AI INFORME · {escape(fecha)}</div>
    <h1 style="margin:12px 0 4px;font-size:28px;line-height:1.15;color:#ffffff">El pulso de la IA</h1>
    <p style="color:#8b93a1;font-size:14px;margin:0 0 18px">Recopilación automática desde fuentes públicas.</p>
    <div style="display:flex;gap:16px;margin:0 0 22px">{top}</div>
    <h2 style="font-size:17px;color:#fff;border-left:3px solid #83e5be;padding-left:10px">Novedades</h2>
{rows}
    <p style="color:#8b93a1;font-size:12px;margin-top:26px;border-top:1px solid #222;padding-top:16px">
      Recibes este correo porque te suscribiste a AI Informe.<br>
      <a href="{SITE}" style="color:#7dd3fc">Ver el informe completo</a>
    </p>
  </div>
</body></html>"""


def main() -> None:
    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("NEWSLETTER_FROM")
    to_raw = os.environ.get("NEWSLETTER_TO")

    if not ((api_key and sender and to_raw) or os.environ.get("NEWSLETTER_DRY_RUN") == "1"):
        print("[newsletter] faltan secrets (RESEND_API_KEY / NEWSLETTER_FROM / NEWSLETTER_TO) — se omite")
        return

    day = latest_day()
    if not day:
        print("[newsletter] sin informe — nada que enviar")
        return

    recipients = [x.strip() for x in (to_raw or "").split(",") if x.strip()]
    html = build_html(day)
    subject = f"AI Informe — señales del {day.get('fecha', '')}"

    if os.environ.get("NEWSLETTER_DRY_RUN") == "1":
        print(f"[newsletter] DRY-RUN → {recipients} · asunto: {subject} · {len(html)} bytes")
        return

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps({"from": sender, "to": recipients, "subject": subject, "html": html}).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}", "User-Agent": UA},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            print(f"[newsletter] enviado ({r.status}) a {len(recipients)} destinatarios")
    except Exception as exc:
        print(f"[newsletter] fallo el envío: {exc}")


if __name__ == "__main__":
    sys.exit(main())
