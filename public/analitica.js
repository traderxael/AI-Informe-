// AI Informe · dashboard de analítica (first-party). Carga /api/stats y pinta.
(() => {
  const app = document.getElementById("app");
  if (!app) return;

  const esc = (s) =>
    String(s).replace(/[&<>'"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]),
    );

  const bar = (lbl, val, max) => {
    const pct = max > 0 ? Math.max(2, Math.round((val / max) * 100)) : 0;
    return (
      `<div class="row"><span class="lbl" title="${esc(lbl)}">${esc(lbl)}</span>` +
      `<div class="track"><div class="fill" style="width:${pct}%"></div></div>` +
      `<span class="val">${val}</span></div>`
    );
  };

  const rows = (obj, limit = 8) =>
    Object.entries(obj || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

  (async () => {
    let data = null;
    try {
      const r = await fetch("/api/stats", { cache: "no-store" });
      if (r.ok) data = await r.json();
    } catch (e) {
      data = null;
    }

    if (!data) {
      app.innerHTML = '<p class="sub">No se pudo cargar la analítica.</p>';
      return;
    }
    if (data.reason === "no_token") {
      app.innerHTML =
        '<p class="sub">La analítica está construida pero aún sin conectar: falta el ' +
        "<code>BLOB_READ_WRITE_TOKEN</code> del proyecto.</p>";
      return;
    }

    const s = data.summary;
    if (!s || !s.total) {
      app.innerHTML =
        '<p class="sub">Aún no hay visitas registradas. El beacon ya está activo: ' +
        "apenas llegue la primera, acá se ve.</p>";
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
    const cards = [
      [s.total.toLocaleString("es-CL"), "visitas totales"],
      [(s.days?.[today] || 0).toLocaleString("es-CL"), "hoy"],
      [sum(s.paths).toLocaleString("es-CL"), "páginas vistas"],
      [sum(s.refs).toLocaleString("es-CL"), "desde referentes"],
    ];

    const last14 = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      last14.push([k.slice(5), s.days?.[k] || 0]);
    }
    const maxDay = Math.max(...last14.map((x) => x[1]), 1);
    const paths = rows(s.paths);
    const maxP = Math.max(...paths.map((x) => x[1]), 1);
    const refs = rows(s.refs);
    const maxR = Math.max(...refs.map((x) => x[1]), 1);

    app.innerHTML =
      `<div class="cards">${cards
        .map(([v, l]) => `<div class="card"><strong>${v}</strong><span>${l}</span></div>`)
        .join("")}</div>` +
      (s.updated
        ? `<p class="note">Último registro: ${new Date(s.updated).toLocaleString("es-CL")}</p>`
        : "") +
      `<div class="panel"><h2>Últimos 14 días</h2>${last14
        .map(([l, v]) => bar(l, v, maxDay))
        .join("")}</div>` +
      `<div class="panel"><h2>Páginas más vistas</h2>${
        paths.length ? paths.map(([l, v]) => bar(l, v, maxP)).join("") : '<p class="note">Sin datos.</p>'
      }</div>` +
      `<div class="panel"><h2>Referentes</h2>${
        refs.length ? refs.map(([l, v]) => bar(l, v, maxR)).join("") : '<p class="note">Sin referentes todavía.</p>'
      }</div>`;
  })();
})();
