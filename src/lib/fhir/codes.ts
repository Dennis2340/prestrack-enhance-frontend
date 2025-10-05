// Minimal codes and units used for ANC capture (can be expanded later)

export const LOINC = {
  BODY_WEIGHT: "29463-7", // Body weight
  HEMOGLOBIN: "718-7", // Hemoglobin [Mass/volume] in Blood
  SYSTOLIC_BP: "8480-6", // Systolic blood pressure
  DIASTOLIC_BP: "8462-4", // Diastolic blood pressure
  HEART_RATE: "8867-4", // Heart rate (used for fetal heart rate capture)
};

export const LOCAL = {
  BP: "bp", // e.g., 120/80
  FUNDAL_HEIGHT: "fundal-height",
  FHR: "fhr",
  HIV_RESULT: "hiv-result", // positive/negative/unknown
  SYPHILIS_RESULT: "syphilis-result",
  MALARIA_RDT: "malaria-rdt",
};

export const UNITS = {
  KG: "kg",
  CM: "cm",
  BPM: "bpm",
  MM_HG: "mm[Hg]",
};

export const MEDS = {
  IPTP: { code: "SP", system: "local" }, // Sulfadoxine-pyrimethamine placeholder
  IRON_FOLATE: { code: "iron-folate", system: "local" },
  CALCIUM: { code: "calcium", system: "local" },
};

export const VACCINES = {
  TT: { code: "TT", system: "local" },
};

export const DANGER_SIGNS = [
  "severe_headache",
  "blurred_vision",
  "vaginal_bleeding",
  "severe_abdominal_pain",
  "reduced_fetal_movements",
  "fever",
] as const;

// Value sets for common ANC labs/screens (DAK-aligned simplifications)
export const VALUE_SETS = {
  HIV_RESULT: ["positive", "negative", "invalid", "unknown"] as const,
  SYPHILIS_RESULT: ["positive", "negative", "invalid", "unknown"] as const,
  MALARIA_RDT: ["positive", "negative", "invalid", "unknown"] as const,
};
