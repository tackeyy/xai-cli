import type { XaiResponse } from "../../lib/types.js";

export function mockXaiResponse(text: string): Response {
  const body: XaiResponse = {
    output: [
      {
        type: "message",
        content: [{ type: "text", text }],
      },
    ],
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export function mockXaiError(status: number, message = "error"): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function mockXaiErrorWithRetryAfter(
  status: number,
  retryAfter: string,
): Response {
  return new Response(JSON.stringify({ error: "rate limited" }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": retryAfter,
    },
  });
}
