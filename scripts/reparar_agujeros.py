#!/usr/bin/env python3
"""Detecta y repara informes faltantes dentro de la ventana recuperable.

El cron diario puede fallar (lockfile roto, feed caído, GitHub de maintance).
Este script corre DESPUÉS del informe del día: si ayer o los días previos
quedó un agujero, lo regenera con los items que los feeds todavía traen
(la ventana de lookback de collect_items es de 7 días). Los agujeros más
viejos que esa ventana ya no son recuperables vía RSS: se listan para que
un humano decida qué hacer con ellos.

Nunca lanza excepción hacia arriba ni devuelve error: es advisory, no debe
poder tumbar la publicación del día.
"""
from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import generar_informe as gi  # noqa: E402

# Igual al lookback_hours=168 de collect_items: más allá de esto los feeds
# ya no traen los items de ese día y la "reparación" saldría vacía.
VENTANA_DIAS = 7


def hoy_utc() -> date:
    return datetime.now(timezone.utc).date()


def fechas_existentes(informes_dir: Path) -> set[date]:
    """Fechas con informe .md; ignora _plantilla y archivos no-ISO."""
    fechas: set[date] = set()
    for p in informes_dir.glob("*.md"):
        if p.name.startswith("_"):
            continue
        try:
            fechas.add(date.fromisoformat(p.stem))
        except ValueError:
            continue
    return fechas


def agujeros_recientes(
    hoy: date, existentes: set[date], ventana: int = VENTANA_DIAS
) -> list[date]:
    """Días sin informe dentro de la ventana recuperable (excluye hoy: lo
    genera el paso anterior del workflow). Orden descendente, más viejo al final."""
    return [
        hoy - timedelta(days=d)
        for d in range(1, ventana)
        if (hoy - timedelta(days=d)) not in existentes
    ]


def agujeros_antiguos(
    hoy: date, existentes: set[date], ventana: int = VENTANA_DIAS
) -> list[date]:
    """Días sin informe anteriores a la ventana: RSS ya no los puede llenar."""
    if not existentes:
        return []
    primera = min(existentes)
    antiguos: list[date] = []
    d = primera
    while d < hoy - timedelta(days=ventana - 1):
        if d not in existentes:
            antiguos.append(d)
        d += timedelta(days=1)
    return antiguos


def main() -> int:
    hoy = hoy_utc()
    existentes = fechas_existentes(gi.INFORMES_DIR)

    antiguos = agujeros_antiguos(hoy, existentes)
    if antiguos:
        lista = ", ".join(d.isoformat() for d in antiguos)
        print(
            f"Agujeros más viejos que {VENTANA_DIAS} días (no recuperables por RSS, "
            f"decidir a mano): {lista}"
        )

    recientes = agujeros_recientes(hoy, existentes)
    if not recientes:
        print("Sin agujeros recientes. Nada que reparar.")
        return 0

    for d in sorted(recientes):
        print(f"Reparando informe de {d.isoformat()}...")
        gi.write_informe(d, force=True)
        print(f"Reparado {d.isoformat()}.")

    print(
        f"Reparados {len(recientes)} informe(s): "
        + ", ".join(d.isoformat() for d in sorted(recientes))
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
