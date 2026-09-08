import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchJson, fetchWithRetry } from "./http";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("fetchWithRetry", () => {
  it("returns the response on the first successful attempt", async () => {
    const response = { ok: true } as Response;
    fetchMock.mockResolvedValue(response);
    expect(await fetchWithRetry("https://example.com")).toBe(response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries after a thrown network error and returns the eventual success", async () => {
    const response = { ok: true } as Response;
    fetchMock.mockRejectedValueOnce(new Error("read ECONNRESET")).mockResolvedValueOnce(response);
    expect(await fetchWithRetry("https://example.com")).toBe(response);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up and returns null after exhausting all attempts", async () => {
    fetchMock.mockRejectedValue(new Error("read ECONNRESET"));
    expect(await fetchWithRetry("https://example.com")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-throwing not-ok response", async () => {
    const response = { ok: false } as Response;
    fetchMock.mockResolvedValue(response);
    expect(await fetchWithRetry("https://example.com")).toBe(response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchJson", () => {
  it("parses a successful JSON response", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ a: 1 }) } as Response);
    expect(await fetchJson("https://example.com")).toEqual({ a: 1 });
  });

  it("returns null for a not-ok response", async () => {
    fetchMock.mockResolvedValue({ ok: false } as Response);
    expect(await fetchJson("https://example.com")).toBeNull();
  });

  it("returns null when every attempt throws", async () => {
    fetchMock.mockRejectedValue(new Error("read ECONNRESET"));
    expect(await fetchJson("https://example.com")).toBeNull();
  });

  it("returns null when the body isn't valid JSON", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: (): Promise<unknown> => Promise.reject(new SyntaxError("Unexpected token")),
    } as Response);
    expect(await fetchJson("https://example.com")).toBeNull();
  });
});
