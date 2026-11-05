// Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then(reg => console.log('SW:', reg.scope))
          .catch(err => console.log('SW fail:', err));
      });
    }

    // Install prompt
    let deferredPrompt;
    const installBtn = document.getElementById('installBtn');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installBtn.style.display = 'block';
    });
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') installBtn.style.display = 'none';
      deferredPrompt = null;
    });

    // State
    let allReports = [];
    let currentFilter = 'all';

    const content = document.getElementById('content');
    const filters = document.getElementById('filters');

    // Filter click
    filters.addEventListener('click', (e) => {
      if (!e.target.dataset.filter) return;
      currentFilter = e.target.dataset.filter;
      filters.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn === e.target);
      });
      render();
    });

    // Footer nav
    document.querySelectorAll('[data-nav]').forEach(link => {
      link.addEventListener('click', (e) => {
        document.querySelectorAll('[data-nav]').forEach(l => l.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Cargar informes
    async function loadReports() {
      try {
        const res = await fetch('/web/informes.json');
        const data = await res.json();
        allReports = data.map(r => ({
          ...r,
          category: categorize(r.title, r.summary)
        }));
        render();
      } catch {
        content.innerHTML = '<div class="loading"><p>No se pudieron cargar los informes.</p></div>';
      }
    }

    function categorize(title, summary) {
      const text = (title + ' ' + summary).toLowerCase();
      if (text.includes('guerra') || text.includes('oil') || text.includes('ucrania') || text.includes('saudi') || text.includes('iran') || text.includes('ducto') || text.includes('energía')) return 'guerra';
      if (text.includes('shanghai') || text.includes('hang seng') || text.includes('s&p') || text.includes('ftse') || text.includes('mercado') || text.includes('stock') || text.includes('compuesto')) return 'mercados';
      if (text.includes('deepseek') || text.includes('enflame') || text.includes('huawei') || text.includes('china') || text.includes('moonshot') || text.includes('kimi')) return 'china';
      if (text.includes('quantum') || text.includes('fusion') || text.includes('perovskite') || text.includes('robot') || text.includes('tech') || text.includes('tecnolog') || text.includes('6g')) return 'tech';
      return 'ia';
    }

    function render() {
      const filtered = currentFilter === 'all'
        ? allReports
        : allReports.filter(r => r.category === currentFilter);

      if (filtered.length === 0) {
        content.innerHTML = '<div class="loading"><p>No hay informes aquí.</p></div>';
        return;
      }

      const sections = {
        ia: 'Inteligencia Artificial',
        china: 'China y Tecnología',
        tech: 'Nuevas Tecnologías',
        guerra: 'Guerra y Geopolítica',
        mercados: 'Mercados'
      };

      let html = '';
      const grouped = {};
      filtered.forEach(r => {
        if (!grouped[r.category]) grouped[r.category] = [];
        grouped[r.category].push(r);
      });

      for (const [cat, reports] of Object.entries(grouped)) {
        html += `<h2 class="section-title">${sections[cat] || cat}</h2>`;
        reports.forEach(r => {
          const title = r.title || 'Informe';
          const summary = (r.summary || '').substring(0, 140);
          const link = r.file || '#';
          html += `
            <a href="/web/${link}" class="card">
              <div class="date">${r.date}</div>
              <h3>${title}</h3>
              <div class="summary">${summary}…</div>
              <span class="tag ${cat}">${cat}</span>
            </a>
          `;
        });
      }

      content.innerHTML = html;
    }

    loadReports();
