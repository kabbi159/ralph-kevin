import { describe, expect, it } from "vitest";
import {
  newArtifactId,
  newEventId,
  newFindingId,
  newInterviewId,
  newRunId,
  newSignalId,
} from "../ids";

const N = 10_000;

describe("id generators", () => {
  it("produce 10k unique ids per generator under load", () => {
    const generators: Array<{ name: string; gen: () => string; prefix: string }> = [
      { name: "run", gen: newRunId, prefix: "run_" },
      { name: "event", gen: newEventId, prefix: "evt_" },
      { name: "signal", gen: newSignalId, prefix: "fs_" },
      { name: "artifact", gen: newArtifactId, prefix: "art_" },
      { name: "interview", gen: newInterviewId, prefix: "iv_" },
    ];
    for (const g of generators) {
      const seen = new Set<string>();
      for (let i = 0; i < N; i++) {
        const id = g.gen();
        expect(id.startsWith(g.prefix)).toBe(true);
        seen.add(id);
      }
      expect(seen.size).toBe(N);
    }
  });

  it("findings produce sequential F-001 / F-002 / … with a numeric index", () => {
    expect(newFindingId(0)).toBe("F-001");
    expect(newFindingId(1)).toBe("F-002");
    expect(newFindingId(99)).toBe("F-100");
    expect(newFindingId(998)).toBe("F-999");
    expect(newFindingId(999)).toBe("F-1000");
  });

  it("findings without an index are random and unique", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1_000; i++) {
      const id = newFindingId();
      expect(id.startsWith("F-")).toBe(true);
      expect(id).not.toMatch(/^F-\d{3}$/); // never collides with the sequential form
      seen.add(id);
    }
    expect(seen.size).toBe(1_000);
  });

  it("findings reject negative or non-integer indices", () => {
    expect(() => newFindingId(-1)).toThrow();
    expect(() => newFindingId(1.5)).toThrow();
  });

  it("run / event / signal ids are roughly time-sortable across millisecond boundaries", async () => {
    const a = newRunId();
    await new Promise((r) => setTimeout(r, 8));
    const b = newRunId();
    expect(a < b).toBe(true);
  });
});
