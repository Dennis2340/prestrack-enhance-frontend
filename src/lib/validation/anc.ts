import { z } from "zod";
import { VALUE_SETS, DANGER_SIGNS } from "@/lib/fhir/codes";

export const ancIntakeSchema = z.object({
  lmp: z.string().date().optional().or(z.literal("")).optional(),
  gravida: z.coerce.number().int().gte(0).optional(),
  para: z.coerce.number().int().gte(0).optional(),
});

export const quantitySchema = z.object({ value: z.coerce.number(), unit: z.string().min(1) });

export const observationSchema = z.object({
  codeSystem: z.string().min(1),
  code: z.string().min(1),
  valueQuantity: quantitySchema.optional(),
  valueCodeableConcept: z.object({ text: z.string().min(1) }).optional(),
  note: z.string().optional(),
});

export const interventionSchema = z.object({
  type: z.enum(["iptp", "iron_folate", "calcium", "deworming"]).default("iptp"),
  date: z.string().min(4),
  medicationCode: z.string().optional(),
  medicationSystem: z.string().optional(),
  doseText: z.string().optional(),
});

export const immunizationSchema = z.object({
  vaccineCode: z.string().min(1),
  vaccineSystem: z.string().min(1),
  occurrenceDateTime: z.string().min(4),
  lotNumber: z.string().optional(),
});

export const ancContactSchema = z.object({
  date: z.string().min(4),
  observations: z.array(observationSchema).optional().default([]),
  interventions: z.array(interventionSchema).optional().default([]),
  immunizations: z.array(immunizationSchema).optional().default([]),
  // Labs/screens (optional, validated when provided)
  hivResult: z.enum([...VALUE_SETS.HIV_RESULT] as [string, ...string[]]).optional(),
  syphilisResult: z.enum([...VALUE_SETS.SYPHILIS_RESULT] as [string, ...string[]]).optional(),
  hb: z
    .preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().gte(3).lte(25))
    .optional(),
  malariaRdt: z.enum([...VALUE_SETS.MALARIA_RDT] as [string, ...string[]]).optional(),
  // Danger signs (optional list of known keys)
  dangerSigns: z.array(z.enum([...DANGER_SIGNS] as [string, ...string[]])).optional().default([]),
});
