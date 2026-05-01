import { existsSync } from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";

// Lazy DuckDB connection wrapper. The runner / search / sample paths share a
// single in-memory instance per source so connection setup amortizes across
// many queries within one CLI invocation.

export type DuckDBConnection = Awaited<ReturnType<DuckDBInstance["connect"]>>;

export const isParquetGlobAvailable = (rootDir: string): boolean => {
  // We only need to verify *one* shard exists — DuckDB itself will glob the
  // pattern at query time. This is how we let tests skip cleanly when the
  // dataset cache hasn't been downloaded.
  return existsSync(`${rootDir}/data/train-00000-of-00009.parquet`);
};

let _instance: DuckDBInstance | undefined;

export const getDuckDBInstance = async (): Promise<DuckDBInstance> => {
  if (!_instance) {
    _instance = await DuckDBInstance.create(":memory:");
  }
  return _instance;
};

export type Bindable = number | bigint | string | boolean | null;

export const runQuery = async (
  conn: DuckDBConnection,
  sql: string,
  params: Bindable[] = [],
): Promise<Array<Record<string, unknown>>> => {
  if (params.length === 0) {
    const r = await conn.runAndReadAll(sql);
    return r.getRowObjects() as Array<Record<string, unknown>>;
  }
  const prep = await conn.prepare(sql);
  for (let i = 0; i < params.length; i++) {
    const v = params[i];
    const idx = i + 1; // DuckDB params are 1-indexed
    if (v === null) {
      prep.bindNull(idx);
    } else if (typeof v === "boolean") {
      prep.bindBoolean(idx, v);
    } else if (typeof v === "bigint") {
      prep.bindBigInt(idx, v);
    } else if (typeof v === "number") {
      if (Number.isInteger(v)) prep.bindInteger(idx, v);
      else prep.bindDouble(idx, v);
    } else if (typeof v === "string") {
      prep.bindVarchar(idx, v);
    } else {
      throw new Error(`runQuery: unsupported parameter type at $${idx}: ${typeof v}`);
    }
  }
  const r = await prep.runAndReadAll();
  return r.getRowObjects() as Array<Record<string, unknown>>;
};

// Convert any nested BigInt values returned by DuckDB into plain JS numbers
// before they hit the rest of the pipeline (Zod, JSON.stringify both choke
// on BigInt). This is a hot path so the cast is shallow.
export const sanitizeBigInts = (row: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "bigint" ? Number(v) : v;
  }
  return out;
};
