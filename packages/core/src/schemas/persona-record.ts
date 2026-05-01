import { z } from "zod";

// Persona provenance — see docs/03_PERSONA_DATA_LAYER.md §Normalized persona record.
// Provenance is non-negotiable: every PersonaRecord must declare its origin so
// reports never present synthetic personas as real-user research.
export const PersonaSourceSchema = z.object({
  provider: z.enum(["nvidia", "custom", "mock"]),
  dataset: z.string().min(1),
  datasetRevision: z.string().optional(),
  rowId: z.string().optional(),
  license: z.string().optional(),
  attribution: z.string().optional(),
});

export const PersonaLocaleSchema = z.object({
  country: z.string().optional(),
  language: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
});

export const PersonaDemographicsSchema = z.object({
  age: z.number().int().nonnegative().optional(),
  sex: z.string().optional(),
  maritalStatus: z.string().optional(),
  familyType: z.string().optional(),
  housingType: z.string().optional(),
  educationLevel: z.string().optional(),
  occupation: z.string().optional(),
});

// Narratives.raw is the locale-agnostic catch-all. Korea-specific columns like
// `military_status` and `bachelors_field`, plus any future locale-specific
// fields, flow here rather than being silently dropped by the normalizer.
export const PersonaNarrativesSchema = z.object({
  persona: z.string().optional(),
  professionalPersona: z.string().optional(),
  culturalBackground: z.string().optional(),
  skillsAndExpertise: z.string().optional(),
  skillsAndExpertiseList: z.array(z.string()).optional(),
  hobbiesAndInterests: z.string().optional(),
  hobbiesAndInterestsList: z.array(z.string()).optional(),
  travelPersona: z.string().optional(),
  culinaryPersona: z.string().optional(),
  familyPersona: z.string().optional(),
  sportsPersona: z.string().optional(),
  artsPersona: z.string().optional(),
  careerGoalsAndAmbitions: z.string().optional(),
  raw: z.record(z.unknown()).optional(),
});

export const PersonaDerivedTraitsSchema = z
  .object({
    digitalLiteracy: z.number().optional(),
    priceSensitivity: z.number().optional(),
    riskAversion: z.number().optional(),
    patience: z.number().optional(),
    detailOrientation: z.number().optional(),
    trustSensitivity: z.number().optional(),
    mobileConfidence: z.number().optional(),
  })
  .optional();

export const PersonaRecordSchema = z.object({
  id: z.string().min(1),
  source: PersonaSourceSchema,
  locale: PersonaLocaleSchema,
  demographics: PersonaDemographicsSchema,
  narratives: PersonaNarrativesSchema,
  derivedTraits: PersonaDerivedTraitsSchema,
  embeddingText: z.string().optional(),
});

export type PersonaSource = z.infer<typeof PersonaSourceSchema>;
export type PersonaLocale = z.infer<typeof PersonaLocaleSchema>;
export type PersonaDemographics = z.infer<typeof PersonaDemographicsSchema>;
export type PersonaNarratives = z.infer<typeof PersonaNarrativesSchema>;
export type PersonaDerivedTraits = z.infer<typeof PersonaDerivedTraitsSchema>;
export type PersonaRecord = z.infer<typeof PersonaRecordSchema>;
