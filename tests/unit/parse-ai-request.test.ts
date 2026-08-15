import { describe, expect, it, vi } from "vitest";
import type { LlmParsedConditions } from "@/schemas/ai-request";
import type { ConditionsParserClient } from "@/server/llm/orcarouter";
import { parseAiRequest } from "@/server/services/parse-ai-request";

function parser(output: LlmParsedConditions): ConditionsParserClient {
  return { parseConditions: vi.fn().mockResolvedValue(output) };
}

const EMPTY_OUTPUT: LlmParsedConditions = {
  vehicleSeries: null,
  tripId: null,
  date: null,
  startTime: null,
  endTime: null,
  maxWalkMinutes: null,
  lightingPreference: null,
};

describe("parseAiRequest", () => {
  it("normalizes a Japanese request and resolves tomorrow in Asia/Tokyo", async () => {
    const result = await parseAiRequest(
      "明日の午後にSeries-Aを撮りたい。駅から10分以内がいい",
      parser({
        ...EMPTY_OUTPUT,
        vehicleSeries: "Series-A",
        startTime: "12:00",
        endTime: "17:00",
        maxWalkMinutes: 10,
      }),
      new Date("2026-08-14T15:30:00.000Z"),
    );

    expect(result).toEqual({
      ok: true,
      conditions: {
        vehicleSeries: "Series-A",
        tripId: null,
        date: "2026-08-16",
        startTime: "12:00",
        endTime: "17:00",
        maxWalkMinutes: 10,
        lightingPreference: null,
      },
    });
  });

  it("returns explicit missing fields for a vehicle-only request", async () => {
    const result = await parseAiRequest(
      "Series-Aを撮りたい",
      parser({ ...EMPTY_OUTPUT, vehicleSeries: "Series-A" }),
      new Date("2026-08-15T00:00:00.000Z"),
    );

    expect(result).toMatchObject({
      ok: false,
      missingFields: ["date", "startTime", "endTime", "maxWalkMinutes"],
    });
  });

  it("returns explicit missing fields for a time-only request", async () => {
    const result = await parseAiRequest(
      "今日の12:00から17:00まで",
      parser({
        ...EMPTY_OUTPUT,
        startTime: "12:00",
        endTime: "17:00",
      }),
      new Date("2026-08-15T00:00:00.000Z"),
    );

    expect(result).toMatchObject({
      ok: false,
      missingFields: ["vehicleSeriesOrTripId", "maxWalkMinutes"],
    });
  });

  it("normalizes an explicitly stated evening range deterministically", async () => {
    const result = await parseAiRequest(
      "Series-Bを今日の夕方に撮りたい。駅から15分まで",
      parser({
        ...EMPTY_OUTPUT,
        vehicleSeries: "Series-B",
        startTime: null,
        endTime: null,
        maxWalkMinutes: 15,
      }),
      new Date("2026-08-15T00:00:00.000Z"),
    );

    expect(result).toMatchObject({
      ok: true,
      conditions: {
        date: "2026-08-15",
        startTime: "16:00",
        endTime: "18:00",
      },
    });
  });

  it("removes vehicle information that was not present in user input", async () => {
    const result = await parseAiRequest(
      "明日の午後、駅から10分以内",
      parser({
        ...EMPTY_OUTPUT,
        vehicleSeries: "Series-Invented",
        startTime: "12:00",
        endTime: "17:00",
        maxWalkMinutes: 10,
      }),
      new Date("2026-08-15T00:00:00.000Z"),
    );

    expect(result).toMatchObject({
      ok: false,
      conditions: { vehicleSeries: null },
      missingFields: ["vehicleSeriesOrTripId"],
    });
  });
});
