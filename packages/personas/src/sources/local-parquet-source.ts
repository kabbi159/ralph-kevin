import type { PersonaRecord, PersonaSearchQuery } from "@personabench/core";
import { normalizeNemotronRow } from "../normalizers/nemotron";
import {
  type Bindable,
  type DuckDBConnection,
  getDuckDBInstance,
  isParquetGlobAvailable,
  runQuery,
  sanitizeBigInts,
} from "./duckdb-client";
import type { PersonaSamplingConfig, PersonaSearchResult, PersonaSource } from "./persona-source";

// LocalParquetNemotronSource — DuckDB-backed PersonaSource over the downloaded
// `nvidia/Nemotron-Personas-*` parquet shards. Uses @duckdb/node-api, NOT the
// legacy `duckdb` npm package (which fails on pnpm 10's native build sandbox).

export type LocalParquetSourceOpts = {
  // Folder that contains `data/train-*.parquet` (e.g. data/personas/nemotron-korea).
  rootDir: string;
  // The HuggingFace dataset identifier — used for provenance + the persona id prefix.
  dataset: string;
  datasetRevision?: string;
  license?: string;
  attribution?: string;
};

const TEXT_QUERY_COLUMNS = [
  "persona",
  "professional_persona",
  "cultural_background",
  "skills_and_expertise",
  "hobbies_and_interests",
  "career_goals_and_ambitions",
  "occupation",
];

// Build a WHERE clause from a PersonaSearchQuery + a parallel parameter list.
// Uses 1-indexed `$N` placeholders that runQuery binds with the typed binders.
const buildWhereClause = (q: PersonaSearchQuery): { sql: string; params: Bindable[] } => {
  const conditions: string[] = [];
  const params: Bindable[] = [];
  const next = (): string => `$${params.length + 1}`;

  if (q.demographics?.ageMin != null) {
    conditions.push(`age >= ${next()}`);
    params.push(q.demographics.ageMin);
  }
  if (q.demographics?.ageMax != null) {
    conditions.push(`age <= ${next()}`);
    params.push(q.demographics.ageMax);
  }
  if (q.demographics?.sex?.length) {
    const placeholders = q.demographics.sex.map(() => next()).join(", ");
    conditions.push(`sex IN (${placeholders})`);
    params.push(...q.demographics.sex);
  }
  if (q.demographics?.maritalStatus?.length) {
    const placeholders = q.demographics.maritalStatus.map(() => next()).join(", ");
    conditions.push(`marital_status IN (${placeholders})`);
    params.push(...q.demographics.maritalStatus);
  }
  if (q.demographics?.educationLevel?.length) {
    const placeholders = q.demographics.educationLevel.map(() => next()).join(", ");
    conditions.push(`education_level IN (${placeholders})`);
    params.push(...q.demographics.educationLevel);
  }
  if (q.demographics?.occupation?.length) {
    const placeholders = q.demographics.occupation.map(() => next()).join(", ");
    conditions.push(`occupation IN (${placeholders})`);
    params.push(...q.demographics.occupation);
  }
  if (q.locale?.country) {
    conditions.push(`country = ${next()}`);
    params.push(q.locale.country);
  }
  if (q.locale?.province?.length) {
    const placeholders = q.locale.province.map(() => next()).join(", ");
    conditions.push(`province IN (${placeholders})`);
    params.push(...q.locale.province);
  }
  if (q.locale?.district?.length) {
    const placeholders = q.locale.district.map(() => next()).join(", ");
    conditions.push(`district IN (${placeholders})`);
    params.push(...q.locale.district);
  }
  if (q.textQuery && q.textQuery.trim().length > 0) {
    const tokens = q.textQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    if (tokens.length > 0) {
      const tokenClauses: string[] = [];
      for (const tok of tokens) {
        const ors = TEXT_QUERY_COLUMNS.map((col) => {
          const ph = next();
          params.push(`%${tok}%`);
          return `LOWER(${col}) LIKE ${ph}`;
        }).join(" OR ");
        tokenClauses.push(`(${ors})`);
      }
      conditions.push(`(${tokenClauses.join(" OR ")})`);
    }
  }

  return {
    sql: conditions.length === 0 ? "" : `WHERE ${conditions.join(" AND ")}`,
    params,
  };
};

const DEFAULT_SEARCH_LIMIT = 100;

export class LocalParquetNemotronSource implements PersonaSource {
  readonly id: string;
  readonly kind = "local_parquet" as const;

  private readonly opts: LocalParquetSourceOpts;
  private readonly globPath: string;
  private connPromise?: Promise<DuckDBConnection>;

  constructor(opts: LocalParquetSourceOpts) {
    this.opts = opts;
    this.id = `local_parquet:${opts.dataset}`;
    this.globPath = `${opts.rootDir}/data/train-*.parquet`;
    if (!isParquetGlobAvailable(opts.rootDir)) {
      throw new Error(
        `LocalParquetNemotronSource: parquet shards not found under ${opts.rootDir}/data/. ` +
          `Run \`huggingface-cli download ${opts.dataset} --repo-type dataset --local-dir ${opts.rootDir}\`.`,
      );
    }
  }

  private async getConn(): Promise<DuckDBConnection> {
    if (!this.connPromise) {
      this.connPromise = (async () => {
        const inst = await getDuckDBInstance();
        return inst.connect();
      })();
    }
    return this.connPromise;
  }

  private get readParquetExpr(): string {
    // DuckDB's read_parquet() with a glob pattern enumerates all shards in one
    // logical relation. We single-quote the path; the pattern itself is fixed
    // at construction time so SQL injection is not a risk.
    const escaped = this.globPath.replace(/'/g, "''");
    return `read_parquet('${escaped}')`;
  }

  async search(query: PersonaSearchQuery): Promise<PersonaSearchResult> {
    const start = Date.now();
    const conn = await this.getConn();
    const { sql: where, params } = buildWhereClause(query);
    const limit = query.sampleSize ?? DEFAULT_SEARCH_LIMIT;
    const sql = `SELECT * FROM ${this.readParquetExpr} ${where} LIMIT ${Math.max(1, Math.floor(limit))}`;
    const rows = await runQuery(conn, sql, params);
    const matches: PersonaRecord[] = [];
    for (const row of rows) {
      try {
        matches.push(
          normalizeNemotronRow(sanitizeBigInts(row), {
            dataset: this.opts.dataset,
            datasetRevision: this.opts.datasetRevision,
            license: this.opts.license,
            attribution: this.opts.attribution,
          }),
        );
      } catch (err) {
        // Skip malformed rows individually rather than failing the whole query.
        // The normalizer's error message already includes the row's uuid for
        // post-mortem debugging.
        console.warn(`[local-parquet] dropping invalid row: ${(err as Error).message}`);
      }
    }
    return {
      matches,
      sourceLatencyMs: Date.now() - start,
    };
  }

  async sample(config: PersonaSamplingConfig): Promise<PersonaRecord[]> {
    const baseQuery: PersonaSearchQuery = {
      ...(config.query ?? {}),
      sampleSize: Math.max(config.sampleSize * 4, config.sampleSize),
    };
    const all = (await this.search(baseQuery)).matches;
    if (!config.diversityBy?.length) return all.slice(0, config.sampleSize);

    // Bucket round-robin by the requested axes. Cheap deterministic sampler:
    // pick one from each bucket in turn until we hit sampleSize.
    const axisKey = (r: PersonaRecord): string => {
      const parts = (config.diversityBy ?? []).map((axis) => {
        switch (axis) {
          case "age":
            return `age:${typeof r.demographics.age === "number" ? Math.floor(r.demographics.age / 10) : "x"}`;
          case "region":
            return `region:${r.locale.province ?? "x"}`;
          case "occupation":
            return `occ:${r.demographics.occupation ?? "x"}`;
          case "educationLevel":
            return `edu:${r.demographics.educationLevel ?? "x"}`;
          default:
            return "x";
        }
      });
      return parts.join("|");
    };
    const buckets = new Map<string, PersonaRecord[]>();
    for (const r of all) {
      const key = axisKey(r);
      const list = buckets.get(key) ?? [];
      list.push(r);
      buckets.set(key, list);
    }
    const out: PersonaRecord[] = [];
    while (out.length < config.sampleSize && buckets.size > 0) {
      for (const [key, list] of buckets) {
        const chosen = list.shift();
        if (chosen) out.push(chosen);
        if (list.length === 0) buckets.delete(key);
        if (out.length >= config.sampleSize) break;
      }
    }
    return out;
  }

  async getById(id: string): Promise<PersonaRecord | null> {
    const expectedPrefix = `nemotron:${this.opts.dataset}:`;
    if (!id.startsWith(expectedPrefix)) return null;
    const rowId = id.slice(expectedPrefix.length);
    const conn = await this.getConn();
    const sql = `SELECT * FROM ${this.readParquetExpr} WHERE uuid = $1 LIMIT 1`;
    const rows = await runQuery(conn, sql, [rowId]);
    if (rows.length === 0) return null;
    const first = rows[0];
    if (!first) return null;
    return normalizeNemotronRow(sanitizeBigInts(first), {
      dataset: this.opts.dataset,
      datasetRevision: this.opts.datasetRevision,
      license: this.opts.license,
      attribution: this.opts.attribution,
    });
  }

  async close(): Promise<void> {
    if (this.connPromise) {
      const conn = await this.connPromise;
      conn.disconnectSync();
      this.connPromise = undefined;
    }
  }
}
