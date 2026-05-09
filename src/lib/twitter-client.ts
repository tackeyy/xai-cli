import { createHmac } from "node:crypto";
import { computeTweetLength, TWEET_MAX_LENGTH } from "./tweet-length.js";
import type {
  DmAvailability,
  DmCheckResult,
  TwitterAuthMode,
  TwitterEngagementMetrics,
  TwitterUserLookupResponse,
  TwitterFollowingResponse,
  TwitterBookmarkResponse,
  TwitterBookmarkFolderResponse,
  TwitterIncludes,
  TwitterTweet,
  TwitterUser,
  TwitterUserProfile,
  TwitterUserTimelineResponse,
} from "./twitter-types.js";

export interface TwitterClientOptions {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  bearerToken?: string;
  oauth2UserToken?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface ReplyResult {
  id: string;
  text: string;
}

export interface PostTweetInput {
  text: string;
  url?: string;
  replyTo?: string;
  maxLength?: number;
  noLengthCheck?: boolean;
}

export interface PostTweetPayload {
  text: string;
  reply?: { in_reply_to_tweet_id: string };
}

export interface PostTweetResult {
  id: string;
  text: string;
  url: string;
  posted_at: string;
}

export class TweetTooLongError extends Error {
  constructor(public readonly length: number, public readonly maxLength: number) {
    super(
      `Tweet exceeds ${maxLength} weighted characters (got ${length}). ` +
        `Note: URLs are counted as 23 characters each, CJK as 2.`,
    );
    this.name = "TweetTooLongError";
  }
}

interface GetRequestOptions {
  auth: TwitterAuthMode;
  query?: Record<string, string | number | boolean | undefined>;
}

const DEFAULT_TIMELINE_TWEET_FIELDS = [
  "id",
  "text",
  "created_at",
  "author_id",
  "public_metrics",
  "organic_metrics",
  "non_public_metrics",
];
const DEFAULT_USER_PROFILE_FIELDS = ["description", "created_at", "verified", "public_metrics"];
const DM_STATUS_USER_FIELDS = ["receives_your_dm", "connection_status", "protected", "verified"];
const MAX_COUNT = 1000;

export class TwitterClient {
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly accessToken?: string;
  private readonly accessTokenSecret?: string;
  private readonly bearerToken?: string;
  private readonly oauth2UserToken?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(opts: TwitterClientOptions) {
    this.apiKey = opts.apiKey;
    this.apiSecret = opts.apiSecret;
    this.accessToken = opts.accessToken;
    this.accessTokenSecret = opts.accessTokenSecret;
    this.bearerToken = opts.bearerToken;
    this.oauth2UserToken = opts.oauth2UserToken;
    this.baseUrl = opts.baseUrl ?? "https://api.twitter.com";
    this.timeoutMs = opts.timeoutMs ?? 30000;
  }

  private requireOAuth1Credentials(): void {
    if (!this.apiKey || !this.apiSecret || !this.accessToken || !this.accessTokenSecret) {
      throw new Error(
        "OAuth 1.0a credentials required. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET.",
      );
    }
  }

  private requireBearerToken(): string {
    if (!this.bearerToken) {
      throw new Error("X_BEARER_TOKEN is not set");
    }
    return this.bearerToken;
  }

  private requireOAuth2UserToken(): string {
    if (!this.oauth2UserToken) {
      throw new Error("X_OAUTH2_USER_TOKEN is not set");
    }
    return this.oauth2UserToken;
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
    requestParams?: Record<string, string>,
  ): string {
    const allParams: Record<string, string> = { ...oauthParams };
    if (requestParams) {
      for (const [k, v] of Object.entries(requestParams)) {
        allParams[k] = v;
      }
    }

    const paramString = Object.entries(allParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const baseString = [
      method.toUpperCase(),
      encodeURIComponent(url),
      encodeURIComponent(paramString),
    ].join("&");

    const signingKey = `${encodeURIComponent(this.apiSecret!)}&${encodeURIComponent(this.accessTokenSecret!)}`;
    return createHmac("sha1", signingKey).update(baseString).digest("base64");
  }

  private buildOAuthHeader(method: string, url: string, requestParams?: Record<string, string>): string {
    this.requireOAuth1Credentials();

    const oauthParams: Record<string, string> = {
      oauth_consumer_key: this.apiKey!,
      oauth_nonce: this.generateNonce(),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: this.accessToken!,
      oauth_version: "1.0",
    };

    oauthParams.oauth_signature = this.buildOAuthSignature(method, url, oauthParams, requestParams);

    const headerParts = Object.entries(oauthParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
      .join(", ");

    return `OAuth ${headerParts}`;
  }

  private buildAuthHeader(method: string, url: URL, mode: TwitterAuthMode): string {
    switch (mode) {
      case "bearer":
        return `Bearer ${this.requireBearerToken()}`;
      case "oauth2-user":
        return `Bearer ${this.requireOAuth2UserToken()}`;
      case "oauth1": {
        const queryParams: Record<string, string> = {};
        url.searchParams.forEach((v, k) => {
          queryParams[k] = v;
        });
        const baseUrl = `${url.origin}${url.pathname}`;
        return this.buildOAuthHeader(method, baseUrl, queryParams);
      }
    }
  }

  private async get<T>(path: string, opts: GetRequestOptions): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== "") {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: this.buildAuthHeader("GET", url, opts.auth),
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        const retryAfterHeader = res.headers.get("retry-after");
        const retryHint = retryAfterHeader ? ` (retry-after: ${retryAfterHeader}s)` : "";
        throw new Error(`X API error ${res.status}${retryHint}: ${errorBody}`);
      }

      const text = await res.text();
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`X API returned invalid JSON: ${text.slice(0, 200)}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  // --- User lookup ---

  async getUserByUsername(
    username: string,
    opts?: {
      userFields?: string[];
      expansions?: string[];
      tweetFields?: string[];
      auth?: TwitterAuthMode;
    },
  ): Promise<TwitterUserLookupResponse> {
    const query: Record<string, string | undefined> = {};
    if (opts?.userFields?.length) query["user.fields"] = opts.userFields.join(",");
    if (opts?.expansions?.length) query.expansions = opts.expansions.join(",");
    if (opts?.tweetFields?.length) query["tweet.fields"] = opts.tweetFields.join(",");

    return this.get<TwitterUserLookupResponse>(
      `/2/users/by/username/${encodeURIComponent(username)}`,
      { auth: opts?.auth ?? "bearer", query },
    );
  }

  async getUserProfileByUsername(
    username: string,
    opts?: {
      auth?: TwitterAuthMode;
    },
  ): Promise<TwitterUserProfile> {
    const response = await this.getUserByUsername(username, {
      auth: opts?.auth ?? "bearer",
      userFields: DEFAULT_USER_PROFILE_FIELDS,
    });
    const user = response.data;
    const metrics = user.public_metrics ?? {};
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      description: typeof user.description === "string" ? user.description : null,
      verified: typeof user.verified === "boolean" ? user.verified : null,
      created_at: typeof user["created_at"] === "string" ? user["created_at"] : null,
      followers_count: this.metricOrNull(metrics.followers_count),
      following_count: this.metricOrNull(metrics.following_count),
    };
  }

  async getUserDmStatus(
    username: string,
    opts?: {
      auth?: Extract<TwitterAuthMode, "bearer" | "oauth2-user">;
    },
  ): Promise<DmCheckResult> {
    const normalizedUsername = this.stripAt(username);
    const response = await this.getUserByUsername(normalizedUsername, {
      auth: opts?.auth ?? "bearer",
      userFields: DM_STATUS_USER_FIELDS,
    });
    const user = response.data;
    const connectionStatus = Array.isArray(user.connection_status)
      ? user.connection_status.filter((value): value is string => typeof value === "string")
      : [];
    const protectedAccount = user.protected === true;
    const receivesYourDm = typeof user.receives_your_dm === "boolean" ? user.receives_your_dm : undefined;
    const verdict = this.determineDmStatus(receivesYourDm, protectedAccount, connectionStatus);

    return {
      username: user.username ?? normalizedUsername,
      user_id: user.id,
      can_receive_dm: verdict.can_receive_dm,
      reason: verdict.reason,
      receives_your_dm: receivesYourDm ?? null,
      connection_status: connectionStatus,
      protected: protectedAccount,
      fetched_at: new Date().toISOString(),
    };
  }

  async getAuthenticatedUser(opts?: {
    userFields?: string[];
  }): Promise<TwitterUserLookupResponse> {
    const query: Record<string, string | undefined> = {};
    if (opts?.userFields?.length) query["user.fields"] = opts.userFields.join(",");

    return this.get<TwitterUserLookupResponse>("/2/users/me", {
      auth: "oauth2-user",
      query,
    });
  }

  // --- Following ---

  async getFollowing(
    userId: string,
    opts?: {
      userFields?: string[];
      expansions?: string[];
      tweetFields?: string[];
      maxResults?: number;
      paginationToken?: string;
      auth?: "bearer" | "oauth1";
    },
  ): Promise<TwitterFollowingResponse> {
    const query: Record<string, string | number | undefined> = {};
    if (opts?.userFields?.length) query["user.fields"] = opts.userFields.join(",");
    if (opts?.expansions?.length) query.expansions = opts.expansions.join(",");
    if (opts?.tweetFields?.length) query["tweet.fields"] = opts.tweetFields.join(",");
    if (opts?.maxResults) query.max_results = opts.maxResults;
    if (opts?.paginationToken) query.pagination_token = opts.paginationToken;

    return this.get<TwitterFollowingResponse>(
      `/2/users/${encodeURIComponent(userId)}/following`,
      { auth: opts?.auth ?? "bearer", query },
    );
  }

  // --- User timeline ---

  async getUserTimeline(
    userId: string,
    opts?: {
      tweetFields?: string[];
      expansions?: string[];
      userFields?: string[];
      mediaFields?: string[];
      maxResults?: number;
      paginationToken?: string;
      auth?: "bearer" | "oauth1";
    },
  ): Promise<TwitterUserTimelineResponse> {
    const query: Record<string, string | number | undefined> = {};
    const tweetFields = opts?.tweetFields ?? DEFAULT_TIMELINE_TWEET_FIELDS;
    if (tweetFields.length) query["tweet.fields"] = tweetFields.join(",");
    if (opts?.expansions?.length) query.expansions = opts.expansions.join(",");
    if (opts?.userFields?.length) query["user.fields"] = opts.userFields.join(",");
    if (opts?.mediaFields?.length) query["media.fields"] = opts.mediaFields.join(",");
    if (opts?.maxResults) query.max_results = opts.maxResults;
    if (opts?.paginationToken) query.pagination_token = opts.paginationToken;

    const response = await this.get<TwitterUserTimelineResponse>(
      `/2/users/${encodeURIComponent(userId)}/tweets`,
      { auth: opts?.auth ?? "bearer", query },
    );

    return this.normalizeTweetResponse(response);
  }

  async getUserTimelineCount(
    userId: string,
    opts: {
      count: number;
      tweetFields?: string[];
      expansions?: string[];
      userFields?: string[];
      mediaFields?: string[];
      maxResults?: number;
      auth?: "bearer" | "oauth1";
    },
  ): Promise<TwitterUserTimelineResponse> {
    this.validateCount(opts.count);
    const allData: TwitterTweet[] = [];
    const seenTweetIds = new Set<string>();
    let includes: TwitterIncludes = {};
    let paginationToken: string | undefined;
    let partial = false;

    do {
      const remaining = opts.count - allData.length;
      const pageSize = Math.min(opts.maxResults ?? 100, remaining);
      const res = await this.getUserTimeline(userId, {
        ...opts,
        maxResults: pageSize,
        paginationToken,
      });

      for (const tweet of res.data ?? []) {
        if (seenTweetIds.has(tweet.id)) continue;
        seenTweetIds.add(tweet.id);
        allData.push(tweet);
        if (allData.length >= opts.count) break;
      }
      includes = this.mergeIncludes(includes, res.includes);
      paginationToken = res.meta?.next_token;
    } while (paginationToken && allData.length < opts.count);

    if (paginationToken && allData.length >= opts.count) {
      partial = false;
    } else if (!paginationToken && allData.length < opts.count) {
      partial = true;
    }

    const data = allData.slice(0, opts.count);
    return {
      data,
      includes: Object.keys(includes).length > 0 ? includes : undefined,
      meta: { result_count: data.length, requested_count: opts.count, partial },
    };
  }

  async getAllFollowing(
    userId: string,
    opts?: {
      userFields?: string[];
      expansions?: string[];
      tweetFields?: string[];
      maxResults?: number;
      limitPages?: number;
      auth?: "bearer" | "oauth1";
    },
  ): Promise<TwitterFollowingResponse> {
    const maxPages = opts?.limitPages ?? 100;
    const allData: TwitterUser[] = [];
    let includes: TwitterIncludes = {};
    let paginationToken: string | undefined;
    let pages = 0;

    do {
      const res = await this.getFollowing(userId, {
        ...opts,
        paginationToken,
      });

      if (res.data) allData.push(...res.data);
      includes = this.mergeIncludes(includes, res.includes);
      paginationToken = res.meta?.next_token;
      pages++;
    } while (paginationToken && pages < maxPages);

    return {
      data: allData,
      includes: Object.keys(includes).length > 0 ? includes : undefined,
      meta: { result_count: allData.length },
    };
  }

  // --- Bookmarks ---

  async getBookmarks(
    userId: string,
    opts?: {
      tweetFields?: string[];
      expansions?: string[];
      userFields?: string[];
      mediaFields?: string[];
      maxResults?: number;
      paginationToken?: string;
    },
  ): Promise<TwitterBookmarkResponse> {
    const query: Record<string, string | number | undefined> = {};
    if (opts?.tweetFields?.length) query["tweet.fields"] = opts.tweetFields.join(",");
    if (opts?.expansions?.length) query.expansions = opts.expansions.join(",");
    if (opts?.userFields?.length) query["user.fields"] = opts.userFields.join(",");
    if (opts?.mediaFields?.length) query["media.fields"] = opts.mediaFields.join(",");
    if (opts?.maxResults) query.max_results = opts.maxResults;
    if (opts?.paginationToken) query.pagination_token = opts.paginationToken;

    const response = await this.get<TwitterBookmarkResponse>(
      `/2/users/${encodeURIComponent(userId)}/bookmarks`,
      { auth: "oauth2-user", query },
    );
    return this.normalizeTweetResponse(response);
  }

  async getAllBookmarks(
    userId: string,
    opts?: {
      tweetFields?: string[];
      expansions?: string[];
      userFields?: string[];
      mediaFields?: string[];
      maxResults?: number;
      limitPages?: number;
    },
  ): Promise<TwitterBookmarkResponse> {
    const maxPages = opts?.limitPages ?? 20;
    const allData: TwitterTweet[] = [];
    let includes: TwitterIncludes = {};
    let paginationToken: string | undefined;
    let pages = 0;

    do {
      const res = await this.getBookmarks(userId, {
        ...opts,
        paginationToken,
      });

      if (res.data) allData.push(...res.data);
      includes = this.mergeIncludes(includes, res.includes);
      paginationToken = res.meta?.next_token;
      pages++;
    } while (paginationToken && pages < maxPages);

    return this.normalizeTweetResponse({
      data: allData,
      includes: Object.keys(includes).length > 0 ? includes : undefined,
      meta: { result_count: allData.length },
    });
  }

  async getBookmarkFolders(
    userId: string,
    opts?: {
      maxResults?: number;
      paginationToken?: string;
    },
  ): Promise<TwitterBookmarkFolderResponse> {
    const query: Record<string, string | number | undefined> = {};
    if (opts?.maxResults) query.max_results = opts.maxResults;
    if (opts?.paginationToken) query.pagination_token = opts.paginationToken;

    return this.get<TwitterBookmarkFolderResponse>(
      `/2/users/${encodeURIComponent(userId)}/bookmarks/folders`,
      { auth: "oauth2-user", query },
    );
  }

  async getAllBookmarkFolders(
    userId: string,
    opts?: {
      maxResults?: number;
      limitPages?: number;
    },
  ): Promise<TwitterBookmarkFolderResponse> {
    const maxPages = opts?.limitPages ?? 20;
    const allData: { id: string; name: string }[] = [];
    let paginationToken: string | undefined;
    let pages = 0;

    do {
      const res = await this.getBookmarkFolders(userId, {
        ...opts,
        paginationToken,
      });

      if (res.data) allData.push(...res.data);
      paginationToken = res.meta?.next_token;
      pages++;
    } while (paginationToken && pages < maxPages);

    return {
      data: allData,
      meta: { result_count: allData.length },
    };
  }

  async getBookmarksByFolder(
    userId: string,
    folderId: string,
    opts?: {
      tweetFields?: string[];
      expansions?: string[];
      userFields?: string[];
      mediaFields?: string[];
      maxResults?: number;
      paginationToken?: string;
    },
  ): Promise<TwitterBookmarkResponse> {
    const query: Record<string, string | number | undefined> = {};
    if (opts?.tweetFields?.length) query["tweet.fields"] = opts.tweetFields.join(",");
    if (opts?.expansions?.length) query.expansions = opts.expansions.join(",");
    if (opts?.userFields?.length) query["user.fields"] = opts.userFields.join(",");
    if (opts?.mediaFields?.length) query["media.fields"] = opts.mediaFields.join(",");
    if (opts?.maxResults) query.max_results = opts.maxResults;
    if (opts?.paginationToken) query.pagination_token = opts.paginationToken;

    const response = await this.get<TwitterBookmarkResponse>(
      `/2/users/${encodeURIComponent(userId)}/bookmarks/folders/${encodeURIComponent(folderId)}`,
      { auth: "oauth2-user", query },
    );
    return this.normalizeTweetResponse(response);
  }

  async getAllBookmarksByFolder(
    userId: string,
    folderId: string,
    opts?: {
      tweetFields?: string[];
      expansions?: string[];
      userFields?: string[];
      mediaFields?: string[];
      maxResults?: number;
      limitPages?: number;
    },
  ): Promise<TwitterBookmarkResponse> {
    const maxPages = opts?.limitPages ?? 20;
    const allData: TwitterTweet[] = [];
    let includes: TwitterIncludes = {};
    let paginationToken: string | undefined;
    let pages = 0;

    do {
      const res = await this.getBookmarksByFolder(userId, folderId, {
        ...opts,
        paginationToken,
      });

      if (res.data) allData.push(...res.data);
      includes = this.mergeIncludes(includes, res.includes);
      paginationToken = res.meta?.next_token;
      pages++;
    } while (paginationToken && pages < maxPages);

    return this.normalizeTweetResponse({
      data: allData,
      includes: Object.keys(includes).length > 0 ? includes : undefined,
      meta: { result_count: allData.length },
    });
  }

  // --- Bookmark filtering ---

  filterBookmarks(
    response: TwitterBookmarkResponse,
    pattern: string,
    opts?: {
      ignoreCase?: boolean;
      field?: "text" | "author" | "url" | "all";
      plainPattern?: boolean;
    },
  ): TwitterBookmarkResponse {
    const field = opts?.field ?? "all";
    const flags = opts?.ignoreCase ? "i" : "";
    const regex = opts?.plainPattern
      ? null
      : new RegExp(pattern, flags);
    const plainLower = opts?.plainPattern && opts?.ignoreCase ? pattern.toLowerCase() : pattern;

    const userMap = new Map<string, TwitterUser>();
    if (response.includes?.users) {
      for (const user of response.includes.users) {
        userMap.set(user.id, user);
      }
    }

    const matchedData = response.data.filter((tweet) => {
      const candidates: string[] = [];

      if (field === "text" || field === "all") {
        if (tweet.text) candidates.push(tweet.text);
      }
      if (field === "author" || field === "all") {
        if (tweet.author_id) {
          const user = userMap.get(tweet.author_id);
          if (user) {
            if (user.name) candidates.push(user.name);
            if (user.username) candidates.push(user.username);
          }
        }
      }
      if (field === "url" || field === "all") {
        candidates.push(`https://x.com/i/status/${tweet.id}`);
      }

      return candidates.some((c) => {
        if (regex) return regex.test(c);
        if (opts?.ignoreCase) return c.toLowerCase().includes(plainLower);
        return c.includes(pattern);
      });
    });

    const matchedAuthorIds = new Set(matchedData.map((t) => t.author_id).filter(Boolean));
    const filteredUsers = response.includes?.users?.filter((u) => matchedAuthorIds.has(u.id));

    return {
      data: matchedData,
      includes: filteredUsers?.length ? { ...response.includes, users: filteredUsers } : response.includes,
      meta: { result_count: matchedData.length },
    };
  }

  // --- Post / Reply (existing) ---

  async replyTweet(inReplyToTweetId: string, text: string): Promise<ReplyResult> {
    this.requireOAuth1Credentials();
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

  async postTweet(input: PostTweetInput): Promise<PostTweetResult> {
    this.requireOAuth1Credentials();
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
    return `${text}\n${url}`;
  }

  private mergeIncludes(a: TwitterIncludes, b?: TwitterIncludes): TwitterIncludes {
    if (!b) return a;
    const result: TwitterIncludes = { ...a };

    if (b.users) {
      const existing = new Set((a.users ?? []).map((u) => u.id));
      result.users = [...(a.users ?? []), ...b.users.filter((u) => !existing.has(u.id))];
    }
    if (b.tweets) {
      const existing = new Set((a.tweets ?? []).map((t) => t.id));
      result.tweets = [...(a.tweets ?? []), ...b.tweets.filter((t) => !existing.has(t.id))];
    }

    return result;
  }

  private validateCount(count: number): void {
    if (!Number.isInteger(count) || count <= 0 || count > MAX_COUNT) {
      throw new Error(`count must be between 1 and ${MAX_COUNT}`);
    }
  }

  private metricOrNull(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private stripAt(value: string): string {
    return value.startsWith("@") ? value.slice(1) : value;
  }

  private determineDmStatus(
    receivesYourDm: boolean | undefined,
    protectedAccount: boolean,
    connectionStatus: string[],
  ): { can_receive_dm: DmAvailability; reason: string } {
    if (protectedAccount && !connectionStatus.includes("following")) {
      return { can_receive_dm: "unknown", reason: "protected_account_not_following" };
    }
    if (receivesYourDm === true) {
      return { can_receive_dm: "true", reason: "receives_your_dm=true" };
    }
    if (receivesYourDm === false) {
      return { can_receive_dm: "false", reason: "receives_your_dm=false" };
    }
    return { can_receive_dm: "unknown", reason: "field_not_returned" };
  }

  private normalizeEngagement(tweet: TwitterTweet): TwitterEngagementMetrics {
    const publicMetrics = tweet.public_metrics ?? {};
    const organicMetrics = tweet.organic_metrics ?? {};
    const nonPublicMetrics = tweet.non_public_metrics ?? {};
    return {
      retweet_count: this.metricOrNull(publicMetrics.retweet_count),
      reply_count: this.metricOrNull(publicMetrics.reply_count),
      quote_count: this.metricOrNull(publicMetrics.quote_count),
      like_count: this.metricOrNull(publicMetrics.like_count),
      bookmark_count: this.metricOrNull(publicMetrics.bookmark_count),
      view_count: this.metricOrNull(organicMetrics.impression_count ?? nonPublicMetrics.impression_count ?? tweet["view_count"]),
    };
  }

  private normalizeTweet(tweet: TwitterTweet): TwitterTweet {
    const engagement = this.normalizeEngagement(tweet);
    return {
      ...tweet,
      ...engagement,
      engagement,
    };
  }

  private normalizeTweetResponse<T extends { data: TwitterTweet[]; includes?: TwitterIncludes; meta: TwitterUserTimelineResponse["meta"] }>(
    response: T,
  ): T {
    return {
      ...response,
      data: (response.data ?? []).map((tweet) => this.normalizeTweet(tweet)),
    };
  }
}
