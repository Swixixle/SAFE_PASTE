(function () {
  'use strict';

  const STORAGE_ENABLED = 'safepaste_enabled';
  const STORAGE_LAST = 'safepaste_last_redaction';
  const STORAGE_DAILY = 'safepaste_daily';

  let enabledCache = true;
  try {
    chrome.storage.local.get(STORAGE_ENABLED, (r) => {
      if (r[STORAGE_ENABLED] === false) enabledCache = false;
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[STORAGE_ENABLED]) {
        enabledCache = changes[STORAGE_ENABLED].newValue !== false;
      }
    });
  } catch (_) {}

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function getActiveEditable(target) {
    if (!target) return null;
    if (target.isContentEditable) return target;
    const tag = target.tagName && target.tagName.toLowerCase();
    if (tag === 'textarea') return target;
    if (tag === 'input' && (target.type === 'text' || target.type === 'search')) return target;
    const host = target.closest('[contenteditable="true"]');
    if (host) return host;
    return null;
  }

  function insertIntoInput(el, text) {
    const start = typeof el.selectionStart === 'number' ? el.selectionStart : el.value.length;
    const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : el.value.length;
    const val = el.value;
    const next = val.slice(0, start) + text + val.slice(end);
    el.value = next;
    const caret = start + text.length;
    el.selectionStart = el.selectionEnd = caret;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function insertIntoContentEditable(el, text) {
    el.focus();
    const ok = document.execCommand('insertText', false, text);
    if (!ok) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }

  function showIndicator(anchorEl, total) {
    const pill = document.createElement('div');
    pill.className = 'safepaste-pill';
    pill.textContent =
      total === 1 ? '\u{1F6E1} 1 credential redacted' : `\u{1F6E1} ${total} credentials redacted`;
    pill.setAttribute('role', 'status');

    const rect = anchorEl.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    pill.style.top = `${rect.bottom + scrollY + 6}px`;
    pill.style.left = `${Math.min(rect.left + scrollX, scrollX + window.innerWidth - 220)}px`;

    document.documentElement.appendChild(pill);
    requestAnimationFrame(() => pill.classList.add('safepaste-pill--visible'));

    window.setTimeout(() => {
      pill.classList.remove('safepaste-pill--visible');
      pill.classList.add('safepaste-pill--hide');
    }, 2800);

    window.setTimeout(() => pill.remove(), 3600);
  }

  async function persistRedaction(total, countByType) {
    const now = Date.now();
    const day = todayKey();
    const data = await chrome.storage.local.get([STORAGE_DAILY]);
    let daily = data[STORAGE_DAILY];
    if (!daily || daily.day !== day) daily = { day, count: 0 };
    daily.count += total;
    await chrome.storage.local.set({
      [STORAGE_LAST]: { total, countByType, at: now },
      [STORAGE_DAILY]: daily,
    });
  }

  document.addEventListener(
    'paste',
    (e) => {
      if (!enabledCache) return;

      const raw = e.clipboardData && e.clipboardData.getData('text/plain');
      if (raw == null || raw === '') return;

      const detections = globalThis.SafePasteDetector.detectCredentials(raw);
      const { text: sanitized, total, countByType } =
        globalThis.SafePasteRedactor.redactCredentials(raw, detections);

      if (total === 0 || sanitized === raw) return;

      const el = getActiveEditable(e.target);
      if (!el) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      if (el.isContentEditable) insertIntoContentEditable(el, sanitized);
      else insertIntoInput(el, sanitized);

      showIndicator(el, total);
      persistRedaction(total, countByType).catch(() => {});
    },
    true
  );
})();
