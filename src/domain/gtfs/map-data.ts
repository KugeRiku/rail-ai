import type {
  Feature,
  FeatureCollection,
  LineString,
  Point,
  Position,
} from "geojson";

export type RouteSummary = {
  id: string;
  shortName: string;
  name: string;
  color: string;
  tripCount: number;
  shapeCount: number;
};

export type TripSummary = {
  id: string;
  shapeId: string;
  headsign: string;
  directionId: number;
};

export type ShapePointRecord = {
  shapeId: string;
  sequence: number;
  longitude: number;
  latitude: number;
};

export type StopRecord = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
};

export type RouteLineProperties = {
  routeId: string;
  routeName: string;
  routeColor: string;
  shapeId: string;
  directionIds: number[];
  tripIds: string[];
};

export type StopProperties = {
  id: string;
  name: string;
  routeId: string;
};

export type RouteMapData = {
  route: Omit<RouteSummary, "tripCount" | "shapeCount">;
  trips: TripSummary[];
  shapes: FeatureCollection<LineString, RouteLineProperties>;
  stops: FeatureCollection<Point, StopProperties>;
};

export function normalizeRouteColor(color: string): string {
  const normalized = color.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(normalized) ? `#${normalized}` : "#18866f";
}

export function createRouteShapeGeoJson(
  route: RouteMapData["route"],
  trips: TripSummary[],
  points: ShapePointRecord[],
): RouteMapData["shapes"] {
  const pointsByShape = new Map<string, ShapePointRecord[]>();

  for (const point of points) {
    const shapePoints = pointsByShape.get(point.shapeId) ?? [];
    shapePoints.push(point);
    pointsByShape.set(point.shapeId, shapePoints);
  }

  const tripsByShape = new Map<string, TripSummary[]>();
  for (const trip of trips) {
    const shapeTrips = tripsByShape.get(trip.shapeId) ?? [];
    shapeTrips.push(trip);
    tripsByShape.set(trip.shapeId, shapeTrips);
  }

  const features: Array<Feature<LineString, RouteLineProperties>> = [];

  for (const [shapeId, shapePoints] of pointsByShape) {
    const coordinates = shapePoints
      .toSorted((left, right) => left.sequence - right.sequence)
      .map(({ longitude, latitude }): Position => [longitude, latitude]);

    if (coordinates.length < 2) {
      continue;
    }

    const shapeTrips = tripsByShape.get(shapeId) ?? [];
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates,
      },
      properties: {
        routeId: route.id,
        routeName: route.name,
        routeColor: route.color,
        shapeId,
        directionIds: [...new Set(shapeTrips.map((trip) => trip.directionId))],
        tripIds: shapeTrips.map((trip) => trip.id),
      },
    });
  }

  return { type: "FeatureCollection", features };
}

export function createStopsGeoJson(
  routeId: string,
  stops: StopRecord[],
): RouteMapData["stops"] {
  return {
    type: "FeatureCollection",
    features: stops.map(
      ({ id, name, longitude, latitude }): Feature<Point, StopProperties> => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        properties: { id, name, routeId },
      }),
    ),
  };
}
