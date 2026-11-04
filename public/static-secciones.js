/* AI Informe — secciones Tendencias y Estadísticas (portada estática, CSP-safe) */
(function () {
  var COLORS = ['#83e5be','#7dd3fc','#c4b5fd','#fcd34d','#fda4af','#6ee7b7','#fdba74','#a5f3fc'];
  var P = { l: 46, r: 12, t: 16, b: 30 };

  function fetchJson(urls) {
    var chain = Promise.resolve(null);
    urls.forEach(function (u) {
      chain = chain.then(function (v) {
        if (v) return v;
        return fetch(u, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
      });
    });
    return chain;
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── TENDENCIAS: líneas de Elo (SVG) ── */
  function renderTendencias(modelos, historial) {
    var svg = document.getElementById('tendenciasChart');
    var legend = document.getElementById('tendenciasLegend');
    var empty = document.getElementById('tendenciasEmpty');
    if (!svg) return;
    var rows = (modelos && Array.isArray(modelos.modelos)) ? modelos.modelos : [];
    var top = rows.slice(0, 8);
    var history = (historial && Array.isArray(historial.history)) ? historial.history.slice() : [];
    history.sort(function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)); });

    var W = 720, H = 300, iw = W - P.l - P.r, ih = H - P.t - P.b;
    var values = [];
    top.forEach(function (m) {
      history.forEach(function (p) {
        var elo = p.modelos ? p.modelos[m.modelo] : null;
        if (elo != null) values.push(elo);
      });
    });
    var minE = values.length ? Math.min.apply(null, values) : 1400;
    var maxE = values.length ? Math.max.apply(null, values) : 1600;
    var pad = Math.max(15, Math.round((maxE - minE) * 0.15));
    var lo = minE - pad, hi = maxE + pad;
    var X = function (i) { return history.length > 1 ? P.l + (i / (history.length - 1)) * iw : P.l + iw / 2; };
    var Y = function (e) { return P.t + (1 - (e - lo) / (hi - lo)) * ih; };

    var svgHtml = '';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      var y = P.t + f * ih;
      var e = Math.round(hi - f * (hi - lo));
      svgHtml += '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y + '" y2="' + y + '" stroke="rgba(255,255,255,.09)" stroke-dasharray="3 4"/>';
      svgHtml += '<text x="' + (P.l - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="rgba(255,255,255,.45)">' + e + '</text>';
    });
    if (history.length) {
      svgHtml += '<text x="' + P.l + '" y="' + (H - 8) + '" font-size="10" fill="rgba(255,255,255,.4)">' + esc(history[0].fecha || '') + '</text>';
      svgHtml += '<text x="' + (W - P.r) + '" y="' + (H - 8) + '" text-anchor="end" font-size="10" fill="rgba(255,255,255,.4)">' + esc(history[history.length - 1].fecha || '') + '</text>';
    }
    top.forEach(function (m, idx) {
      var pts = [];
      history.forEach(function (p, i) {
        var elo = p.modelos ? p.modelos[m.modelo] : null;
        if (elo != null) pts.push(X(i) + ',' + Y(elo));
      });
      if (pts.length) {
        svgHtml += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + COLORS[idx % COLORS.length] + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
      }
    });
    svg.innerHTML = svgHtml;

    if (legend) {
      legend.innerHTML = top.map(function (m, idx) {
        return '<span class="chip-legend"><span class="dot" style="background:' + COLORS[idx % COLORS.length] + '"></span>' + esc(m.modelo) + '</span>';
      }).join('');
    }
    if (empty && history.length < 2) {
      empty.hidden = false;
      empty.textContent = (window.localStorage.getItem('ai-informe-lang') === 'en')
        ? 'Not enough history yet — one point is added every day. Meanwhile, the current ranking is shown as dots.'
        : 'Aún no hay suficiente historia — cada día se agrega un punto. Mientras tanto, el ranking actual se muestra en el gráfico.';
    }
  }

  /* ── ESTADÍSTICAS: cifras y barras ── */
  function renderEstadisticas(modelos, feedHealth, informes) {
    function setText(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; }
    var days = Array.isArray(informes) ? informes.length : 0;
    var sum = Array.isArray(informes) ? informes.reduce(function (acc, x) { return acc + (x.total || 0); }, 0) : 0;
    setText('statSignals', days ? String(sum) : '—');
    setText('statPerDay', days ? String(Math.round(sum / days)) : '—');
    var rows = (modelos && Array.isArray(modelos.modelos)) ? modelos.modelos : [];
    var avgElo = rows.length ? Math.round(rows.reduce(function (a, m) { return a + (m.elo || 0); }, 0) / rows.length) : null;
    setText('statAvgElo', avgElo != null ? String(avgElo) : '—');
    if (feedHealth && feedHealth.total_feeds) setText('statFeeds', feedHealth.ok + '/' + feedHealth.total_feeds);
    setText('estadisticasActualizado', (feedHealth && feedHealth.generado ? 'corte: ' + String(feedHealth.generado).slice(0, 10) : ''));

    function renderBars(id, list, maxValue) {
      var box = document.getElementById(id);
      if (!box) return;
      var max = Math.max.apply(null, list.map(function (x) { return x.value; }).concat([1]));
      box.innerHTML = list.map(function (x) {
        var pct = Math.max(2, Math.round((x.value / Math.max(max, maxValue || 1)) * 100));
        return '<div class="bar-row"><span class="bar-label" title="' + esc(x.label) + '">' + esc(x.label) + '</span><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div><span class="bar-value">' + x.value + '</span></div>';
      }).join('');
    }

    // Modelos por organización
    var orgMap = {};
    rows.forEach(function (m) { var k = m.org || '—'; orgMap[k] = (orgMap[k] || 0) + 1; });
    var orgs = Object.keys(orgMap).map(function (k) { return { label: k, value: orgMap[k] }; })
      .sort(function (a, b) { return b.value - a.value; }).slice(0, 6);
    renderBars('statsOrgs', orgs);

    // Fuentes con más artículos
    var feeds = (feedHealth && Array.isArray(feedHealth.feeds)) ? feedHealth.feeds : [];
    var topFeeds = feeds.slice().sort(function (a, b) { return (b.items || 0) - (a.items || 0); }).slice(0, 5)
      .map(function (f) { return { label: f.nombre, value: f.items || 0 }; });
    renderBars('statsFeeds', topFeeds);
  }

  Promise.all([
    fetchJson(['/data/modelos.json', 'modelos.json']),
    fetchJson(['/data/modelos-history.json', 'modelos-history.json']),
    fetchJson(['/data/feed_health.json', 'feed_health.json']),
    fetchJson(['/data/informes.json', 'informes.json'])
  ]).then(function (res) {
    renderTendencias(res[0], res[1]);
    renderEstadisticas(res[0], res[2], res[3]);
  }).catch(function () { /* las cifras quedan en "—" */ });
})();
