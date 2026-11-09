/**
 * Loads detector.js + redactor.js from safepaste-extension (same logic as the browser).
 * Single source of truth — keep in sync with the extension files on disk.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(__dirname, '../safepaste-extension');

let cache = null;

/**
 * @returns {{ detectCredentials: (text: string) => Array<unknown>, redactCredentials: (text: string, detections: unknown[]) => { text: string, countByType: Record<string, number>, total: number } }}
 */
export function getExtensionEngine() {
  if (cache) return cache;

  const detectorSrc = fs.readFileSync(path.join(extensionDir, 'detector.js'), 'utf8');
  const redactorSrc = fs.readFileSync(path.join(extensionDir, 'redactor.js'), 'utf8');

  const sandbox = vm.createContext({ console });
  vm.runInContext(detectorSrc + '\n' + redactorSrc, sandbox);

  const detectCredentials = sandbox.SafePasteDetector.detectCredentials;
  const redactCredentials = sandbox.SafePasteRedactor.redactCredentials;

  function sanitizePasteText(text) {
    const detections = detectCredentials(text);
    return redactCredentials(text, detections);
  }

  cache = { detectCredentials, redactCredentials, sanitizePasteText, extensionDir };
  return cache;
}
