import { randomBytes } from "node:crypto";

// ID generators — stable prefixes per the boot prompt:
//   run_  → run identifier (used as agent-browser --session)
//   evt_  → RunEvent.id
//   fs_   → FrictionSignal.id
//   F-NNN → UXFinding.id (sequential within a run; spec example uses F-001)
//   art_  → Artifact.id
//   iv_   → Interview.id
//
// Persona ids are NOT generated here — they're externally formatted as
// `nemotron:<dataset>:<rowId-or-uuid>` / `mock_<n>` / `custom:<dataset>:<id>`.

const randomHex = (bytes: number): string => randomBytes(bytes).toString("hex");

const sortablePrefix = (): string =>
  // Base36 epoch ms — 8-9 chars, lexicographically sortable up to year ~5188.
  // Pads to 9 chars so equal-length sort works for the foreseeable future.
  Date.now()
    .toString(36)
    .padStart(9, "0");

export const newRunId = (): string => `run_${sortablePrefix()}_${randomHex(3)}`;

export const newEventId = (): string => `evt_${sortablePrefix()}_${randomHex(3)}`;

export const newSignalId = (): string => `fs_${sortablePrefix()}_${randomHex(3)}`;

export const newArtifactId = (): string => `art_${sortablePrefix()}_${randomHex(3)}`;

export const newInterviewId = (): string => `iv_${sortablePrefix()}_${randomHex(3)}`;

// Findings use a stable sequential identifier when an index is supplied
// (matches the docs/06 example "F-001"), and a random identifier otherwise so
// callers can mint ad-hoc finding ids in tests.
export const newFindingId = (index?: number): string => {
  if (typeof index === "number") {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(`newFindingId: index must be a non-negative integer (got ${index})`);
    }
    return `F-${String(index + 1).padStart(3, "0")}`;
  }
  return `F-${randomHex(4)}`;
};
