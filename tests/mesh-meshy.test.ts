import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchMock = vi.fn();
global.fetch = fetchMock as any;

import { MeshyProvider } from "../lib/mesh/meshy";

describe("MeshyProvider", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.MESHY_API_KEY = "test-key";
  });

  it("startJob posts data-URL with auth and returns jobId", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: "job-123" }),
    });
    const p = new MeshyProvider();
    const out = await p.startJob(Buffer.from("img"), "image/png");
    expect(out.jobId).toBe("job-123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/openapi/v2/image-to-3d");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.image_url).toMatch(/^data:image\/png;base64,/);
  });

  it("pollJob maps PENDING/IN_PROGRESS to pending", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "PENDING" }) });
    const p = new MeshyProvider();
    expect((await p.pollJob("j")).status).toBe("pending");

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ status: "IN_PROGRESS" }) });
    expect((await p.pollJob("j")).status).toBe("pending");
  });

  it("pollJob maps SUCCEEDED to ready with glbUrl", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "SUCCEEDED", model_urls: { glb: "https://cdn/m.glb" } }),
    });
    const p = new MeshyProvider();
    const out = await p.pollJob("j");
    expect(out.status).toBe("ready");
    expect(out.glbUrl).toBe("https://cdn/m.glb");
  });

  it("pollJob maps FAILED to failed with error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "FAILED", task_error: { message: "boom" } }),
    });
    const p = new MeshyProvider();
    const out = await p.pollJob("j");
    expect(out.status).toBe("failed");
    expect(out.error).toBe("boom");
  });

  it("throws MissingApiKeyError when key missing", async () => {
    delete process.env.MESHY_API_KEY;
    const p = new MeshyProvider();
    await expect(p.startJob(Buffer.from(""), "image/png")).rejects.toThrow(/MESHY_API_KEY/);
  });
});
