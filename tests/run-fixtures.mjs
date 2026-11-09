import { getExtensionEngine } from '../lib/extension-engine.mjs';
import { fixtures } from './fixtures.js';

const { detectCredentials, redactCredentials } = getExtensionEngine();

let failed = 0;
for (const f of fixtures) {
  const { text } = redactCredentials(f.input, detectCredentials(f.input));
  if (text !== f.output) {
    failed++;
    console.error(`FAIL: ${f.name}`);
    console.error(`  expected: ${f.output}`);
    console.error(`  actual:   ${text}`);
  } else {
    console.log(`ok: ${f.name}`);
  }
}

if (failed) {
  console.error(`\n${failed} fixture(s) failed`);
  process.exit(1);
}
