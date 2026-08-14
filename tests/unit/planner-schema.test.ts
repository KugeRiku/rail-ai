import { describe, expect, it } from "vitest";
import { plannerSearchRequestSchema } from "@/schemas/planner";

describe("plannerSearchRequestSchema", () => {
  it("accepts structured vehicle search conditions", () => {
    expect(
      plannerSearchRequestSchema.safeParse({
        vehicleSeries: "Series-A",
        date: "2026-08-15",
        startTime: "12:00",
        endTime: "17:00",
        maxWalkMinutes: 10,
      }).success,
    ).toBe(true);
  });

  it("requires a vehicle series or trip and validates bounds", () => {
    expect(
      plannerSearchRequestSchema.safeParse({
        date: "2026-08-15",
        startTime: "12:00",
        endTime: "17:00",
        maxWalkMinutes: 10,
      }).success,
    ).toBe(false);
    expect(
      plannerSearchRequestSchema.safeParse({
        tripId: "TRIP_A",
        date: "2026-02-30",
        startTime: "12:00",
        endTime: "17:00",
        maxWalkMinutes: -1,
      }).success,
    ).toBe(false);
  });
});
