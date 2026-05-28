const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const htmlPath = path.join(dir, 'Game - Draft 1.html');
const jsDir = path.join(dir, 'js');

const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = html.match(/<script>\n([\s\S]*)<\/script>\n<\/body>/);
if (!scriptMatch) throw new Error('Main inline script not found');
const script = scriptMatch[1];

function sectionStart(title) {
  const marker = `/* ═══════════════════════════════════════\n   ${title}`;
  const idx = script.indexOf(marker);
  if (idx < 0) throw new Error('Section not found: ' + title);
  return idx;
}

function sliceBetween(startIdx, endIdx) {
  return script.slice(startIdx, endIdx).trim() + '\n';
}

const nav = sectionStart('NAVIGATION');
const panels = sectionStart('PANELS');
const syncUi = sectionStart('SYNC UI');
const plot = sectionStart('PLOT GRID');
const interior = sectionStart('INTERIOR GRID');
const fishing = sectionStart('FISHING');
const interactions = sectionStart('INTERACTIONS');
const workbench = sectionStart('WORKBENCH');
const foundBanner = sectionStart('FOUND BANNER');
const notifications = sectionStart('NOTIFICATIONS');
const persistence = sectionStart('PERSISTENCE');
const init = sectionStart('INIT');

const stateHeader = sectionStart('STATE');
const dataInit = sectionStart('DATA INIT');
const getDefaultStateIdx = script.indexOf('function getDefaultState()');

const header = (name) => `/* Hearthstead — ${name} */\n'use strict';\n\n`;

const modules = [
  ['constants.js', 'constants', sliceBetween(stateHeader, dataInit)],
  ['data-init.js', 'data init', sliceBetween(dataInit, getDefaultStateIdx)],
  ['state.js', 'state & activity', sliceBetween(getDefaultStateIdx, nav)],
  ['navigation.js', 'navigation', sliceBetween(nav, panels)],
  ['panels.js', 'panels', sliceBetween(panels, syncUi)],
  ['sync-ui.js', 'sync ui', sliceBetween(syncUi, plot)],
  ['plot.js', 'plot grid', sliceBetween(plot, interior)],
  ['interior-grid.js', 'interior grid', sliceBetween(interior, fishing)],
  ['activities.js', 'activities', sliceBetween(fishing, interactions)],
  ['interactions.js', 'interactions', sliceBetween(interactions, workbench)],
  ['workbench.js', 'workbench', sliceBetween(workbench, foundBanner)],
  ['ui.js', 'ui banners & notifications', sliceBetween(foundBanner, persistence)],
  ['save.js', 'persistence', sliceBetween(persistence, init)],
  ['bootstrap.js', 'bootstrap', sliceBetween(init, script.length)],
];

if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir);

const loadOrder = [];
for (const [file, label, content] of modules) {
  fs.writeFileSync(path.join(jsDir, file), header(label) + content);
  loadOrder.push(file);
}

const dataScripts = html.match(/<script src="data\/[^"]+"><\/script>/g) || [];
const jsScripts = loadOrder.map(f => `<script src="js/${f}"></script>`);
const newBodyEnd = dataScripts.join('\n') + '\n' + jsScripts.join('\n') + '\n</body>';

const newHtml = html.replace(/<script>\n[\s\S]*<\/script>\n<\/body>/, newBodyEnd);
fs.writeFileSync(htmlPath, newHtml);

console.log('Extracted', loadOrder.length, 'modules to js/');
console.log('HTML now', newHtml.split('\n').length, 'lines');
