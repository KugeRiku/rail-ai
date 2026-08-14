import { describe, expect, it } from "vitest";
import { projectPointToShape } from "@/domain/geo/snap-to-shape";
import { formatServiceTimeHHMM } from "@/domain/gtfs/time";
import {
  estimateTripPassage,
  type PassageEstimate,
  type PassageStopTime,
  type TripPassageInput,
} from "@/domain/passages/estimate-trip-passage";

const SHAPE_COORDINATES = [
  [139, 35],
  [139.01, 35],
];

const BASE_STOP_TIMES: PassageStopTime[] = [
  {
    stopId: "STOP_A",
    stopSequence: 1,
    arrivalSeconds: 43_140,
    departureSeconds: 43_200,
    shapeDistance: 0,
    latitude: 35,
    longitude: 139,
  },
  {
    stopId: "STOP_B",
    stopSequence: 2,
    arrivalSeconds: 43_800,
    departureSeconds: 43_860,
    shapeDistance: 1_000,
    latitude: 35,
    longitude: 139.01,
  },
];

function createInput(
  selectedDistanceAlongShape: number,
  stopTimes = BASE_STOP_TIMES,
): TripPassageInput {
  return {
    tripId: "TRIP_A",
    tripShapeId: "SHAPE_A",
    targetShapeId: "SHAPE_A",
    shapeCoordinates: SHAPE_COORDINATES,
    selectedDistanceAlongShape,
    stopTimes,
  };
}

function requireEstimate(result: ReturnType<typeof estimateTripPassage>) {
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(`Expected an estimate, received ${result.reason}`);
  }
  return result satisfies PassageEstimate;
}

describe("estimateTripPassage", () => {
  it("returns the previous departure time at the previous stop", () => {
    const result = requireEstimate(estimateTripPassage(createInput(0)));

    expect(result.estimatedSeconds).toBe(43_200);
    expect(result.ratio).toBe(0);
    expect(result.isEstimated).toBe(true);
  });

  it("interpolates a point 25% through the section", () => {
    const result = requireEstimate(estimateTripPassage(createInput(250)));

    expect(result.estimatedSeconds).toBe(43_350);
    expect(result.ratio).toBe(0.25);
  });

  it("interpolates a point 50% through the section", () => {
    const result = requireEstimate(estimateTripPassage(createInput(500)));

    expect(result.estimatedSeconds).toBe(43_500);
    expect(result.ratio).toBe(0.5);
  });

  it("interpolates a point 75% through the section", () => {
    const result = requireEstimate(estimateTripPassage(createInput(750)));

    expect(result.estimatedSeconds).toBe(43_650);
    expect(result.ratio).toBe(0.75);
  });

  it("returns the next arrival time at the next stop", () => {
    const result = requireEstimate(estimateTripPassage(createInput(1_000)));

    expect(result.estimatedSeconds).toBe(43_800);
    expect(result.ratio).toBe(1);
  });

  it("keeps service-day seconds when a trip crosses midnight", () => {
    const overnightStops: PassageStopTime[] = [
      { ...BASE_STOP_TIMES[0], departureSeconds: 86_100 },
      { ...BASE_STOP_TIMES[1], arrivalSeconds: 86_700, departureSeconds: 86_700 },
    ];
    const result = requireEstimate(
      estimateTripPassage(createInput(500, overnightStops)),
    );

    expect(result.estimatedSeconds).toBe(86_400);
    expect(formatServiceTimeHHMM(result.estimatedSeconds)).toBe("24:00");
    expect(formatServiceTimeHHMM(90_600)).toBe("25:10");
  });

  it("rejects a trip that does not run on the selected shape", () => {
    const result = estimateTripPassage({
      ...createInput(500),
      tripShapeId: "SHAPE_B",
    });

    expect(result).toEqual({ ok: false, reason: "TRIP_SHAPE_MISMATCH" });
  });

  it("rejects stop_times that are not in increasing stop order", () => {
    const invalidStops: PassageStopTime[] = [
      { ...BASE_STOP_TIMES[0], stopSequence: 2 },
      { ...BASE_STOP_TIMES[1], stopSequence: 1 },
    ];
    const result = estimateTripPassage(createInput(500, invalidStops));

    expect(result).toEqual({ ok: false, reason: "INVALID_STOP_ORDER" });
  });

  it("rejects a zero-distance stop interval", () => {
    const zeroDistanceStops: PassageStopTime[] = [
      BASE_STOP_TIMES[0],
      { ...BASE_STOP_TIMES[1], shapeDistance: 0 },
    ];
    const result = estimateTripPassage(createInput(0, zeroDistanceStops));

    expect(result).toEqual({ ok: false, reason: "INVALID_STOP_ORDER" });
  });

  it("projects stop coordinates when shape_dist_traveled is unavailable", () => {
    const projectedStops = BASE_STOP_TIMES.map((stop) => ({
      ...stop,
      shapeDistance: null,
    }));
    const midpoint = projectPointToShape(SHAPE_COORDINATES, {
      longitude: 139.005,
      latitude: 35,
    });
    expect(midpoint).not.toBeNull();

    const result = requireEstimate(
      estimateTripPassage(
        createInput(midpoint?.distanceAlongShape ?? 0, projectedStops),
      ),
    );

    expect(result.estimatedSeconds).toBe(43_500);
    expect(result.distanceSource).toBe("projected");
  });

  it("prefers shape_dist_traveled over stop coordinate projection", () => {
    const offShapeStops = BASE_STOP_TIMES.map((stop) => ({
      ...stop,
      latitude: 34,
      longitude: 138,
    }));
    const result = requireEstimate(
      estimateTripPassage(createInput(500, offShapeStops)),
    );

    expect(result.estimatedSeconds).toBe(43_500);
    expect(result.distanceSource).toBe("shape_dist_traveled");
  });
});
