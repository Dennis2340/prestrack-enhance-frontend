// Minimal codes and units used for ANC capture (can be expanded later)

export const LOINC = {
  BODY_WEIGHT: "29463-7", // Body weight
  HEMOGLOBIN: "718-7", // Hemoglobin [Mass/volume] in Blood
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
