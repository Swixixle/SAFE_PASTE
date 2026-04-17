/**
 * Structure-preserving replacement using original-text offsets (ascending merge).
 */
(function () {
  'use strict';

  /**
   * @param {string} text
   * @param {Array<{type: string, start: number, end: number, replacement: string}>} detections
   * @returns {{ text: string, countByType: Record<string, number>, total: number }}
   */
  function redactCredentials(text, detections) {
    if (!detections || detections.length === 0) {
      return { text, countByType: {}, total: 0 };
    }

    const sorted = detections
      .filter((d) => d.start >= 0 && d.end <= text.length && d.start < d.end)
      .slice()
      .sort((a, b) => a.start - b.start || b.end - a.end);

    let out = '';
    let pos = 0;
    const countByType = {};

    for (let i = 0; i < sorted.length; i++) {
      const d = sorted[i];
      if (d.start < pos) continue;
      out += text.slice(pos, d.start) + d.replacement;
      pos = d.end;
      countByType[d.type] = (countByType[d.type] || 0) + 1;
    }
    out += text.slice(pos);

    const total = Object.values(countByType).reduce((a, b) => a + b, 0);
    return { text: out, countByType, total };
  }

  globalThis.SafePasteRedactor = { redactCredentials };
})();
