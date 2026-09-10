import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";

describe("createApiClient", () => {
  it("calls a typed endpoint relative to the configured API origin", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    const client = createApiClient("https://api.example.test", {
      fetch: fetchMock,
    });

    const { data, error } = await client.GET("/api/v1/health");

    expect(error).toBeUndefined();
    expect(data).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledOnce();

    const request = fetchMock.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) {
      throw new TypeError("Expected openapi-fetch to issue a Request");
    }
    expect(request.url).toBe("https://api.example.test/api/v1/health");
  });
});
