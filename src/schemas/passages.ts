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

export const passageRequestSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    shapeId: identifier.optional(),
    routeId: identifier.optional(),
    date: z.string().refine(isValidIsoDate, "Invalid ISO date"),
    startTime: serviceTime,
    endTime: serviceTime,
  })
  .strict()
  .refine((value) => Boolean(value.shapeId) !== Boolean(value.routeId), {
    message: "Exactly one of shapeId or routeId is required",
  });

export type PassageRequest = z.infer<typeof passageRequestSchema>;
