/**
 * One-shot extractor for stage 6 file splits. Safe to re-run (reads source backups via plot.js.bak if present).
 * Run: node scripts/split-stage6-extract.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readLines(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/);
}

function sliceLines(lines, start1, end1) {
  return lines.slice(start1 - 1, end1).join('\n') + '\n';
}

function writeChunk(file, header, body) {
  const full = header + body.replace(/^\n+/, '');
  fs.writeFileSync(path.join(ROOT, file), full);
  console.log('wrote', file, full.split(/\r?\n/).length, 'lines');
}

function splitFile(srcFile, chunks) {
  const lines = fs.readFileSync(path.join(ROOT, srcFile), 'utf8').split(/\r?\n/);
  for (const c of chunks) {
    writeChunk(c.file, c.header, sliceLines(lines, c.start, c.end));
  }
}

splitFile('js/plot.js', [
  {
    file: 'js/plot-store.js',
    start: 4,
    end: 198,
    header: "/* Hearthstead — plot grid store & migration */\n'use strict';\n\n",
  },
  {
    file: 'js/plot-cells.js',
    start: 199,
    end: 715,
    header: "/* Hearthstead — plot cell HTML & tile helpers */\n'use strict';\n\n",
  },
  {
    file: 'js/plot-water.js',
    start: 1480,
    end: 1903,
    header: "/* Hearthstead — water bodies & pond surfaces */\n'use strict';\n\n",
  },
  {
    file: 'js/plot-renderer.js',
    start: 1905,
    end: 2403,
    header: "/* Hearthstead — plot grid render, pan & drag */\n'use strict';\n\n",
  },
  {
    file: 'js/plot.js',
    start: 716,
    end: 1478,
    header: "/* Hearthstead — plot edit, placement & taps */\n'use strict';\n\n",
  },
]);

splitFile('js/activities.js', [
  {
    file: 'js/activity-shared.js',
    start: 446,
    end: 462,
    header: "/* Hearthstead — shared plot activity sparkle helpers */\n'use strict';\n\n",
  },
  {
    file: 'js/activity-fishing.js',
    start: 7,
    end: 445,
    header: "/* Hearthstead — fishing */\n'use strict';\n\n",
  },
  {
    file: 'js/activity-gathering.js',
    start: 464,
    end: 671,
    header: "/* Hearthstead — gathering */\n'use strict';\n\n",
  },
  {
    file: 'js/activity-mining.js',
    start: 673,
    end: 979,
    header: "/* Hearthstead — mining */\n'use strict';\n\n",
  },
  {
    file: 'js/activity-woodcutting.js',
    start: 981,
    end: 1114,
    header: "/* Hearthstead — woodcutting */\n'use strict';\n\n",
  },
  {
    file: 'js/activity-exploring.js',
    start: 1118,
    end: 2090,
    header: "/* Hearthstead — exploring / expeditions */\n'use strict';\n\n",
  },
  {
    file: 'js/activities.js',
    start: 2092,
    end: 2115,
    header: "/* Hearthstead — world activity registration */\n'use strict';\n\n",
  },
]);

console.log('done');
