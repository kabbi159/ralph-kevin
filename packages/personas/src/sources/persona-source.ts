import type { PersonaRecord, PersonaSearchQuery } from "@personabench/core";

// PersonaSource — see docs/03_PERSONA_DATA_LAYER.md §Source interface.
// Implementations: MockPersonaSource (fixtures), LocalJsonPersonaSource
// (BYO NDJSON), LocalParquetNemotronSource (DuckDB), HuggingFaceNemotronSource
// (deferred). The hosted-track HostedVectorPersonaSource is not built here.

export type PersonaSourceKind =
  | "mock"
  | "local_json"
  | "local_parquet"
  | "huggingface"
  | "hosted_vector";

export type PersonaSamplingConfig = {
  query?: PersonaSearchQuery;
  sampleSize: number;
  diversityBy?: PersonaSearchQuery["diversityBy"];
};

export type PersonaSearchResult = {
  matches: PersonaRecord[];
  totalEstimated?: number;
  sourceLatencyMs?: number;
};

export interface PersonaSource {
  readonly id: string;
  readonly kind: PersonaSourceKind;

  search(query: PersonaSearchQuery): Promise<PersonaSearchResult>;
  sample(config: PersonaSamplingConfig): Promise<PersonaRecord[]>;
  getById(id: string): Promise<PersonaRecord | null>;
}
