import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INFORMES = path.join(ROOT, "informes");
const WEB = path.join(ROOT, "web");

const FEEDS = [
  ["OpenAI", "https://openai.com/news/rss.xml"],
  ["Google AI", "https://blog.google/technology/ai/rss/"],
  ["DeepMind", "https://deepmind.google/blog/rss.xml"],
  ["Meta AI", "https://ai.meta.com/blog/rss/"],
  ["Hugging Face", "https://huggingface.co/blog/feed.xml"],
  ["TechCrunch AI", "https://techcrunch.com/category/artificial-intelligence/feed/"],
  ["The Verge AI", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"],
  ["MIT Tech Review AI", "https://www.technologyreview.com/topic/artificial-intelligence/feed"],
];

const KEYWORDS = {
  economia: ["funding","investment","investor","valuation","ipo","stock","nvidia","revenue","billion","million","acquisition","acquire","deal","layoff","market cap","earnings","profit","cost","pricing","inversión","millones","compra","adquisición","bolsa","economía","economia"],
  usos: ["healthcare","hospital","clinic","education","school","university","manufacturing","factory","customer service","enterprise","government","deployment","production","use case","real-world","real world","farmer","doctor","salud","educación","educacion","empresa","gobierno","industria","caso de uso","mundo real"],
  futuro: ["regulation","regulator","eu ai act","agi","forecast","prediction","roadmap","policy","safety","future","2030","2027","alignment","legislat","regulación","regulacion","ley","futuro","hoja de ruta","seguridad"],
  novedades: ["model","gpt","claude","gemini","llama","release","launch","update","open source","open-source","paper","research","api","feature","announce","benchmark","weight","checkpoint"],
};

function classify(title, summary) {
  const blob = `${title} ${summary}`.toLowerCase();
  const scores = { novedades: 0, usos: 0, economia: 0, futuro: 0 };
  for (const [section, words] of Object.entries(KEYWORDS)) {
    for (const word of words) {
      if (blob.includes(word.toLowerCase())) scores[section] += 1;
    }
  }
  let best = "novedades";
  for (const s of ["novedades", "usos", "economia", "futuro"]) {
    if (scores[s] > scores[best]) best = s;
  }
  return scores[best] === 0 ? "novedades" : best;
}

function stripTags(raw) {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseFeed(xml) {
  const items = [];
  const blocks = xml.split(/<(item|entry)\b/i).slice(1);
  for (let i = 0; i < blocks.length; i += 2) {
    const chunk = blocks[i + 1] || "";
    const title = (chunk.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1] || "";
    const linkTag = chunk.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    const linkText = (chunk.match(/<link[^>]*>([^<]+)<\/link>/i) || [])[1];
    const link = (linkTag && linkTag[1]) || (linkText || "").trim();
    const summaryRaw = (chunk.match(/<(?:description|summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:description|summary|content)>/i) || [])[1] || "";
    const pub = (chunk.match(/<(?:pubDate|published|updated|date)[^>]*>([^<]+)<\//i) || [])[1] || "";
    const cleanTitle = stripTags(title.replace(/&#8217;/g, "'").replace(/&#8216;/g, "'"));
    if (!cleanTitle) continue;
    items.push({
      title: cleanTitle,
      link: stripTags(link),
      summary: stripTags(summaryRaw).slice(0, 400),
      published: pub ? new Date(pub) : null,
    });
  }
  return items;
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "AI-Informe/1.0 (+https://github.com/traderxael/AI-Informe-)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function inlineMd(text) {
  let t = escapeHtml(text);
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  return t;
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inList = false;
  const close = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  for (const line of lines) {
    if (line.startsWith("### ")) {
      close();
      out.push(`<h3>${inlineMd(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      close();
      out.push(`<h2>${inlineMd(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      close();
      out.push(`<h1>${inlineMd(line.slice(2))}</h1>`);
    } else if (line.startsWith("- ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inlineMd(line.slice(2))}</li>`);
    } else if (line.trim() === "") {
      close();
    } else {
      close();
      out.push(`<p>${inlineMd(line)}</p>`);
    }
  }
  close();
  return out.join("\n");
}

const day = new Date().toISOString().slice(0, 10);
const minDt = Date.now() - 168 * 3600 * 1000;
const seen = new Set();
const collected = [];

for (const [source, url] of FEEDS) {
  const xml = await fetchText(url);
  if (!xml) continue;
  for (const item of parseFeed(xml)) {
    const key = (item.link || item.title).toLowerCase();
    if (seen.has(key)) continue;
    if (item.published && !Number.isNaN(item.published.getTime()) && item.published.getTime() < minDt) continue;
    seen.add(key);
    item.source = source;
    item.section = classify(item.title, item.summary || "");
    collected.push(item);
  }
}

collected.sort((a, b) => (b.published?.getTime() || 0) - (a.published?.getTime() || 0));

const by = { novedades: [], usos: [], economia: [], futuro: [] };
for (const it of collected) by[it.section].push(it);

function bullets(section, empty) {
  const rows = by[section].slice(0, 12);
  if (!rows.length) return empty;
  return rows
    .map((it) => (it.link ? `- [${it.title}](${it.link}) — ${it.source}` : `- ${it.title} — ${it.source}`))
    .join("\n");
}

const total = collected.length;
const resumen = total
  ? `Hoy se recopilaron ${total} piezas sobre IA (${by.novedades.length} novedades, ${by.usos.length} usos reales, ${by.economia.length} economía, ${by.futuro.length} futuro). Abajo van las más recientes, agrupadas por tema. Lo más visible: ${collected[0].title}.`
  : "No llegaron ítems nuevos de los feeds en la ventana de las últimas horas. Revisa las fuentes o vuelve a ejecutar con `--force` más tarde.";

const fuentes = FEEDS.map(([s, u]) => `- ${s}: ${u}`).join("\n");

const md = `# Informe de IA — ${day}

## Resumen del día

${resumen}

## Novedades y cambios que se quedan

${bullets("novedades", "- Sin novedades claras en los feeds de hoy.")}

## Usos de IA en el mundo real

${bullets("usos", "- Sin casos de uso destacados en los feeds de hoy.")}

## Economía de la IA

${bullets("economia", "- Sin notas económicas destacadas en los feeds de hoy.")}

## Señales de futuro

${bullets("futuro", "- Sin señales de regulación o horizonte en los feeds de hoy.")}

## Fuentes

${fuentes}
`;

fs.mkdirSync(INFORMES, { recursive: true });
fs.writeFileSync(path.join(INFORMES, `${day}.md`), md, "utf8");

const reports = fs
  .readdirSync(INFORMES)
  .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
  .sort()
  .reverse();

const rows = reports.map((file) => {
  const text = fs.readFileSync(path.join(INFORMES, file), "utf8");
  const title = (text.match(/^# (.+)$/m) || [null, file.replace(".md", "")])[1];
  const parts = text.split("## Resumen del día");
  let summary = "";
  if (parts[1]) {
    for (const line of parts[1].split("\n")) {
      if (line.startsWith("## ")) break;
      if (line.trim()) {
        summary = line.trim();
        break;
      }
    }
  }
  const date = file.replace(".md", "");
  const body = mdToHtml(text);
  fs.mkdirSync(path.join(WEB, "dias"), { recursive: true });
  fs.writeFileSync(
    path.join(WEB, "dias", `${date}.html`),
    `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <div class="wrap">
    <header>
      <p><a href="../index.html">← Todos los informes</a></p>
    </header>
    <article>
      ${body}
    </article>
  </div>
</body>
</html>
`,
    "utf8"
  );
  return { date, title, file: `dias/${date}.html`, summary };
});

fs.mkdirSync(WEB, { recursive: true });
fs.writeFileSync(path.join(WEB, "informes.json"), JSON.stringify(rows, null, 2) + "\n", "utf8");

const nav = rows.length
  ? rows.map((r, i) => `<a href="${escapeHtml(r.file)}"${i === 0 ? ' class="active"' : ""}>${escapeHtml(r.date)}</a>`).join("\n          ")
  : '<p class="empty">Aún no hay informes.</p>';
const latest = rows.length
  ? mdToHtml(fs.readFileSync(path.join(INFORMES, `${rows[0].date}.md`), "utf8"))
  : '<p class="empty">Todavía no hay un informe.</p>';

fs.writeFileSync(
  path.join(WEB, "index.html"),
  `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AI Informe</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="wrap">
    <header>
      <h1>AI Informe</h1>
      <p>Recopilación diaria de novedades, usos reales, economía y señales de futuro de la IA.</p>
    </header>
    <div class="layout">
      <nav>
        <h2>Informes</h2>
          ${nav}
      </nav>
      <article>
        ${latest}
      </article>
    </div>
  </div>
</body>
</html>
`,
  "utf8"
);

console.log(`Escrito informes/${day}.md (${collected.length} ítems).`);
