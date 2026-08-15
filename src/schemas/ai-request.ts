import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  });
const serviceTime = z.string().regex(/^\d{1,3}:[0-5]\d$/);
const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);

export const aiParseRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(500),
  })
  .strict();

export const llmParsedConditionsSchema = z
  .object({
    vehicleSeries: z.string().trim().min(1).max(100).nullable(),
    tripId: identifier.nullable(),
    date: isoDate.nullable(),
    startTime: serviceTime.nullable(),
    endTime: serviceTime.nullable(),
    maxWalkMinutes: z.number().int().min(0).max(180).nullable(),
    lightingPreference: z.enum(["good"]).nullable(),
  })
  .strict();

export const structuredSearchConditionsSchema = z
  .object({
    vehicleSeries: z.string().trim().min(1).max(100).nullable(),
    tripId: identifier.nullable(),
    date: isoDate.nullable(),
    startTime: serviceTime.nullable(),
    endTime: serviceTime.nullable(),
    maxWalkMinutes: z.number().int().min(0).max(180).nullable(),
    lightingPreference: z.enum(["good"]).nullable(),
  })
  .strict();

export type LlmParsedConditions = z.infer<typeof llmParsedConditionsSchema>;
export type StructuredSearchConditions = z.infer<
  typeof structuredSearchConditionsSchema
>;
