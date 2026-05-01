import type { PersonaRecord } from "@personabench/core";

// UX-focused embedding text — see docs/03_PERSONA_DATA_LAYER.md §Embedding text builder.
// Used by HostedVectorPersonaSource (hosted track) and by LocalParquetNemotronSource
// when it needs a similarity-search-ready text representation.

export const buildEmbeddingText = (r: PersonaRecord): string => {
  const lines: string[] = [];
  lines.push(`Country: ${r.locale.country ?? ""}`);
  const region = [r.locale.province, r.locale.district].filter(Boolean).join(" ");
  lines.push(`Region: ${region}`);
  lines.push(`Age: ${r.demographics.age ?? ""}`);
  lines.push(`Occupation: ${r.demographics.occupation ?? ""}`);
  lines.push(`Education: ${r.demographics.educationLevel ?? ""}`);
  lines.push(`Family: ${r.demographics.familyType ?? ""}`);
  lines.push(`Housing: ${r.demographics.housingType ?? ""}`);
  lines.push("");
  lines.push(`Core persona: ${r.narratives.persona ?? ""}`);
  lines.push(`Professional context: ${r.narratives.professionalPersona ?? ""}`);
  lines.push(`Cultural background: ${r.narratives.culturalBackground ?? ""}`);
  lines.push(
    `Skills: ${r.narratives.skillsAndExpertise ?? r.narratives.skillsAndExpertiseList?.join(", ") ?? ""}`,
  );
  lines.push(
    `Hobbies: ${r.narratives.hobbiesAndInterests ?? r.narratives.hobbiesAndInterestsList?.join(", ") ?? ""}`,
  );
  lines.push(`Goals: ${r.narratives.careerGoalsAndAmbitions ?? ""}`);
  lines.push(
    `Consumer/lifestyle hints: ${[
      r.narratives.travelPersona,
      r.narratives.culinaryPersona,
      r.narratives.familyPersona,
      r.narratives.sportsPersona,
      r.narratives.artsPersona,
    ]
      .filter(Boolean)
      .join(" / ")}`,
  );
  return lines.join("\n");
};
