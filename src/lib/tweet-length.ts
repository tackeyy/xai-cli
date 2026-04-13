/**
 * Twitter / X の "weighted character count" を計算する。
 *
 * 公式仕様 (twitter-text):
 *   https://developer.twitter.com/en/docs/counting-characters
 *
 * - URL は自動で t.co に短縮されるため、長さに関わらず 23 文字として数える
 * - 以下の Unicode 範囲は 1 文字扱い:
 *     - U+0000..U+10FF  (Latin / Arabic など)
 *     - U+2000..U+200D  (general punctuation 一部)
 *     - U+2010..U+201F  (hyphens, quotes など)
 *     - U+2032..U+2037  (primes など)
 * - それ以外 (CJK, emoji 等) は 2 文字扱い
 *
 * 上限は weighted で 280 をデフォルトとする。
 */

export const DEFAULT_TWEET_MAX_LENGTH = 280;
export const URL_WEIGHTED_LENGTH = 23;

function parseMaxLengthEnv(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

export const TWEET_MAX_LENGTH =
  parseMaxLengthEnv(process.env.XAI_MAX_TWEET_LENGTH) ?? DEFAULT_TWEET_MAX_LENGTH;

// 簡易 URL 検出: http(s)://... を 1 URL とみなして 23 文字に置換する
// Twitter の実装はより複雑 (t.co 短縮の実ルール) だが、実運用では十分
const URL_REGEX = /https?:\/\/[^\s]+/g;

/**
 * Unicode コードポイントが weight 1 の範囲に含まれるか判定する
 */
function isWeightOne(codePoint: number): boolean {
  if (codePoint >= 0x0000 && codePoint <= 0x10ff) return true;
  if (codePoint >= 0x2000 && codePoint <= 0x200d) return true;
  if (codePoint >= 0x2010 && codePoint <= 0x201f) return true;
  if (codePoint >= 0x2032 && codePoint <= 0x2037) return true;
  return false;
}

/**
 * 文字列の Twitter weighted length を計算する。
 * URL は 23 文字として扱い、それ以外は codepoint 範囲ごとに 1 or 2 で数える。
 */
export function computeTweetLength(text: string): number {
  // まず URL を 23 文字分の sentinel に置換する
  // (置換後も通常の weight 1 範囲で数えるため、ASCII 1文字 × 23 で埋める)
  const urlPlaceholder = "#".repeat(URL_WEIGHTED_LENGTH);
  const normalized = text.replace(URL_REGEX, urlPlaceholder);

  let weighted = 0;
  for (const ch of normalized) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    weighted += isWeightOne(cp) ? 1 : 2;
  }
  return weighted;
}

/**
 * 投稿本文が 280 文字以内か判定する。
 */
export function isWithinTweetLimit(text: string, maxLength = TWEET_MAX_LENGTH): boolean {
  return computeTweetLength(text) <= maxLength;
}
