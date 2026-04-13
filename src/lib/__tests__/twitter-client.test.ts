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
