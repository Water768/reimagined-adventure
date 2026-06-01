/**
 * Full consistency & dependency audit for Hearthstead codebase.
 * Script order: build/manifest.json (see npm run manifest:check).
 * Run: npm run audit  |  npm run ci
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  ROOT,
  loadManifest,
  getLoadOrder,
  getExpectedScriptSrcs,
  getHtmlPath,
} = require('./lib/load-manifest');

const manifest = loadManifest();
const htmlPath = getHtmlPath(manifest);
const html = fs.readFileSync(htmlPath, 'utf8');
const LOAD_ORDER = getLoadOrder(manifest);

const report = {
  errors: [],
  warnings: [],
  info: [],
};

function err(msg) {
  report.errors.push(msg);
}
function warn(msg) {
  report.warnings.push(msg);
}
function info(msg) {
  report.info.push(msg);
}

// ── 1. HTML script tags vs build/manifest.json ──
const scriptSrcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const expectedSrcs = getExpectedScriptSrcs(manifest);
if (scriptSrcs.length !== expectedSrcs.length) {
  err(`HTML has ${scriptSrcs.length} script tags; manifest lists ${expectedSrcs.length} — run npm run manifest:sync`);
}
scriptSrcs.forEach((src, i) => {
  if (src !== expectedSrcs[i]) {
    err(`Script order mismatch at index ${i}: HTML="${src}" manifest="${expectedSrcs[i]}" — edit build/manifest.json then npm run manifest:sync`);
  }
  if (!fs.existsSync(path.join(ROOT, src))) err(`Missing script file: ${src}`);
});
const manifestOnly = expectedSrcs.filter((s) => !scriptSrcs.includes(s));
const htmlOnly = scriptSrcs.filter((s) => !expectedSrcs.includes(s));
if (manifestOnly.length) err(`In manifest but not in HTML: ${manifestOnly.join(', ')}`);
if (htmlOnly.length) err(`In HTML but not in manifest: ${htmlOnly.join(', ')}`);
const dupScripts = scriptSrcs.filter((s, i) => scriptSrcs.indexOf(s) !== i);
if (dupScripts.length) err(`Duplicate script tags: ${[...new Set(dupScripts)].join(', ')}`);

if (html.match(/<script(?![^>]*\ssrc=)/)) {
  err('Inline <script> block found in HTML (should be external only)');
}

const manifestStyles = manifest.styles || [];
if (manifestStyles.length) {
  for (const href of manifestStyles) {
    if (!fs.existsSync(path.join(ROOT, href))) err(`Missing stylesheet from manifest: ${href}`);
    if (!html.includes(`href="${href}"`)) {
      err(`HTML missing stylesheet link for ${href} — run npm run styles:sync`);
    }
  }
  if (/<style>[\s\S]*?<\/style>/.test(html)) {
    err('Inline <style> block found — extract to css/game.css and run npm run styles:sync');
  }
}

// ── 2. Parse globals per file ──
function extractTopLevelBindings(source) {
  const bindings = { consts: new Set(), funcs: new Set(), lets: new Set() };
  // Strip block comments for simpler parsing
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of stripped.matchAll(/^function\s+([a-zA-Z_$][\w$]*)/gm)) bindings.funcs.add(m[1]);
  for (const m of stripped.matchAll(/^const\s+([a-zA-Z_$][\w$]*)/gm)) bindings.consts.add(m[1]);
  for (const m of stripped.matchAll(/^let\s+([a-zA-Z_$][\w$]*)/gm)) bindings.lets.add(m[1]);
  return bindings;
}

function extractIdentifierRefs(source) {
  const refs = new Set();
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
  for (const m of stripped.matchAll(/\b([a-zA-Z_$][\w$]*)\b/g)) refs.add(m[1]);
  return refs;
}

const fileBindings = {};
const allDefined = { consts: new Set(), funcs: new Set(), lets: new Set() };
const duplicateConsts = [];

for (const { file } of LOAD_ORDER) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const b = extractTopLevelBindings(src);
  fileBindings[file] = b;
  for (const c of b.consts) {
    if (allDefined.consts.has(c)) duplicateConsts.push({ name: c, file });
    allDefined.consts.add(c);
  }
  for (const f of b.funcs) {
    if (allDefined.funcs.has(f)) warn(`Duplicate function declaration: ${f} in ${file}`);
    allDefined.funcs.add(f);
  }
  for (const l of b.lets) {
    if (allDefined.lets.has(l)) warn(`Duplicate let declaration: ${l} in ${file}`);
    allDefined.lets.add(l);
  }
}

for (const d of duplicateConsts) {
  err(`Duplicate const "${d.name}" (redeclared in ${d.file})`);
}

// ── 3. Cross-file reference check (heuristic) ──
const BUILTIN = new Set([
  'undefined', 'null', 'true', 'false', 'NaN', 'Infinity',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Math', 'Date', 'JSON',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
  'console', 'document', 'window', 'localStorage', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'Error', 'Map', 'Set', 'Promise', 'RegExp',
  'this', 'arguments', 'length', 'push', 'pop', 'slice', 'map', 'filter', 'forEach',
  'reduce', 'find', 'findIndex', 'includes', 'indexOf', 'join', 'split', 'trim',
  'keys', 'values', 'entries', 'fromEntries', 'assign', 'freeze', 'hasOwnProperty',
  'toString', 'valueOf', 'prototype', 'constructor', 'call', 'apply', 'bind',
  'then', 'catch', 'finally', 'async', 'await', 'function', 'return', 'if', 'else',
  'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'throw',
  'new', 'typeof', 'instanceof', 'in', 'of', 'const', 'let', 'var', 'class',
  'extends', 'super', 'import', 'export', 'default', 'delete', 'void', 'yield',
  'get', 'set', 'static', 'require', 'module', 'exports', 'process',
  'event', 'stopPropagation', 'preventDefault', 'target', 'currentTarget',
  'style', 'classList', 'dataset', 'innerHTML', 'textContent', 'hidden', 'value',
  'addEventListener', 'removeEventListener', 'getElementById', 'querySelector',
  'querySelectorAll', 'createElement', 'appendChild', 'removeChild', 'replaceChild',
  'setAttribute', 'getAttribute', 'removeAttribute', 'click', 'focus', 'blur',
  'parentElement', 'children', 'childNodes', 'closest', 'contains', 'matches',
  'scrollIntoView', 'scrollTop', 'scrollLeft', 'offsetWidth', 'offsetHeight',
  'clientWidth', 'clientHeight', 'getBoundingClientRect', 'requestAnimationFrame',
  'cancelAnimationFrame', 'performance', 'now', 'floor', 'ceil', 'round', 'min', 'max',
  'random', 'abs', 'sqrt', 'pow', 'sign', 'log', 'warn', 'error',
  'stringify', 'parse', 'isArray', 'from', 'some', 'every', 'sort', 'reverse',
  'concat', 'flat', 'flatMap', 'splice', 'unshift', 'shift', 'fill', 'copyWithin',
  'at', 'replace', 'replaceAll', 'match', 'matchAll', 'search', 'test', 'exec',
  'substring', 'substr', 'charAt', 'charCodeAt', 'codePointAt', 'padStart', 'padEnd',
  'startsWith', 'endsWith', 'repeat', 'toLowerCase', 'toUpperCase', 'localeCompare',
  'Number', 'String', 'Boolean', 'Symbol', 'BigInt', 'Intl', 'Reflect', 'Proxy',
  'WeakMap', 'WeakSet', 'ArrayBuffer', 'DataView', 'Float32Array', 'Uint8Array',
  'AbortController', 'AbortSignal', 'structuredClone', 'queueMicrotask',
  'name', 'icon', 'key', 'type', 'id', 'typeId', 'label', 'title', 'msg', 'text',
  'html', 'cssText', 'className', 'node', 'el', 'btn', 'div', 'span', 'img',
  'i', 'j', 'k', 'n', 'x', 'y', 'z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h',
  'm', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'ok', 'def', 'val', 'num', 'str',
  'item', 'items', 'list', 'arr', 'obj', 'data', 'src', 'dest', 'opts', 'cfg',
  'fn', 'cb', 'ctx', 'idx', 'len', 'max', 'min', 'cap', 'amt', 'qty', 'count',
  'total', 'pct', 'rate', 'lvl', 'level', 'xp', 'tier', 'slot', 'cell', 'room',
  'tile', 'grid', 'state', 'recipe', 'recipes', 'inv', 'equip', 'skill', 'skills',
  'pet', 'pets', 'fish', 'log', 'logs', 'ore', 'rock', 'wood', 'stone', 'water',
  'fire', 'food', 'tool', 'axe', 'shard', 'fiber', 'thread', 'spin', 'cook',
  'mine', 'gather', 'chop', 'craft', 'build', 'edit', 'mode', 'screen', 'panel',
  'menu', 'overlay', 'banner', 'toast', 'notify', 'save', 'load', 'sync', 'init',
  'open', 'close', 'show', 'hide', 'toggle', 'start', 'stop', 'add', 'remove',
  'update', 'render', 'build', 'get', 'set', 'ensure', 'check', 'can', 'has',
  'is', 'was', 'did', 'will', 'should', 'need', 'use', 'used', 'make', 'run',
  'done', 'fail', 'pass', 'miss', 'hit', 'success', 'error', 'warn', 'info',
  'left', 'right', 'top', 'bottom', 'width', 'height', 'size', 'px', 'ms',
  'sec', 'time', 'now', 'last', 'next', 'prev', 'cur', 'old', 'new', 'tmp',
  'res', 'ret', 'out', 'in', 'on', 'off', 'up', 'down', 'all', 'any', 'none',
  'self', 'other', 'each', 'own', 'prop', 'props', 'args', 'arg', 'param',
  'params', 'opt', 'options', 'config', 'result', 'results', 'reason', 'message',
  'code', 'status', 'active', 'enabled', 'disabled', 'visible', 'hidden',
  'true', 'false', 'null', 'undefined',
]);

const definedSoFar = { consts: new Set(), funcs: new Set(), lets: new Set() };
const unresolvedByFile = {};

for (const { file } of LOAD_ORDER) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const refs = extractIdentifierRefs(src);
  const local = fileBindings[file];
  const missing = [];
  for (const r of refs) {
    if (BUILTIN.has(r)) continue;
    if (local.consts.has(r) || local.funcs.has(r) || local.lets.has(r)) continue;
    if (definedSoFar.consts.has(r) || definedSoFar.funcs.has(r) || definedSoFar.lets.has(r)) continue;
    // Skip single-letter except common game globals checked later
    if (r.length === 1 && r !== 'L') continue;
    missing.push(r);
  }
  if (missing.length) {
    unresolvedByFile[file] = [...new Set(missing)].sort();
  }
  for (const c of local.consts) definedSoFar.consts.add(c);
  for (const f of local.funcs) definedSoFar.funcs.add(f);
  for (const l of local.lets) definedSoFar.lets.add(l);
}

// Filter unresolved: only flag ALL-CAPS or camelCase identifiers likely to be globals
for (const [file, ids] of Object.entries(unresolvedByFile)) {
  const suspicious = ids.filter(
    (id) =>
      /^[A-Z][A-Z0-9_]+$/.test(id) ||
      /^[a-z][a-zA-Z0-9]*$/.test(id) &&
        (id.startsWith('get') || id.startsWith('set') || id.startsWith('build') ||
         id.startsWith('init') || id.startsWith('sync') || id.startsWith('ensure') ||
         id.startsWith('migrate') || id.startsWith('repair') || id.startsWith('close') ||
         id.startsWith('open') || id.startsWith('toggle') || id.startsWith('nav') ||
         id.startsWith('grant') || id.startsWith('add') || id.startsWith('remove') ||
         id.startsWith('update') || id.startsWith('render') || id.startsWith('start') ||
         id.startsWith('stop') || id.startsWith('mine') || id.startsWith('fish') ||
         id.startsWith('chop') || id.startsWith('gather') || id.startsWith('craft') ||
         id.startsWith('spin') || id.startsWith('cook') || id.startsWith('store') ||
         id.startsWith('workbench') || id.startsWith('interior') || id.startsWith('plot') ||
         id.startsWith('show') || id.startsWith('hide') || id.startsWith('load') ||
         id.startsWith('save') || id.startsWith('manual') || id.startsWith('confirm') ||
         id.startsWith('recenter') || id.startsWith('finalize') || id.startsWith('reconcile'))
  );
  if (suspicious.length) {
    warn(`${file}: possible unresolved refs at load time: ${suspicious.join(', ')}`);
  }
}

// ── 4. Known data dependency order ──
const DATA_DEPS = {
  'data/interior.js': ['WOODLANDS', 'PLOT_TILE_BASE', 'MINES'],
  'data/crafting.js': ['FISH_DEFS'],
  'data/barn.js': ['BARN_ANIMALS'],
  'js/data-init.js': ['PLOT_TILE_BASE', 'WOODLANDS', 'GATHERING_LOCATIONS', 'MINES', 'FURNITURE_CRAFTS', 'FURNITURE_DEFS', 'SHELF_RECIPES', 'LOG_DEFS', 'MINE_RESOURCE_DEFS'],
};
for (const [file, deps] of Object.entries(DATA_DEPS)) {
  const actualFile = file.replace('data/data-init', 'js/data-init');
  if (!fs.existsSync(path.join(ROOT, actualFile))) continue;
  const idx = LOAD_ORDER.findIndex((x) => x.file === actualFile || x.file === file);
  const available = new Set();
  for (let i = 0; i < idx; i++) {
    const b = fileBindings[LOAD_ORDER[i].file];
    b.consts.forEach((c) => available.add(c));
    b.funcs.forEach((f) => available.add(f));
  }
  for (const dep of deps) {
    if (!available.has(dep)) err(`${actualFile} requires ${dep} but it is not defined in prior scripts`);
  }
}

// ── 5. onclick handlers ──
const ONCLICK_EVENT_METHODS = new Set(['stopPropagation', 'preventDefault']);
const onclickExprs = [...html.matchAll(/onclick="([^"]+)"/g)].map((m) => m[1]);
const onclickFns = new Set();
onclickExprs.forEach((expr) => {
  const cleaned = expr.replace(/event\.[a-zA-Z_$][\w$]*\s*\([^)]*\)\s*;?/g, '');
  cleaned.replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, (_, n) => {
    if (n === 'event' || ONCLICK_EVENT_METHODS.has(n)) return;
    onclickFns.add(n);
  });
});
for (const fn of onclickFns) {
  if (!allDefined.funcs.has(fn)) err(`onclick handler "${fn}" has no top-level function declaration`);
}

// ── 6. getElementById / querySelector IDs in HTML ──
const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const allJs = LOAD_ORDER.map(({ file }) => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
const getByIdRefs = [...allJs.matchAll(/getElementById\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
const queryIdRefs = [...allJs.matchAll(/querySelector(?:All)?\s*\(\s*['"]#([^'"\s\[]+)['"]/g)].map((m) => m[1]);
const jsIdRefs = [...new Set([...getByIdRefs, ...queryIdRefs])];
const missingIds = jsIdRefs.filter((id) => !htmlIds.has(id));
if (missingIds.length) {
  warn(`JS references ${missingIds.length} element ID(s) not found in HTML: ${missingIds.slice(0, 20).join(', ')}${missingIds.length > 20 ? '...' : ''}`);
}

const unusedIds = [...htmlIds].filter((id) => !jsIdRefs.includes(id) && !html.includes(`for="${id}"`));
info(`${htmlIds.size} HTML ids; ${jsIdRefs.length} referenced in JS; ${unusedIds.length} ids appear unused by getElementById/querySelector`);

// ── 7. Runtime load test ──
const elStore = {};
function mkEl(id) {
  return {
    id,
    style: { setProperty: () => {}, cssText: '' },
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    dataset: {},
    innerHTML: '',
    textContent: '',
    hidden: false,
    value: '',
    appendChild: () => {},
    removeChild: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    children: [],
    childNodes: [],
    parentElement: null,
    offsetWidth: 100,
    offsetHeight: 100,
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 100 }),
    scrollIntoView: () => {},
    click: () => {},
    remove: () => {},
    blur: () => {},
    focus: () => {},
  };
}

const ctx = {
  console: { log: () => {}, warn: () => {}, error: (...a) => report.runtimeErrors.push(a.join(' ')) },
  document: {
    getElementById: (id) => {
      if (!elStore[id]) elStore[id] = mkEl(id);
      return elStore[id];
    },
    querySelector: (sel) => {
      const m = sel.match(/^#(.+)$/);
      if (m) return ctx.document.getElementById(m[1]);
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: () => mkEl(''),
  },
  window: {
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0; },
  clearTimeout: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  Math, Date, Object, Array, JSON, Number, String, parseInt, parseFloat, isNaN, Infinity, undefined, Error, Map, Set,
};
Object.assign(ctx.window, ctx);
ctx.window.addEventListener = ctx.window.addEventListener || (() => {});
ctx.window.removeEventListener = ctx.window.removeEventListener || (() => {});
report.runtimeErrors = [];

// bootstrap.js starts timers and full DOM init — browser-only
const RUNTIME_SKIP = new Set(['js/bootstrap.js']);

for (const { file } of LOAD_ORDER) {
  if (RUNTIME_SKIP.has(file)) continue;
  try {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  } catch (e) {
    err(`Runtime load failed: ${file} — ${e.message}`);
  }
}

const bootstrapSrc = fs.readFileSync(path.join(ROOT, 'js/bootstrap.js'), 'utf8');
if (!/bootStep\s*\(\s*['"]loadGameState['"]/.test(bootstrapSrc)) {
  err('js/bootstrap.js must call bootStep("loadGameState", loadGameState)');
}

function runtimeHas(name) {
  try {
    return vm.runInNewContext(`typeof ${name} !== 'undefined'`, ctx);
  } catch {
    return false;
  }
}
function runtimeKeys(name) {
  try {
    return vm.runInNewContext(`Object.keys(${name}).length`, ctx);
  } catch {
    return 0;
  }
}

if (!runtimeHas('state')) err('state not initialized after full load');
if (!runtimeHas('getDefaultState')) err('getDefaultState missing after full load');
if (!runtimeHas('syncUI')) err('syncUI missing after full load');
if (!runtimeHas('startGame')) err('startGame missing after full load');
if (!runtimeHas('RECIPES') || runtimeKeys('RECIPES') === 0) err('RECIPES empty after full load');
if (!runtimeHas('PLOT_TILE_DEFS') || runtimeKeys('PLOT_TILE_DEFS') === 0) err('PLOT_TILE_DEFS empty after full load');
if (!runtimeHas('LOG_TYPES') || runtimeKeys('LOG_TYPES') === 0) err('LOG_TYPES empty after full load');
if (!runtimeHas('ITEM_REGISTRY') || runtimeKeys('ITEM_REGISTRY') < 40) err('ITEM_REGISTRY too small after full load');
if (!runtimeHas('getItemDef')) err('getItemDef missing after full load');
if (!runtimeHas('stackCount')) err('stackCount missing after full load');
if (!runtimeHas('markDirty')) err('markDirty missing after full load');
if (!runtimeHas('flushDirty')) err('flushDirty missing after full load');
if (!runtimeHas('requestSaveGame')) err('requestSaveGame missing after full load');
if (!runtimeHas('SAVE_DEBOUNCE_MS')) err('SAVE_DEBOUNCE_MS missing after full load');
if (!runtimeHas('registerPlotStructure')) err('registerPlotStructure missing after full load');
if (!runtimeHas('migrateAllPlotStructures')) err('migrateAllPlotStructures missing after full load');
if (runtimeHas('getRegisteredPlotStructureBehaviors')) {
  const n = vm.runInNewContext('getRegisteredPlotStructureBehaviors().length', ctx);
  if (n < 4) err('Expected at least 4 registered plot structures, got ' + n);
}
if (!runtimeHas('flushActivityUi')) err('flushActivityUi missing after full load');
if (!runtimeHas('invalidatePlotGrid')) err('invalidatePlotGrid missing after full load');
if (!runtimeHas('patchPlotCellElement')) err('patchPlotCellElement missing after full load');
if (!runtimeHas('registerScreen')) err('registerScreen missing after full load');
if (!runtimeHas('getRegisteredScreenIds')) err('getRegisteredScreenIds missing after full load');
if (runtimeHas('getRegisteredScreenIds')) {
  const n = vm.runInNewContext('getRegisteredScreenIds().length', ctx);
  if (n < 18) err('Expected at least 18 registered screens, got ' + n);
}
if (!runtimeHas('isHutOverlayScreen')) err('isHutOverlayScreen missing after full load');
if (!runtimeHas('getScreenGoldElementIds')) err('getScreenGoldElementIds missing after full load');
if (!runtimeHas('registerWorldActivityRunners')) err('registerWorldActivityRunners missing after full load');
const activityRunnerTypes = ['fishing', 'gathering', 'mining', 'woodcutting', 'exploring', 'crafting'];
for (const t of activityRunnerTypes) {
  const ok = vm.runInNewContext(
    `typeof getActivityRunner==='function'&&!!getActivityRunner('${t}')`,
    ctx
  );
  if (!ok) err('ACTIVITY_RUNNERS missing entry: ' + t);
}
if (runtimeHas('hasRunningActivity') && runtimeHas('stopAllActivities')) {
  vm.runInNewContext('stopAllActivities()', ctx);
  if (vm.runInNewContext('hasRunningActivity()', ctx)) {
    err('hasRunningActivity() true after stopAllActivities()');
  }
}
if (runtimeHas('validateItemRegistry')) {
  const issueN = vm.runInNewContext('collectRegistryIssues().length', ctx);
  if (issueN > 0) warn(`Item registry has ${issueN} missing recipe/output key(s) — see collectRegistryIssues()`);
}

// ── 8. Save key consistency ──
const saveKeyMatches = [...allJs.matchAll(/['"]hearthstead-save['"]/g)];
if (!saveKeyMatches.length) warn('Save key "hearthstead-save" not found in JS');
else info(`Save key "hearthstead-save" found ${saveKeyMatches.length} time(s)`);

// ── 9. Module size summary ──
const sizes = LOAD_ORDER.map(({ file }) => {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/).length;
  return { file, lines };
});

// ── OUTPUT ──
console.log('\n=== HEARTHSTEAD CODEBASE AUDIT ===\n');

console.log('FILE SIZES (lines):');
sizes.forEach(({ file, lines }) => console.log(`  ${file.padEnd(28)} ${lines}`));
console.log(`  ${'Game - Draft 1.html'.padEnd(28)} ${html.split(/\r?\n/).length}`);

console.log('\nLOAD ORDER (build/manifest.json):');
LOAD_ORDER.forEach(({ file }, i) => console.log(`  ${String(i + 1).padStart(2)}. ${file}`));

console.log('\nTOP-LEVEL BINDINGS:');
console.log(`  const: ${allDefined.consts.size}  function: ${allDefined.funcs.size}  let: ${allDefined.lets.size}`);

if (report.info.length) {
  console.log('\nINFO:');
  report.info.forEach((m) => console.log(`  • ${m}`));
}

if (report.warnings.length) {
  console.log('\nWARNINGS:');
  report.warnings.forEach((m) => console.log(`  ⚠ ${m}`));
}

if (report.errors.length) {
  console.log('\nERRORS:');
  report.errors.forEach((m) => console.log(`  ✗ ${m}`));
  console.log(`\nAUDIT RESULT: FAIL (${report.errors.length} error(s), ${report.warnings.length} warning(s))\n`);
  process.exit(1);
}

console.log(`\nAUDIT RESULT: PASS (${report.warnings.length} warning(s))\n`);
