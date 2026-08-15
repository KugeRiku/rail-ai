import { describe, expect, it } from "vitest";
import type { PassageTripCandidate } from "@/domain/passages/search-passages";
import { searchShootingPlans } from "@/domain/planner/search-shooting-plans";
import type { ShootingSpot } from "@/domain/shooting-spots/shooting-spot";

const MAX_EXPECTED_LIGHTING_BONUS = 5;

function spot(
  id: string,
  walkMinutes = 5,
  safetyStatus: ShootingSpot["safetyStatus"] = "approved",
  cameraBearing = 270,
): ShootingSpot {
  return {
    id,
    name: `撮影地点${id}`,
    latitude: 35,
    longitude: 139.005,
    nearestStation: "中間駅",
    walkMinutes,
    cameraBearing,
    notes: "テスト用の登録地点",
    safetyStatus,
  };
}

function trip(
  id: string,
  startSeconds: number,
  confidence: "confirmed" | "expected" | null = "confirmed",
  vehicleSeries = "Series-A",
  serviceId = "ACTIVE",
): PassageTripCandidate {
  return {
    routeId: "ROUTE_A",
    routeName: "デモ線",
    tripId: id,
    serviceId,
    shapeId: "SHAPE_A",
    headsign: "終点",
    directionId: 0,
    shapeCoordinates: [
      [139, 35],
      [139.01, 35],
    ],
    stopTimes: [
      {
        stopId: "STOP_A",
        stopSequence: 1,
        arrivalSeconds: startSeconds,
        departureSeconds: startSeconds,
        shapeDistance: null,
        longitude: 139,
        latitude: 35,
      },
      {
        stopId: "STOP_B",
        stopSequence: 2,
        arrivalSeconds: startSeconds + 600,
        departureSeconds: startSeconds + 600,
        shapeDistance: null,
        longitude: 139.01,
        latitude: 35,
      },
    ],
    vehicleAssignment: confidence
      ? {
          tripId: id,
          vehicleSeries,
          displayName: "デモ車両",
          confidence,
        }
      : null,
  };
}

function search(
  overrides: Partial<Parameters<typeof searchShootingPlans>[0]> = {},
) {
  return searchShootingPlans({
    vehicleSeries: "Series-A",
    startSeconds: 43_200,
    endSeconds: 64_800,
    maxWalkMinutes: 10,
    serviceDate: "2026-08-15",
    maxDistanceMeters: 250,
    activeServiceIds: new Set(["ACTIVE"]),
    spots: [spot("A")],
    trips: [trip("TRIP_A", 43_200)],
    ...overrides,
  });
}

describe("searchShootingPlans", () => {
  it("returns the registered spot, trip, estimate, vehicle and score reasons", () => {
    const result = search();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      spot: { id: "A", safetyStatus: "approved" },
      trip: { id: "TRIP_A", routeName: "デモ線", headsign: "終点" },
      estimatedPassageTime: "12:05",
      estimatedPassageSeconds: 43_500,
      isEstimated: true,
      vehicle: {
        vehicleSeries: "Series-A",
        confidence: "confirmed",
      },
      walkMinutes: 5,
      cameraBearing: 270,
      score: 93,
    });
    expect(result[0].scoreReasons).toEqual([
      "指定時間帯に通過（+40）",
      "対象車両 Series-A と一致（+20）",
      "徒歩5分（上限10分以内、+23）",
      "車両形式は確定情報（+10）",
    ]);
  });

  it("never returns unapproved spots or spots beyond the walking limit", () => {
    const result = search({
      spots: [spot("OK", 10), spot("TOO_FAR", 11), spot("PENDING", 2, "pending")],
    });

    expect(result.map((candidate) => candidate.spot.id)).toEqual(["OK"]);
  });

  it("filters inactive services and passages outside the time range", () => {
    expect(
      search({ trips: [trip("INACTIVE", 43_200, "confirmed", "Series-A", "OFF")] }),
    ).toEqual([]);
    expect(search({ trips: [trip("TOO_LATE", 72_000)] })).toEqual([]);
  });

  it("filters by exact vehicle series without inventing missing assignments", () => {
    const result = search({
      trips: [
        trip("MATCH", 43_200),
        trip("OTHER", 43_200, "confirmed", "Series-B"),
        trip("UNKNOWN", 43_200, null),
      ],
    });

    expect(result.map((candidate) => candidate.trip.id)).toEqual(["MATCH"]);
  });

  it("supports searching for a specific trip even without vehicle data", () => {
    const result = search({
      vehicleSeries: undefined,
      tripId: "TARGET",
      trips: [trip("TARGET", 43_200, null), trip("OTHER", 43_200)],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      trip: { id: "TARGET" },
      vehicle: null,
      score: 83,
    });
    expect(result[0].scoreReasons).toContain("車両形式の確度加点なし（+0）");
  });

  it("orders candidates deterministically by score and walking distance", () => {
    const result = search({
      spots: [spot("FAR", 8), spot("NEAR", 2)],
      trips: [
        trip("EXPECTED", 43_200, "expected"),
        trip("CONFIRMED", 43_800, "confirmed"),
      ],
    });

    expect(result.map((candidate) => [candidate.spot.id, candidate.trip.id])).toEqual([
      ["NEAR", "CONFIRMED"],
      ["NEAR", "EXPECTED"],
      ["FAR", "CONFIRMED"],
      ["FAR", "EXPECTED"],
    ]);
  });

  it("only adds a small lighting bonus when good lighting is requested", () => {
    const spots = [
      spot("FRONT_LIT", 5, "approved", 0),
      spot("BACK_LIT", 5, "approved", 180),
    ];
    const withoutPreference = search({ spots });
    const withPreference = search({ spots, lightingPreference: "good" });

    expect(withoutPreference.map((candidate) => candidate.score)).toEqual([
      93, 93,
    ]);
    expect(withoutPreference[0].scoreReasons).not.toEqual(
      expect.arrayContaining([expect.stringContaining("光線条件")]),
    );
    expect(withPreference[0].spot.id).toBe("FRONT_LIT");
    expect(withPreference[0].lightingScore).toBeGreaterThan(
      withPreference[1].lightingScore,
    );
    expect(withPreference[0].score - 93).toBeLessThanOrEqual(
      MAX_EXPECTED_LIGHTING_BONUS,
    );
    expect(withPreference[0].scoreReasons).toEqual(
      expect.arrayContaining([expect.stringContaining("光線条件は")]),
    );
  });

  it("preserves service-day times after 24:00", () => {
    const result = search({
      startSeconds: 86_400,
      endSeconds: 90_000,
      trips: [trip("NIGHT", 88_200)],
    });

    expect(result[0]).toMatchObject({
      estimatedPassageTime: "24:35",
      estimatedPassageSeconds: 88_500,
    });
  });

  it("returns an empty list when there are no matching candidates", () => {
    expect(search({ vehicleSeries: "Series-Z" })).toEqual([]);
    expect(search({ vehicleSeries: undefined, tripId: undefined })).toEqual([]);
  });
});
