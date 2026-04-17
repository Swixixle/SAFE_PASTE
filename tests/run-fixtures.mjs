import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { fixtures } from './fixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extDir = path.join(__dirname, '..', 'safepaste-extension');
const detectorSrc = fs.readFileSync(path.join(extDir, 'detector.js'), 'utf8');
const redactorSrc = fs.readFileSync(path.join(extDir, 'redactor.js'), 'utf8');

const sandbox = vm.createContext({ console });
vm.runInContext(detectorSrc + '\n' + redactorSrc, sandbox);

const detect = sandbox.SafePasteDetector.detectCredentials;
const redact = sandbox.SafePasteRedactor.redactCredentials;

let failed = 0;
for (const f of fixtures) {
  const { text } = redact(f.input, detect(f.input));
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
