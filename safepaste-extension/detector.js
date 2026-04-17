/**
 * SafePaste credential detection. Returns non-overlapping matches in document order
 * (tier 1 first, then tier 2; earlier rules claim ranges first).
 */
(function () {
  'use strict';

  const ENV_KEY_PATTERN =
    /^[A-Z0-9_]*(?:SECRET|TOKEN|API_KEY|PASSWORD|DATABASE_URL|PRIVATE_KEY|ACCESS_KEY|AUTH)[A-Z0-9_]*$/i;

  const PLACEHOLDER_PREFIX =
    /^(your[-_]?key|your[-_]?secret|xxx+|<[^>]+>|replace[_-]?me|insert[-_]?key|api[-_]?key[-_]?here)/i;

  const PLACEHOLDER_EXACT =
    /^(changeme|password|secret|example|sample|test|admin|user|root|placeholder|todo)$/i;

  function shannonEntropy(str) {
    const freq = Object.create(null);
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      freq[c] = (freq[c] || 0) + 1;
    }
    let h = 0;
    const len = str.length;
    for (const k in freq) {
      const p = freq[k] / len;
      h -= p * Math.log2(p);
    }
    return h;
  }

  function isLikelyPlaceholderValue(val) {
    const v = val.trim();
    if (!v) return true;
    if (PLACEHOLDER_PREFIX.test(v)) return true;
    if (PLACEHOLDER_EXACT.test(v)) return true;
    if (/^test[-_]?key$/i.test(v)) return true;
    if (/^<[^>]+>$/.test(v)) return true;
    if (v.length < 12 && /^[a-z][a-z0-9_-]*$/i.test(v)) return true;
    if (v.length >= 32 && shannonEntropy(v) < 3.2 && /[a-z]{3,}/i.test(v)) return true;
    return false;
  }

  function isBase64UrlSegment(seg, minLen) {
    if (seg.length < minLen) return false;
    return /^[A-Za-z0-9_-]+$/.test(seg);
  }

  function looksLikeJwt(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    return (
      isBase64UrlSegment(parts[0], 8) &&
      isBase64UrlSegment(parts[1], 8) &&
      isBase64UrlSegment(parts[2], 8)
    );
  }

  function mergeIntervals(intervals) {
    if (!intervals.length) return [];
    const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
    const out = [sorted[0].slice()];
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      const last = out[out.length - 1];
      if (cur[0] <= last[1]) last[1] = Math.max(last[1], cur[1]);
      else out.push(cur.slice());
    }
    return out;
  }

  function overlapsClaimed(start, end, claimed) {
    for (let i = 0; i < claimed.length; i++) {
      const [cs, ce] = claimed[i];
      if (start < ce && end > cs) return true;
    }
    return false;
  }

  function addClaim(claimed, start, end) {
    claimed.push([start, end]);
    return mergeIntervals(claimed);
  }

  /**
   * @param {string} text
   * @returns {Array<{type: string, start: number, end: number, replacement: string, confidence: 'high'|'medium'}>}
   */
  function detectCredentials(text) {
    const results = [];
    let claimed = [];

    function tryAdd(det) {
      if (overlapsClaimed(det.start, det.end, claimed)) return;
      results.push(det);
      claimed = addClaim(claimed, det.start, det.end);
    }

    // 5. PEM blocks (tier1) — multiline
    const pemRe =
      /-----BEGIN ([A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]*?-----END ([A-Z0-9 ]+ )?PRIVATE KEY-----/gi;
    let m;
    while ((m = pemRe.exec(text)) !== null) {
      tryAdd({
        type: 'pem_private_key',
        start: m.index,
        end: m.index + m[0].length,
        replacement: '[REDACTED_KEY]',
        confidence: 'high',
      });
    }

    // 1. Database URLs — password only
    const dbUrlRe =
      /\b(postgresql|postgres|mysql|mongodb\+srv|mongodb|redis):\/\/([^:\s/?#]+):([^@\s/?#]+)@/gi;
    while ((m = dbUrlRe.exec(text)) !== null) {
      const scheme = m[1];
      const user = m[2];
      const pass = m[3];
      const passStart = m.index + scheme.length + 3 + user.length + 1;
      if (isLikelyPlaceholderValue(pass) || /^<[^>]+>$/.test(pass)) continue;
      tryAdd({
        type: 'database_url_password',
        start: passStart,
        end: passStart + pass.length,
        replacement: '[REDACTED]',
        confidence: 'high',
      });
    }

    // 2. ENV assignments
    const envRe = /(^|\n)([A-Z][A-Z0-9_]*)\s*=\s*([^\n\r]*)/g;
    while ((m = envRe.exec(text)) !== null) {
      const key = m[2];
      const value = m[3];
      if (!ENV_KEY_PATTERN.test(key)) continue;
      if (isLikelyPlaceholderValue(value)) continue;
      const valStart = m.index + m[0].length - value.length;
      tryAdd({
        type: 'env_secret',
        start: valStart,
        end: valStart + value.length,
        replacement: '[REDACTED]',
        confidence: 'high',
      });
    }

    // 3. Bearer tokens
    const bearerRe = /Authorization\s*:\s*Bearer\s+(\S+)/gi;
    while ((m = bearerRe.exec(text)) !== null) {
      const tok = m[1];
      const tokStart = m.index + m[0].length - tok.length;
      const repl = looksLikeJwt(tok) ? '[REDACTED_JWT]' : '[REDACTED]';
      tryAdd({
        type: 'bearer_token',
        start: tokStart,
        end: tokStart + tok.length,
        replacement: repl,
        confidence: 'high',
      });
    }

    // 4. JWTs (standalone)
    const jwtRe = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
    while ((m = jwtRe.exec(text)) !== null) {
      tryAdd({
        type: 'jwt',
        start: m.index,
        end: m.index + m[0].length,
        replacement: '[REDACTED_JWT]',
        confidence: 'high',
      });
    }
    const jwtGenericRe =
      /\b([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\.([A-Za-z0-9_-]{8,})\b/g;
    while ((m = jwtGenericRe.exec(text)) !== null) {
      const whole = m[0];
      if (!looksLikeJwt(whole)) continue;
      tryAdd({
        type: 'jwt',
        start: m.index,
        end: m.index + whole.length,
        replacement: '[REDACTED_JWT]',
        confidence: 'medium',
      });
    }

    // 6. Anthropic keys — preserve sk-ant-api##-
    const anthRe = /\b(sk-ant-api\d{2}-)([A-Za-z0-9_-]+)\b/g;
    while ((m = anthRe.exec(text)) !== null) {
      const secret = m[2];
      if (!secret || isLikelyPlaceholderValue(secret)) continue;
      const secStart = m.index + m[1].length;
      tryAdd({
        type: 'anthropic_api_key',
        start: secStart,
        end: secStart + secret.length,
        replacement: '[REDACTED]',
        confidence: 'high',
      });
    }

    // 7. OpenAI keys (not Anthropic)
    const oaiRe = /\bsk-(?!ant)[A-Za-z0-9_-]{20,}\b/g;
    while ((m = oaiRe.exec(text)) !== null) {
      const full = m[0];
      let prefix = 'sk-';
      const proj = full.match(/^sk-proj-[A-Za-z0-9]+-/);
      if (proj) prefix = proj[0];
      else {
        const live = full.match(/^sk-(?:live|test)-/);
        if (live) prefix = live[0];
      }
      const secret = full.slice(prefix.length);
      if (!secret || isLikelyPlaceholderValue(secret)) continue;
      const secStart = m.index + prefix.length;
      tryAdd({
        type: 'openai_api_key',
        start: secStart,
        end: secStart + secret.length,
        replacement: '[REDACTED]',
        confidence: 'high',
      });
    }

    // 8. GitHub tokens
    const ghRe = /\b(ghp_|gho_|ghs_|ghu_)[A-Za-z0-9]{30,}\b/g;
    while ((m = ghRe.exec(text)) !== null) {
      const prefix = m[1];
      const secret = m[0].slice(prefix.length);
      const secStart = m.index + prefix.length;
      tryAdd({
        type: 'github_token',
        start: secStart,
        end: secStart + secret.length,
        replacement: '[REDACTED]',
        confidence: 'high',
      });
    }

    // 9. AWS access keys
    const awsRe = /\bAKIA[0-9A-Z]{16}\b/g;
    while ((m = awsRe.exec(text)) !== null) {
      tryAdd({
        type: 'aws_access_key',
        start: m.index,
        end: m.index + m[0].length,
        replacement: '[REDACTED]',
        confidence: 'high',
      });
    }

    // 10. Stripe keys — preserve sk_live_ / sk_test_
    const stripeRe = /\b(sk_(?:live|test)_)([A-Za-z0-9]+)\b/g;
    while ((m = stripeRe.exec(text)) !== null) {
      const secret = m[2];
      if (!secret) continue;
      const secStart = m.index + m[1].length;
      tryAdd({
        type: 'stripe_secret',
        start: secStart,
        end: secStart + secret.length,
        replacement: '[REDACTED]',
        confidence: 'high',
      });
    }

    // 11. Generic high-entropy API key near key-like label
    const genericRe =
      /(?:^|[\n\s"'`])(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*["'`]?([A-Za-z0-9+/=_-]{32,})\b/gi;
    while ((m = genericRe.exec(text)) !== null) {
      const val = m[2];
      if (isLikelyPlaceholderValue(val)) continue;
      if (shannonEntropy(val) < 4) continue;
      const valStart = m.index + m[0].length - val.length;
      tryAdd({
        type: 'generic_api_key',
        start: valStart,
        end: valStart + val.length,
        replacement: '[REDACTED]',
        confidence: 'medium',
      });
    }

    results.sort((a, b) => a.start - b.start);
    return results;
  }

  globalThis.SafePasteDetector = { detectCredentials };
})();
