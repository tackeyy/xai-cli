import { createHmac } from "node:crypto";
import { computeTweetLength, TWEET_MAX_LENGTH } from "./tweet-length.js";
import type {
  DmAvailability,
  DmCheckResult,
  TwitterAuthMode,
  TwitterConversationResponse,
  TwitterEngagementMetrics,
  TwitterSearchRecentResponse,
  TwitterTweetLookupResponse,
  TwitterUserLookupResponse,
  TwitterFollowingResponse,
  TwitterBookmarkResponse,
  TwitterBookmarkFolderResponse,
  TwitterIncludes,
  TwitterTweet,
  TwitterUser,
  TwitterUserProfile,
  TwitterUserTimelineResponse,
  TwitterDmEventsResponse,
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
  quoteTweetId?: string;
}

export interface PostTweetPayload {
  text: string;
  reply?: { in_reply_to_tweet_id: string };
  quote_tweet_id?: string;
}

export interface PostTweetResult {
  id: string;
  text: string;
  url: string;
  posted_at: string;
}

export interface UpdateProfileInput {
  name?: string;
  /** Profile bio. Maps to the v1.1 `description` field. */
  bio?: string;
  url?: string;
  location?: string;
}

export interface UpdateProfileResult {
  screenName?: string;
  name?: string;
  description?: string;
  url?: string;
  location?: string;
}

/** Map of size key (e.g. "1500x500") to URL string */
export type BannerSizes = Record<string, string>;

export interface BannerResult {
  /** false when the account has no banner (API returned 404) */
  hasBanner: boolean;
  sizes: BannerSizes;
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
// Mentions use Bearer auth by default; organic_metrics/non_public_metrics require
// OAuth1.0a User Context (own tweets only) and cause 403 with Bearer token.
const MENTIONS_TWEET_FIELDS = [
  "id",
  "text",
  "created_at",
  "author_id",
  "public_metrics",
];
const DEFAULT_USER_PROFILE_FIELDS = ["description", "created_at", "verified", "public_metrics"];
const DM_STATUS_USER_FIELDS = ["receives_your_dm", "connection_status", "protected", "verified"];
const DM_EVENT_DEFAULT_FIELDS = "id,event_type,text,sender_id,created_at,dm_conversation_id";
const DEFAULT_TWEET_LOOKUP_FIELDS = [
  "id",
  "text",
  "created_at",
  "author_id",
  "conversation_id",
  "in_reply_to_user_id",
  "referenced_tweets",
  "public_metrics",
];
const DEFAULT_TWEET_LOOKUP_EXPANSIONS = [
  "author_id",
  "referenced_tweets.id",
  "referenced_tweets.id.author_id",
  "in_reply_to_user_id",
];
const TWEET_ID_RE = /^\d{1,25}$/;
const TWEET_URL_RE = /(?:x|twitter)\.com\/(?:[^/]+\/status|i\/status|i\/web\/status)\/(\d{1,25})/i;
const MAX_COUNT = 1000;
const CONVERSATION_MAX_PAGES = 50;

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

  /**
   * 認証ユーザーのホームタイムライン (フォロー中の全アカウントの投稿) を逆時系列で取得する。
   * X API の /2/users/:id/timelines/reverse_chronological は App-only Bearer が禁止されており
   * OAuth 1.0a / OAuth 2.0 User Context が必須なため、auth の既定値は "oauth1"。
   * :id は認証ユーザー自身の id である必要がある。
   */
  async getHomeTimeline(
    userId: string,
    opts?: {
      tweetFields?: string[];
      expansions?: string[];
      userFields?: string[];
      mediaFields?: string[];
      maxResults?: number;
      paginationToken?: string;
      exclude?: string[];
      auth?: "bearer" | "oauth1";
    },
  ): Promise<TwitterUserTimelineResponse> {
    const query: Record<string, string | number | undefined> = {};
    const tweetFields = opts?.tweetFields ?? DEFAULT_TIMELINE_TWEET_FIELDS;
    if (tweetFields.length) query["tweet.fields"] = tweetFields.join(",");
    if (opts?.expansions?.length) query.expansions = opts.expansions.join(",");
    if (opts?.userFields?.length) query["user.fields"] = opts.userFields.join(",");
    if (opts?.mediaFields?.length) query["media.fields"] = opts.mediaFields.join(",");
    if (opts?.exclude?.length) query.exclude = opts.exclude.join(",");
    if (opts?.maxResults) query.max_results = opts.maxResults;
    if (opts?.paginationToken) query.pagination_token = opts.paginationToken;

    const response = await this.get<TwitterUserTimelineResponse>(
      `/2/users/${encodeURIComponent(userId)}/timelines/reverse_chronological`,
      { auth: opts?.auth ?? "oauth1", query },
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


  // --- Mentions ---

  async getMentions(
    userId: string,
    opts?: {
      tweetFields?: string[];
      maxResults?: number;
      paginationToken?: string;
      auth?: "bearer" | "oauth1";
    },
  ): Promise<TwitterUserTimelineResponse> {
    const query: Record<string, string | number | undefined> = {};
    const tweetFields = opts?.tweetFields ?? MENTIONS_TWEET_FIELDS;
    if (tweetFields.length) query["tweet.fields"] = tweetFields.join(",");
    if (opts?.maxResults) query.max_results = opts.maxResults;
    if (opts?.paginationToken) query.pagination_token = opts.paginationToken;

    const response = await this.get<TwitterUserTimelineResponse>(
      `/2/users/${encodeURIComponent(userId)}/mentions`,
      { auth: opts?.auth ?? "bearer", query },
    );

    return this.normalizeTweetResponse(response);
  }

  async getMentionsCount(
    userId: string,
    opts: {
      count: number;
      tweetFields?: string[];
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
      const res = await this.getMentions(userId, {
        tweetFields: opts.tweetFields,
        maxResults: pageSize,
        paginationToken,
        auth: opts.auth,
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

    if (!paginationToken && allData.length < opts.count) {
      partial = true;
    }

    const data = allData.slice(0, opts.count);
    return {
      data,
      includes: Object.keys(includes).length > 0 ? includes : undefined,
      meta: { result_count: data.length, requested_count: opts.count, partial },
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

  // --- Tweet media (Issue #15) ---

  /**
   * Fetch media (photo) URLs for a tweet via X API v2.
   * Returns empty array when X_BEARER_TOKEN is unavailable (fallback via oEmbed not needed
   * because the caller handles the no-image case).
   * Caps at MAX_TWEET_IMAGES (4) images.
   */
  async getTweetMediaUrls(
    tweetIdOrUrl: string,
    opts?: { auth?: "bearer" | "oauth1"; maxImages?: number },
  ): Promise<string[]> {
    const maxImages = opts?.maxImages ?? 4;
    const auth = opts?.auth ?? "bearer";

    // If no bearer token available, return empty — caller will fall back to text-only
    if (!this.bearerToken && auth === "bearer") {
      return [];
    }

    let tweetId: string;
    try {
      tweetId = this.normalizeTweetId(tweetIdOrUrl);
    } catch {
      return [];
    }

    const response = await this.get<{
      data: {
        id: string;
        attachments?: { media_keys?: string[] };
      };
      includes?: {
        media?: Array<{
          media_key: string;
          type: string;
          url?: string;
          preview_image_url?: string;
        }>;
      };
    }>(`/2/tweets/${encodeURIComponent(tweetId)}`, {
      auth,
      query: {
        "tweet.fields": "attachments",
        expansions: "attachments.media_keys",
        "media.fields": "url,preview_image_url,type",
      },
    });

    const mediaKeys = response.data.attachments?.media_keys ?? [];
    const mediaItems = response.includes?.media ?? [];

    const urls: string[] = [];
    for (const key of mediaKeys) {
      if (urls.length >= maxImages) break;
      const item = mediaItems.find((m) => m.media_key === key);
      if (!item) continue;
      // Photos have url; videos have preview_image_url
      const url = item.url ?? item.preview_image_url;
      if (url) urls.push(url);
    }

    return urls;
  }

  // --- Tweet lookup & conversation (Issue #13: R1 + R2) ---

  async getTweetById(
    tweetIdOrUrl: string,
    opts?: {
      tweetFields?: string[];
      expansions?: string[];
      userFields?: string[];
      mediaFields?: string[];
      auth?: "bearer" | "oauth1";
    },
  ): Promise<TwitterTweetLookupResponse> {
    const tweetId = this.normalizeTweetId(tweetIdOrUrl);
    const query: Record<string, string | undefined> = {};
    const tweetFields = opts?.tweetFields ?? DEFAULT_TWEET_LOOKUP_FIELDS;
    const expansions = opts?.expansions ?? DEFAULT_TWEET_LOOKUP_EXPANSIONS;
    if (tweetFields.length) query["tweet.fields"] = tweetFields.join(",");
    if (expansions.length) query.expansions = expansions.join(",");
    if (opts?.userFields?.length) query["user.fields"] = opts.userFields.join(",");
    if (opts?.mediaFields?.length) query["media.fields"] = opts.mediaFields.join(",");

    return this.get<TwitterTweetLookupResponse>(
      `/2/tweets/${encodeURIComponent(tweetId)}`,
      { auth: opts?.auth ?? "bearer", query },
    );
  }

  async searchRecent(
    query: string,
    opts?: {
      maxResults?: number;
      tweetFields?: string[];
      expansions?: string[];
      userFields?: string[];
      mediaFields?: string[];
      paginationToken?: string;
      startTime?: string;
      endTime?: string;
      sinceId?: string;
      untilId?: string;
      auth?: "bearer" | "oauth1";
    },
  ): Promise<TwitterSearchRecentResponse> {
    if (!query || !query.trim()) {
      throw new Error("searchRecent: query must not be empty");
    }
    const params: Record<string, string | number | undefined> = { query };
    if (opts?.tweetFields?.length) params["tweet.fields"] = opts.tweetFields.join(",");
    if (opts?.expansions?.length) params.expansions = opts.expansions.join(",");
    if (opts?.userFields?.length) params["user.fields"] = opts.userFields.join(",");
    if (opts?.mediaFields?.length) params["media.fields"] = opts.mediaFields.join(",");
    if (opts?.maxResults) params.max_results = opts.maxResults;
    if (opts?.paginationToken) params.next_token = opts.paginationToken;
    if (opts?.startTime) params.start_time = opts.startTime;
    if (opts?.endTime) params.end_time = opts.endTime;
    if (opts?.sinceId) params.since_id = opts.sinceId;
    if (opts?.untilId) params.until_id = opts.untilId;

    return this.get<TwitterSearchRecentResponse>(`/2/tweets/search/recent`, {
      auth: opts?.auth ?? "bearer",
      query: params,
    });
  }

  async getConversation(
    tweetIdOrUrl: string,
    opts?: {
      all?: boolean;
      maxResults?: number;
      tweetFields?: string[];
      expansions?: string[];
      userFields?: string[];
      mediaFields?: string[];
      auth?: "bearer" | "oauth1";
    },
  ): Promise<TwitterConversationResponse> {
    const auth = opts?.auth ?? "bearer";
    const root = await this.getTweetById(tweetIdOrUrl, {
      tweetFields: opts?.tweetFields,
      expansions: opts?.expansions,
      userFields: opts?.userFields,
      mediaFields: opts?.mediaFields,
      auth,
    });
    const conversationId = root.data.conversation_id ?? root.data.id;

    const all: TwitterTweet[] = [];
    const seen = new Set<string>();
    let includes: TwitterIncludes = root.includes ?? {};
    let paginationToken: string | undefined;
    let page = 0;
    let partial = false;

    do {
      const res = await this.searchRecent(`conversation_id:${conversationId}`, {
        maxResults: opts?.maxResults ?? 100,
        tweetFields: opts?.tweetFields ?? DEFAULT_TWEET_LOOKUP_FIELDS,
        expansions: opts?.expansions ?? DEFAULT_TWEET_LOOKUP_EXPANSIONS,
        userFields: opts?.userFields,
        mediaFields: opts?.mediaFields,
        paginationToken,
        auth,
      });
      for (const t of res.data ?? []) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        all.push(t);
      }
      includes = this.mergeIncludes(includes, res.includes);
      paginationToken = res.meta?.next_token;
      page += 1;
      if (!opts?.all) break;
      if (page >= CONVERSATION_MAX_PAGES) {
        partial = true;
        break;
      }
    } while (paginationToken);

    if (!seen.has(root.data.id)) {
      all.push(root.data);
      seen.add(root.data.id);
    }

    all.sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      return ta - tb;
    });

    const rootTweet = all.find((t) => t.id === conversationId) ?? null;

    return {
      conversation_id: conversationId,
      root: rootTweet,
      tweets: all,
      includes: Object.keys(includes).length > 0 ? includes : undefined,
      meta: { result_count: all.length, partial },
    };
  }

  private normalizeTweetId(input: string): string {
    if (!input) {
      throw new Error("invalid tweet id: empty");
    }
    if (TWEET_ID_RE.test(input)) {
      return input;
    }
    const match = input.match(TWEET_URL_RE);
    if (match) {
      return match[1];
    }
    throw new Error(`invalid tweet id or URL: ${input}`);
  }

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

  // --- DM Events (D3) ---

  async getDmEvents(
    opts?: {
      maxResults?: number;
      paginationToken?: string;
      dmConversationId?: string;
      eventTypes?: string;
      dmEventFields?: string;
    },
  ): Promise<TwitterDmEventsResponse> {
    this.requireOAuth1Credentials();

    const query: Record<string, string | number | undefined> = {};
    if (opts?.maxResults) query.max_results = opts.maxResults;
    if (opts?.paginationToken) query.pagination_token = opts.paginationToken;
    if (opts?.dmConversationId) query.dm_conversation_id = opts.dmConversationId;
    if (opts?.eventTypes) query.event_types = opts.eventTypes;
    query["dm_event.fields"] = opts?.dmEventFields ?? DM_EVENT_DEFAULT_FIELDS;

    try {
      return await this.get<TwitterDmEventsResponse>("/2/dm_events", {
        auth: "oauth1",
        query,
      });
    } catch (err: unknown) {
      // Annotate 401/403 with a human-readable Elevated access hint
      // Use includes() to handle retry-after format: "X API error 403 (retry-after: 60s): ..."
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("X API error 401") || msg.includes("X API error 403")) {
        throw new Error(`${msg} Requires Elevated/paid tier access.`);
      }
      throw err;
    }
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
    if (input.quoteTweetId) {
      payload.quote_tweet_id = input.quoteTweetId;
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

  // --- Profile update (v1.1 account/update_profile) ---

  /**
   * Validate inputs and build the form params for account/update_profile.
   * Public so the CLI dry-run can preview the request without sending it.
   */
  // --- Banner CRUD ---

  /**
   * Validates base64 image data for profile banner upload.
   * Public so CLI dry-run can call it without performing the upload.
   * @param imageBase64 - Base64-encoded image data (no data: URI prefix)
   * @param ext - Optional file extension to validate (jpg/jpeg/png/webp/gif)
   */
  validateBannerImage(imageBase64: string, ext?: string): void {
    const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"] as const;
    if (ext !== undefined) {
      const lower = ext.toLowerCase();
      if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(lower)) {
        throw new Error(
          `Invalid image extension: "${ext}". Allowed formats: jpg, jpeg, png, webp, gif.`,
        );
      }
    }
    // X limit is 5MB on the DECODED image. base64 inflates size ~4/3, so the
    // base64 string of a 5MB image is ~6.99M chars. Guard on that — NOT on 5M
    // chars, which would wrongly reject valid images down to ~3.75MB decoded.
    const MAX_BASE64_LEN = Math.ceil((5 * 1024 * 1024 * 4) / 3); // ≈6,990,508 chars (= 5MB decoded)
    if (imageBase64.length > MAX_BASE64_LEN) {
      const approxMb = ((imageBase64.length * 3) / 4 / (1024 * 1024)).toFixed(1);
      throw new Error(`Image exceeds 5MB limit (got ~${approxMb}MB decoded).`);
    }
  }

  /**
   * GET /1.1/users/profile_banner.json
   * Returns the banner sizes for a given screen name, or hasBanner=false on 404.
   */
  async getProfileBanner(screenName: string): Promise<BannerResult> {
    this.requireOAuth1Credentials();
    const url = new URL(`${this.baseUrl}/1.1/users/profile_banner.json`);
    url.searchParams.set("screen_name", screenName);
    const baseUrl = `${url.origin}${url.pathname}`;
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      queryParams[k] = v;
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: this.buildOAuthHeader("GET", baseUrl, queryParams),
        },
        signal: controller.signal,
      });

      if (res.status === 404) {
        return { hasBanner: false, sizes: {} };
      }

      if (!res.ok) {
        const errorBody = await res.text();
        const retryAfterHeader = res.headers.get("retry-after");
        const retryHint = retryAfterHeader ? ` (retry-after: ${retryAfterHeader}s)` : "";
        let msg = `X API error ${res.status}${retryHint}: ${errorBody}`;
        if (res.status === 401 || res.status === 403) {
          msg += " Requires Elevated/paid tier access (v1.1 users/profile_banner).";
        }
        throw new Error(msg);
      }

      const data = (await res.json()) as {
        sizes?: Record<string, { h: number; w: number; url: string }>;
      };

      const sizes: BannerSizes = {};
      for (const [key, value] of Object.entries(data.sizes ?? {})) {
        sizes[key] = value.url;
      }

      return { hasBanner: true, sizes };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * POST /1.1/account/update_profile_banner.json
   *
   * IMPORTANT: The `banner` param is intentionally NOT included in the OAuth
   * signature base string. buildOAuthHeader is called WITHOUT body params so
   * that the large base64 payload does not break the signature.
   */
  async updateProfileBanner(imageBase64: string, ext?: string): Promise<void> {
    this.requireOAuth1Credentials();
    this.validateBannerImage(imageBase64, ext);

    const url = `${this.baseUrl}/1.1/account/update_profile_banner.json`;
    // banner param is NOT passed to buildOAuthHeader — this is the critical gotcha.
    // Passing a large base64 string as a signed param causes signature mismatches.
    const body = `banner=${encodeURIComponent(imageBase64)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // OAuth 1.0a: banner is excluded from signature base — call without body params.
          Authorization: this.buildOAuthHeader("POST", url),
        },
        body,
        signal: controller.signal,
      });

      if (res.ok) {
        return; // 200 or 201
      }

      const errorBody = await res.text();
      const retryAfterHeader = res.headers.get("retry-after");
      const retryHint = retryAfterHeader ? ` (retry-after: ${retryAfterHeader}s)` : "";
      let msg = `X API error ${res.status}${retryHint}: ${errorBody}`;
      if (res.status === 401 || res.status === 403) {
        msg += " Requires Elevated/paid tier access (v1.1 account/update_profile_banner).";
      }
      throw new Error(msg);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * POST /1.1/account/remove_profile_banner.json
   */
  async removeProfileBanner(): Promise<void> {
    this.requireOAuth1Credentials();
    const url = `${this.baseUrl}/1.1/account/remove_profile_banner.json`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: this.buildOAuthHeader("POST", url),
        },
        body: "",
        signal: controller.signal,
      });

      if (res.ok) {
        return;
      }

      const errorBody = await res.text();
      const retryAfterHeader = res.headers.get("retry-after");
      const retryHint = retryAfterHeader ? ` (retry-after: ${retryAfterHeader}s)` : "";
      let msg = `X API error ${res.status}${retryHint}: ${errorBody}`;
      if (res.status === 401 || res.status === 403) {
        msg += " Requires Elevated/paid tier access (v1.1 account/remove_profile_banner).";
      }
      throw new Error(msg);
    } finally {
      clearTimeout(timer);
    }
  }

    buildProfileParams(input: UpdateProfileInput): Record<string, string> {
    const limits: Array<[keyof UpdateProfileInput, string, number]> = [
      ["name", "name", 50],
      ["bio", "description", 160],
      ["url", "url", 100],
      ["location", "location", 30],
    ];
    const params: Record<string, string> = {};
    for (const [key, field, max] of limits) {
      const value = input[key];
      if (value === undefined) continue;
      const len = [...value].length;
      if (len > max) {
        throw new Error(`${key} exceeds ${max} characters (got ${len}).`);
      }
      params[field] = value;
    }
    if (Object.keys(params).length === 0) {
      throw new Error("at least one of name / bio / url / location must be provided");
    }
    return params;
  }

  async updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
    this.requireOAuth1Credentials();
    const params = this.buildProfileParams(input);
    const url = `${this.baseUrl}/1.1/account/update_profile.json`;
    // Encode the body with RFC3986 (space -> %20) so it matches the OAuth 1.0a
    // signature base string exactly. URLSearchParams would encode space as '+',
    // which can break signature verification for values containing spaces.
    const body = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // OAuth 1.0a: form-encoded body params MUST be included in the signature base.
          Authorization: this.buildOAuthHeader("POST", url, params),
        },
        body,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        const retryAfterHeader = res.headers.get("retry-after");
        const retryHint = retryAfterHeader ? ` (retry-after: ${retryAfterHeader}s)` : "";
        let msg = `X API error ${res.status}${retryHint}: ${errorBody}`;
        if (res.status === 401 || res.status === 403) {
          msg += " Requires Elevated/paid tier access (v1.1 account/update_profile).";
        }
        throw new Error(msg);
      }

      const data = (await res.json()) as {
        screen_name?: string;
        name?: string;
        description?: string;
        location?: string;
        url?: string;
        entities?: { url?: { urls?: Array<{ expanded_url?: string }> } };
      };
      const expanded = data.entities?.url?.urls?.[0]?.expanded_url;
      return {
        screenName: data.screen_name,
        name: data.name,
        description: data.description,
        location: data.location,
        url: expanded ?? data.url,
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
