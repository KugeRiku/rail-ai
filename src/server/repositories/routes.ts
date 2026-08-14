import type Database from "better-sqlite3";
import type {
  RouteSummary,
  ShapePointRecord,
  StopRecord,
  TripSummary,
} from "@/domain/gtfs/map-data";
import {
  createRouteShapeGeoJson,
  createStopsGeoJson,
  normalizeRouteColor,
  type RouteMapData,
} from "@/domain/gtfs/map-data";

type RouteRow = {
  id: string;
  short_name: string;
  name: string;
  color: string;
  trip_count: number;
  shape_count: number;
};

type TripRow = {
  id: string;
  shape_id: string;
  headsign: string;
  direction_id: number;
};

type ShapePointRow = {
  shape_id: string;
  sequence: number;
  longitude: number;
  latitude: number;
};

type StopRow = {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
};

function toRouteSummary(row: RouteRow): RouteSummary {
  return {
    id: row.id,
    shortName: row.short_name,
    name: row.name,
    color: normalizeRouteColor(row.color),
    tripCount: row.trip_count,
    shapeCount: row.shape_count,
  };
}

export function listRoutes(database: Database.Database): RouteSummary[] {
  const rows = database
    .prepare(
      `SELECT
         routes.id,
         routes.short_name,
         routes.name,
         routes.color,
         COUNT(DISTINCT trips.id) AS trip_count,
         COUNT(DISTINCT trips.shape_id) AS shape_count
       FROM routes
       LEFT JOIN trips ON trips.route_id = routes.id
       GROUP BY routes.id
       ORDER BY routes.id`,
    )
    .all() as RouteRow[];

  return rows.map(toRouteSummary);
}

export function getRouteMapData(
  database: Database.Database,
  routeId: string,
): RouteMapData | null {
  const routeRow = database
    .prepare(
      `SELECT
         routes.id,
         routes.short_name,
         routes.name,
         routes.color,
         COUNT(DISTINCT trips.id) AS trip_count,
         COUNT(DISTINCT trips.shape_id) AS shape_count
       FROM routes
       LEFT JOIN trips ON trips.route_id = routes.id
       WHERE routes.id = ?
       GROUP BY routes.id`,
    )
    .get(routeId) as RouteRow | undefined;

  if (!routeRow) {
    return null;
  }

  const routeSummary = toRouteSummary(routeRow);
  const route = {
    id: routeSummary.id,
    shortName: routeSummary.shortName,
    name: routeSummary.name,
    color: routeSummary.color,
  };

  const tripRows = database
    .prepare(
      `SELECT id, shape_id, headsign, direction_id
       FROM trips
       WHERE route_id = ?
       ORDER BY direction_id, id`,
    )
    .all(routeId) as TripRow[];
  const trips: TripSummary[] = tripRows.map((row) => ({
    id: row.id,
    shapeId: row.shape_id,
    headsign: row.headsign,
    directionId: row.direction_id,
  }));

  const pointRows = database
    .prepare(
      `SELECT DISTINCT
         shape_points.shape_id,
         shape_points.sequence,
         shape_points.longitude,
         shape_points.latitude
       FROM shape_points
       INNER JOIN trips ON trips.shape_id = shape_points.shape_id
       WHERE trips.route_id = ?
       ORDER BY shape_points.shape_id, shape_points.sequence`,
    )
    .all(routeId) as ShapePointRow[];
  const shapePoints: ShapePointRecord[] = pointRows.map((row) => ({
    shapeId: row.shape_id,
    sequence: row.sequence,
    longitude: row.longitude,
    latitude: row.latitude,
  }));

  const stopRows = database
    .prepare(
      `SELECT DISTINCT stops.id, stops.name, stops.longitude, stops.latitude
       FROM stops
       INNER JOIN stop_times ON stop_times.stop_id = stops.id
       INNER JOIN trips ON trips.id = stop_times.trip_id
       WHERE trips.route_id = ?
       ORDER BY stops.id`,
    )
    .all(routeId) as StopRow[];
  const stops: StopRecord[] = stopRows;

  return {
    route,
    trips,
    shapes: createRouteShapeGeoJson(route, trips, shapePoints),
    stops: createStopsGeoJson(route.id, stops),
  };
}
