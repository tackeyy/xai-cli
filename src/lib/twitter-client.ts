import { createHmac } from "node:crypto";

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
}
