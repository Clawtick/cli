import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Config lives in ~/.clawtick, resolved at import time; point HOME at a temp dir.
async function makeClient(config?: object) {
  const home = mkdtempSync(join(tmpdir(), "ct-home-"));
  vi.stubEnv("HOME", home);
  vi.stubEnv("USERPROFILE", home);
  if (config) {
    mkdirSync(join(home, ".clawtick"));
    writeFileSync(join(home, ".clawtick", "config.json"), JSON.stringify(config));
  }
  vi.resetModules();
  const { ApiClient } = await import("../src/api-client.js");
  return new ApiClient();
}

const cfg = { apiUrl: "https://api.test", apiKey: "cp_key" };
const jsonRes = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("ApiClient", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is unauthenticated without a key and does not call fetch", async () => {
    const api = await makeClient();
    expect(api.isAuthenticated()).toBe(false);
    await expect(api.listJobs()).rejects.toThrow("Not authenticated");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns data on success and sends the bearer header", async () => {
    fetchMock.mockResolvedValue(jsonRes(200, { jobs: [] }));
    const api = await makeClient(cfg);
    expect(api.isAuthenticated()).toBe(true);
    await expect(api.listJobs()).resolves.toEqual({ jobs: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/v1/jobs");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer cp_key");
  });

  it("sends a JSON body for POST", async () => {
    fetchMock.mockResolvedValue(jsonRes(200, { id: "j1" }));
    const api = await makeClient(cfg);
    await api.createJob({ cron: "* * * * *", message: "hi" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ cron: "* * * * *", message: "hi" });
  });

  it("throws the server error message on 4xx", async () => {
    fetchMock.mockResolvedValue(jsonRes(400, { error: "bad cron" }));
    const api = await makeClient(cfg);
    await expect(api.listJobs()).rejects.toThrow("bad cron");
  });

  it("falls back to a status message on 5xx with a non-JSON body", async () => {
    fetchMock.mockResolvedValue(new Response("oops", { status: 503 }));
    const api = await makeClient(cfg);
    await expect(api.getStatus()).rejects.toThrow("API error: 503");
  });

  it("propagates network errors", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const api = await makeClient(cfg);
    await expect(api.triggerJob("j1")).rejects.toThrow("ECONNREFUSED");
  });

  it("builds the right path for delete", async () => {
    fetchMock.mockResolvedValue(jsonRes(200, {}));
    const api = await makeClient(cfg);
    await api.deleteJob("abc");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/v1/jobs/abc");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });
});
