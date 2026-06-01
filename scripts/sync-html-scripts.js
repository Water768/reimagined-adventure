/**
 * Sync external <script src> tags in the game HTML from build/manifest.json.
 *
 *   node scripts/sync-html-scripts.js          — write HTML if out of date
 *   node scripts/sync-html-scripts.js --check  — exit 1 if HTML drifts (CI)
 */
const fs = require('fs');
const {
  loadManifest,
  renderScriptTags,
  getHtmlPath,
  getExpectedScriptSrcs,
  ROOT,
} = require('./lib/load-manifest');

const checkOnly = process.argv.includes('--check');

const manifest = loadManifest();
const htmlPath = getHtmlPath(manifest);
const html = fs.readFileSync(htmlPath, 'utf8');

const scriptBlockRe = /(?:<script src="[^"]+"><\/script>\n)+/;
const match = html.match(scriptBlockRe);
if (!match) {
  console.error(`[manifest] No external script block found in ${manifest.html}`);
  process.exit(1);
}

const expectedBlock = renderScriptTags(manifest) + '\n';
const currentBlock = match[0];

if (currentBlock === expectedBlock) {
  console.log(`[manifest] ${manifest.html} script tags match build/manifest.json (${manifest.scripts.length} files)`);
  process.exit(0);
}

if (checkOnly) {
  console.error(`[manifest] ${manifest.html} is out of sync with build/manifest.json`);
  console.error('[manifest] Run: npm run manifest:sync');
  const expected = getExpectedScriptSrcs(manifest);
  const actual = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  const len = Math.max(expected.length, actual.length);
  for (let i = 0; i < len; i++) {
    if (expected[i] !== actual[i]) {
      console.error(`  index ${i}: manifest="${expected[i] || '(missing)'}" html="${actual[i] || '(missing)'}"`);
    }
  }
  process.exit(1);
}

for (const scriptPath of manifest.scripts) {
  const full = `${scriptPath}`;
  if (!fs.existsSync(require('path').join(ROOT, full))) {
    console.error(`[manifest] Missing file listed in manifest: ${full}`);
    process.exit(1);
  }
}

const updated = html.replace(scriptBlockRe, expectedBlock);
fs.writeFileSync(htmlPath, updated);
console.log(`[manifest] Updated ${manifest.html} (${manifest.scripts.length} script tags)`);
