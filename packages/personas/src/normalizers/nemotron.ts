import { type PersonaRecord, PersonaRecordSchema } from "@personabench/core";
import { buildEmbeddingText } from "./embedding-text";

// NemotronNormalizer — Nemotron-Personas-* row → PersonaRecord.
// Locale-agnostic by construction: every column listed in FIRST_CLASS_MAP maps
// onto a typed first-class field; everything else flows into narratives.raw
// without dropping. Korea-specific examples: military_status, bachelors_field.

export type NormalizationContext = {
  dataset: string;
  datasetRevision?: string;
  license?: string;
  attribution?: string;
};

// Source-column-name → PersonaRecord-path mapping. The path notation is dotted
// and goes through PersonaRecord; values land at the corresponding leaf.
// Anything not listed here flows into narratives.raw[<column_name>].
const FIRST_CLASS_MAP: Record<string, string> = {
  uuid: "__id__",
  // narratives.*
  persona: "narratives.persona",
  professional_persona: "narratives.professionalPersona",
  cultural_background: "narratives.culturalBackground",
  skills_and_expertise: "narratives.skillsAndExpertise",
  skills_and_expertise_list: "narratives.skillsAndExpertiseList",
  hobbies_and_interests: "narratives.hobbiesAndInterests",
  hobbies_and_interests_list: "narratives.hobbiesAndInterestsList",
  travel_persona: "narratives.travelPersona",
  culinary_persona: "narratives.culinaryPersona",
  family_persona: "narratives.familyPersona",
  sports_persona: "narratives.sportsPersona",
  arts_persona: "narratives.artsPersona",
  career_goals_and_ambitions: "narratives.careerGoalsAndAmbitions",
  // demographics.*
  age: "demographics.age",
  sex: "demographics.sex",
  marital_status: "demographics.maritalStatus",
  family_type: "demographics.familyType",
  housing_type: "demographics.housingType",
  education_level: "demographics.educationLevel",
  occupation: "demographics.occupation",
  // locale.*
  country: "locale.country",
  language: "locale.language",
  province: "locale.province",
  district: "locale.district",
};

const LIST_COLUMNS = new Set(["skills_and_expertise_list", "hobbies_and_interests_list"]);

const isPlainString = (v: unknown): v is string => typeof v === "string" && v.length > 0;

// Parquet rows can return BigInt for BIGINT columns. JSON-stringification of
// BigInt throws, and the schema expects plain JS numbers, so coerce here.
const toNumberish = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && v.length > 0 && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
};

const parseListField = (v: unknown): string[] | undefined => {
  if (Array.isArray(v)) {
    return v.filter(isPlainString);
  }
  if (typeof v === "string" && v.trim().length > 0) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter(isPlainString);
    } catch {
      // fall back to comma split
      return v
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }
  return undefined;
};

const setNestedValue = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const segments = path.split(".");
  let cur = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (typeof seg !== "string") return;
    if (typeof cur[seg] !== "object" || cur[seg] === null) {
      cur[seg] = {};
    }
    cur = cur[seg] as Record<string, unknown>;
  }
  const last = segments[segments.length - 1];
  if (typeof last !== "string") return;
  cur[last] = value;
};

export const normalizeNemotronRow = (
  row: Record<string, unknown>,
  ctx: NormalizationContext,
): PersonaRecord => {
  const out: Record<string, unknown> = {
    locale: {},
    demographics: {},
    narratives: {},
  };
  const raw: Record<string, unknown> = {};

  let id: string | undefined;

  for (const [col, value] of Object.entries(row)) {
    if (value === null || value === undefined) continue;
    const dest = FIRST_CLASS_MAP[col];

    if (!dest) {
      // unknown column — preserve verbatim, locale-agnostic catch-all
      raw[col] = value;
      continue;
    }

    if (dest === "__id__") {
      id = isPlainString(value) ? value : String(value);
      continue;
    }

    let coerced: unknown = value;
    if (dest === "demographics.age") {
      coerced = toNumberish(value);
    } else if (LIST_COLUMNS.has(col)) {
      coerced = parseListField(value);
    } else if (typeof value === "bigint") {
      coerced = Number(value);
    }
    if (coerced === undefined) continue;
    setNestedValue(out, dest, coerced);
  }

  if (Object.keys(raw).length > 0) {
    (out.narratives as Record<string, unknown>).raw = raw;
  }

  const rowId = id;
  const personaId = rowId
    ? `nemotron:${ctx.dataset}:${rowId}`
    : `nemotron:${ctx.dataset}:${Math.random().toString(36).slice(2)}`;

  const record: Record<string, unknown> = {
    id: personaId,
    source: {
      provider: "nvidia",
      dataset: ctx.dataset,
      ...(ctx.datasetRevision ? { datasetRevision: ctx.datasetRevision } : {}),
      ...(rowId ? { rowId } : {}),
      ...(ctx.license ? { license: ctx.license } : {}),
      ...(ctx.attribution ? { attribution: ctx.attribution } : {}),
    },
    locale: out.locale,
    demographics: out.demographics,
    narratives: out.narratives,
  };

  // Validate via PersonaRecordSchema. If invalid, surface the issue with the
  // source rowId attached so callers can debug a specific bad row in the parquet.
  const parsed = PersonaRecordSchema.safeParse(record);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`normalizeNemotronRow: invalid row ${rowId ?? "(no uuid)"}: ${issues}`);
  }

  // Build embeddingText from the validated record.
  parsed.data.embeddingText = buildEmbeddingText(parsed.data);
  return parsed.data;
};
