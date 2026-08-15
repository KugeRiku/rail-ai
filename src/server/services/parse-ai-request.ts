import {
  structuredSearchConditionsSchema,
  type StructuredSearchConditions,
} from "@/schemas/ai-request";
import type { ConditionsParserClient } from "@/server/llm/orcarouter";

export const RAILSHOT_TIME_ZONE = "Asia/Tokyo" as const;

export type RequiredPlannerField =
  | "vehicleSeriesOrTripId"
  | "date"
  | "startTime"
  | "endTime"
  | "maxWalkMinutes";

export type ParseAiRequestResult =
  | { ok: true; conditions: StructuredSearchConditions }
  | {
      ok: false;
      conditions: StructuredSearchConditions;
      missingFields: RequiredPlannerField[];
    };

function formatDateInTokyo(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RAILSHOT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function normalizedIncludes(text: string, value: string): boolean {
  return text.normalize("NFKC").toLowerCase().includes(
    value.normalize("NFKC").toLowerCase(),
  );
}

function relativeDateFromText(text: string): "today" | "tomorrow" | null {
  if (/(明日|あした)/u.test(text)) {
    return "tomorrow";
  }
  if (/(今日|本日)/u.test(text)) {
    return "today";
  }
  return null;
}

function hasExplicitDateCue(text: string): boolean {
  return (
    /\d{4}[-/]\d{1,2}[-/]\d{1,2}/u.test(text) ||
    /\d{1,2}月\d{1,2}日/u.test(text)
  );
}

function hasTimeCue(text: string): boolean {
  return /\d{1,3}:\d{2}|午前|午後|朝|昼|夕方|夜/u.test(text);
}

function explicitTimeRange(
  text: string,
): { startTime: string; endTime: string } | null {
  if (/夕方/u.test(text)) {
    return { startTime: "16:00", endTime: "18:00" };
  }
  if (/午後/u.test(text)) {
    return { startTime: "12:00", endTime: "17:00" };
  }
  return null;
}

function hasWalkCue(text: string): boolean {
  return /徒歩|歩いて|駅から.{0,12}\d+分/u.test(text);
}

function hasLightingCue(text: string): boolean {
  return /光線|順光|逆光|光が|ライティング/u.test(text);
}

function requiredFields(
  conditions: StructuredSearchConditions,
): RequiredPlannerField[] {
  const missing: RequiredPlannerField[] = [];
  if (!conditions.vehicleSeries && !conditions.tripId) {
    missing.push("vehicleSeriesOrTripId");
  }
  if (!conditions.date) missing.push("date");
  if (!conditions.startTime) missing.push("startTime");
  if (!conditions.endTime) missing.push("endTime");
  if (conditions.maxWalkMinutes === null) missing.push("maxWalkMinutes");
  return missing;
}

export async function parseAiRequest(
  text: string,
  client: ConditionsParserClient,
  now = new Date(),
): Promise<ParseAiRequestResult> {
  const referenceDate = formatDateInTokyo(now);
  const parsed = await client.parseConditions({
    text,
    referenceDate,
    timeZone: RAILSHOT_TIME_ZONE,
  });
  const relativeDate = relativeDateFromText(text);
  const normalizedTimeRange = explicitTimeRange(text);
  const date = relativeDate
    ? addDays(referenceDate, relativeDate === "tomorrow" ? 1 : 0)
    : hasExplicitDateCue(text)
      ? parsed.date
      : null;
  const conditions = structuredSearchConditionsSchema.parse({
    vehicleSeries:
      parsed.vehicleSeries && normalizedIncludes(text, parsed.vehicleSeries)
        ? parsed.vehicleSeries
        : null,
    tripId:
      parsed.tripId && normalizedIncludes(text, parsed.tripId)
        ? parsed.tripId
        : null,
    date,
    startTime: hasTimeCue(text)
      ? (normalizedTimeRange?.startTime ?? parsed.startTime)
      : null,
    endTime: hasTimeCue(text)
      ? (normalizedTimeRange?.endTime ?? parsed.endTime)
      : null,
    maxWalkMinutes: hasWalkCue(text) ? parsed.maxWalkMinutes : null,
    lightingPreference: hasLightingCue(text)
      ? parsed.lightingPreference
      : null,
  });
  const missingFields = requiredFields(conditions);

  return missingFields.length === 0
    ? { ok: true, conditions }
    : { ok: false, conditions, missingFields };
}
