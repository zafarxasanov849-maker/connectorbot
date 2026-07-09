// Manba tag'lari faqat harf, raqam, "_" va "-" dan iborat bo'lishi kerak.
// Bu callback_data'dagi ":" ajratuvchisi bilan to'qnashuvni oldini oladi.
const TAG_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidTag(tag: string): boolean {
  return TAG_RE.test(tag);
}

export const TAG_HINT =
  "Tag faqat lotin harflari, raqamlar, '_' va '-' dan iborat bo'lishi kerak (masalan: instagram2024).";
