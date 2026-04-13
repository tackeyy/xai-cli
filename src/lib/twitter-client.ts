import { createHmac } from "node:crypto";
import { computeTweetLength, TWEET_MAX_LENGTH } from "./tweet-length.js";

export interface TwitterClientOptions {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface ReplyResult {
  id: string;
  text: string;
}

export interface PostTweetInput {
  text: string;
  /** 本文末尾に改行区切りで追記する URL */
  url?: string;
  /** 返信先ツイート ID */
  replyTo?: string;
  /** Weighted character count の上限。未指定時は TWEET_MAX_LENGTH を使う */
  maxLength?: number;
  /** true の場合はローカルの文字数バリデーションをスキップする */
  noLengthCheck?: boolean;
}

export interface PostTweetPayload {
  text: string;
  reply?: { in_reply_to_tweet_id: string };
}

export interface PostTweetResult {
  id: string;
  text: string;
  /** x.com 上のツイート URL */
  url: string;
  /** サーバーが返した投稿時刻。data にない場合は呼び出し時の ISO 文字列 */
  posted_at: string;
}

/**
 * 投稿本文が 280 weighted chars を超えた場合に投げる専用エラー。
 * 呼び出し側で fetch を発火させずに弾ける。
 */
export class TweetTooLongError extends Error {
  constructor(public readonly length: number, public readonly maxLength: number) {
    super(
      `Tweet exceeds ${maxLength} weighted characters (got ${length}). ` +
        `Note: URLs are counted as 23 characters each, CJK as 2.`,
    );
    this.name = "TweetTooLongError";
  }
}

export class TwitterClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly accessToken: string;
  private readonly accessTokenSecret: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts: TwitterClientOptions) {
    this.apiKey = opts.apiKey;
    this.apiSecret = opts.apiSecret;
    this.accessToken = opts.accessToken;
    this.accessTokenSecret = opts.accessTokenSecret;
    this.baseUrl = opts.baseUrl ?? "https://api.twitter.com";
    this.timeoutMs = opts.timeoutMs ?? 30000;
  }

  private generateNonce(): string {
    return (
      Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    );
  }

  private buildOAuthSignature(
    method: string,
    url: string,
    oauthParams: Record<string, string>,
  ): string {
    const paramString = Object.entries(oauthParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const baseString = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(paramString),
    ].join("&");

    const signingKey = `${encodeURIComponent(this.apiSecret)}&${encodeURIComponent(this.accessTokenSecret)}`;
    return createHmac("sha1", signingKey).update(baseString).digest("base64");
  }

  private buildOAuthHeader(method: string, url: string): string {
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.apiKey,
      oauth_nonce: this.generateNonce(),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: this.accessToken,
      oauth_version: "1.0",
    };

    oauthParams.oauth_signature = this.buildOAuthSignature(method, url, oauthParams);

    const headerParts = Object.entries(oauthParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ");

    return `OAuth ${headerParts}`;
  }

  async replyTweet(inReplyToTweetId: string, text: string): Promise<ReplyResult> {
    const url = `${this.baseUrl}/2/tweets`;
    const body = {
      text,
      reply: { in_reply_to_tweet_id: inReplyToTweetId },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.buildOAuthHeader("POST", url),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`X API error ${res.status}: ${errorBody}`);
      }

      const data = (await res.json()) as { data: { id: string; text: string } };
      return { id: data.data.id, text: data.data.text };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * dry-run 用のヘルパ。
   * 実 API を叩かずに、送信される X API v2 POST /2/tweets のリクエストボディを組み立てる。
   * maxLength を超過した場合は TweetTooLongError を投げる。
   */
  buildPostPayload(input: PostTweetInput): PostTweetPayload {
    const combinedText = this.combineTextAndUrl(input.text, input.url);

    const weighted = computeTweetLength(combinedText);
    if (!input.noLengthCheck) {
      const maxLength = input.maxLength ?? TWEET_MAX_LENGTH;
      if (!Number.isInteger(maxLength) || maxLength <= 0) {
        throw new Error("maxLength must be a positive integer");
      }
      if (weighted > maxLength) {
        throw new TweetTooLongError(weighted, maxLength);
      }
    }

    const payload: PostTweetPayload = { text: combinedText };
    if (input.replyTo) {
      payload.reply = { in_reply_to_tweet_id: input.replyTo };
    }
    return payload;
  }

  /**
   * X にツイートを投稿する。
   *
   * - ローカルで 280 weighted chars の事前バリデーションを行う (fetch を発火させない)
   * - 失敗時は HTTP status を含む Error を投げる (呼び出し側で retry 判定)
   * - OAuth 1.0a ヘッダを付与する
   */
  async postTweet(input: PostTweetInput): Promise<PostTweetResult> {
    const payload = this.buildPostPayload(input);
    const url = `${this.baseUrl}/2/tweets`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: this.buildOAuthHeader("POST", url),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        const retryAfterHeader = res.headers.get("retry-after");
        const retryHint = retryAfterHeader ? ` (retry-after: ${retryAfterHeader}s)` : "";
        throw new Error(`X API error ${res.status}${retryHint}: ${errorBody}`);
      }

      const data = (await res.json()) as {
        data: { id: string; text: string; created_at?: string };
      };
      const postedAt = data.data.created_at ?? new Date().toISOString();
      return {
        id: data.data.id,
        text: data.data.text,
        url: `https://x.com/i/status/${data.data.id}`,
        posted_at: postedAt,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private combineTextAndUrl(text: string, url?: string): string {
    if (!url) return text;
    // 本文末尾に改行区切りで URL を追記 (本文に既に同一 URL があっても簡素化のため重複検出しない)
    return `${text}\n${url}`;
  }
}
