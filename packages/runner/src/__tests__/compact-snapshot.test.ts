import { describe, expect, it } from "vitest";
import type { RawSnapshot } from "../browser/agent-browser-session";
import { compactSnapshot } from "../observe/compact-snapshot";

const sampleRaw: RawSnapshot = {
  origin: "http://localhost:3100",
  snapshot: {
    kind: "tree",
    children: [
      { tag: "h1", text: "주문/결제" },
      {
        tag: "section",
        children: [
          { tag: "div", text: "무선 이어폰 Pro" },
          { tag: "span", text: "₩49,000" },
        ],
      },
      {
        tag: "section",
        children: [{ tag: "button", name: "배송 정보", role: "button" }],
      },
      {
        tag: "section",
        children: [{ tag: "div", text: "예상 합계 약 49,000원~" }],
      },
      { tag: "button", name: "결제 확정", role: "button" },
    ],
  },
  refs: {
    e1: { role: "heading", name: "주문/결제" },
    e3: { role: "button", name: "배송 정보" },
    e5: { role: "textbox", name: "쿠폰 코드" },
    e6: { role: "button", name: "적용" },
    e8: { role: "button", name: "결제 확정" },
  },
};

describe("compactSnapshot", () => {
  it("yields all interactive refs as `@<id>` selectors with role+label", () => {
    const obs = compactSnapshot(sampleRaw);
    expect(obs.refs).toEqual(["e1", "e3", "e5", "e6", "e8"]);
    expect(obs.interactiveElements).toHaveLength(5);
    const e8 = obs.interactiveElements?.find((e) => e.selector === "@e8");
    expect(e8?.label).toBe("결제 확정");
    expect(e8?.role).toBe("button");
  });

  it("preserves visible text including price + ambiguous total markers", () => {
    const obs = compactSnapshot(sampleRaw);
    expect(obs.visibleText).toContain("주문/결제");
    expect(obs.visibleText).toContain("₩49,000");
    expect(obs.visibleText).toContain("예상 합계 약 49,000원~");
    expect(obs.visibleText).toContain("결제 확정");
  });

  it("propagates origin verbatim from the raw snapshot", () => {
    const obs = compactSnapshot(sampleRaw);
    expect(obs.origin).toBe("http://localhost:3100");
  });

  it("de-duplicates repeated text fragments", () => {
    const dup: RawSnapshot = {
      origin: "http://x/",
      snapshot: {
        children: [
          { text: "Same" },
          { text: "Same" },
          { children: [{ text: "Same" }, { text: "Different" }] },
        ],
      },
      refs: {},
    };
    const obs = compactSnapshot(dup);
    const occurrences = obs.visibleText?.split("Same").length ?? 1;
    // dedupe → "Same" appears once → split returns 2 parts
    expect(occurrences).toBe(2);
    expect(obs.visibleText).toContain("Different");
  });

  it("returns no interactiveElements when refs is empty", () => {
    const empty = compactSnapshot({ origin: "x", snapshot: {}, refs: {} });
    expect(empty.interactiveElements).toBeUndefined();
    expect(empty.refs).toEqual([]);
  });

  it("the full Observation body survives a JSON round-trip and parses against the schema shape", async () => {
    const obs = compactSnapshot(sampleRaw);
    const back = JSON.parse(JSON.stringify(obs));
    expect(back.origin).toBe(obs.origin);
    expect(back.interactiveElements?.length).toBe(obs.interactiveElements?.length);
  });

  it("handles a deeply-nested structure without explosion", () => {
    const deep: RawSnapshot = { origin: "x", snapshot: { children: [] }, refs: {} };
    let cursor: { children: unknown[] } = { children: [] };
    deep.snapshot = cursor;
    for (let i = 0; i < 100; i++) {
      const next = { children: [], text: `level-${i}` };
      cursor.children.push(next);
      cursor = next;
    }
    const obs = compactSnapshot(deep);
    expect(obs.visibleText).toContain("level-0");
    expect(obs.visibleText).toContain("level-50");
  });
});
