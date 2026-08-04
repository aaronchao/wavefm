import { COUNTRIES, type Country } from "./countries";

/**
 * Best-effort "what country is this podcast probably from" guess, purely
 * from the show's own text — there's no reliable country field on any
 * free podcast API we use. Deliberately conservative: returns null the
 * moment the signal is ambiguous (Arabic/Cyrillic script, or Latin script
 * with no other cue) rather than defaulting to a guess that would read as
 * a confident fact. Known, accepted limitation: Traditional-Chinese text
 * alone can't distinguish Hong Kong from Taiwan, so it's labeled Taiwan —
 * there's no cheap further signal to split them.
 *
 * Only a handful of scripts are unambiguous enough to call: Hangul (Korea
 * is effectively the only podcast-producing Hangul-using country), Kana
 * (Japan — kanji alone is ambiguous with Chinese, but kana disambiguates),
 * Thai script, and a few Vietnamese-exclusive Latin letters. Chinese text
 * is split Simplified vs Traditional by counting a set of common
 * character pairs that differ between the two — a crude but real signal,
 * not a coin flip.
 */

// A handful of very-high-frequency character pairs that differ between
// Simplified and Traditional Chinese — 个/這/們 etc. show up in almost any
// long-enough Chinese sentence, so even a short title usually has a hit.
const SIMPLIFIED_CHARS = "个这们时说见对会开关学东车长问现实语话识书读写爱为从后过还没样么谁让岁国";
const TRADITIONAL_CHARS = "個這們時說見對會開關學東車長問現實語話識書讀寫愛為從後過還沒樣麼誰讓歲國";

function countMatches(text: string, chars: string): number {
  let n = 0;
  for (const ch of text) if (chars.includes(ch)) n++;
  return n;
}

function hasCodePointInRange(text: string, min: number, max: number): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= min && cp <= max) return true;
  }
  return false;
}

export function inferCountry(show: {
  title: string;
  author?: string;
  description?: string;
  feedUrl?: string;
}): Country | null {
  // A handful of hosting platforms that are, in practice, almost
  // exclusively used by mainland Chinese creators — a stronger signal
  // than script detection when it's available.
  if (show.feedUrl) {
    const host = safeHostname(show.feedUrl);
    if (host && /(^|\.)(ximalaya\.com|lizhi\.fm|qingting\.fm|xiaoyuzhoufm\.com)$/i.test(host)) {
      return COUNTRIES.CN;
    }
  }

  const text = [show.title, show.author, show.description].filter(Boolean).join(" ");
  if (!text.trim()) return null;

  // Hangul syllables + jamo — Korea.
  if (hasCodePointInRange(text, 0xac00, 0xd7a3) || hasCodePointInRange(text, 0x1100, 0x11ff)) {
    return COUNTRIES.KR;
  }
  // Hiragana + Katakana — Japan (kanji alone is ambiguous with Chinese).
  if (hasCodePointInRange(text, 0x3040, 0x30ff)) {
    return COUNTRIES.JP;
  }
  // Thai script.
  if (hasCodePointInRange(text, 0x0e00, 0x0e7f)) {
    return COUNTRIES.TH;
  }
  // Vietnamese-exclusive Latin letters (đ/Đ, ơ/Ơ, ư/Ư) — no other
  // Latin-script language in our catalog's realistic range uses these.
  if (/[đĐơƠưƯ]/.test(text)) {
    return COUNTRIES.VN;
  }
  // Simplified vs Traditional Chinese, by majority of a curated
  // high-frequency character-pair set. A tie (including 0-0, i.e. no
  // Chinese characters at all) is not a guess.
  const simplified = countMatches(text, SIMPLIFIED_CHARS);
  const traditional = countMatches(text, TRADITIONAL_CHARS);
  if (simplified > traditional) return COUNTRIES.CN;
  if (traditional > simplified) return COUNTRIES.TW;

  // Arabic, Cyrillic, and plain Latin script are all too ambiguous across
  // many countries to guess honestly — no call.
  return null;
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
