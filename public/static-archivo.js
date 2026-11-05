// Carga el archivo historico de informes desde /data/archivo.json.
// Extraido de index.html para cumplir la CSP (script-src 'self', sin inline).
(function(){
  const urls = ['/data/archivo.json','data/archivo.json'];
  (async function(){
    let d = null;
    for (const u of urls) {
      try {
        const r = await fetch(u);
        if (r.ok) { d = await r.json(); break; }
      } catch {
        // Esta URL fallo; se prueba la siguiente.
      }
    }
    const list = document.getElementById('archivoList');
    const count = document.getElementById('archivoCount');
    if (!list) return;
    if (!Array.isArray(d) || d.length === 0) {
      list.textContent = 'Archivo no disponible por el momento.';
      return;
    }
    if (count) count.textContent = `${d.length} informes`;
    list.textContent = '';
    for (const item of d) {
      if (!item || !item.fecha) continue;
      const div = document.createElement('div');
      div.className = 'archivo-item';
      const left = document.createElement('div');
      const fecha = document.createElement('div');
      fecha.className = 'a-fecha';
      fecha.textContent = item.fecha;
      left.appendChild(fecha);
      if (item.resumen) {
        const res = document.createElement('div');
        res.className = 'a-resumen';
        res.textContent = item.resumen.length > 180 ? item.resumen.slice(0, 180) + '…' : item.resumen;
        left.appendChild(res);
      }
      const a = document.createElement('a');
      a.href = item.url || '#';
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.textContent = 'Leer informe';
      div.appendChild(left);
      div.appendChild(a);
      list.appendChild(div);
    }
  })();
})();
