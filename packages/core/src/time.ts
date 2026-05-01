// Time helpers — ISO-8601 with explicit timezone. All run artifacts use UTC
// (`Z` suffix); the Korea-time session window only affects the time-status
// hook, not persisted state.

const ISO_8601_RE =
  // Matches yyyy-MM-ddTHH:mm[:ss[.fff]] with either Z or ±HH:MM offset.
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

export const nowIsoUtc = (): string => new Date().toISOString();

export const parseIsoUtc = (s: string): Date => {
  if (typeof s !== "string" || !ISO_8601_RE.test(s)) {
    throw new Error(`parseIsoUtc: not a valid ISO-8601 string with timezone: ${JSON.stringify(s)}`);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`parseIsoUtc: unparseable date: ${JSON.stringify(s)}`);
  }
  return d;
};

export const isoToEpochMs = (s: string): number => parseIsoUtc(s).getTime();

export const epochMsToIso = (ms: number): string => {
  if (!Number.isFinite(ms)) {
    throw new Error(`epochMsToIso: not a finite number: ${ms}`);
  }
  return new Date(ms).toISOString();
};

// Convert any timezone-bearing ISO string to its UTC normalized form.
// Useful when persisting a KST-formatted timestamp into events.ndjson which
// is required to be UTC.
export const normalizeIsoToUtc = (s: string): string => epochMsToIso(isoToEpochMs(s));
