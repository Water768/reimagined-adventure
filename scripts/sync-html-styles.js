/**
 * Ensure game HTML uses external stylesheet from build/manifest.json "styles".
 * Run: node scripts/sync-html-styles.js [--check]
 */
const fs = require('fs');
const path = require('path');
const { loadManifest, getHtmlPath, ROOT } = require('./lib/load-manifest');

const checkOnly = process.argv.includes('--check');
const manifest = loadManifest();
const styles = manifest.styles || [];
const htmlPath = getHtmlPath(manifest);
let html = fs.readFileSync(htmlPath, 'utf8');

if (!styles.length) {
  console.log('[manifest] No styles in manifest — skip');
  process.exit(0);
}

const linkTags = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n');
const styleBlockRe = /<style>[\s\S]*?<\/style>/;
const hasInline = styleBlockRe.test(html);
const hasLinks = styles.every((href) => html.includes(`href="${href}"`));

if (!hasInline && hasLinks) {
  console.log(`[manifest] ${manifest.html} stylesheet link(s) OK`);
  process.exit(0);
}

if (checkOnly) {
  console.error(`[manifest] ${manifest.html} stylesheet out of sync — run: npm run styles:sync`);
  process.exit(1);
}

for (const href of styles) {
  const full = path.join(ROOT, href);
  if (!fs.existsSync(full)) {
    console.error(`[manifest] Missing stylesheet: ${href}`);
    process.exit(1);
  }
}

if (hasInline) {
  html = html.replace(styleBlockRe, linkTags);
} else if (!hasLinks) {
  html = html.replace('</head>', `${linkTags}\n</head>`);
}

fs.writeFileSync(htmlPath, html);
console.log(`[manifest] Updated ${manifest.html} stylesheet → ${styles.join(', ')}`);
