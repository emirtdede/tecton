#!/usr/bin/env node
/**
 * quality-gate.js
 *
 * One command that runs every static gate the project enforces, so CI and a
 * developer machine cannot disagree about what "green" means:
 *
 *   1. typography   - no em/en dashes, no emoji      (check-style.js)
 *   2. dictionaries - key parity, placeholders, empties (check-i18n.js)
 *   3. unit tests   - vitest run
 *
 * The production build is deliberately not part of this gate: the CI workflow
 * runs it as a separate step so a slow bundling failure does not hide a fast
 * logic failure.
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const steps = [
  { name: 'typography', command: process.execPath, args: [path.join(__dirname, 'check-style.js')] },
  { name: 'dictionaries', command: process.execPath, args: [path.join(__dirname, 'check-i18n.js')] },
  {
    name: 'unit tests',
    command: process.execPath,
    args: [path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run'],
  },
];

const results = [];
for (const step of steps) {
  process.stdout.write(`\n=== ${step.name} ===\n`);
  const result = spawnSync(step.command, step.args, { cwd: ROOT, stdio: 'inherit', shell: false });
  const ok = result.status === 0;
  results.push({ name: step.name, ok });
  if (!ok && step.name !== 'unit tests') break;
}

console.log('\n=== quality summary ===');
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}`);
}
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\n[quality] ${failed.length} check(s) failed.`);
  process.exit(1);
}
console.log('[quality] all checks passed.');
