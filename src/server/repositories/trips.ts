import type Database from "better-sqlite3";
import { normalizeRouteColor } from "@/domain/gtfs/map-data";
import { formatServiceTimeHHMM } from "@/domain/gtfs/time";
import type { TripDetail } from "@/domain/trips/trip-detail";

type TripDetailRow = {
  trip_id: string;
  service_id: string;
  shape_id: string;
  headsign: string;
  direction_id: number;
  route_id: string;
  route_short_name: string;
  route_name: string;
  route_color: string;
};

type StopTimeRow = {
  stop_id: string;
  stop_name: string;
  stop_sequence: number;
  arrival_seconds: number;
  departure_seconds: number;
  shape_distance: number | null;
  latitude: number;
  longitude: number;
};

export function getTripDetail(
  database: Database.Database,
  tripId: string,
): TripDetail | null {
  const trip = database
    .prepare(
      `SELECT
         trips.id AS trip_id,
         trips.service_id,
         trips.shape_id,
         trips.headsign,
         trips.direction_id,
         routes.id AS route_id,
         routes.short_name AS route_short_name,
         routes.name AS route_name,
         routes.color AS route_color
       FROM trips
       INNER JOIN routes ON routes.id = trips.route_id
       WHERE trips.id = ?`,
    )
    .get(tripId) as TripDetailRow | undefined;

  if (!trip) {
    return null;
  }

  const stopTimes = database
    .prepare(
      `SELECT
         stop_times.stop_id,
         stops.name AS stop_name,
         stop_times.stop_sequence,
         stop_times.arrival_seconds,
         stop_times.departure_seconds,
         stop_times.shape_distance,
         stops.latitude,
         stops.longitude
       FROM stop_times
       INNER JOIN stops ON stops.id = stop_times.stop_id
       WHERE stop_times.trip_id = ?
       ORDER BY stop_times.stop_sequence`,
    )
    .all(tripId) as StopTimeRow[];

  return {
    trip: {
      id: trip.trip_id,
      serviceId: trip.service_id,
      shapeId: trip.shape_id,
      headsign: trip.headsign,
      directionId: trip.direction_id,
    },
    route: {
      id: trip.route_id,
      shortName: trip.route_short_name,
      name: trip.route_name,
      color: normalizeRouteColor(trip.route_color),
    },
    stopTimes: stopTimes.map((stopTime) => ({
      stopId: stopTime.stop_id,
      stopName: stopTime.stop_name,
      stopSequence: stopTime.stop_sequence,
      arrivalSeconds: stopTime.arrival_seconds,
      departureSeconds: stopTime.departure_seconds,
      arrivalTime: formatServiceTimeHHMM(stopTime.arrival_seconds),
      departureTime: formatServiceTimeHHMM(stopTime.departure_seconds),
      shapeDistance: stopTime.shape_distance,
      latitude: stopTime.latitude,
      longitude: stopTime.longitude,
    })),
  };
}
