// Service Worker Registration
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then(reg => console.log('SW registered:', reg.scope))
          .catch(err => console.log('SW registration failed:', err));
      });
    }

    // PWA Install Prompt
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

    // App State
    let allReports = [];
    let currentFilter = 'all';

    // DOM Elements
    const content = document.getElementById('pwaContent');
    const nav = document.getElementById('pwaNav');

    // Navigation
    nav.addEventListener('click', (e) => {
      if (!e.target.dataset.filter) return;
      currentFilter = e.target.dataset.filter;
      nav.querySelectorAll('.pwa-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn === e.target);
      });
      render();
    });

    // Footer navigation
    document.querySelectorAll('[data-nav]').forEach(link => {
      link.addEventListener('click', (e) => {
        document.querySelectorAll('[data-nav]').forEach(l => l.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    // Parse report data inline (from informes.json structure)
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
        content.innerHTML = '<div class="loading"><p>Error cargando informes. Verifica tu conexión.</p></div>';
      }
    }

    function categorize(title, summary) {
      const text = (title + ' ' + summary).toLowerCase();
      if (text.includes('guerra') || text.includes('oil') || text.includes('ucrania') || text.includes('saudi') || text.includes('iran')) return 'guerra';
      if (text.includes('shanghai') || text.includes('hang seng') || text.includes('s&p') || text.includes('ftse') || text.includes('mercado') || text.includes('stock')) return 'mercados';
      if (text.includes('deepseek') || text.includes('enflame') || text.includes('huawei') || text.includes('china') || text.includes('moonshot')) return 'china';
      if (text.includes('quantum') || text.includes('fusion') || text.includes('perovskite') || text.includes('robot') || text.includes('tech') || text.includes('tecnolog')) return 'tech';
      return 'ia';
    }

    function render() {
      const filtered = currentFilter === 'all'
        ? allReports
        : allReports.filter(r => r.category === currentFilter);

      if (filtered.length === 0) {
        content.innerHTML = '<div class="loading"><p>No hay informes en esta categoría.</p></div>';
        return;
      }

      const sections = {
        ia: '🧠 Inteligencia Artificial',
        china: '🇨🇳 China y Tecnología',
        tech: '🚀 Nuevas Tecnologías',
        guerra: '⚔️ Guerra y Geopolítica',
        mercados: '📈 Mercados'
      };

      let html = '';
      const grouped = {};

      filtered.forEach(r => {
        if (!grouped[r.category]) grouped[r.category] = [];
        grouped[r.category].push(r);
      });

      for (const [cat, reports] of Object.entries(grouped)) {
        html += `<h2 class="pwa-section-title">${sections[cat] || cat}</h2>`;
        reports.forEach(r => {
          const dateStr = r.date || '';
          const title = r.title || 'Informe';
          const summary = (r.summary || '').substring(0, 120);
          const link = r.file || '#';
          html += `
            <a href="/web/${link}" class="pwa-card" style="text-decoration:none;color:inherit;display:block;">
              <div class="meta">${dateStr}</div>
              <h3>${title}</h3>
              <div class="summary">${summary}…</div>
              <div style="margin-top:0.5rem;">
                <span class="tag">${cat.toUpperCase()}</span>
              </div>
            </a>
          `;
        });
      }

      content.innerHTML = html;
    }

    // Initialize
    loadReports();
