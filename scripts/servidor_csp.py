#!/usr/bin/env python3
"""Servidor estatico de prueba que replica el layout de Vercel + la CSP de vercel.json.

Uso: python scripts/servidor_csp.py [puerto]
- Sirve la raiz del repo y public/ fusionado en la raiz (como hace Vercel).
- Aplica el header Content-Security-Policy de vercel.json a todas las respuestas.
"""
from __future__ import annotations

import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

CSP = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))["headers"][0][
    "headers"
][0]["value"]

TIPOS = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".pdf": "application/pdf",
    ".woff2": "font/woff2",
}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def resolver(self) -> Path | None:
        ruta = self.path.split("?", 1)[0].split("#", 1)[0]
        ruta = re.sub(r"^/+", "", ruta)
        candidatos = []
        if ruta:
            candidatos += [ROOT / ruta, PUBLIC / ruta]
            candidatos += [ROOT / f"{ruta}index.html", PUBLIC / f"{ruta}index.html"]
            if not ruta.endswith("/"):
                candidatos += [ROOT / f"{ruta}/index.html", PUBLIC / f"{ruta}/index.html"]
        else:
            candidatos += [ROOT / "index.html"]
        for c in candidatos:
            if c.is_file():
                return c
        return None

    def do_GET(self) -> None:  # noqa: N802
        archivo = self.resolver()
        if archivo is None:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", "9")
            self.send_header("Content-Security-Policy", CSP)
            self.end_headers()
            self.wfile.write(b"not found")
            return
        datos = archivo.read_bytes()
        self.send_response(200)
        self.send_header(
            "Content-Type",
            TIPOS.get(archivo.suffix.lower(), "application/octet-stream"),
        )
        self.send_header("Content-Length", str(len(datos)))
        self.send_header("Content-Security-Policy", CSP)
        self.end_headers()
        self.wfile.write(datos)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f"sirviendo {ROOT} en http://localhost:{puerto} (CSP activa)", flush=True)
    ThreadingHTTPServer(("127.0.0.1", puerto), Handler).serve_forever()
