/* AI Informe — buscador full-text del archivo (30 días). Externo, CSP-safe. */
(function () {
  var input = document.getElementById('archivoSearch');
  var results = document.getElementById('archivoResults');
  var list = document.getElementById('archivoList');
  if (!input || !results) return;

  var data = null;
  var timer = null;

  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fetchData() {
    if (data) return Promise.resolve(data);
    var urls = ['/data/informes.json', 'informes.json'];
    var chain = Promise.resolve(null);
    urls.forEach(function (u) {
      chain = chain.then(function (v) {
        if (v) return v;
        return fetch(u, { cache: 'force-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
      });
    });
    return chain.then(function (d) { data = d || []; return data; });
  }
  function renderResults(items, query) {
    if (!items.length) {
      results.innerHTML = '<div class="result-empty">Sin resultados para «' + escapeHtml(query) + '»</div>';
      results.hidden = false;
      return;
    }
    var html = '<div class="result-count">' + items.length + (items.length >= 40 ? '+' : '') + ' resultados</div>';
    items.slice(0, 40).forEach(function (it) {
      html += '<a class="result-item" href="' + escapeHtml(it.url || '#') + '" target="_blank" rel="noopener">'
        + '<span class="result-fecha">' + escapeHtml(String(it.fecha || '').slice(0, 10)) + '</span>'
        + '<span><span class="result-title">' + escapeHtml(it.titulo) + '</span><br>'
        + '<span class="result-meta">' + escapeHtml(it.fuente || '') + (it.seccion ? ' · ' + escapeHtml(it.seccion) : '') + (it.pais ? ' · ' + escapeHtml(it.pais) : '') + '</span>'
        + '</span></a>';
    });
    results.innerHTML = html;
    results.hidden = false;
  }
  input.addEventListener('input', function () {
    var q = fold(input.value.trim());
    clearTimeout(timer);
    if (q.length < 3) {
      results.hidden = true;
      if (list) list.hidden = false;
      return;
    }
    timer = setTimeout(function () {
      fetchData().then(function (d) {
        var hits = [];
        var seen = new Set();
        for (var i = d.length - 1; i >= 0 && hits.length < 120; i--) {
          var items = (d[i] && d[i].items) || [];
          for (var j = 0; j < items.length && hits.length < 120; j++) {
            var it = items[j];
            var hay = fold((it.titulo || '') + ' ' + (it.resumen || '') + ' ' + (it.fuente || '') + ' ' + (it.pais || '') + ' ' + (it.seccion || ''));
            if (hay.indexOf(q) !== -1 && !seen.has(it.url)) {
              seen.add(it.url);
              hits.push(it);
            }
          }
        }
        renderResults(hits, input.value.trim());
        if (list) list.hidden = true;
      });
    }, 250);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      input.value = '';
      results.hidden = true;
      if (list) list.hidden = false;
    }
  });
})();
