import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  type PersonaRecord,
  PersonaRecordSchema,
  type PersonaSearchQuery,
} from "@personabench/core";
import { MockPersonaSource } from "@personabench/personas";

// Persona pack save/reuse — stretch S4. Packs are small JSON files under
// .personabench/persona-packs/<id>.json that bundle a search query + the
// resolved persona records, so a future run can re-use the same set without
// re-querying the source.

const PACKS_ROOT = resolve(process.cwd(), ".personabench", "persona-packs");

export type PersonaPack = {
  id: string;
  name: string;
  description?: string;
  source: { datasets: string[]; searchQuery: PersonaSearchQuery };
  personas: PersonaRecord[];
  coverage: {
    size: number;
    countries: string[];
    ageDistribution?: Record<string, number>;
    occupationDistribution?: Record<string, number>;
  };
  createdAt: string;
};

export const personaPacksRoot = (): string => PACKS_ROOT;

export const savePersonaPack = (pack: PersonaPack): string => {
  mkdirSync(PACKS_ROOT, { recursive: true });
  const path = join(PACKS_ROOT, `${pack.id}.json`);
  writeFileSync(path, `${JSON.stringify(pack, null, 2)}\n`);
  return path;
};

export const loadPersonaPack = (id: string): PersonaPack | null => {
  const path = join(PACKS_ROOT, `${id}.json`);
  if (!existsSync(path)) return null;
  const data = JSON.parse(readFileSync(path, "utf8")) as PersonaPack;
  for (const p of data.personas) PersonaRecordSchema.parse(p);
  return data;
};

export const listPersonaPacks = (): PersonaPack[] => {
  if (!existsSync(PACKS_ROOT)) return [];
  return readdirSync(PACKS_ROOT)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .map((id) => loadPersonaPack(id))
    .filter((p): p is PersonaPack => p !== null);
};

const buildCoverage = (records: PersonaRecord[]): PersonaPack["coverage"] => {
  const countries = new Set<string>();
  const ageDist: Record<string, number> = {};
  const occDist: Record<string, number> = {};
  for (const r of records) {
    if (r.locale.country) countries.add(r.locale.country);
    if (typeof r.demographics.age === "number") {
      const bucket = `${Math.floor(r.demographics.age / 10) * 10}대`;
      ageDist[bucket] = (ageDist[bucket] ?? 0) + 1;
    }
    if (r.demographics.occupation) {
      occDist[r.demographics.occupation] = (occDist[r.demographics.occupation] ?? 0) + 1;
    }
  }
  return {
    size: records.length,
    countries: Array.from(countries),
    ageDistribution: ageDist,
    occupationDistribution: occDist,
  };
};

export type CreatePackOpts = {
  id: string;
  name: string;
  description?: string;
  query?: PersonaSearchQuery;
};

export const createMockPack = async (opts: CreatePackOpts): Promise<PersonaPack> => {
  const src = new MockPersonaSource();
  const matches = opts.query
    ? (await src.search(opts.query)).matches
    : (await src.search({})).matches;
  const pack: PersonaPack = {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    source: {
      datasets: ["fixture/checkout-mock-v1"],
      searchQuery: opts.query ?? {},
    },
    personas: matches,
    coverage: buildCoverage(matches),
    createdAt: new Date().toISOString(),
  };
  savePersonaPack(pack);
  return pack;
};
