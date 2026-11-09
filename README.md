# SafePaste — credential protection (browser + terminal)

**Browser:** a Chrome extension that redacts sensitive clipboard text on paste. **Terminal:** a small Node.js CLI sanitizes the **system clipboard** with the **same** `detector.js` / `redactor.js` rules — useful for Claude Code, local AI CLIs, and any terminal where you might paste API keys or `.env` snippets by mistake.

## What it does

- Intercepts **paste** on web pages (capture phase, before many site handlers run).
- Scans clipboard text with a **two-tier** detection library (high-confidence patterns first, then known vendor formats).
- **Rewrites only the secret segments** where possible (for example, database URLs keep host and user; only the password is replaced).
- Shows a short **floating pill** when anything was redacted (for a few seconds, then it fades).
- **Popup**: on/off toggle, summary of the last redaction, and count of credentials redacted **today** (stored locally).

## Key features

- **Real-time paste protection** — Secrets are reduced *before* they are inserted into the field (when the extension is on and a pattern matches).
- **Smart pattern detection** — Database URLs, env-style `KEY=value` lines with secret-like names, `Authorization: Bearer …`, JWT-shaped strings, PEM private keys, and keys for Anthropic, OpenAI, GitHub, AWS, Stripe, plus a guarded generic rule for long high-entropy values near labels like `api_key`.
- **Visual feedback** — Pill notification near the input when redaction ran.
- **Privacy-first** — No network requests; detection and replacement run in the content script. Nothing is sent to a server.
- **Toggle control** — Enable or disable from the extension popup (state is stored with `chrome.storage.local`).

## Installation

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the **`safepaste-extension`** folder inside this repo (not the repo root).
5. Pin the SafePaste icon from the extensions menu if you want quick access to the popup.

Brave and other Chromium browsers that support Manifest V3 unpacked extensions can follow the same steps (use `brave://extensions` in Brave).

## How it works

When you paste plain text, SafePaste:

1. Reads **`text/plain`** from the paste event (no extra clipboard permission required for that).
2. Runs **detectors** (`detector.js`) and applies **structure-preserving replacements** (`redactor.js`).
3. If the text changed, it **prevents the default paste**, inserts the sanitized string at the caret (for `<textarea>`, text `<input>`, and `contenteditable`), and shows the pill.

Patterns include (among others):

- Database connection strings (`postgresql://`, `mysql://`, `mongodb://`, `mongodb+srv://`, `redis://`) — password segment only.
- API keys and tokens (OpenAI-, Anthropic-, GitHub-, AWS-, Stripe-style, etc.).
- JWTs and Bearer tokens (JWT-shaped bearer payloads use a JWT-specific replacement label).
- Environment variables whose **names** suggest secrets (`SECRET`, `TOKEN`, `API_KEY`, `PASSWORD`, `DATABASE_URL`, `PRIVATE_KEY`, `ACCESS_KEY`, `AUTH`, …).

**Safe examples** (placeholders, docs-style `<PASSWORD>`, low-signal “your-key-here” style values) are designed to **pass through** when they match the extension’s placeholder heuristics.

For a concise list of rules and replacement tokens, open the popup and use **View pattern library** (opens `patterns.html` bundled with the extension).

## Terminal and Claude Code (local clipboard)

There is **no OS-level hook** in this repo that intercepts Cmd+V inside Terminal.app or iTerm2 before the shell receives text — that would require platform-specific accessibility automation. Instead, SafePaste provides an **explicit sanitize step** you run on the clipboard (or on piped text) **before** you paste into a local Claude Code / Ollama / TUI session.

**Requirements:** Node.js 18+ on the same machine.

- **`npm run clipboard`** — Read clipboard → redact → write clipboard (macOS: `pbpaste` / `pbcopy`; Linux: `xclip` or `wl-paste` / `wl-copy`).
- **`node terminal/sanitize-clipboard.mjs --dry-run`** — Print sanitized text to stdout without changing the clipboard.
- **`node terminal/sanitize-clipboard.mjs --stdin`** — Read stdin, write sanitized text to stdout.
- **Explicit pipeline (macOS):** `pbpaste | node terminal/sanitize-clipboard.mjs --stdin | pbcopy` — same rules without using the script’s built-in clipboard helpers.

Optional **zsh** helpers (set `SAFE_PASTE_ROOT` automatically when sourced):

```bash
source /absolute/path/to/SAFE_PASTE/terminal/safe-paste.zsh
sp-c          # alias → sanitize system clipboard in place, then paste as usual
```

**Suggested workflow:** copy the snippet you might paste into the assistant → run `npm run clipboard` (or `sp-c`) → paste. Processing stays local; there are no network calls.

## Privacy and security

- **Extension:** all processing happens **locally in the browser**.
- **Terminal CLI:** same detection code loaded from `safepaste-extension/`; evaluation uses Node’s `vm` module; **no** outbound requests.
- **No** outbound requests for detection or redaction.
- **No** persistent logging of clipboard contents in the extension code path; only **aggregates** you see in the popup (last redaction summary and daily count) are stored in extension storage.
- The **terminal CLI** does not log clipboard contents to disk; it only prints a one-line summary to stderr when redactions occur (and only if stderr is a TTY or you pass `-v`), matching the script behavior above.

The project is open source so you can audit `safepaste-extension/` yourself.

## Development

- **Fixture tests:** `npm test` or `node tests/run-fixtures.mjs`
- **Shared engine:** `lib/extension-engine.mjs` loads `safepaste-extension/detector.js` and `redactor.js` so the CLI and tests stay aligned with the extension.

---

Perfect for developers, security-minded users, and anyone who pastes configuration or secrets near AI chats, support forms, or shared screens and wants an extra guardrail — not a substitute for secret management, rotation, or least-privilege practices.
