import { beforeEach, describe, expect, it, vi } from "vitest";

const { nextFetch, runContext } = vi.hoisted(() => ({
  nextFetch: vi.fn(),
  runContext: vi.fn(
    (
      _request: Request,
      _env: Record<string, unknown>,
      _ctx: unknown,
      handler: () => Promise<Response>,
    ) => handler(),
  ),
}));

vi.mock("server-only", () => ({}));

import { createCloudflareWorker } from "../src/lib/server/cloudflare-worker";
const worker = createCloudflareWorker({ fetch: nextFetch }, runContext);

describe("Cloudflare request boundary", () => {
  beforeEach(() => {
    nextFetch.mockReset();
    runContext.mockClear();
  });

  it("uses the real upload authorization before Next reads a binary body", async () => {
    const read = vi.fn();
    const request = new Request("https://app.example/api/photos?propertyId=p", {
      method: "POST",
      body: new ReadableStream({ pull: read }),
      duplex: "half",
    } as RequestInit);
    // Creating a stream can prefill its queue. Check reads from this point.
    await Promise.resolve();
    read.mockClear();
    const response = await worker.fetch(request, {}, {});
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: "Please sign in before uploading photos.",
    });
    expect(read).not.toHaveBeenCalled();
    expect(nextFetch).not.toHaveBeenCalled();
    expect(runContext).toHaveBeenCalledOnce();
  });

  it("rejects other upload methods without invoking either runtime", async () => {
    const response = await worker.fetch(
      new Request("https://app.example/api/photos"),
      {},
      {},
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expect(nextFetch).not.toHaveBeenCalled();
    expect(runContext).not.toHaveBeenCalled();
  });

  it("keeps existing property links without rendering or exposing records", async () => {
    const response = await worker.fetch(
      new Request("https://app.example/properties/property-1?untrusted=value"),
      {},
      {},
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe(
      "https://app.example/properties/detail?id=property-1",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("");
    expect(nextFetch).not.toHaveBeenCalled();
  });

  it("passes the static property shell and its ID to OpenNext unchanged", async () => {
    const request = new Request(
      "https://app.example/properties/detail?id=property-1",
    );
    const result = new Response("static shell");
    nextFetch.mockResolvedValue(result);
    expect(await worker.fetch(request, {}, {})).toBe(result);
    expect(nextFetch).toHaveBeenCalledWith(request, {}, {});
    expect(runContext).not.toHaveBeenCalled();
  });
});
