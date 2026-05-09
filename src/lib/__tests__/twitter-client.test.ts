import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TwitterClient, TweetTooLongError } from "../twitter-client.js";

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
