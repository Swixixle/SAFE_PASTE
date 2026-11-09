#!/usr/bin/env node
/**
 * SafePaste terminal: sanitize system clipboard using the same rules as the Chrome extension.
 *
 * Default: read clipboard → redact → write clipboard (macOS pbpaste/pbcopy, Linux xclip or wl-clipboard).
 * No network; local Node + vm evaluation of extension detector/redactor.
 *
 * Usage:
 *   npm run clipboard
 *   node terminal/sanitize-clipboard.mjs [--dry-run] [--verbose]
 *   echo "$text" | node terminal/sanitize-clipboard.mjs --stdin
 *   echo "$text" | node terminal/sanitize-clipboard.mjs --stdin --clipboard-out
 */
import { execFileSync } from 'child_process';
import process from 'process';
import { getExtensionEngine } from '../lib/extension-engine.mjs';

function readClipboard() {
  const plat = process.platform;
  if (plat === 'darwin') {
    return execFileSync('pbpaste', { encoding: 'utf8' });
  }
  if (plat === 'linux') {
    try {
      return execFileSync('xclip', ['-selection', 'clipboard', '-o'], { encoding: 'utf8' });
    } catch {
      return execFileSync('wl-paste', [], { encoding: 'utf8' });
    }
  }
  if (plat === 'win32') {
    throw new Error('Clipboard on Windows: pipe text via --stdin, or use WSL + Linux paths');
  }
  throw new Error(`Unsupported platform: ${plat}`);
}

function writeClipboard(text) {
  const plat = process.platform;
  if (plat === 'darwin') {
    execFileSync('pbcopy', { input: text, encoding: 'utf8' });
    return;
  }
  if (plat === 'linux') {
    try {
      execFileSync('xclip', ['-selection', 'clipboard'], { input: text, encoding: 'utf8' });
    } catch {
      execFileSync('wl-copy', [], { input: text, encoding: 'utf8' });
    }
    return;
  }
  throw new Error(`writeClipboard not implemented for ${plat}`);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
  });
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const verbose = args.has('--verbose') || args.has('-v');
const stdinMode = args.has('--stdin');
const clipboardOut = args.has('--clipboard-out');

async function main() {
  const { sanitizePasteText } = getExtensionEngine();

  let input;
  if (stdinMode) {
    input = await readStdin();
  } else {
    try {
      input = readClipboard();
    } catch (e) {
      console.error(String(e.message || e));
      process.exit(1);
    }
  }

  const { text: out, total, countByType } = sanitizePasteText(input);

  if (stdinMode) {
    if (dryRun) {
      process.stdout.write(out);
      if (!out.endsWith('\n')) process.stdout.write('\n');
    } else if (clipboardOut) {
      try {
        writeClipboard(out);
      } catch (e) {
        console.error(String(e.message || e));
        process.exit(1);
      }
    } else {
      process.stdout.write(out);
      if (!out.endsWith('\n')) process.stdout.write('\n');
    }
  } else if (dryRun) {
    process.stdout.write(out);
    if (!out.endsWith('\n')) process.stdout.write('\n');
  } else {
    try {
      writeClipboard(out);
    } catch (e) {
      console.error(String(e.message || e));
      process.exit(1);
    }
  }

  const logErr = (msg) => {
    if (verbose || process.stderr.isTTY) console.error(msg);
  };

  if (verbose && total > 0) {
    const types = Object.entries(countByType)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ');
    logErr(`SafePaste: ${total} redaction(s) ${types ? `(${types})` : ''}`);
  } else if (total > 0 && !dryRun) {
    if (stdinMode && !clipboardOut) {
      logErr(`SafePaste: ${total} credential(s) redacted (stdout)`);
    } else if (stdinMode && clipboardOut) {
      logErr(`SafePaste: ${total} credential(s) redacted in clipboard`);
    } else {
      logErr(`SafePaste: ${total} credential(s) redacted in clipboard`);
    }
  } else if (total > 0 && dryRun) {
    logErr(`SafePaste: ${total} credential(s) would be redacted (dry-run)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
