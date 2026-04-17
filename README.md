# SafePaste — Chrome extension for credential protection

A Chrome extension that automatically detects and redacts sensitive information (passwords, API keys, tokens) from clipboard paste operations, so it is less likely to land in web forms, AI chat boxes, and other inputs by mistake.

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

## Privacy and security

- All processing happens **locally in the browser**.
- **No** outbound requests for detection or redaction.
- **No** persistent logging of clipboard contents in the extension code path; only **aggregates** you see in the popup (last redaction summary and daily count) are stored in extension storage.

The project is open source so you can audit `safepaste-extension/` yourself.

## Development

- **Fixture tests** (expected redaction outputs):  `node tests/run-fixtures.mjs`  
  (from repo root; requires Node.js.)

---

Perfect for developers, security-minded users, and anyone who pastes configuration or secrets near AI chats, support forms, or shared screens and wants an extra guardrail — not a substitute for secret management, rotation, or least-privilege practices.
