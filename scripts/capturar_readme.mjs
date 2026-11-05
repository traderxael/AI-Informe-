#!/usr/bin/env node
/**
 * Captura las pantallas de la portada para el README.
 *
 * Uso: node scripts/capturar_readme.mjs [urlBase] [directorioSalida]
 * Por defecto: http://localhost:8765 y screenshots/readme
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2] || 'http://localhost:8765';
const outDir = path.resolve(process.argv[3] || 'screenshots/readme');

const VISTAS = [
  { nombre: 'portada', url: '/', tipo: 'viewport' },
  { nombre: 'tendencias', url: '/', tipo: 'elemento', selector: '#tendencias' },
  { nombre: 'estadisticas', url: '/', tipo: 'elemento', selector: '#estadisticas' },
  { nombre: 'x-viral', url: '/', tipo: 'elemento', selector: '#x-viral', imagenes: true },
  { nombre: 'pwa', url: '/pwa/app.html', tipo: 'viewport' },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  for (const vista of VISTAS) {
    await page.goto(base + vista.url, { waitUntil: 'networkidle' });

    const destino = path.join(outDir, `${vista.nombre}.png`);
    if (vista.tipo === 'elemento') {
      // Espera a que la seccion async (grafico/tabla/imagenes) tenga contenido real.
      await page.waitForFunction(
        (sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          return el.querySelectorAll('svg path, .stat-card, .stats-grid > *, .x-card').length > 0;
        },
        vista.selector,
        { timeout: 15000 }
      ).catch(() => {});

      if (vista.imagenes) {
        // Las imagenes de X son lazy: hay que bringinglas a la vista y esperar.
        await page.evaluate((sel) => {
          document.querySelector(sel)?.scrollIntoView({ block: 'start', behavior: 'instant' });
        }, vista.selector);
        await page.waitForFunction(
          () => {
            const imgs = [...document.querySelectorAll('#xGrid .x-media img')];
            return imgs.length > 0 && imgs.every((i) => i.complete);
          },
          { timeout: 20000 }
        ).catch(() => {});
      }

      await page.locator(vista.selector).screenshot({ path: destino });
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1200);
      await page.screenshot({ path: destino });
    }
    console.log(`OK -> ${destino}`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
