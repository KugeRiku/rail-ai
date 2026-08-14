import type { Position } from "geojson";
import { snapPointToShape } from "@/domain/geo/snap-to-shape";
import { formatServiceTimeHHMM } from "@/domain/gtfs/time";
import {
  estimateTripPassage,
  type PassageStopTime,
} from "@/domain/passages/estimate-trip-passage";

export type PassageTripCandidate = {
  routeId: string;
  routeName: string;
  tripId: string;
  serviceId: string;
  shapeId: string;
  headsign: string;
  directionId: number;
  shapeCoordinates: Position[];
  stopTimes: PassageStopTime[];
};

export type PassageListItem = {
  routeId: string;
  routeName: string;
  tripId: string;
  shapeId: string;
  headsign: string;
  directionId: number;
  estimatedSeconds: number;
  estimatedTime: string;
  isEstimated: true;
};

type PassageSearchInput = {
  latitude: number;
  longitude: number;
  startSeconds: number;
  endSeconds: number;
  maxDistanceMeters: number;
  activeServiceIds: ReadonlySet<string>;
  candidates: PassageTripCandidate[];
};

export function searchPassages({
  latitude,
  longitude,
  startSeconds,
  endSeconds,
  maxDistanceMeters,
  activeServiceIds,
  candidates,
}: PassageSearchInput): PassageListItem[] {
  const projectionByShape = new Map<
    string,
    ReturnType<typeof snapPointToShape>
  >();
  const passages: PassageListItem[] = [];

  for (const candidate of candidates) {
    if (!activeServiceIds.has(candidate.serviceId)) {
      continue;
    }

    let projection = projectionByShape.get(candidate.shapeId);
    if (!projectionByShape.has(candidate.shapeId)) {
      projection = snapPointToShape(
        candidate.shapeCoordinates,
        { latitude, longitude },
        maxDistanceMeters,
      );
      projectionByShape.set(candidate.shapeId, projection ?? null);
    }

    if (!projection) {
      continue;
    }

    const estimate = estimateTripPassage({
      tripId: candidate.tripId,
      tripShapeId: candidate.shapeId,
      targetShapeId: candidate.shapeId,
      shapeCoordinates: candidate.shapeCoordinates,
      selectedDistanceAlongShape: projection.distanceAlongShape,
      stopTimes: candidate.stopTimes,
    });

    if (
      !estimate.ok ||
      estimate.estimatedSeconds < startSeconds ||
      estimate.estimatedSeconds > endSeconds
    ) {
      continue;
    }

    passages.push({
      routeId: candidate.routeId,
      routeName: candidate.routeName,
      tripId: candidate.tripId,
      shapeId: candidate.shapeId,
      headsign: candidate.headsign,
      directionId: candidate.directionId,
      estimatedSeconds: estimate.estimatedSeconds,
      estimatedTime: formatServiceTimeHHMM(estimate.estimatedSeconds),
      isEstimated: true,
    });
  }

  return passages.toSorted(
    (left, right) =>
      left.estimatedSeconds - right.estimatedSeconds ||
      left.tripId.localeCompare(right.tripId),
  );
}
