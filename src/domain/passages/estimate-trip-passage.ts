import type { Position } from "geojson";
import { projectPointToShape } from "@/domain/geo/snap-to-shape";

export type PassageStopTime = {
  stopId: string;
  stopSequence: number;
  arrivalSeconds: number;
  departureSeconds: number;
  /** Normalized distance in meters; null falls back to coordinate projection. */
  shapeDistance: number | null;
  latitude: number;
  longitude: number;
};

export type TripPassageInput = {
  tripId: string;
  tripShapeId: string;
  targetShapeId: string;
  shapeCoordinates: Position[];
  /** Distance from the shape origin in meters. */
  selectedDistanceAlongShape: number;
  stopTimes: PassageStopTime[];
};

export type PassageEstimate = {
  ok: true;
  tripId: string;
  shapeId: string;
  estimatedSeconds: number;
  isEstimated: true;
  previousStopId: string;
  nextStopId: string;
  previousStopDistance: number;
  nextStopDistance: number;
  ratio: number;
  distanceSource: "shape_dist_traveled" | "projected" | "mixed";
};

export type PassageEstimationFailureReason =
  | "TRIP_SHAPE_MISMATCH"
  | "INSUFFICIENT_STOPS"
  | "INVALID_INPUT"
  | "INVALID_STOP_ORDER"
  | "STOP_PROJECTION_FAILED"
  | "OUTSIDE_STOP_RANGE";

export type PassageEstimationResult =
  | PassageEstimate
  | { ok: false; reason: PassageEstimationFailureReason };

type LocatedStopTime = PassageStopTime & {
  distanceAlongShape: number;
  distanceSource: "shape_dist_traveled" | "projected";
};

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function locateStopTime(
  stopTime: PassageStopTime,
  shapeCoordinates: Position[],
): LocatedStopTime | null {
  if (stopTime.shapeDistance !== null) {
    if (!isFiniteNonNegative(stopTime.shapeDistance)) {
      return null;
    }

    return {
      ...stopTime,
      distanceAlongShape: stopTime.shapeDistance,
      distanceSource: "shape_dist_traveled",
    };
  }

  const projected = projectPointToShape(shapeCoordinates, {
    latitude: stopTime.latitude,
    longitude: stopTime.longitude,
  });

  if (!projected) {
    return null;
  }

  return {
    ...stopTime,
    distanceAlongShape: projected.distanceAlongShape,
    distanceSource: "projected",
  };
}

function getDistanceSource(
  previous: LocatedStopTime,
  next: LocatedStopTime,
): PassageEstimate["distanceSource"] {
  return previous.distanceSource === next.distanceSource
    ? previous.distanceSource
    : "mixed";
}

export function estimateTripPassage(
  input: TripPassageInput,
): PassageEstimationResult {
  if (input.tripShapeId !== input.targetShapeId) {
    return { ok: false, reason: "TRIP_SHAPE_MISMATCH" };
  }

  if (input.stopTimes.length < 2) {
    return { ok: false, reason: "INSUFFICIENT_STOPS" };
  }

  if (
    !isFiniteNonNegative(input.selectedDistanceAlongShape) ||
    input.shapeCoordinates.length < 2
  ) {
    return { ok: false, reason: "INVALID_INPUT" };
  }

  const locatedStops: LocatedStopTime[] = [];

  for (let index = 0; index < input.stopTimes.length; index += 1) {
    const stopTime = input.stopTimes[index];
    const previousInput = input.stopTimes[index - 1];

    if (
      !Number.isInteger(stopTime.stopSequence) ||
      stopTime.stopSequence <= 0 ||
      !isFiniteNonNegative(stopTime.arrivalSeconds) ||
      !isFiniteNonNegative(stopTime.departureSeconds) ||
      stopTime.departureSeconds < stopTime.arrivalSeconds ||
      (previousInput !== undefined &&
        stopTime.stopSequence <= previousInput.stopSequence)
    ) {
      return { ok: false, reason: "INVALID_STOP_ORDER" };
    }

    const located = locateStopTime(stopTime, input.shapeCoordinates);
    if (!located) {
      return { ok: false, reason: "STOP_PROJECTION_FAILED" };
    }

    const previous = locatedStops.at(-1);
    if (
      previous &&
      (located.distanceAlongShape <= previous.distanceAlongShape ||
        located.arrivalSeconds < previous.departureSeconds)
    ) {
      return { ok: false, reason: "INVALID_STOP_ORDER" };
    }

    locatedStops.push(located);
  }

  const firstStop = locatedStops[0];
  const lastStop = locatedStops.at(-1);
  if (
    input.selectedDistanceAlongShape < firstStop.distanceAlongShape ||
    !lastStop ||
    input.selectedDistanceAlongShape > lastStop.distanceAlongShape
  ) {
    return { ok: false, reason: "OUTSIDE_STOP_RANGE" };
  }

  for (let index = 0; index < locatedStops.length - 1; index += 1) {
    const previous = locatedStops[index];
    const next = locatedStops[index + 1];

    if (input.selectedDistanceAlongShape > next.distanceAlongShape) {
      continue;
    }

    const ratio =
      (input.selectedDistanceAlongShape - previous.distanceAlongShape) /
      (next.distanceAlongShape - previous.distanceAlongShape);
    // A station interval starts at the previous departure and ends at the
    // next arrival. The result remains an estimate even at either endpoint.
    const estimatedSeconds = Math.round(
      previous.departureSeconds +
        (next.arrivalSeconds - previous.departureSeconds) * ratio,
    );

    return {
      ok: true,
      tripId: input.tripId,
      shapeId: input.targetShapeId,
      estimatedSeconds,
      isEstimated: true,
      previousStopId: previous.stopId,
      nextStopId: next.stopId,
      previousStopDistance: previous.distanceAlongShape,
      nextStopDistance: next.distanceAlongShape,
      ratio,
      distanceSource: getDistanceSource(previous, next),
    };
  }

  return { ok: false, reason: "OUTSIDE_STOP_RANGE" };
}
