/**
 * Shared loader for build/manifest.json — single source of script order.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'build', 'manifest.json');

function loadManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);
  if (!Array.isArray(manifest.scripts) || manifest.scripts.length === 0) {
    throw new Error('manifest.json must define a non-empty "scripts" array');
  }
  for (const scriptPath of manifest.scripts) {
    if (typeof scriptPath !== 'string' || !/^(data|js)\//.test(scriptPath)) {
      throw new Error(`Invalid script path in manifest: ${scriptPath}`);
    }
  }
  return manifest;
}

function getLoadOrder(manifest = loadManifest()) {
  return manifest.scripts.map((file) => ({
    file,
    group: file.startsWith('data/') ? 'data' : 'js',
  }));
}

function getExpectedScriptSrcs(manifest = loadManifest()) {
  return manifest.scripts.slice();
}

function renderScriptTags(manifest = loadManifest()) {
  return manifest.scripts
    .map((src) => `<script src="${src}"></script>`)
    .join('\n');
}

function getHtmlPath(manifest = loadManifest()) {
  return path.join(ROOT, manifest.html || 'Game - Draft 1.html');
}

module.exports = {
  ROOT,
  MANIFEST_PATH,
  loadManifest,
  getLoadOrder,
  getExpectedScriptSrcs,
  renderScriptTags,
  getHtmlPath,
};
