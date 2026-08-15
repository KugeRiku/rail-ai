import type { StructuredSearchConditions } from "@/schemas/ai-request";

export const DEMO_AI_INPUT =
  "2026-08-16の午後にSeries-Aを撮りたい。駅から10分以内で、できれば光線条件がいい場所";

export const DEMO_FALLBACK_CONDITIONS: StructuredSearchConditions = {
  vehicleSeries: "Series-A",
  tripId: null,
  date: "2026-08-16",
  startTime: "12:00",
  endTime: "17:00",
  maxWalkMinutes: 10,
  lightingPreference: "good",
};
