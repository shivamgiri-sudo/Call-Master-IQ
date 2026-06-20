/**
 * safety.ts — defensive masking utilities.
 *
 * The backend already masks sensitive fields in API responses
 * (see src/services/finnable/mapper.ts:maskMobile + maskTranscript).
 * These frontend utilities are defense-in-depth: if any backend response ever
 * leaks raw mobile / OTP / PIN / CVV / email / card-like data, this layer
 * catches it before it reaches the DOM.
 *
 * NEVER remove this layer. It exists because the data it handles can leak
 * customer PII; defensive coding here is the cheapest way to keep that
 * from becoming a customer-visible incident.
 */

const DIGITS_RE = /\d/g;

export function maskMobile(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length < 4) return '••••';
  return '••••••' + digits.slice(-4);
}

export function maskEmail(value: unknown): string {
  const s = String(value ?? '');
  if (!s || !s.includes('@')) return '';
  const [local, domain] = s.split('@');
  if (!local || !domain) return '';
  if (local.length <= 2) return '*'.repeat(local.length) + '@' + domain;
  return local[0] + '*'.repeat(Math.max(2, local.length - 2)) + local[local.length - 1] + '@' + domain;
}

/**
 * Mask long digit runs (>= 6 contiguous digits) — last 4 only visible.
 * Catches: phone numbers, Aadhaar-like, card-like sequences.
 */
export function maskLongDigits(input: string): string {
  return String(input ?? '').replace(/\d{6,}/g, (run) => {
    if (run.length <= 4) return run;
    return '•'.repeat(run.length - 4) + run.slice(-4);
  });
}

/**
 * Mask OTP / PIN / CVV / password-like keywords with their digit tail.
 *   "your otp is 482910" → "your otp is ••••••"
 */
export function maskSensitiveKeywords(input: string): string {
  return String(input ?? '').replace(
    /\b(otp|pin|cvv|password|passwd|pwd)\b[\s\S]{0,12}?(\d{3,8})/gi,
    (_full, keyword, digits) => `${keyword} ••••••`,
  );
}

/**
 * Combined transcript mask. Use this on any snippet before rendering.
 */
export function maskTranscript(input: string): string {
  if (!input) return '';
  let s = maskSensitiveKeywords(String(input));
  s = maskLongDigits(s);
  return s;
}

/**
 * Truncate transcript to a safe length with ellipsis. Default 280 chars.
 */
export function truncateSnippet(input: string, maxLen = 280): string {
  const masked = maskTranscript(input);
  if (masked.length <= maxLen) return masked;
  return masked.slice(0, maxLen).trimEnd() + '…';
}

/**
 * Strip any non-printable / control chars from a string. Cheap sanitiser.
 */
export function sanitizeText(input: string): string {
  // eslint-disable-next-line no-control-regex
  return String(input ?? '').replace(/[\u0000-\u001F\u007F]/g, '');
}

// Re-export for completeness
export { DIGITS_RE };