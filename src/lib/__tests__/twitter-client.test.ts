import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TwitterClient, TweetTooLongError } from "../twitter-client.js";
import type { DeleteTweetResult } from "../twitter-types.js";
import type { MuteBlockResult, TwitterSearchAllResponse, TwitterTrendsResponse, TwitterSpacesSearchResponse } from "../twitter-types.js";

function makeClient() {
  return new TwitterClient({
    apiKey: "k",
    apiSecret: "ks",
    accessToken: "t",
    accessTokenSecret: "ts",
  });
}

function makeBearerClient() {
  return new TwitterClient({
    bearerToken: "test-bearer-token",
  });
}

function makeOAuth2UserClient() {
  return new TwitterClient({
    oauth2UserToken: "test-oauth2-user-token",
  });
}

function makeFullClient() {
  return new TwitterClient({
    apiKey: "k",
    apiSecret: "ks",
    accessToken: "t",
    accessTokenSecret: "ts",
    bearerToken: "test-bearer-token",
    oauth2UserToken: "test-oauth2-user-token",
  });
}

describe("TwitterClient.postTweet", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts plain text and returns tweet id + url", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "111", text: "hello" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const tc = makeClient();
    const result = await tc.postTweet({ text: "hello" });

    expect(result.id).toBe("111");
    expect(result.text).toBe("hello");
    expect(result.url).toBe("https://x.com/i/status/111");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const call = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(call[1]?.body));
    expect(body).toEqual({ text: "hello" });
  });

  it("appends --url to the text body separated by a newline", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "222", text: "ignored" } }), {
        status: 200,
      }),
    );

    const tc = makeClient();
    await tc.postTweet({
      text: "check this",
      url: "https://example.com/article",
    });

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.text).toBe("check this\nhttps://example.com/article");
  });

  it("includes reply.in_reply_to_tweet_id when replyTo is given", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "333", text: "" } }), { status: 200 }),
    );

    const tc = makeClient();
    await tc.postTweet({ text: "thanks!", replyTo: "999" });

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body).toEqual({
      text: "thanks!",
      reply: { in_reply_to_tweet_id: "999" },
    });
  });

  it("throws TweetTooLongError when text exceeds 280 weighted chars (local validation)", async () => {
    const tc = makeClient();
    const tooLong = "あ".repeat(141); // weighted = 282
    await expect(tc.postTweet({ text: tooLong })).rejects.toBeInstanceOf(TweetTooLongError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("allows a longer post when maxLength is raised", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "444", text: "ok" } }), {
        status: 200,
      }),
    );
    const tc = makeClient();
    await tc.postTweet({
      text: "a".repeat(281),
      maxLength: 300,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("skips validation when noLengthCheck is true", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "555", text: "ok" } }), {
        status: 200,
      }),
    );
    const tc = makeClient();
    await tc.postTweet({
      text: "あ".repeat(141),
      noLengthCheck: true,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("includes the URL in weighted length check before sending", async () => {
    const tc = makeClient();
    // "a" * 258 + " " + URL(23) = 258 + 1 + 23 = 282 > 280
    const body = "a".repeat(258) + " https://example.com";
    await expect(tc.postTweet({ text: body })).rejects.toBeInstanceOf(TweetTooLongError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws with status on 401 auth failure", async () => {
    fetchSpy.mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );
    const tc = makeClient();
    await expect(tc.postTweet({ text: "x" })).rejects.toThrow(/401/);
  });

  it("throws with retry-after hint on 429", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ title: "Too Many Requests" }), {
        status: 429,
        headers: { "retry-after": "42" },
      }),
    );
    const tc = makeClient();
    await expect(tc.postTweet({ text: "x" })).rejects.toThrow(/429/);
  });

  it("Authorization header starts with OAuth", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "1", text: "x" } }), { status: 200 }),
    );
    const tc = makeClient();
    await tc.postTweet({ text: "x" });

    const headers = (fetchSpy.mock.calls[0][1]?.headers ?? {}) as Record<string, string>;
    expect(headers["Authorization"] ?? headers["authorization"]).toMatch(/^OAuth /);
    expect(headers["Content-Type"]).toBe("application/json");
  });
});

describe("TwitterClient.buildPostPayload (dry-run helper)", () => {
  it("builds a plain text payload", () => {
    const tc = makeClient();
    const payload = tc.buildPostPayload({ text: "hello" });
    expect(payload).toEqual({ text: "hello" });
  });

  it("appends URL to text", () => {
    const tc = makeClient();
    const payload = tc.buildPostPayload({ text: "check", url: "https://a.example" });
    expect(payload.text).toBe("check\nhttps://a.example");
  });

  it("adds reply", () => {
    const tc = makeClient();
    const payload = tc.buildPostPayload({ text: "t", replyTo: "42" });
    expect(payload).toEqual({ text: "t", reply: { in_reply_to_tweet_id: "42" } });
  });

  it("throws TweetTooLongError when over limit", () => {
    const tc = makeClient();
    expect(() => tc.buildPostPayload({ text: "a".repeat(281) })).toThrow(TweetTooLongError);
  });

  it("builds longer payload when maxLength is raised", () => {
    const tc = makeClient();
    const payload = tc.buildPostPayload({ text: "a".repeat(281), maxLength: 300 });
    expect(payload).toEqual({ text: "a".repeat(281) });
  });

  it("skips validation when noLengthCheck is true", () => {
    const tc = makeClient();
    const payload = tc.buildPostPayload({ text: "あ".repeat(141), noLengthCheck: true });
    expect(payload).toEqual({ text: "あ".repeat(141) });
  });

  it("adds quote_tweet_id when quoteTweetId is given", () => {
    const tc = makeClient();
    const payload = tc.buildPostPayload({ text: "check this", quoteTweetId: "42" });
    expect(payload).toEqual({ text: "check this", quote_tweet_id: "42" });
  });

});

// --- GET helper tests ---

describe("TwitterClient GET helper", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Bearer auth header for bearer mode", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "123", name: "Test", username: "test" } }), { status: 200 }),
    );

    const tc = makeBearerClient();
    await tc.getUserByUsername("test");

    const call = fetchSpy.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-bearer-token");
  });

  it("sends Bearer auth header for oauth2-user mode", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "me123", name: "Me", username: "me" } }), { status: 200 }),
    );

    const tc = makeOAuth2UserClient();
    await tc.getAuthenticatedUser();

    const call = fetchSpy.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-oauth2-user-token");
  });

  it("sends OAuth 1.0a header for oauth1 mode with query params in signature", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "123", name: "Test", username: "test" } }), { status: 200 }),
    );

    const tc = makeFullClient();
    await tc.getUserByUsername("test", { auth: "oauth1" });

    const call = fetchSpy.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^OAuth /);
  });

  it("builds query string from options", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "123", name: "Test", username: "test" } }), { status: 200 }),
    );

    const tc = makeBearerClient();
    await tc.getUserByUsername("test", { userFields: ["description", "location"] });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("user.fields=description%2Clocation");
  });

  it("throws on non-2xx response", async () => {
    fetchSpy.mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    const tc = makeBearerClient();
    await expect(tc.getUserByUsername("test")).rejects.toThrow(/401/);
  });

  it("throws on invalid JSON response", async () => {
    fetchSpy.mockResolvedValue(
      new Response("not json at all", { status: 200 }),
    );

    const tc = makeBearerClient();
    await expect(tc.getUserByUsername("test")).rejects.toThrow(/invalid JSON/);
  });

  it("throws when bearer token is missing", async () => {
    const tc = new TwitterClient({});
    await expect(tc.getUserByUsername("test")).rejects.toThrow(/X_BEARER_TOKEN/);
  });

  it("throws when oauth2 user token is missing", async () => {
    const tc = new TwitterClient({});
    await expect(tc.getAuthenticatedUser()).rejects.toThrow(/X_OAUTH2_USER_TOKEN/);
  });

  it("includes retry-after in error message on 429", async () => {
    fetchSpy.mockResolvedValue(
      new Response("rate limited", { status: 429, headers: { "retry-after": "30" } }),
    );

    const tc = makeBearerClient();
    await expect(tc.getUserByUsername("test")).rejects.toThrow(/retry-after: 30s/);
  });
});

// --- getUserByUsername tests ---

describe("TwitterClient.getUserByUsername", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls correct endpoint", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "123", name: "Test", username: "test" } }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getUserByUsername("test");

    expect(result.data.id).toBe("123");
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/2/users/by/username/test");
  });

  it("getUserProfileByUsername requests public metrics and normalizes profile fields", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          id: "123",
          name: "Test",
          username: "test",
          description: "bio",
          verified: true,
          created_at: "2020-01-01T00:00:00.000Z",
          public_metrics: {
            followers_count: 0,
            following_count: 42,
            tweet_count: 100,
            listed_count: 2,
          },
        },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getUserProfileByUsername("test");

    expect(result.followers_count).toBe(0);
    expect(result.following_count).toBe(42);
    expect(result.verified).toBe(true);
    expect(result.created_at).toBe("2020-01-01T00:00:00.000Z");
    expect(result.description).toBe("bio");
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("user.fields=description%2Ccreated_at%2Cverified%2Cpublic_metrics");
  });

  it("getUserProfileByUsername converts null or invalid metrics to null", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          id: "123",
          username: "test",
          public_metrics: {
            followers_count: null,
            following_count: "NaN",
          },
        },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getUserProfileByUsername("test");

    expect(result.followers_count).toBeNull();
    expect(result.following_count).toBeNull();
    expect(result.verified).toBeNull();
  });

  it("getUserDmStatus returns true when receives_your_dm is true", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          id: "123",
          username: "test",
          receives_your_dm: true,
          connection_status: ["following"],
          protected: false,
          verified: true,
        },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getUserDmStatus("@test");

    expect(result).toMatchObject({
      username: "test",
      user_id: "123",
      can_receive_dm: "true",
      reason: "receives_your_dm=true",
      receives_your_dm: true,
      connection_status: ["following"],
      protected: false,
    });
    expect(new Date(result.fetched_at).toISOString()).toBe(result.fetched_at);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/2/users/by/username/test");
    expect(url).toContain("user.fields=receives_your_dm%2Cconnection_status%2Cprotected%2Cverified");
  });

  it("getUserDmStatus returns false when receives_your_dm is false", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          id: "123",
          username: "test",
          receives_your_dm: false,
          connection_status: ["followed_by"],
          protected: false,
        },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getUserDmStatus("test");

    expect(result.can_receive_dm).toBe("false");
    expect(result.reason).toBe("receives_your_dm=false");
    expect(result.receives_your_dm).toBe(false);
    expect(result.connection_status).toEqual(["followed_by"]);
  });

  it("getUserDmStatus returns unknown when receives_your_dm is missing", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          id: "123",
          username: "test",
          connection_status: ["following"],
          protected: false,
        },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getUserDmStatus("test");

    expect(result.can_receive_dm).toBe("unknown");
    expect(result.reason).toBe("field_not_returned");
    expect(result.receives_your_dm).toBeNull();
  });

  it("getUserDmStatus returns unknown for protected accounts not followed by authenticated user", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: {
          id: "123",
          username: "test",
          receives_your_dm: true,
          connection_status: ["followed_by"],
          protected: true,
        },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getUserDmStatus("test");

    expect(result.can_receive_dm).toBe("unknown");
    expect(result.reason).toBe("protected_account_not_following");
    expect(result.receives_your_dm).toBe(true);
  });

  it("getUserDmStatus surfaces deleted account 404 errors", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ title: "Not Found" }), { status: 404 }),
    );

    const tc = makeBearerClient();
    await expect(tc.getUserDmStatus("deleted")).rejects.toThrow(/X API error 404/);
  });

  it("getUserDmStatus throws when bearer token is missing", async () => {
    const tc = new TwitterClient({});
    await expect(tc.getUserDmStatus("test")).rejects.toThrow(/X_BEARER_TOKEN/);
  });
});

// --- getFollowing tests ---

describe("TwitterClient.getFollowing", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls correct endpoint with user id", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "1", username: "user1" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getFollowing("12345");

    expect(result.data).toHaveLength(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/2/users/12345/following");
  });

  it("sends pagination_token as query param", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "2", username: "user2" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    await tc.getFollowing("12345", { paginationToken: "abc123" });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("pagination_token=abc123");
  });

  it("sends max_results as query param", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "3", username: "user3" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    await tc.getFollowing("12345", { maxResults: 500 });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("max_results=500");
  });
});

// --- getAllFollowing tests ---

describe("TwitterClient.getAllFollowing", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("follows next_token across multiple pages", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "1", username: "a" }],
          meta: { result_count: 1, next_token: "page2" },
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "2", username: "b" }],
          meta: { result_count: 1 },
        }), { status: 200 }),
      );

    const tc = makeBearerClient();
    const result = await tc.getAllFollowing("12345");

    expect(result.data).toHaveLength(2);
    expect(result.meta.result_count).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("respects limitPages", async () => {
    const makeRes = () =>
      new Response(JSON.stringify({
        data: [{ id: "1", username: "a" }],
        meta: { result_count: 1, next_token: "more" },
      }), { status: 200 });
    fetchSpy.mockImplementation(() => Promise.resolve(makeRes()));

    const tc = makeBearerClient();
    const result = await tc.getAllFollowing("12345", { limitPages: 2 });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.data).toHaveLength(2);
  });
});

describe("TwitterClient.getUserTimeline", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes all engagement fields when present", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{
          id: "t1",
          text: "hello",
          public_metrics: {
            retweet_count: 1,
            reply_count: 2,
            like_count: 3,
            quote_count: 4,
            bookmark_count: 5,
          },
          organic_metrics: { impression_count: 6 },
        }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getUserTimeline("123");

    expect(result.data[0]).toMatchObject({
      retweet_count: 1,
      reply_count: 2,
      like_count: 3,
      quote_count: 4,
      bookmark_count: 5,
      view_count: 6,
    });
  });

  it("sets missing engagement fields to null", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "t1", text: "old tweet", public_metrics: { like_count: 3 } }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getUserTimeline("123");

    expect(result.data[0]).toMatchObject({
      retweet_count: null,
      reply_count: null,
      quote_count: null,
      like_count: 3,
      bookmark_count: null,
      view_count: null,
    });
  });

  it("getUserTimelineCount follows pagination and truncates to requested count", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "t1" }, { id: "t2" }],
          meta: { result_count: 2, next_token: "next" },
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "t3" }, { id: "t4" }],
          meta: { result_count: 2 },
        }), { status: 200 }),
      );

    const tc = makeBearerClient();
    const result = await tc.getUserTimelineCount("123", { count: 3, maxResults: 2 });

    expect(result.data.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.meta.result_count).toBe(3);
  });

  it("getUserTimelineCount includes all tweets across three pages when there are no duplicates", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "t1" }, { id: "t2" }],
          meta: { result_count: 2, next_token: "page2" },
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "t3" }, { id: "t4" }],
          meta: { result_count: 2, next_token: "page3" },
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "t5" }],
          meta: { result_count: 1 },
        }), { status: 200 }),
      );

    const tc = makeBearerClient();
    const result = await tc.getUserTimelineCount("123", { count: 5, maxResults: 2 });

    expect(result.data.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.meta.result_count).toBe(5);
    expect(result.meta.partial).toBe(false);
  });

  it("getUserTimelineCount removes duplicate tweet ids across pages", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "t1" }, { id: "t2" }],
          meta: { result_count: 2, next_token: "page2" },
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "t2" }, { id: "t3" }],
          meta: { result_count: 2 },
        }), { status: 200 }),
      );

    const tc = makeBearerClient();
    const result = await tc.getUserTimelineCount("123", { count: 3, maxResults: 2 });

    expect(result.data.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.meta.result_count).toBe(3);
    expect(result.meta.partial).toBe(false);
  });

  it("getUserTimelineCount stops when only duplicates remain and no next token exists", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "t1" }, { id: "t2" }],
          meta: { result_count: 2, next_token: "page2" },
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "t1" }, { id: "t2" }],
          meta: { result_count: 2 },
        }), { status: 200 }),
      );

    const tc = makeBearerClient();
    const result = await tc.getUserTimelineCount("123", { count: 3, maxResults: 2 });

    expect(result.data.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.meta.result_count).toBe(2);
    expect(result.meta.requested_count).toBe(3);
    expect(result.meta.partial).toBe(true);
  });

  it("getUserTimelineCount marks partial when API has fewer tweets than requested", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "t1" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getUserTimelineCount("123", { count: 100, maxResults: 100 });

    expect(result.data.map((t) => t.id)).toEqual(["t1"]);
    expect(result.meta.requested_count).toBe(100);
    expect(result.meta.partial).toBe(true);
  });
});

// --- getAuthenticatedUser tests ---

describe("TwitterClient.getAuthenticatedUser", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls /2/users/me endpoint", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "me1", name: "Me", username: "myself" } }), { status: 200 }),
    );

    const tc = makeOAuth2UserClient();
    const result = await tc.getAuthenticatedUser();

    expect(result.data.id).toBe("me1");
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/2/users/me");
  });
});

// --- getBookmarks tests ---

describe("TwitterClient.getBookmarks", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls correct bookmarks endpoint", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "t1", text: "hello" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeOAuth2UserClient();
    const result = await tc.getBookmarks("me1");

    expect(result.data).toHaveLength(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/2/users/me1/bookmarks");
  });

  it("sends tweet.fields and expansions as query params", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "t1", text: "hello" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeOAuth2UserClient();
    await tc.getBookmarks("me1", {
      tweetFields: ["created_at", "author_id"],
      expansions: ["author_id"],
    });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("tweet.fields=created_at%2Cauthor_id");
    expect(url).toContain("expansions=author_id");
  });
});

// --- getAllBookmarks tests ---

describe("TwitterClient.getAllBookmarks", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("follows next_token across multiple pages", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "t1", text: "a" }],
          meta: { result_count: 1, next_token: "page2" },
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "t2", text: "b" }],
          meta: { result_count: 1 },
        }), { status: 200 }),
      );

    const tc = makeOAuth2UserClient();
    const result = await tc.getAllBookmarks("me1");

    expect(result.data).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

// --- getBookmarkFolders tests ---

describe("TwitterClient.getBookmarkFolders", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls correct folders endpoint", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "f1", name: "AI" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeOAuth2UserClient();
    const result = await tc.getBookmarkFolders("me1");

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("AI");
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/2/users/me1/bookmarks/folders");
  });
});

// --- getBookmarksByFolder tests ---

describe("TwitterClient.getBookmarksByFolder", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls correct folder endpoint with folder id", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "t1", text: "folder tweet" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeOAuth2UserClient();
    const result = await tc.getBookmarksByFolder("me1", "folder123");

    expect(result.data).toHaveLength(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/2/users/me1/bookmarks/folders/folder123");
  });
});

// --- filterBookmarks tests ---

describe("TwitterClient.filterBookmarks", () => {
  const tc = new TwitterClient({});

  const sampleResponse = {
    data: [
      { id: "1", text: "AI税理士の未来", author_id: "a1" },
      { id: "2", text: "freeeの使い方", author_id: "a2" },
      { id: "3", text: "M&Aの基本", author_id: "a1" },
    ] as any[],
    includes: {
      users: [
        { id: "a1", name: "税理士太郎", username: "tax_taro" },
        { id: "a2", name: "経理花子", username: "keiri_hanako" },
      ],
    },
    meta: { result_count: 3 },
  };

  it("filters by text field using regex", () => {
    const result = tc.filterBookmarks(sampleResponse, "税理士", { field: "text" });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("1");
  });

  it("filters by author field", () => {
    const result = tc.filterBookmarks(sampleResponse, "tax_taro", { field: "author" });
    expect(result.data).toHaveLength(2);
  });

  it("filters by all fields (default)", () => {
    const result = tc.filterBookmarks(sampleResponse, "税理士");
    expect(result.data).toHaveLength(2); // "AI税理士の未来" + author "税理士太郎"
  });

  it("supports case-insensitive search", () => {
    const result = tc.filterBookmarks(sampleResponse, "FREEE", { ignoreCase: true });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("2");
  });

  it("supports plain pattern matching", () => {
    const result = tc.filterBookmarks(sampleResponse, "M&A", { plainPattern: true });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("3");
  });

  it("filters by url field", () => {
    const result = tc.filterBookmarks(sampleResponse, "status/2", { field: "url" });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("2");
  });

  it("returns empty data when no matches", () => {
    const result = tc.filterBookmarks(sampleResponse, "zzzznotfound");
    expect(result.data).toHaveLength(0);
    expect(result.meta.result_count).toBe(0);
  });
});

describe("TwitterClient.getTweetById", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls GET /2/tweets/:id with default tweet.fields and expansions", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "111",
            text: "hello",
            conversation_id: "111",
            referenced_tweets: [{ type: "replied_to", id: "999" }],
          },
        }),
        { status: 200 },
      ),
    );

    const tc = makeBearerClient();
    const result = await tc.getTweetById("111");

    expect(result.data.id).toBe("111");
    expect(result.data.conversation_id).toBe("111");
    expect(result.data.referenced_tweets?.[0].id).toBe("999");

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/2/tweets/111");
    expect(url).toContain("tweet.fields=");
    expect(url).toContain("conversation_id");
    expect(url).toContain("referenced_tweets");
    expect(url).toContain("expansions=");
  });

  it("respects custom tweetFields and expansions", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "1" } }), { status: 200 }),
    );

    const tc = makeBearerClient();
    await tc.getTweetById("1", {
      tweetFields: ["id", "text"],
      expansions: ["author_id"],
    });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("tweet.fields=id%2Ctext");
    expect(url).toContain("expansions=author_id");
  });

  it("includes referenced tweets and users in includes", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { id: "111", text: "reply" },
          includes: {
            tweets: [{ id: "999", text: "parent" }],
            users: [{ id: "u1", username: "alice" }],
          },
        }),
        { status: 200 },
      ),
    );

    const tc = makeBearerClient();
    const result = await tc.getTweetById("111");
    expect(result.includes?.tweets?.[0].id).toBe("999");
    expect(result.includes?.users?.[0].username).toBe("alice");
  });

  it("throws for non-numeric tweet id", async () => {
    const tc = makeBearerClient();
    await expect(tc.getTweetById("not-a-number")).rejects.toThrow(/tweet id/i);
  });

  it("supports oauth1 auth mode", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "1" } }), { status: 200 }),
    );
    const tc = makeClient();
    await tc.getTweetById("1", { auth: "oauth1" });
    const call = fetchSpy.mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(/^OAuth /);
  });
});

describe("TwitterClient.searchRecent", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls GET /2/tweets/search/recent with query", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "1", text: "match" }],
          meta: { result_count: 1, newest_id: "1", oldest_id: "1" },
        }),
        { status: 200 },
      ),
    );

    const tc = makeBearerClient();
    const result = await tc.searchRecent("conversation_id:123");

    expect(result.data?.[0].id).toBe("1");
    expect(result.meta.result_count).toBe(1);

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/2/tweets/search/recent");
    expect(url).toContain("query=conversation_id%3A123");
  });

  it("rejects empty query", async () => {
    const tc = makeBearerClient();
    await expect(tc.searchRecent("")).rejects.toThrow(/query/i);
  });

  it("passes maxResults, paginationToken, startTime", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { result_count: 0 } }), { status: 200 }),
    );
    const tc = makeBearerClient();
    await tc.searchRecent("hello", {
      maxResults: 50,
      paginationToken: "abc",
      startTime: "2026-01-01T00:00:00Z",
    });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("max_results=50");
    expect(url).toContain("next_token=abc");
    expect(url).toContain("start_time=2026-01-01T00%3A00%3A00Z");
  });
});

describe("TwitterClient.getConversation", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches root tweet then searches by conversation_id", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: "555",
              text: "reply in thread",
              conversation_id: "100",
              created_at: "2026-05-25T10:01:00Z",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { id: "555", text: "reply in thread", created_at: "2026-05-25T10:01:00Z" },
              { id: "100", text: "root", created_at: "2026-05-25T10:00:00Z" },
            ],
            meta: { result_count: 2, newest_id: "555", oldest_id: "100" },
          }),
          { status: 200 },
        ),
      );

    const tc = makeBearerClient();
    const result = await tc.getConversation("555");

    expect(result.conversation_id).toBe("100");
    expect(result.tweets).toHaveLength(2);
    expect(result.tweets[0].id).toBe("100");
    expect(result.tweets[1].id).toBe("555");
    expect(result.root?.id).toBe("100");

    const searchUrl = String(fetchSpy.mock.calls[1][0]);
    expect(searchUrl).toContain("query=conversation_id%3A100");
  });

  it("accepts a tweet URL", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: "777",
              conversation_id: "777",
              text: "solo",
              created_at: "2026-05-25T10:00:00Z",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: "777", text: "solo", created_at: "2026-05-25T10:00:00Z" }],
            meta: { result_count: 1 },
          }),
          { status: 200 },
        ),
      );
    const tc = makeBearerClient();
    const result = await tc.getConversation("https://x.com/foo/status/777");
    expect(result.conversation_id).toBe("777");
    expect(result.tweets).toHaveLength(1);
  });

  it("returns partial=false and meta.result_count", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { id: "1", conversation_id: "1", created_at: "2026-05-25T10:00:00Z" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ id: "1", created_at: "2026-05-25T10:00:00Z" }],
            meta: { result_count: 1 },
          }),
          { status: 200 },
        ),
      );
    const tc = makeBearerClient();
    const result = await tc.getConversation("1");
    expect(result.meta.partial).toBe(false);
    expect(result.meta.result_count).toBe(1);
  });
});

describe("TwitterClient.getMentions", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls GET /2/users/:id/mentions with userId", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "m1", text: "@me hello" }],
          meta: { result_count: 1 },
        }),
        { status: 200 },
      ),
    );

    const tc = makeBearerClient();
    const result = await tc.getMentions("123");

    expect(result.data?.[0].id).toBe("m1");
    expect(result.meta.result_count).toBe(1);

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/2/users/123/mentions");
  });

  it("passes maxResults and paginationToken as query params", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { result_count: 0 } }), { status: 200 }),
    );
    const tc = makeBearerClient();
    await tc.getMentions("456", { maxResults: 20, paginationToken: "tok123" });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("max_results=20");
    expect(url).toContain("pagination_token=tok123");
  });

  it("does not include organic_metrics or non_public_metrics in tweet.fields (403 guard)", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { result_count: 0 } }), { status: 200 }),
    );
    const tc = makeBearerClient();
    await tc.getMentions("789");
    const url = String(fetchSpy.mock.calls[0][0]);
    // organic_metrics/non_public_metrics require OAuth1.0a User Context and cause 403
    // with Bearer token, so MENTIONS_TWEET_FIELDS excludes them
    expect(url).not.toContain("organic_metrics");
    expect(url).not.toContain("non_public_metrics");
    expect(url).toContain("tweet.fields");
    expect(url).toContain("public_metrics");
  });
});

describe("TwitterClient.getMentionsCount", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("collects multiple pages until count is reached", async () => {
    const page1 = { data: [{ id: "m1", text: "a" }, { id: "m2", text: "b" }], meta: { result_count: 2, next_token: "tok2" } };
    const page2 = { data: [{ id: "m3", text: "c" }], meta: { result_count: 1 } };
    fetchSpy
      .mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page2), { status: 200 }));

    const tc = makeBearerClient();
    const result = await tc.getMentionsCount("123", { count: 3 });

    expect(result.data).toHaveLength(3);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.meta.result_count).toBe(3);
  });

  it("stops early when count is satisfied within first page", async () => {
    const page1 = { data: [{ id: "m1", text: "a" }, { id: "m2", text: "b" }, { id: "m3", text: "c" }], meta: { result_count: 3, next_token: "tok2" } };
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(page1), { status: 200 }));

    const tc = makeBearerClient();
    const result = await tc.getMentionsCount("123", { count: 2 });

    expect(result.data).toHaveLength(2);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("TwitterClient.getDmEvents", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls GET /2/dm_events with OAuth1.0a", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "e1", text: "hello DM", event_type: "MessageCreate" }],
          meta: { result_count: 1 },
        }),
        { status: 200 },
      ),
    );

    const tc = makeClient();
    const result = await tc.getDmEvents();

    expect(result.data?.[0].id).toBe("e1");
    expect(result.meta.result_count).toBe(1);

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/2/dm_events");

    const headers = (fetchSpy.mock.calls[0][1]?.headers ?? {}) as Record<string, string>;
    expect(headers["Authorization"] ?? headers["authorization"]).toMatch(/^OAuth /);
  });

  it("passes maxResults and paginationToken", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { result_count: 0 } }), { status: 200 }),
    );
    const tc = makeClient();
    await tc.getDmEvents({ maxResults: 25, paginationToken: "pageXYZ" });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("max_results=25");
    expect(url).toContain("pagination_token=pageXYZ");
  });

  it("throws with 'Requires Elevated/paid tier access' on 403", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ title: "Forbidden", detail: "Access denied" }), { status: 403 }),
    );
    const tc = makeClient();
    await expect(tc.getDmEvents()).rejects.toThrow(/Requires Elevated\/paid tier access/);
  });

  it("throws with 'Requires Elevated/paid tier access' on 401", async () => {
    fetchSpy.mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );
    const tc = makeClient();
    await expect(tc.getDmEvents()).rejects.toThrow(/Requires Elevated\/paid tier access/);
  });
});

// --- getDmEvents additional tests (P1/P3) ---
describe("TwitterClient.getDmEvents - dm_event.fields and params", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { result_count: 0 } }), { status: 200 }),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes dm_event.fields with sender_id, created_at, dm_conversation_id by default", async () => {
    const tc = makeClient();
    await tc.getDmEvents();
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("dm_event.fields=");
    expect(url).toContain("sender_id");
    expect(url).toContain("created_at");
    expect(url).toContain("dm_conversation_id");
  });

  it("allows caller to override dm_event.fields via opts", async () => {
    const tc = makeClient();
    await tc.getDmEvents({ dmEventFields: "id,text" });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("dm_event.fields=id%2Ctext");
  });

  it("includes event_types query param when specified", async () => {
    const tc = makeClient();
    await tc.getDmEvents({ eventTypes: "MessageCreate" });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("event_types=MessageCreate");
  });

  it("includes dm_conversation_id query param when specified", async () => {
    const tc = makeClient();
    await tc.getDmEvents({ dmConversationId: "conv-abc123" });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("dm_conversation_id=conv-abc123");
  });

  it("includes Elevated hint on 403 with retry-after annotation", async () => {
    // When retry-after header is present, error msg is "X API error 403 (retry-after: 60s): ..."
    // The replace regex /^X API error (401|403):/ would NOT match this format — test drives the fix
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ title: "Forbidden", detail: "Access denied" }),
        {
          status: 403,
          headers: { "retry-after": "60" },
        },
      ),
    );
    const tc = makeClient();
    const err = await tc.getDmEvents().catch((e) => e);
    expect(err.message).toMatch(/Requires Elevated\/paid tier access/);
    // Hint must appear even though message starts with "X API error 403 (retry-after: 60s):"
    expect(err.message).toContain("retry-after");
  });

  it("includes Elevated hint on 401 with retry-after annotation in message", async () => {
    // Simulate error message that looks like "X API error 403 (retry-after: 60s): ..."
    fetchSpy.mockResolvedValue(
      new Response("Unauthorized with retry-after: 60s", { status: 401 }),
    );
    const tc = makeClient();
    await expect(tc.getDmEvents()).rejects.toThrow(/Requires Elevated\/paid tier access/);
  });
});


describe("TwitterClient.updateProfile", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockUserResponse(overrides: Record<string, unknown> = {}) {
    return new Response(
      JSON.stringify({
        screen_name: "3chhe",
        name: "Yusuke",
        description: "new bio",
        location: "Tokyo",
        url: "https://t.co/abc",
        entities: { url: { urls: [{ expanded_url: "https://example.com" }] } },
        ...overrides,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  it("POSTs to /1.1/account/update_profile.json with form-encoded bio", async () => {
    fetchSpy.mockResolvedValue(mockUserResponse());
    const tc = makeClient();
    await tc.updateProfile({ bio: "new bio" });

    const call = fetchSpy.mock.calls[0];
    expect(String(call[0])).toBe("https://api.twitter.com/1.1/account/update_profile.json");
    expect(call[1]?.method).toBe("POST");
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(headers["Authorization"] ?? headers["authorization"]).toMatch(/^OAuth /);
    const body = new URLSearchParams(String(call[1]?.body));
    expect(body.get("description")).toBe("new bio");
    expect(body.has("name")).toBe(false);
  });

  it("sends only provided fields (name + location)", async () => {
    fetchSpy.mockResolvedValue(mockUserResponse());
    const tc = makeClient();
    await tc.updateProfile({ name: "Taro", location: "Osaka" });
    const body = new URLSearchParams(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.get("name")).toBe("Taro");
    expect(body.get("location")).toBe("Osaka");
    expect(body.has("description")).toBe(false);
    expect(body.has("url")).toBe(false);
  });

  it("percent-encodes spaces as %20 in body (OAuth-consistent, not +)", async () => {
    fetchSpy.mockResolvedValue(mockUserResponse());
    const tc = makeClient();
    await tc.updateProfile({ bio: "hello world" });
    const rawBody = String(fetchSpy.mock.calls[0][1]?.body);
    expect(rawBody).toContain("description=hello%20world");
    expect(rawBody).not.toContain("+");
  });

  it("maps url to form param 'url'", async () => {
    fetchSpy.mockResolvedValue(mockUserResponse());
    const tc = makeClient();
    await tc.updateProfile({ url: "https://example.com" });
    const body = new URLSearchParams(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.get("url")).toBe("https://example.com");
  });

  it("returns normalized profile (prefers entities expanded_url)", async () => {
    fetchSpy.mockResolvedValue(mockUserResponse());
    const tc = makeClient();
    const result = await tc.updateProfile({ bio: "new bio" });
    expect(result.screenName).toBe("3chhe");
    expect(result.name).toBe("Yusuke");
    expect(result.description).toBe("new bio");
    expect(result.location).toBe("Tokyo");
    expect(result.url).toBe("https://example.com");
  });

  it("falls back to url field when entities absent", async () => {
    fetchSpy.mockResolvedValue(mockUserResponse({ entities: undefined, url: "https://t.co/xyz" }));
    const tc = makeClient();
    const result = await tc.updateProfile({ bio: "x" });
    expect(result.url).toBe("https://t.co/xyz");
  });

  it("throws when no fields provided", async () => {
    const tc = makeClient();
    await expect(tc.updateProfile({})).rejects.toThrow(/at least one/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws when bio exceeds 160 chars", async () => {
    const tc = makeClient();
    await expect(tc.updateProfile({ bio: "a".repeat(161) })).rejects.toThrow(/160/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws when name exceeds 50 chars", async () => {
    const tc = makeClient();
    await expect(tc.updateProfile({ name: "a".repeat(51) })).rejects.toThrow(/50/);
  });

  it("throws when location exceeds 30 chars", async () => {
    const tc = makeClient();
    await expect(tc.updateProfile({ location: "a".repeat(31) })).rejects.toThrow(/30/);
  });

  it("throws when url exceeds 100 chars", async () => {
    const tc = makeClient();
    await expect(tc.updateProfile({ url: "h".repeat(101) })).rejects.toThrow(/100/);
  });

  it("annotates 403 with elevated/paid tier hint", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "no" }] }), { status: 403 }),
    );
    const tc = makeClient();
    await expect(tc.updateProfile({ bio: "x" })).rejects.toThrow(/Elevated|paid tier/i);
  });

  it("requires OAuth1 credentials", async () => {
    const tc = makeBearerClient();
    await expect(tc.updateProfile({ bio: "x" })).rejects.toThrow();
  });
});

describe("TwitterClient.buildProfileParams (dry-run helper)", () => {
  it("maps bio to description", () => {
    const tc = makeClient();
    expect(tc.buildProfileParams({ bio: "hi" })).toEqual({ description: "hi" });
  });
  it("includes all provided fields", () => {
    const tc = makeClient();
    expect(tc.buildProfileParams({ name: "N", bio: "B", url: "U", location: "L" })).toEqual({
      name: "N",
      description: "B",
      url: "U",
      location: "L",
    });
  });
  it("throws when empty", () => {
    const tc = makeClient();
    expect(() => tc.buildProfileParams({})).toThrow(/at least one/i);
  });
  it("throws when bio too long", () => {
    const tc = makeClient();
    expect(() => tc.buildProfileParams({ bio: "a".repeat(161) })).toThrow(/160/);
  });
});

describe("TwitterClient.getHomeTimeline", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls reverse_chronological with OAuth1 by default and supports exclude/max_results", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ id: "t1", text: "hi" }], meta: { result_count: 1 } }),
        { status: 200 },
      ),
    );

    const tc = makeClient(); // oauth1 creds
    await tc.getHomeTimeline("u123", { maxResults: 10, exclude: ["retweets", "replies"] });

    const call = fetchSpy.mock.calls[0];
    const url = call[0] as string;
    expect(url).toContain("/2/users/u123/timelines/reverse_chronological");
    expect(url).toContain("exclude=retweets%2Creplies");
    expect(url).toContain("max_results=10");
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^OAuth /);
  });

  it("throws on 403 (App-only Bearer is forbidden for this endpoint)", async () => {
    fetchSpy.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    const tc = makeBearerClient();
    await expect(tc.getHomeTimeline("u123", { auth: "bearer" })).rejects.toThrow(/403/);
  });
});

// ============================================================
// TwitterClient.getProfileBanner
// ============================================================
describe("TwitterClient.getProfileBanner", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockBannerResponse(overrides: Record<string, unknown> = {}) {
    return new Response(
      JSON.stringify({
        sizes: {
          "1500x500": {
            h: 500,
            w: 1500,
            url: "https://pbs.twimg.com/profile_banners/123/456/1500x500",
          },
          "1080x360": {
            h: 360,
            w: 1080,
            url: "https://pbs.twimg.com/profile_banners/123/456/1080x360",
          },
          "600x200": {
            h: 200,
            w: 600,
            url: "https://pbs.twimg.com/profile_banners/123/456/600x200",
          },
          "300x100": {
            h: 100,
            w: 300,
            url: "https://pbs.twimg.com/profile_banners/123/456/300x100",
          },
        },
        ...overrides,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  it("GETs /1.1/users/profile_banner.json with screen_name query param", async () => {
    fetchSpy.mockResolvedValue(mockBannerResponse());
    const tc = makeClient();
    await tc.getProfileBanner("testuser");
    const call = fetchSpy.mock.calls[0];
    const url = new URL(String(call[0]));
    expect(url.pathname).toBe("/1.1/users/profile_banner.json");
    expect(url.searchParams.get("screen_name")).toBe("testuser");
  });

  it("uses OAuth1.0a Authorization header", async () => {
    fetchSpy.mockResolvedValue(mockBannerResponse());
    const tc = makeClient();
    await tc.getProfileBanner("testuser");
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"] ?? headers["authorization"]).toMatch(/^OAuth /);
  });

  it("returns normalized BannerResult with sizes map", async () => {
    fetchSpy.mockResolvedValue(mockBannerResponse());
    const tc = makeClient();
    const result = await tc.getProfileBanner("testuser");
    expect(result.hasBanner).toBe(true);
    expect(result.sizes["1500x500"]).toBe("https://pbs.twimg.com/profile_banners/123/456/1500x500");
    expect(result.sizes["1080x360"]).toBe("https://pbs.twimg.com/profile_banners/123/456/1080x360");
    expect(result.sizes["600x200"]).toBe("https://pbs.twimg.com/profile_banners/123/456/600x200");
    expect(result.sizes["300x100"]).toBe("https://pbs.twimg.com/profile_banners/123/456/300x100");
  });

  it("returns hasBanner=false on 404 (no banner set)", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "Sorry, that page does not exist." }] }), { status: 404 }),
    );
    const tc = makeClient();
    const result = await tc.getProfileBanner("nobanner");
    expect(result.hasBanner).toBe(false);
    expect(Object.keys(result.sizes)).toHaveLength(0);
  });

  it("throws on 401 with Elevated/paid tier hint", async () => {
    fetchSpy.mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );
    const tc = makeClient();
    await expect(tc.getProfileBanner("testuser")).rejects.toThrow(/Elevated|paid tier/i);
  });

  it("throws on 403 with Elevated/paid tier hint", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "Forbidden" }] }), { status: 403 }),
    );
    const tc = makeClient();
    await expect(tc.getProfileBanner("testuser")).rejects.toThrow(/Elevated|paid tier/i);
  });

  it("requires OAuth1 credentials", async () => {
    const tc = makeBearerClient();
    await expect(tc.getProfileBanner("testuser")).rejects.toThrow();
  });
});

// ============================================================
// TwitterClient.updateProfileBanner
// ============================================================
describe("TwitterClient.updateProfileBanner", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to /1.1/account/update_profile_banner.json", async () => {
    fetchSpy.mockResolvedValue(new Response("", { status: 200 }));
    const tc = makeClient();
    await tc.updateProfileBanner("base64data==");
    const call = fetchSpy.mock.calls[0];
    expect(String(call[0])).toBe("https://api.twitter.com/1.1/account/update_profile_banner.json");
    expect(call[1]?.method).toBe("POST");
  });

  it("sends banner= in form-encoded body", async () => {
    fetchSpy.mockResolvedValue(new Response("", { status: 200 }));
    const tc = makeClient();
    await tc.updateProfileBanner("base64data==");
    const rawBody = String(fetchSpy.mock.calls[0][1]?.body);
    expect(rawBody).toBe(`banner=${encodeURIComponent("base64data==")}`);
  });

  it("uses OAuth Authorization header without banner in signature (no body params passed)", async () => {
    // The critical gotcha: buildOAuthHeader("POST", url) called WITHOUT body params
    // so the banner is NOT included in the OAuth signature base string.
    // We verify this by checking the Authorization header is OAuth, and the
    // signature was built without banner (impossible to verify the exact signature,
    // but we can spy on buildOAuthHeader behavior by checking no body params leak in).
    // The key test: calling updateProfileBanner should NOT pass banner to buildOAuthHeader.
    // We verify indirectly: if banner WERE included in signature, buildOAuthHeader would
    // receive a requestParams object; without it, the OAuth header does not contain "banner".
    fetchSpy.mockResolvedValue(new Response("", { status: 200 }));
    const tc = makeClient();
    await tc.updateProfileBanner("base64data==");
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    const auth = headers["Authorization"] ?? headers["authorization"];
    expect(auth).toMatch(/^OAuth /);
    // The OAuth header must NOT contain "banner" as a signed parameter
    expect(auth).not.toContain("banner");
  });

  it("succeeds on 201 response (created)", async () => {
    fetchSpy.mockResolvedValue(new Response("", { status: 201 }));
    const tc = makeClient();
    await expect(tc.updateProfileBanner("imgdata")).resolves.toBeUndefined();
  });

  it("throws on 403 with Elevated/paid tier hint", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "Forbidden" }] }), { status: 403 }),
    );
    const tc = makeClient();
    await expect(tc.updateProfileBanner("base64data")).rejects.toThrow(/Elevated|paid tier/i);
  });

  it("throws on 401 with Elevated/paid tier hint", async () => {
    fetchSpy.mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );
    const tc = makeClient();
    await expect(tc.updateProfileBanner("base64data")).rejects.toThrow(/Elevated|paid tier/i);
  });

  it("requires OAuth1 credentials", async () => {
    const tc = makeBearerClient();
    await expect(tc.updateProfileBanner("base64data")).rejects.toThrow();
  });

  it("validates image size: throws when base64 > 5MB decoded", async () => {
    // 5MB = 5 * 1024 * 1024 bytes. base64 is 4/3 ratio, so >6.67MB base64 string.
    // We check the validator by passing an over-limit base64 string.
    const oversized = "A".repeat(Math.ceil((5 * 1024 * 1024 * 4) / 3) + 1); // base64 of >5MB image
    const tc = makeClient();
    await expect(tc.updateProfileBanner(oversized)).rejects.toThrow(/5MB|size/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("validates image extension via validateBannerImage", async () => {
    const tc = makeClient();
    await expect(tc.updateProfileBanner("data", "bmp")).rejects.toThrow(/extension|format|jpg|jpeg|png|webp|gif/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ============================================================
// TwitterClient.removeProfileBanner
// ============================================================
describe("TwitterClient.removeProfileBanner", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to /1.1/account/remove_profile_banner.json", async () => {
    fetchSpy.mockResolvedValue(new Response("", { status: 200 }));
    const tc = makeClient();
    await tc.removeProfileBanner();
    const call = fetchSpy.mock.calls[0];
    expect(String(call[0])).toBe("https://api.twitter.com/1.1/account/remove_profile_banner.json");
    expect(call[1]?.method).toBe("POST");
  });

  it("uses OAuth Authorization header", async () => {
    fetchSpy.mockResolvedValue(new Response("", { status: 200 }));
    const tc = makeClient();
    await tc.removeProfileBanner();
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"] ?? headers["authorization"]).toMatch(/^OAuth /);
  });

  it("throws on 403 with Elevated/paid tier hint", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "Forbidden" }] }), { status: 403 }),
    );
    const tc = makeClient();
    await expect(tc.removeProfileBanner()).rejects.toThrow(/Elevated|paid tier/i);
  });

  it("requires OAuth1 credentials", async () => {
    const tc = makeBearerClient();
    await expect(tc.removeProfileBanner()).rejects.toThrow();
  });
});

// --- getFollowers tests ---

describe("TwitterClient.getFollowers", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls correct endpoint with user id", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "1", username: "follower1" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getFollowers("12345");

    expect(result.data).toHaveLength(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/2/users/12345/followers");
  });

  it("sends pagination_token as query param", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "2", username: "follower2" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    await tc.getFollowers("12345", { paginationToken: "tok123" });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("pagination_token=tok123");
  });

  it("sends max_results as query param", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "3", username: "follower3" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    await tc.getFollowers("12345", { maxResults: 200 });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("max_results=200");
  });
});

// --- getAllFollowers tests ---

describe("TwitterClient.getAllFollowers", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("follows next_token across multiple pages", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "1", username: "a" }],
          meta: { result_count: 1, next_token: "page2" },
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          data: [{ id: "2", username: "b" }],
          meta: { result_count: 1 },
        }), { status: 200 }),
      );

    const tc = makeBearerClient();
    const result = await tc.getAllFollowers("12345");

    expect(result.data).toHaveLength(2);
    expect(result.meta.result_count).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("respects limitPages", async () => {
    const makeRes = (nextToken?: string) =>
      new Response(JSON.stringify({
        data: [{ id: "x", username: "x" }],
        meta: { result_count: 1, ...(nextToken ? { next_token: nextToken } : {}) },
      }), { status: 200 });

    fetchSpy
      .mockResolvedValueOnce(makeRes("p2"))
      .mockResolvedValueOnce(makeRes("p3"))
      .mockResolvedValueOnce(makeRes());

    const tc = makeBearerClient();
    const result = await tc.getAllFollowers("12345", { limitPages: 2 });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.data).toHaveLength(2);
  });
});

// --- getOwnedLists tests ---

describe("TwitterClient.getOwnedLists", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls correct endpoint with user id", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "list1", name: "My List" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getOwnedLists("12345");

    expect(result.data).toHaveLength(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/2/users/12345/owned_lists");
  });

  it("sends list.fields as query param", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "list1", name: "My List", description: "desc" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    await tc.getOwnedLists("12345", { listFields: ["id", "name", "description"] });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("list.fields=");
    expect(url).toContain("description");
  });

  it("uses bearer auth by default", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [],
        meta: { result_count: 0 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    await tc.getOwnedLists("12345");

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^Bearer /);
  });
});

// --- getListTweets tests ---

describe("TwitterClient.getListTweets", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls correct endpoint with list id", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "t1", text: "hello" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getListTweets("list99");

    expect(result.data).toHaveLength(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/2/lists/list99/tweets");
  });

  it("sends tweet.fields and max_results", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [],
        meta: { result_count: 0 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    await tc.getListTweets("list99", { tweetFields: ["id", "text", "created_at"], maxResults: 50 });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("tweet.fields=");
    expect(url).toContain("max_results=50");
  });
});

// --- getListMembers tests ---

describe("TwitterClient.getListMembers", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls correct endpoint with list id", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ id: "u1", username: "user1" }],
        meta: { result_count: 1 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getListMembers("list99");

    expect(result.data).toHaveLength(1);
    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("/2/lists/list99/members");
  });

  it("sends user.fields as query param", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        data: [],
        meta: { result_count: 0 },
      }), { status: 200 }),
    );

    const tc = makeBearerClient();
    await tc.getListMembers("list99", { userFields: ["username", "name", "public_metrics"] });

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain("user.fields=");
  });
});

// --- deleteTweet tests ---

describe("TwitterClient.deleteTweet", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls DELETE /2/tweets/:id and returns deleted=true", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { deleted: true } }), { status: 200 }),
    );

    const tc = makeClient();
    const result = await tc.deleteTweet("99999");

    expect(result.deleted).toBe(true);
    const call = fetchSpy.mock.calls[0];
    expect(String(call[0])).toContain("/2/tweets/99999");
    expect(call[1]?.method).toBe("DELETE");
  });

  it("uses OAuth Authorization header", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { deleted: true } }), { status: 200 }),
    );

    const tc = makeClient();
    await tc.deleteTweet("12345");

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"] ?? headers["authorization"]).toMatch(/^OAuth /);
  });

  it("throws on API error (e.g. 403)", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "Forbidden" }] }), { status: 403 }),
    );

    const tc = makeClient();
    await expect(tc.deleteTweet("12345")).rejects.toThrow("X API error 403");
  });

  it("requires OAuth1 credentials", async () => {
    const tc = makeBearerClient();
    await expect(tc.deleteTweet("12345")).rejects.toThrow(/OAuth 1.0a credentials/);
  });
});

// ============================================================
// TwitterClient.uploadMedia (chunked upload)
// ============================================================
describe("TwitterClient.uploadMedia", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helpers to create mock INIT / FINALIZE responses
  function mockInitResponse(mediaId = "media_111") {
    return new Response(
      JSON.stringify({ media_id_string: mediaId, expires_after_secs: 86400 }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  function mockFinalizeResponse(mediaId = "media_111", processingInfo?: { state: string; check_after_secs?: number; progress_percent?: number }) {
    const body: Record<string, unknown> = { media_id_string: mediaId, size: 1024 };
    if (processingInfo) body.processing_info = processingInfo;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  function mockStatusResponse(mediaId: string, state: string, checkAfterSecs = 1) {
    return new Response(
      JSON.stringify({
        media_id_string: mediaId,
        processing_info: { state, check_after_secs: checkAfterSecs, progress_percent: 50 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  it("sends INIT, APPEND, FINALIZE in order and returns media_id_string", async () => {
    // We need a real temp file for this test
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmp = join(tmpdir(), "test-upload.jpg");
    writeFileSync(tmp, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01])); // small JPEG

    fetchSpy
      .mockResolvedValueOnce(mockInitResponse("media_111"))  // INIT
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 })) // APPEND
      .mockResolvedValueOnce(mockFinalizeResponse("media_111")); // FINALIZE

    try {
      const tc = makeClient();
      const result = await tc.uploadMedia(tmp);
      expect(result).toBe("media_111");

      expect(fetchSpy).toHaveBeenCalledTimes(3);

      // INIT: command=INIT
      const initCall = fetchSpy.mock.calls[0];
      expect(String(initCall[0])).toContain("/2/media/upload");
      const initBody = new URLSearchParams(String(initCall[1]?.body));
      expect(initBody.get("command")).toBe("INIT");
      expect(initBody.get("media_type")).toBe("image/jpeg");
      expect(initBody.get("media_category")).toBe("tweet_image");
      expect(Number(initBody.get("total_bytes"))).toBeGreaterThan(0);

      // APPEND: command=APPEND with multipart
      const appendCall = fetchSpy.mock.calls[1];
      expect(String(appendCall[0])).toContain("/2/media/upload");
      const appendHeaders = appendCall[1]?.headers as Record<string, string>;
      expect(appendHeaders["Authorization"]).toMatch(/^OAuth /);

      // FINALIZE: command=FINALIZE
      const finalizeCall = fetchSpy.mock.calls[2];
      expect(String(finalizeCall[0])).toContain("/2/media/upload");
      const finalizeBody = new URLSearchParams(String(finalizeCall[1]?.body));
      expect(finalizeBody.get("command")).toBe("FINALIZE");
      expect(finalizeBody.get("media_id")).toBe("media_111");
    } finally {
      unlinkSync(tmp);
    }
  });

  it("polls STATUS when FINALIZE returns processing_info with state=pending", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmp = join(tmpdir(), "test-upload-video.mp4");
    writeFileSync(tmp, Buffer.from([0x00, 0x00, 0x00, 0x00, 0x66, 0x74, 0x79, 0x70])); // fake mp4

    fetchSpy
      .mockResolvedValueOnce(mockInitResponse("media_222"))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(mockFinalizeResponse("media_222", { state: "pending", check_after_secs: 1 }))
      .mockResolvedValueOnce(mockStatusResponse("media_222", "in_progress", 1))
      .mockResolvedValueOnce(mockStatusResponse("media_222", "succeeded"));

    try {
      const tc = makeClient();
      const result = await tc.uploadMedia(tmp);
      expect(result).toBe("media_222");

      // Should have called STATUS twice (in_progress → succeeded)
      expect(fetchSpy).toHaveBeenCalledTimes(5);

      // STATUS calls
      const statusCall = fetchSpy.mock.calls[3];
      const statusUrl = new URL(String(statusCall[0]));
      expect(statusUrl.searchParams.get("command")).toBe("STATUS");
      expect(statusUrl.searchParams.get("media_id")).toBe("media_222");
    } finally {
      unlinkSync(tmp);
    }
  });

  it("throws when FINALIZE processing_info.state=failed", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmp = join(tmpdir(), "test-upload-fail.mp4");
    writeFileSync(tmp, Buffer.from([0x00, 0x00, 0x00, 0x01]));

    fetchSpy
      .mockResolvedValueOnce(mockInitResponse("media_333"))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(mockFinalizeResponse("media_333", { state: "failed" }));

    try {
      const tc = makeClient();
      await expect(tc.uploadMedia(tmp)).rejects.toThrow(/failed|processing/i);
    } finally {
      unlinkSync(tmp);
    }
  });

  it("throws when file does not exist", async () => {
    const tc = makeClient();
    await expect(tc.uploadMedia("/nonexistent/path/file.jpg")).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("detects media_type and media_category from extension: png → tweet_image", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmp = join(tmpdir(), "test-upload.png");
    writeFileSync(tmp, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    fetchSpy
      .mockResolvedValueOnce(mockInitResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(mockFinalizeResponse());

    try {
      const tc = makeClient();
      await tc.uploadMedia(tmp);
      const initBody = new URLSearchParams(String(fetchSpy.mock.calls[0][1]?.body));
      expect(initBody.get("media_type")).toBe("image/png");
      expect(initBody.get("media_category")).toBe("tweet_image");
    } finally {
      unlinkSync(tmp);
    }
  });

  it("detects media_type and media_category from extension: gif → tweet_gif", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmp = join(tmpdir(), "test-upload.gif");
    writeFileSync(tmp, Buffer.from([0x47, 0x49, 0x46, 0x38]));

    fetchSpy
      .mockResolvedValueOnce(mockInitResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(mockFinalizeResponse());

    try {
      const tc = makeClient();
      await tc.uploadMedia(tmp);
      const initBody = new URLSearchParams(String(fetchSpy.mock.calls[0][1]?.body));
      expect(initBody.get("media_type")).toBe("image/gif");
      expect(initBody.get("media_category")).toBe("tweet_gif");
    } finally {
      unlinkSync(tmp);
    }
  });

  it("detects media_type and media_category from extension: mp4 → tweet_video", async () => {
    const { writeFileSync, unlinkSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const tmp = join(tmpdir(), "test-upload.mp4");
    writeFileSync(tmp, Buffer.from([0x00, 0x00, 0x00, 0x01]));

    fetchSpy
      .mockResolvedValueOnce(mockInitResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
      .mockResolvedValueOnce(mockFinalizeResponse());

    try {
      const tc = makeClient();
      await tc.uploadMedia(tmp);
      const initBody = new URLSearchParams(String(fetchSpy.mock.calls[0][1]?.body));
      expect(initBody.get("media_type")).toBe("video/mp4");
      expect(initBody.get("media_category")).toBe("tweet_video");
    } finally {
      unlinkSync(tmp);
    }
  });

  it("requires OAuth1 credentials", async () => {
    const tc = makeBearerClient();
    await expect(tc.uploadMedia("/tmp/test.jpg")).rejects.toThrow(/OAuth 1.0a credentials/);
  });
});

// ============================================================
// TwitterClient.postTweet with mediaIds (extension)
// ============================================================
describe("TwitterClient.postTweet with mediaIds", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes media.media_ids in payload when mediaIds provided", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "111", text: "with media" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const tc = makeClient();
    await tc.postTweet({ text: "with media", mediaIds: ["media_abc", "media_def"] });

    const call = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(call[1]?.body));
    expect(body.media).toEqual({ media_ids: ["media_abc", "media_def"] });
  });

  it("does NOT include media in payload when mediaIds is not provided (backward compat)", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "222", text: "no media" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const tc = makeClient();
    await tc.postTweet({ text: "no media" });

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.media).toBeUndefined();
  });

  it("does NOT include media when mediaIds is empty array", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "333", text: "empty media" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const tc = makeClient();
    await tc.postTweet({ text: "empty media", mediaIds: [] });

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.media).toBeUndefined();
  });

  it("buildPostPayload includes media when mediaIds provided", () => {
    const tc = makeClient();
    const payload = tc.buildPostPayload({ text: "hi", mediaIds: ["m1"] });
    expect((payload as any).media).toEqual({ media_ids: ["m1"] });
  });

  it("buildPostPayload does NOT include media when mediaIds absent", () => {
    const tc = makeClient();
    const payload = tc.buildPostPayload({ text: "hi" });
    expect((payload as any).media).toBeUndefined();
  });
});

// ============================================================
// TwitterClient.validateBannerImage (validator helper)
// ============================================================
describe("TwitterClient.validateBannerImage", () => {
  it("accepts jpg extension", () => {
    const tc = makeClient();
    expect(() => tc.validateBannerImage("data", "jpg")).not.toThrow();
  });

  it("accepts jpeg extension", () => {
    const tc = makeClient();
    expect(() => tc.validateBannerImage("data", "jpeg")).not.toThrow();
  });

  it("accepts png extension", () => {
    const tc = makeClient();
    expect(() => tc.validateBannerImage("data", "png")).not.toThrow();
  });

  it("accepts webp extension", () => {
    const tc = makeClient();
    expect(() => tc.validateBannerImage("data", "webp")).not.toThrow();
  });

  it("accepts gif extension", () => {
    const tc = makeClient();
    expect(() => tc.validateBannerImage("data", "gif")).not.toThrow();
  });

  it("rejects bmp extension", () => {
    const tc = makeClient();
    expect(() => tc.validateBannerImage("data", "bmp")).toThrow(/extension|format|jpg|jpeg|png|webp|gif/i);
  });

  it("throws when base64 decoded size > 5MB", () => {
    const tc = makeClient();
    const oversized = "A".repeat(Math.ceil((5 * 1024 * 1024 * 4) / 3) + 1);
    expect(() => tc.validateBannerImage(oversized)).toThrow(/5MB|size/i);
  });

  it("accepts base64 between old(5M-char) and new(~7M) limit — proves the decoded-size fix", () => {
    const tc = makeClient();
    // 5M+1 chars = ~3.75MB decoded: valid, but the buggy 5M-char limit wrongly rejected it
    const justOverOldLimit = "A".repeat(5 * 1024 * 1024 + 1);
    expect(() => tc.validateBannerImage(justOverOldLimit)).not.toThrow();
  });

  it("does not throw for valid size under 5MB", () => {
    const tc = makeClient();
    const valid = "A".repeat(100);
    expect(() => tc.validateBannerImage(valid, "jpg")).not.toThrow();
  });
});

// ===================================================================
// M1a: getTweetsByIds
// ===================================================================

describe("TwitterClient.getTweetsByIds", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls GET /2/tweets?ids=... with bearer auth by default", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: "111", text: "tweet 1" },
            { id: "222", text: "tweet 2" },
          ],
        }),
        { status: 200 },
      ),
    );

    const tc = makeBearerClient();
    const result = await tc.getTweetsByIds(["111", "222"]);

    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe("111");

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/2/tweets");
    expect(url).toContain("ids=111%2C222");
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^Bearer /);
  });

  it("sends tweet.fields when specified", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "1" }] }), { status: 200 }),
    );
    const tc = makeBearerClient();
    await tc.getTweetsByIds(["1"], { tweetFields: ["created_at", "public_metrics"] });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("tweet.fields=created_at%2Cpublic_metrics");
  });

  it("sends expansions when specified", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "1" }] }), { status: 200 }),
    );
    const tc = makeBearerClient();
    await tc.getTweetsByIds(["1"], { expansions: ["author_id"] });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("expansions=author_id");
  });

  it("supports oauth1 auth mode", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "1" }] }), { status: 200 }),
    );
    const tc = makeClient();
    await tc.getTweetsByIds(["1"], { auth: "oauth1" });
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^OAuth /);
  });

  it("throws on non-2xx response", async () => {
    fetchSpy.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    const tc = makeBearerClient();
    await expect(tc.getTweetsByIds(["1"])).rejects.toThrow(/403/);
  });

  it("throws when ids array is empty", async () => {
    const tc = makeBearerClient();
    await expect(tc.getTweetsByIds([])).rejects.toThrow(/ids/i);
  });

  it("caps ids at 100 and throws when over limit", async () => {
    const tc = makeBearerClient();
    const ids = Array.from({ length: 101 }, (_, i) => String(i + 1));
    await expect(tc.getTweetsByIds(ids)).rejects.toThrow(/100/);
  });
});

// ===================================================================
// M1b: getTweetById with non_public_metrics / organic_metrics opts
// ===================================================================

describe("TwitterClient.getTweetById with metrics opts", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes non_public_metrics in tweet.fields when requested via opts", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "1",
            text: "hello",
            non_public_metrics: { impression_count: 100 },
          },
        }),
        { status: 200 },
      ),
    );

    const tc = makeClient();
    const result = await tc.getTweetById("1", {
      tweetFields: ["id", "text", "non_public_metrics", "organic_metrics"],
      auth: "oauth1",
    });

    expect(result.data.id).toBe("1");
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("non_public_metrics");
    expect(url).toContain("organic_metrics");
  });

  it("existing getTweetById signature remains backward-compatible without opts", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "1", text: "ok" } }), { status: 200 }),
    );
    const tc = makeBearerClient();
    const result = await tc.getTweetById("1");
    expect(result.data.id).toBe("1");
  });
});

// ===================================================================
// M2: getTweetCountsRecent
// ===================================================================

describe("TwitterClient.getTweetCountsRecent", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls GET /2/tweets/counts/recent with query param", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { start: "2026-06-12T00:00:00.000Z", end: "2026-06-13T00:00:00.000Z", tweet_count: 42 },
          ],
          meta: { total_tweet_count: 42 },
        }),
        { status: 200 },
      ),
    );

    const tc = makeBearerClient();
    const result = await tc.getTweetCountsRecent("from:elonmusk");

    expect(result.data).toHaveLength(1);
    expect(result.meta.total_tweet_count).toBe(42);

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/2/tweets/counts/recent");
    expect(url).toContain("query=from%3Aelonmusk");
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^Bearer /);
  });

  it("passes granularity when specified", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { total_tweet_count: 0 } }), { status: 200 }),
    );
    const tc = makeBearerClient();
    await tc.getTweetCountsRecent("hello", { granularity: "hour" });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("granularity=hour");
  });

  it("passes startTime and endTime when specified", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { total_tweet_count: 0 } }), { status: 200 }),
    );
    const tc = makeBearerClient();
    await tc.getTweetCountsRecent("hello", {
      startTime: "2026-06-01T00:00:00Z",
      endTime: "2026-06-07T00:00:00Z",
    });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("start_time=");
    expect(url).toContain("end_time=");
  });

  it("throws on empty query", async () => {
    const tc = makeBearerClient();
    await expect(tc.getTweetCountsRecent("")).rejects.toThrow(/query/i);
  });

  it("throws on non-2xx response", async () => {
    fetchSpy.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    const tc = makeBearerClient();
    await expect(tc.getTweetCountsRecent("test")).rejects.toThrow(/401/);
  });
});

// ===================================================================
// M7: searchUsers
// ===================================================================

describe("TwitterClient.searchUsers", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls GET /2/users/search with query param", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: "123", username: "elonmusk", name: "Elon Musk" },
            { id: "456", username: "elonmusk_fan", name: "Fan" },
          ],
          meta: { result_count: 2 },
        }),
        { status: 200 },
      ),
    );

    const tc = makeBearerClient();
    const result = await tc.searchUsers("elonmusk");

    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe("123");

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/2/users/search");
    expect(url).toContain("query=elonmusk");
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^Bearer /);
  });

  it("passes user.fields when specified", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { result_count: 0 } }), { status: 200 }),
    );
    const tc = makeBearerClient();
    await tc.searchUsers("test", { userFields: ["username", "public_metrics"] });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("user.fields=username%2Cpublic_metrics");
  });

  it("passes maxResults when specified", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { result_count: 0 } }), { status: 200 }),
    );
    const tc = makeBearerClient();
    await tc.searchUsers("test", { maxResults: 10 });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("max_results=10");
  });

  it("supports oauth1 auth mode", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { result_count: 0 } }), { status: 200 }),
    );
    const tc = makeClient();
    await tc.searchUsers("test", { auth: "oauth1" });
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^OAuth /);
  });

  it("throws on empty query", async () => {
    const tc = makeBearerClient();
    await expect(tc.searchUsers("")).rejects.toThrow(/query/i);
  });

  it("throws on non-2xx response", async () => {
    fetchSpy.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    const tc = makeBearerClient();
    await expect(tc.searchUsers("test")).rejects.toThrow(/403/);
  });
});

// ---------------------------------------------------------------------------
// M3 sendDirectMessage
// ---------------------------------------------------------------------------
describe("TwitterClient.sendDirectMessage", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to /2/dm_conversations/with/:participantId/messages", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { dm_conversation_id: "conv-1", dm_event_id: "ev-1" } }),
        { status: 201 },
      ),
    );
    const tc = makeOAuth2UserClient();
    const result = await tc.sendDirectMessage("12345", "Hello!");
    expect(result.dm_conversation_id).toBe("conv-1");
    expect(result.dm_event_id).toBe("ev-1");
    const call = fetchSpy.mock.calls[0];
    expect(String(call[0])).toContain("/2/dm_conversations/with/12345/messages");
    expect(call[1]?.method).toBe("POST");
    const body = JSON.parse(String(call[1]?.body));
    expect(body).toEqual({ text: "Hello!" });
  });

  it("uses oauth2-user Bearer auth by default", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { dm_conversation_id: "c", dm_event_id: "e" } }),
        { status: 201 },
      ),
    );
    const tc = makeOAuth2UserClient();
    await tc.sendDirectMessage("99", "hi");
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-oauth2-user-token");
  });

  it("falls back to oauth1 when opts.auth='oauth1'", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { dm_conversation_id: "c", dm_event_id: "e" } }),
        { status: 201 },
      ),
    );
    const tc = makeClient();
    await tc.sendDirectMessage("99", "hi", { auth: "oauth1" });
    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^OAuth /);
  });

  it("throws on non-2xx response", async () => {
    fetchSpy.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    const tc = makeOAuth2UserClient();
    await expect(tc.sendDirectMessage("1", "x")).rejects.toThrow(/403/);
  });

  it("throws when oauth2UserToken is missing and auth=oauth2-user", async () => {
    const tc = makeClient(); // no oauth2UserToken
    await expect(tc.sendDirectMessage("1", "x")).rejects.toThrow(/X_OAUTH2_USER_TOKEN/);
  });
});

// ---------------------------------------------------------------------------
// M4 createBookmark / deleteBookmark
// ---------------------------------------------------------------------------
describe("TwitterClient.createBookmark", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to /2/users/:id/bookmarks with tweet_id in body", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { bookmarked: true } }), { status: 200 }),
    );
    const tc = makeOAuth2UserClient();
    const result = await tc.createBookmark("tweet-1", { userId: "user-1" });
    expect(result.bookmarked).toBe(true);
    const call = fetchSpy.mock.calls[0];
    expect(String(call[0])).toContain("/2/users/user-1/bookmarks");
    const body = JSON.parse(String(call[1]?.body));
    expect(body).toEqual({ tweet_id: "tweet-1" });
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^Bearer test-oauth2-user-token/);
  });

  it("throws on non-2xx response", async () => {
    fetchSpy.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    const tc = makeOAuth2UserClient();
    await expect(tc.createBookmark("t1", { userId: "u1" })).rejects.toThrow(/401/);
  });

  it("throws when oauth2UserToken is missing", async () => {
    const tc = makeClient();
    await expect(tc.createBookmark("t1", { userId: "u1" })).rejects.toThrow(/X_OAUTH2_USER_TOKEN/);
  });
});

describe("TwitterClient.deleteBookmark", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("DELETEs /2/users/:id/bookmarks/:tweetId", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { bookmarked: false } }), { status: 200 }),
    );
    const tc = makeOAuth2UserClient();
    const result = await tc.deleteBookmark("tweet-2", { userId: "user-1" });
    expect(result.bookmarked).toBe(false);
    const call = fetchSpy.mock.calls[0];
    expect(String(call[0])).toContain("/2/users/user-1/bookmarks/tweet-2");
    expect(call[1]?.method).toBe("DELETE");
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^Bearer test-oauth2-user-token/);
  });

  it("throws on non-2xx response", async () => {
    fetchSpy.mockResolvedValue(new Response("Not Found", { status: 404 }));
    const tc = makeOAuth2UserClient();
    await expect(tc.deleteBookmark("t", { userId: "u" })).rejects.toThrow(/404/);
  });

  it("throws when oauth2UserToken is missing", async () => {
    const tc = makeClient();
    await expect(tc.deleteBookmark("t1", { userId: "u1" })).rejects.toThrow(/X_OAUTH2_USER_TOKEN/);
  });
});

// ---------------------------------------------------------------------------
// M5 Poll support in buildPostPayload / postTweet
// ---------------------------------------------------------------------------
describe("TwitterClient.buildPostPayload with poll", () => {
  it("adds poll to payload when poll options provided", () => {
    const tc = makeClient();
    const payload = tc.buildPostPayload({
      text: "Vote!",
      poll: { options: ["Yes", "No"], durationMinutes: 60 },
    });
    expect(payload.text).toBe("Vote!");
    expect(payload.poll).toEqual({ options: ["Yes", "No"], duration_minutes: 60 });
  });

  it("does NOT add poll when poll is omitted (backward compat)", () => {
    const tc = makeClient();
    const payload = tc.buildPostPayload({ text: "No poll here" });
    expect(payload.poll).toBeUndefined();
  });

  it("posts tweet with poll via postTweet", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "p1", text: "Vote!" } }), { status: 200 }),
    );
    const tc = makeClient();
    await tc.postTweet({ text: "Vote!", poll: { options: ["Yes", "No"], durationMinutes: 120 } });
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.poll).toEqual({ options: ["Yes", "No"], duration_minutes: 120 });
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// M6 postThread
// ---------------------------------------------------------------------------
describe("TwitterClient.postThread", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts multiple tweets with reply chaining", async () => {
    // Each call returns successive tweet IDs
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "t1", text: "first", created_at: "2025-01-01T00:00:00Z" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "t2", text: "second", created_at: "2025-01-01T00:00:01Z" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "t3", text: "third", created_at: "2025-01-01T00:00:02Z" } }), { status: 200 }),
      );

    const tc = makeClient();
    const results = await tc.postThread(["first", "second", "third"]);

    expect(results).toHaveLength(3);
    expect(results[0].id).toBe("t1");
    expect(results[1].id).toBe("t2");
    expect(results[2].id).toBe("t3");
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // 2nd tweet should have reply.in_reply_to_tweet_id = "t1"
    const body2 = JSON.parse(String(fetchSpy.mock.calls[1][1]?.body));
    expect(body2.reply?.in_reply_to_tweet_id).toBe("t1");

    // 3rd tweet should reply to "t2"
    const body3 = JSON.parse(String(fetchSpy.mock.calls[2][1]?.body));
    expect(body3.reply?.in_reply_to_tweet_id).toBe("t2");
  });

  it("posts a single tweet without any reply chain", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "s1", text: "solo" } }), { status: 200 }),
    );
    const tc = makeClient();
    const results = await tc.postThread(["solo"]);
    expect(results).toHaveLength(1);
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.reply).toBeUndefined();
  });

  it("throws when texts array is empty", async () => {
    const tc = makeClient();
    await expect(tc.postThread([])).rejects.toThrow(/empty/i);
  });

  it("throws when OAuth1 credentials are missing", async () => {
    const tc = makeBearerClient(); // no oauth1 creds
    await expect(tc.postThread(["hello"])).rejects.toThrow(/OAuth 1.0a/);
  });

  it("aborts remaining tweets on API error and propagates error", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "ok1", text: "first" } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response("Forbidden", { status: 403 }),
      );

    const tc = makeClient();
    await expect(tc.postThread(["first", "second"])).rejects.toThrow(/403/);
    // Only 2 calls should have been made
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

// ============================================================
// L3: muteUser / unmuteUser / blockUser / unblockUser
// ============================================================

describe("TwitterClient.muteUser", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST /2/users/:id/muting with correct body and returns muting=true", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { muting: true } }), { status: 200 }),
    );

    const tc = makeFullClient();
    const result = await tc.muteUser("target123", { userId: "me456" });

    expect(result.muting).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toContain("/2/users/me456/muting");
    expect(call[1]?.method).toBe("POST");
    const body = JSON.parse(String(call[1]?.body));
    expect(body.target_user_id).toBe("target123");
  });

  it("accepts oauth2-user auth", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { muting: true } }), { status: 200 }),
    );

    const tc = makeFullClient();
    await tc.muteUser("t999", { userId: "me1", auth: "oauth2-user" });

    const call = fetchSpy.mock.calls[0];
    const authHeader = String((call[1]?.headers as Record<string, string>)?.Authorization ?? "");
    expect(authHeader).toMatch(/^Bearer /);
  });

  it("throws when neither oauth2-user nor oauth1 credentials are set", async () => {
    const tc = makeBearerClient(); // no oauth1, no oauth2UserToken
    await expect(tc.muteUser("t1", { userId: "me" })).rejects.toThrow();
  });

  it("throws on API error", async () => {
    fetchSpy.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    const tc = makeFullClient();
    await expect(tc.muteUser("t1", { userId: "me" })).rejects.toThrow(/403/);
  });
});

describe("TwitterClient.unmuteUser", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends DELETE /2/users/:source_id/muting/:target_id and returns muting=false", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { muting: false } }), { status: 200 }),
    );

    const tc = makeFullClient();
    const result = await tc.unmuteUser("target123", { userId: "me456" });

    expect(result.muting).toBe(false);

    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toContain("/2/users/me456/muting/target123");
    expect(call[1]?.method).toBe("DELETE");
  });

  it("throws on API error", async () => {
    fetchSpy.mockResolvedValue(new Response("Not Found", { status: 404 }));
    const tc = makeFullClient();
    await expect(tc.unmuteUser("t1", { userId: "me" })).rejects.toThrow(/404/);
  });
});

describe("TwitterClient.blockUser", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST /2/users/:id/blocking with correct body and returns blocking=true", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { blocking: true } }), { status: 200 }),
    );

    const tc = makeFullClient();
    const result = await tc.blockUser("target123", { userId: "me456" });

    expect(result.blocking).toBe(true);

    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toContain("/2/users/me456/blocking");
    expect(call[1]?.method).toBe("POST");
    const body = JSON.parse(String(call[1]?.body));
    expect(body.target_user_id).toBe("target123");
  });

  it("throws when no auth credentials are set", async () => {
    const tc = makeBearerClient();
    await expect(tc.blockUser("t1", { userId: "me" })).rejects.toThrow();
  });
});

describe("TwitterClient.unblockUser", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends DELETE /2/users/:source_id/blocking/:target_id and returns blocking=false", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { blocking: false } }), { status: 200 }),
    );

    const tc = makeFullClient();
    const result = await tc.unblockUser("target123", { userId: "me456" });

    expect(result.blocking).toBe(false);

    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toContain("/2/users/me456/blocking/target123");
    expect(call[1]?.method).toBe("DELETE");
  });

  it("throws on API error", async () => {
    fetchSpy.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    const tc = makeFullClient();
    await expect(tc.unblockUser("t1", { userId: "me" })).rejects.toThrow(/401/);
  });
});

// ============================================================
// L4: searchAll (GET /2/tweets/search/all — requires Pro+ tier)
// ============================================================

describe("TwitterClient.searchAll", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls GET /2/tweets/search/all with query param", async () => {
    const apiResp: TwitterSearchAllResponse = {
      data: [{ id: "100", text: "hello" }],
      meta: { result_count: 1 },
    };
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(apiResp), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.searchAll("hello world");

    expect(result.data).toHaveLength(1);
    expect(result.data![0].id).toBe("100");

    const call = fetchSpy.mock.calls[0];
    const url = String(call[0]);
    expect(url).toContain("/2/tweets/search/all");
    expect(url).toContain("query=");
  });

  it("forwards start_time / end_time / max_results when provided", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: [], meta: { result_count: 0 } }), { status: 200 }),
    );

    const tc = makeBearerClient();
    await tc.searchAll("test", {
      startTime: "2024-01-01T00:00:00Z",
      endTime: "2024-01-31T23:59:59Z",
      maxResults: 50,
    });

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("start_time=");
    expect(url).toContain("end_time=");
    expect(url).toContain("max_results=50");
  });

  it("throws when query is empty", async () => {
    const tc = makeBearerClient();
    await expect(tc.searchAll("")).rejects.toThrow(/query/i);
  });

  it("throws on API 403 (insufficient tier)", async () => {
    fetchSpy.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    const tc = makeBearerClient();
    await expect(tc.searchAll("test")).rejects.toThrow(/403/);
  });
});

// ============================================================
// L7: getTrends / searchSpaces
// ============================================================

describe("TwitterClient.getTrends", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls GET /2/trends/by/woeid/:woeid", async () => {
    const apiResp: TwitterTrendsResponse = {
      data: [{ trend_name: "#trending", tweet_count: 1000 }],
    };
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(apiResp), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.getTrends(23424856);

    expect(result.data).toHaveLength(1);
    expect(result.data![0].trend_name).toBe("#trending");

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/2/trends/by/woeid/23424856");
  });

  it("throws on API error", async () => {
    fetchSpy.mockResolvedValue(new Response("Not Found", { status: 404 }));
    const tc = makeBearerClient();
    await expect(tc.getTrends(99999)).rejects.toThrow(/404/);
  });
});

describe("TwitterClient.searchSpaces", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls GET /2/spaces/search with query param", async () => {
    const apiResp: TwitterSpacesSearchResponse = {
      data: [{ id: "1sp", state: "live", title: "Test Space" }],
      meta: { result_count: 1 },
    };
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(apiResp), { status: 200 }),
    );

    const tc = makeBearerClient();
    const result = await tc.searchSpaces("test topic");

    expect(result.data).toHaveLength(1);
    expect(result.data![0].id).toBe("1sp");

    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/2/spaces/search");
    expect(url).toContain("query=");
  });

  it("throws when query is empty", async () => {
    const tc = makeBearerClient();
    await expect(tc.searchSpaces("")).rejects.toThrow(/query/i);
  });

  it("throws on API error", async () => {
    fetchSpy.mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    const tc = makeBearerClient();
    await expect(tc.searchSpaces("topic")).rejects.toThrow(/401/);
  });
});
