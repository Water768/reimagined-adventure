/**
 * Full consistency & dependency audit for Hearthstead codebase.
 * Run: node scripts/audit.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'Game - Draft 1.html'), 'utf8');

const DATA_ORDER = [
  'plot-layout.js', 'resources.js', 'nodes.js', 'structures.js', 'well.js', 'fire-pit.js', 'kiln.js',
  'interior.js', 'skills.js', 'equipment.js', 'fish.js', 'exploration.js', 'crafting.js',
  'water.js', 'furniture.js', 'botany.js', 'farming.js', 'loom.js', 'pets.js',
];
const JS_ORDER = [
  'constants.js', 'data-init.js', 'state.js', 'activity-engine.js', 'navigation.js', 'panels.js',
  'sync-ui.js', 'plot.js', 'interior-grid.js', 'activities.js', 'well.js', 'fire-pit.js', 'kiln.js',
  'farming-plot.js', 'interactions.js', 'botany-table.js', 'loom.js', 'workbench.js', 'ui.js', 'save.js', 'bootstrap.js',
];

const LOAD_ORDER = [
  ...DATA_ORDER.map((f) => ({ file: `data/${f}`, group: 'data' })),
  ...JS_ORDER.map((f) => ({ file: `js/${f}`, group: 'js' })),
];

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

// ── 1. HTML script tags vs filesystem ──
const scriptSrcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const expectedSrcs = LOAD_ORDER.map((x) => x.file);
if (scriptSrcs.length !== expectedSrcs.length) {
  warn(`HTML has ${scriptSrcs.length} script tags; expected ${expectedSrcs.length}`);
}
scriptSrcs.forEach((src, i) => {
  if (src !== expectedSrcs[i]) warn(`Script order mismatch at index ${i}: HTML="${src}" expected="${expectedSrcs[i]}"`);
  if (!fs.existsSync(path.join(ROOT, src))) err(`Missing script file: ${src}`);
});
const dupScripts = scriptSrcs.filter((s, i) => scriptSrcs.indexOf(s) !== i);
if (dupScripts.length) err(`Duplicate script tags: ${[...new Set(dupScripts)].join(', ')}`);

if (html.match(/<script(?![^>]*\ssrc=)/)) {
  err('Inline <script> block found in HTML (should be external only)');
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
  'data/data-init.js': ['PLOT_TILE_BASE', 'WOODLANDS', 'GATHERING_LOCATIONS', 'MINES', 'FURNITURE_CRAFTS', 'FURNITURE_DEFS', 'SHELF_RECIPES', 'LOG_DEFS', 'MINE_RESOURCE_DEFS'],
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
const onclickExprs = [...html.matchAll(/onclick="([^"]+)"/g)].map((m) => m[1]);
const onclickFns = new Set();
onclickExprs.forEach((expr) => {
  expr.replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g, (_, n) => {
    if (n !== 'event') onclickFns.add(n);
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
  window: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Date, Object, Array, JSON, Number, String, parseInt, parseFloat, isNaN, Infinity, undefined, Error, Map, Set,
};
ctx.window = ctx;
report.runtimeErrors = [];

for (const { file } of LOAD_ORDER) {
  try {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  } catch (e) {
    err(`Runtime load failed: ${file} — ${e.message}`);
  }
}

if (typeof ctx.state === 'undefined') err('state not initialized after full load');
if (typeof ctx.getDefaultState !== 'function') err('getDefaultState missing after full load');
if (typeof ctx.syncUI !== 'function') err('syncUI missing after full load');
if (typeof ctx.startGame !== 'function') err('startGame missing after full load');
if (!ctx.RECIPES || !Object.keys(ctx.RECIPES).length) err('RECIPES empty after full load');
if (!ctx.PLOT_TILE_DEFS || !Object.keys(ctx.PLOT_TILE_DEFS).length) err('PLOT_TILE_DEFS empty after full load');
if (!ctx.LOG_TYPES || !Object.keys(ctx.LOG_TYPES).length) err('LOG_TYPES empty after full load');

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

console.log('\nLOAD ORDER:');
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
