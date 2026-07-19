/**
 * Script-based language detection (PURE) — enough to keep recommendations
 * in the seed's language. Free podcast APIs don't return a reliable
 * language tag, so we infer it from the characters in the title +
 * description. We only need to tell CJK languages apart from Latin ones
 * (and from each other), which the Unicode blocks do cleanly:
 *   kana  -> Japanese     hangul -> Korean
 *   Han with neither     -> Chinese
 *   otherwise Latin-heavy -> English, else "other".
 */
export type Lang = "zh" | "ja" | "ko" | "en" | "other";

function inRange(c: number, lo: number, hi: number): boolean {
  return c >= lo && c <= hi;
}

const isHan = (c: number) =>
  inRange(c, 0x4e00, 0x9fff) || inRange(c, 0x3400, 0x4dbf) || inRange(c, 0xf900, 0xfaff);
const isKana = (c: number) => inRange(c, 0x3040, 0x30ff); // hiragana + katakana
const isHangul = (c: number) =>
  inRange(c, 0xac00, 0xd7a3) || inRange(c, 0x1100, 0x11ff) || inRange(c, 0x3130, 0x318f);
const isLatin = (c: number) => inRange(c, 0x41, 0x5a) || inRange(c, 0x61, 0x7a);

/** Any decent share of Han (with no kana/hangul present) reads as Chinese. */
const ZH_SHARE = 0.2;

export function detectLang(text: string): Lang {
  if (!text) return "other";
  let han = 0;
  let kana = 0;
  let hangul = 0;
  let latin = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (isKana(c)) kana++;
    else if (isHangul(c)) hangul++;
    else if (isHan(c)) han++;
    else if (isLatin(c)) latin++;
  }
  if (kana > 0) return "ja";
  if (hangul > 0) return "ko";
  const meaningful = han + latin;
  if (meaningful === 0) return "other";
  if (han / meaningful >= ZH_SHARE) return "zh";
  return "en";
}

/** True when a candidate should be kept for a seed in `seedLang`. */
export function sameLanguage(seedLang: Lang, text: string): boolean {
  return detectLang(text) === seedLang;
}

/** We only hard-filter non-Latin seeds — English discovery isn't language-locked. */
export function shouldLanguageFilter(seedLang: Lang): boolean {
  return seedLang === "zh" || seedLang === "ja" || seedLang === "ko";
}
