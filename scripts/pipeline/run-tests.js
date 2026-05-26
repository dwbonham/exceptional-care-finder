#!/usr/bin/env bun
// Run all pipeline test files sequentially.
// Exit 1 if any test file fails.
//
// Usage: bun scripts/pipeline/run-tests.js
//        (or: bun test  — via package.json "test" script)

import { spawnSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

const PIPELINE_DIR = import.meta.dir;
const testFiles = readdirSync(PIPELINE_DIR)
  .filter(f => f.endsWith('.test.js'))
  .sort()
  .map(f => join(PIPELINE_DIR, f));

console.log(`Running ${testFiles.length} test file(s)…\n`);

let allPassed = true;
for (const file of testFiles) {
  console.log(`── ${file.split('/').at(-1)} ──────────────────────────────────────`);
  const result = spawnSync('bun', [file], { stdio: 'inherit' });
  if (result.status !== 0) {
    allPassed = false;
    console.error(`FAILED: ${file}`);
  }
  console.log();
}

if (!allPassed) {
  console.error('One or more test files failed.');
  process.exit(1);
}
console.log('All tests passed.');
