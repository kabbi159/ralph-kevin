import { z } from "zod";

// Persona search query — see docs/03_PERSONA_DATA_LAYER.md §Persona search query.
// Used by PersonaSource.search() across MockPersonaSource, LocalJsonPersonaSource,
// LocalParquetNemotronSource (DuckDB), HuggingFaceNemotronSource.

const TraitRangeSchema = z.tuple([z.number(), z.number()]);

export const PersonaSearchQuerySourceSchema = z
  .object({
    provider: z.enum(["nvidia", "custom"]).optional(),
    dataset: z.string().optional(),
    revision: z.string().optional(),
  })
  .optional();

export const PersonaSearchQueryLocaleSchema = z
  .object({
    country: z.string().optional(),
    language: z.string().optional(),
    province: z.array(z.string()).optional(),
    district: z.array(z.string()).optional(),
  })
  .optional();

export const PersonaSearchQueryDemographicsSchema = z
  .object({
    ageMin: z.number().int().nonnegative().optional(),
    ageMax: z.number().int().nonnegative().optional(),
    sex: z.array(z.string()).optional(),
    maritalStatus: z.array(z.string()).optional(),
    familyType: z.array(z.string()).optional(),
    housingType: z.array(z.string()).optional(),
    educationLevel: z.array(z.string()).optional(),
    occupation: z.array(z.string()).optional(),
  })
  .refine((d) => d?.ageMin === undefined || d?.ageMax === undefined || d.ageMin <= d.ageMax, {
    message: "ageMin must be <= ageMax",
  })
  .optional();

export const PersonaSearchQueryUxTraitsSchema = z
  .object({
    digitalLiteracy: TraitRangeSchema.optional(),
    priceSensitivity: TraitRangeSchema.optional(),
    riskAversion: TraitRangeSchema.optional(),
    patience: TraitRangeSchema.optional(),
    detailOrientation: TraitRangeSchema.optional(),
    trustSensitivity: TraitRangeSchema.optional(),
  })
  .optional();

export const PersonaSearchQueryDiversitySchema = z.array(
  z.enum(["age", "region", "occupation", "educationLevel"]),
);

export const PersonaSearchQuerySchema = z.object({
  textQuery: z.string().optional(),
  source: PersonaSearchQuerySourceSchema,
  locale: PersonaSearchQueryLocaleSchema,
  demographics: PersonaSearchQueryDemographicsSchema,
  uxTraits: PersonaSearchQueryUxTraitsSchema,
  sampleSize: z.number().int().positive().optional(),
  diversityBy: PersonaSearchQueryDiversitySchema.optional(),
});

export type PersonaSearchQuery = z.infer<typeof PersonaSearchQuerySchema>;
