import { describe, expect, it } from "vitest";
import type { PassageStopTime } from "@/domain/passages/estimate-trip-passage";
import {
  searchPassages,
  type PassageTripCandidate,
} from "@/domain/passages/search-passages";

const OUTBOUND_SHAPE = [
  [139, 35],
  [139.01, 35],
];
const INBOUND_SHAPE = OUTBOUND_SHAPE.toReversed();

function stops(
  startSeconds: number,
  endSeconds: number,
  direction: 0 | 1 = 0,
): PassageStopTime[] {
  const coordinates = direction === 0 ? OUTBOUND_SHAPE : INBOUND_SHAPE;
  return [
    {
      stopId: direction === 0 ? "STOP_A" : "STOP_B",
      stopSequence: 1,
      arrivalSeconds: startSeconds,
      departureSeconds: startSeconds,
      shapeDistance: null,
      longitude: coordinates[0][0],
      latitude: coordinates[0][1],
    },
    {
      stopId: direction === 0 ? "STOP_B" : "STOP_A",
      stopSequence: 2,
      arrivalSeconds: endSeconds,
      departureSeconds: endSeconds,
      shapeDistance: null,
      longitude: coordinates[1][0],
      latitude: coordinates[1][1],
    },
  ];
}

function candidate(
  tripId: string,
  startSeconds: number,
  endSeconds: number,
  direction: 0 | 1 = 0,
): PassageTripCandidate {
  return {
    routeId: "ROUTE_A",
    routeName: "デモ線",
    tripId,
    serviceId: "WEEKDAY",
    shapeId: direction === 0 ? "OUTBOUND" : "INBOUND",
    headsign: direction === 0 ? "B駅" : "A駅",
    directionId: direction,
    shapeCoordinates: direction === 0 ? OUTBOUND_SHAPE : INBOUND_SHAPE,
    stopTimes: stops(startSeconds, endSeconds, direction),
  };
}

function search(candidates: PassageTripCandidate[], start = 0, end = 200_000) {
  return searchPassages({
    latitude: 35,
    longitude: 139.005,
    startSeconds: start,
    endSeconds: end,
    maxDistanceMeters: 250,
    activeServiceIds: new Set(["WEEKDAY"]),
    candidates,
  });
}

describe("searchPassages", () => {
  it("returns an empty list when there are no candidates", () => {
    expect(search([])).toEqual([]);
  });

  it("returns one train in the requested time range", () => {
    const result = search([candidate("TRIP_A", 43_200, 43_800)], 43_000, 44_000);

    expect(result).toMatchObject([
      {
        tripId: "TRIP_A",
        routeName: "デモ線",
        headsign: "B駅",
        estimatedSeconds: 43_500,
        estimatedTime: "12:05",
        isEstimated: true,
        previousStopId: "STOP_A",
        nextStopId: "STOP_B",
      },
    ]);
  });

  it("returns multiple trains sorted by estimated time", () => {
    const result = search([
      candidate("LATE", 44_400, 45_000),
      candidate("EARLY", 43_200, 43_800),
      candidate("MIDDLE", 43_800, 44_400),
    ]);

    expect(result.map((passage) => passage.tripId)).toEqual([
      "EARLY",
      "MIDDLE",
      "LATE",
    ]);
  });

  it("excludes trains outside the requested time range", () => {
    const result = search([candidate("NOON", 43_200, 43_800)], 46_800, 50_400);

    expect(result).toEqual([]);
  });

  it("finds trains on outbound and inbound shapes", () => {
    const result = search([
      candidate("OUT", 43_200, 43_800, 0),
      candidate("IN", 44_400, 45_000, 1),
    ]);

    expect(result.map(({ tripId, directionId }) => ({ tripId, directionId }))).toEqual([
      { tripId: "OUT", directionId: 0 },
      { tripId: "IN", directionId: 1 },
    ]);
  });

  it("returns trains after 24:00 without wrapping the time", () => {
    const result = search(
      [candidate("NIGHT", 88_200, 88_800)],
      86_400,
      90_000,
    );

    expect(result[0]).toMatchObject({
      tripId: "NIGHT",
      estimatedSeconds: 88_500,
      estimatedTime: "24:35",
    });
  });

  it("excludes trips whose service is inactive", () => {
    const result = searchPassages({
      latitude: 35,
      longitude: 139.005,
      startSeconds: 0,
      endSeconds: 100_000,
      maxDistanceMeters: 250,
      activeServiceIds: new Set(),
      candidates: [candidate("INACTIVE", 43_200, 43_800)],
    });

    expect(result).toEqual([]);
  });
});
