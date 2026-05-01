import { describe, expect, it } from "vitest";
import { epochMsToIso, isoToEpochMs, normalizeIsoToUtc, nowIsoUtc, parseIsoUtc } from "../time";

describe("time helpers", () => {
  it("nowIsoUtc returns an ISO string with Z suffix and millisecond precision", () => {
    const s = nowIsoUtc();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(parseIsoUtc(s).toISOString()).toBe(s);
  });

  it("epochMsToIso ↔ isoToEpochMs roundtrips preserve millisecond precision", () => {
    const samples = [0, 1, 999, 1746077400123, Date.now(), 4_102_444_799_999];
    for (const ms of samples) {
      const iso = epochMsToIso(ms);
      const back = isoToEpochMs(iso);
      expect(back).toBe(ms);
    }
  });

  it("parseIsoUtc accepts both Z and offset forms", () => {
    expect(parseIsoUtc("2026-05-01T13:30:00Z").getTime()).toBeGreaterThan(0);
    expect(parseIsoUtc("2026-05-01T13:30:00+09:00").getTime()).toBe(
      parseIsoUtc("2026-05-01T04:30:00Z").getTime(),
    );
    // session window endpoint normalizes correctly
    expect(parseIsoUtc("2026-05-01T16:30:00+09:00").getTime()).toBe(
      parseIsoUtc("2026-05-01T07:30:00Z").getTime(),
    );
  });

  it("parseIsoUtc rejects strings with no timezone info", () => {
    expect(() => parseIsoUtc("2026-05-01T13:30:00")).toThrow();
    expect(() => parseIsoUtc("2026-05-01")).toThrow();
    expect(() => parseIsoUtc("yesterday")).toThrow();
    expect(() => parseIsoUtc(undefined as unknown as string)).toThrow();
  });

  it("epochMsToIso rejects non-finite numbers", () => {
    expect(() => epochMsToIso(Number.NaN)).toThrow();
    expect(() => epochMsToIso(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => epochMsToIso(Number.NEGATIVE_INFINITY)).toThrow();
  });

  it("normalizeIsoToUtc converts an offset-bearing string to its UTC equivalent", () => {
    expect(normalizeIsoToUtc("2026-05-01T13:30:00+09:00")).toBe("2026-05-01T04:30:00.000Z");
    expect(normalizeIsoToUtc("2026-05-01T00:00:00Z")).toBe("2026-05-01T00:00:00.000Z");
  });
});
