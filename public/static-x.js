/* AI Informe — sección "Lo que la IA está haciendo" (señales de X con imagen).
   Externo y CSP-safe: sin scripts inline ni atributos on* en el HTML. */
(function () {
  'use strict';

  var grid = document.getElementById('xGrid');
  var count = document.getElementById('xCount');
  if (!grid) return;

  var urls = ['/data/x-viral.json', 'data/x-viral.json'];
  var MAX = 12;

  /* Política de URLs: solo https externo o el propio sitio (mismo origen).
     La caché local de imágenes vive en /data/x-img/, así que una ruta
     relativa tiene que valer; lo que no se permite son esquemas como
     javascript: o data:. */
  function soloHttps(url) {
    if (!url) return '';
    try {
      var u = new URL(url, window.location.origin);
      if (u.protocol === 'https:') return u.href;
      if (u.origin === window.location.origin) return u.href;
      return '';
    } catch {
      return '';
    }
  }

  function fmtViews(n) {
    n = Number(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return String(n);
  }

  function el(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function tarjeta(it) {
    var enlace = el('a', 'x-card');
    var href = soloHttps(it.url);
    if (href) {
      enlace.href = href;
      enlace.target = '_blank';
      enlace.rel = 'noopener noreferrer';
    } else {
      enlace.classList.add('x-card-sin-enlace');
    }

    var media = el('span', 'x-media');
    var img = el('img');
    var src = soloHttps(it.imagen || it.imagen_full);
    if (src) {
      img.src = src;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', function () {
        media.classList.add('x-media-fail');
      });
      media.appendChild(img);
    } else {
      media.classList.add('x-media-fail');
    }
    if (it.tipo_media === 'poster') {
      var badge = el('span', 'x-badge', '▶ video');
      media.appendChild(badge);
    }
    enlace.appendChild(media);

    var body = el('span', 'x-body');
    var head = el('span', 'x-head');
    if (it.avatar) {
      var av = soloHttps(it.avatar);
      if (av) {
        var avatar = el('img', 'x-avatar');
        avatar.src = av;
        avatar.alt = '';
        avatar.loading = 'lazy';
        avatar.decoding = 'async';
        avatar.referrerPolicy = 'no-referrer';
        head.appendChild(avatar);
      }
    }
    head.appendChild(el('span', 'x-autor', '@' + (it.autor || '')));
    head.appendChild(el('span', 'x-views', fmtViews(it.views) + ' views'));
    body.appendChild(head);
    body.appendChild(el('span', 'x-texto', it.texto || ''));

    var tags = el('span', 'x-tags');
    tags.appendChild(el('span', 'x-tag', it.etiqueta || it.tema || 'ia'));
    body.appendChild(tags);
    enlace.appendChild(body);
    return enlace;
  }

  function render(data) {
    var items = (data && data.items) || [];
    grid.textContent = '';
    if (!items.length) {
      grid.appendChild(el('p', 'x-empty', 'Sin señales con imagen por ahora.'));
      return;
    }
    var frag = document.createDocumentFragment();
    items.slice(0, MAX).forEach(function (it) {
      frag.appendChild(tarjeta(it));
    });
    grid.appendChild(frag);
    if (count) {
      count.textContent = items.length + (items.length > MAX ? '+' : '') + ' publicaciones';
    }
  }

  var chain = Promise.resolve(null);
  urls.forEach(function (u) {
    chain = chain.then(function (v) {
      if (v) return v;
      return fetch(u, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    });
  });
  chain.then(function (d) {
    if (d) render(d);
    else {
      grid.textContent = '';
      grid.appendChild(el('p', 'x-empty', 'No se pudieron cargar las señales de X.'));
    }
  });
})();
