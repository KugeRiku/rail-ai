import { lineString, point } from "@turf/helpers";
import length from "@turf/length";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import type { Position } from "geojson";

export type ShapeSelectionMeasurement = {
  latitude: number;
  longitude: number;
  distanceAlongShape: number;
  totalShapeDistance: number;
  distanceFromShape: number;
};

export type SelectedRailPoint = ShapeSelectionMeasurement & {
  routeId: string;
  shapeId: string;
};

type ClickCoordinate = {
  latitude: number;
  longitude: number;
};

function isValidPosition(position: Position): boolean {
  return (
    position.length >= 2 &&
    Number.isFinite(position[0]) &&
    Number.isFinite(position[1])
  );
}

export function projectPointToShape(
  coordinates: Position[],
  clickCoordinate: ClickCoordinate,
): ShapeSelectionMeasurement | null {
  if (
    coordinates.length < 2 ||
    !coordinates.every(isValidPosition) ||
    !Number.isFinite(clickCoordinate.latitude) ||
    !Number.isFinite(clickCoordinate.longitude)
  ) {
    return null;
  }

  const shape = lineString(coordinates);
  const snapped = nearestPointOnLine(
    shape,
    point([clickCoordinate.longitude, clickCoordinate.latitude]),
    { units: "meters" },
  );
  const distanceFromShape = snapped.properties.dist;
  const distanceAlongShape = snapped.properties.location;

  if (
    typeof distanceFromShape !== "number" ||
    typeof distanceAlongShape !== "number"
  ) {
    return null;
  }

  return {
    longitude: snapped.geometry.coordinates[0],
    latitude: snapped.geometry.coordinates[1],
    distanceAlongShape,
    totalShapeDistance: length(shape, { units: "meters" }),
    distanceFromShape,
  };
}

export function snapPointToShape(
  coordinates: Position[],
  clickCoordinate: ClickCoordinate,
  maxDistanceMeters: number,
): ShapeSelectionMeasurement | null {
  if (
    !Number.isFinite(maxDistanceMeters) ||
    maxDistanceMeters < 0
  ) {
    return null;
  }

  const measurement = projectPointToShape(coordinates, clickCoordinate);

  if (!measurement || measurement.distanceFromShape > maxDistanceMeters) {
    return null;
  }

  return measurement;
}
