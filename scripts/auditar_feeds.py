"""Audita feeds con el fetcher REAL del repo (fetch_url -> bytes, parse_feed)."""
import sys, concurrent.futures as cf

sys.path.insert(0, r"C:\Users\USUARIO\AI-Informe-\scripts")
import sources as S
import generar_informe as G

feeds = dict(S.FEEDS)
target = sys.argv[1:] or list(feeds)
todo = [(n, feeds[n]) for n in target if n in feeds]
print(f"Probando {len(todo)} feeds con fetch_url()+parse_feed() reales\n")


def probe(item):
    name, url = item
    try:
        raw = G.fetch_url(url)
        if not raw:
            return name, "SIN_BYTES", "fetch_url -> None (404/bloqueo/timeout)"
        items = G.parse_feed(raw)
        if not items:
            head = raw[:120].decode("utf-8", "replace").replace("\n", " ")
            return name, "0_ITEMS", f"bytes={len(raw)} head={head!r}"
        first = str(items[0].get("title", ""))[:52]
        return name, f"{len(items)}_ITEMS", f"titulo1={first!r}"
    except Exception as e:
        return name, "EXCEPCION", f"{type(e).__name__}: {e}"[:80]


with cf.ThreadPoolExecutor(max_workers=8) as ex:
    rows = list(ex.map(probe, todo))

ok = [r for r in rows if r[1].endswith("_ITEMS") and not r[1].startswith("0_")]
bad = [r for r in rows if r not in ok]
print("=== FUNCIONAN (%d) ===" % len(ok))
for n, s, d in sorted(ok):
    print(f"  OK  {n:22} {s:>9}  {d}")
print("\n=== ROTOS / VACIOS (%d) ===" % len(bad))
for n, s, d in sorted(bad):
    print(f"  XX  {n:22} {s:>9}  {d}")
