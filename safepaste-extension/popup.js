(function () {
  'use strict';

  const STORAGE_ENABLED = 'safepaste_enabled';
  const STORAGE_LAST = 'safepaste_last_redaction';
  const STORAGE_DAILY = 'safepaste_daily';

  const enabledEl = document.getElementById('enabled');
  const toggleLabel = document.getElementById('toggleLabel');
  const lastLine = document.getElementById('lastLine');
  const todayLine = document.getElementById('todayLine');

  function formatRelative(ts) {
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
    const day = Math.floor(hr / 24);
    return `${day} day${day === 1 ? '' : 's'} ago`;
  }

  async function refresh() {
    const data = await chrome.storage.local.get([
      STORAGE_ENABLED,
      STORAGE_LAST,
      STORAGE_DAILY,
    ]);

    const on = data[STORAGE_ENABLED] !== false;
    enabledEl.checked = on;
    toggleLabel.textContent = on ? 'On' : 'Off';

    const last = data[STORAGE_LAST];
    if (last && last.total > 0 && last.at) {
      const n = last.total;
      lastLine.textContent = `Last: ${n} credential${n === 1 ? '' : 's'} redacted ${formatRelative(last.at)}`;
    } else {
      lastLine.textContent = 'Last: —';
    }

    const daily = data[STORAGE_DAILY];
    const nToday = daily && daily.count != null ? daily.count : 0;
    todayLine.textContent = `Today: ${nToday} credential${nToday === 1 ? '' : 's'} redacted`;
  }

  enabledEl.addEventListener('change', async () => {
    const on = enabledEl.checked;
    await chrome.storage.local.set({ [STORAGE_ENABLED]: on });
    toggleLabel.textContent = on ? 'On' : 'Off';
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes[STORAGE_LAST] || changes[STORAGE_DAILY])) refresh();
  });

  refresh();
})();
