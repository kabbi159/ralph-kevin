import { readFileSync } from "node:fs";
import {
  type PersonaRecord,
  PersonaRecordSchema,
  type PersonaSearchQuery,
} from "@personabench/core";
import type { PersonaSamplingConfig, PersonaSearchResult, PersonaSource } from "./persona-source";

// LocalJsonPersonaSource — bring-your-own NDJSON or JSON-array adapter.
// Each row is validated against PersonaRecordSchema before being indexed,
// so a malformed BYO file fails fast at the load boundary rather than
// surfacing as a runtime error inside the runner.

export type LocalJsonSourceOpts = {
  // Path to a `.ndjson` (one record per line) or `.json` (array) file.
  path: string;
  // Optional id prefix used for the source.id field; defaults to "local_json".
  sourceId?: string;
};

const parseLines = (text: string): unknown[] => {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
};

const matchesQuery = (p: PersonaRecord, q: PersonaSearchQuery): boolean => {
  if (q.demographics?.ageMin != null && (p.demographics.age ?? -1) < q.demographics.ageMin)
    return false;
  if (
    q.demographics?.ageMax != null &&
    (p.demographics.age ?? Number.MAX_SAFE_INTEGER) > q.demographics.ageMax
  )
    return false;
  if (q.locale?.country && p.locale.country && q.locale.country !== p.locale.country) return false;
  if (q.textQuery) {
    const haystack = [
      p.narratives.persona,
      p.narratives.professionalPersona,
      p.demographics.occupation,
      p.locale.country,
    ]
      .filter((s): s is string => typeof s === "string")
      .join(" ")
      .toLowerCase();
    const needles = q.textQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((n) => n.length > 0);
    if (!needles.some((n) => haystack.includes(n))) return false;
  }
  return true;
};

export class LocalJsonPersonaSource implements PersonaSource {
  readonly id: string;
  readonly kind = "local_json" as const;

  private readonly records: PersonaRecord[];

  constructor(opts: LocalJsonSourceOpts) {
    this.id = opts.sourceId ?? `local_json:${opts.path}`;
    const text = readFileSync(opts.path, "utf8");
    const raw = parseLines(text);
    this.records = raw.map((row, idx) => {
      const result = PersonaRecordSchema.safeParse(row);
      if (!result.success) {
        const issues = result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        throw new Error(
          `LocalJsonPersonaSource: row ${idx} of ${opts.path} failed validation: ${issues}`,
        );
      }
      return result.data;
    });
  }

  search(query: PersonaSearchQuery): Promise<PersonaSearchResult> {
    const start = Date.now();
    const matches = this.records.filter((r) => matchesQuery(r, query));
    return Promise.resolve({
      matches,
      totalEstimated: matches.length,
      sourceLatencyMs: Date.now() - start,
    });
  }

  async sample(config: PersonaSamplingConfig): Promise<PersonaRecord[]> {
    const found = config.query ? (await this.search(config.query)).matches : this.records.slice();
    return found.slice(0, config.sampleSize);
  }

  getById(id: string): Promise<PersonaRecord | null> {
    return Promise.resolve(this.records.find((r) => r.id === id) ?? null);
  }
}
