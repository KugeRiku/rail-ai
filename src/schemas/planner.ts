import { z } from "zod";

const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const serviceTime = z.string().regex(/^\d{1,3}:[0-5]\d$/);

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const plannerSearchRequestSchema = z
  .object({
    vehicleSeries: z.string().trim().min(1).max(100).optional(),
    tripId: identifier.optional(),
    date: z.string().refine(isValidIsoDate, "Invalid ISO date"),
    startTime: serviceTime,
    endTime: serviceTime,
    maxWalkMinutes: z.number().int().min(0).max(180),
    lightingPreference: z.enum(["good"]).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.vehicleSeries) || Boolean(value.tripId), {
    message: "vehicleSeries or tripId is required",
  });

export type PlannerSearchRequest = z.infer<typeof plannerSearchRequestSchema>;
