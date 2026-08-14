import type Database from "better-sqlite3";
import type {
  ServiceCalendar,
  ServiceException,
} from "@/domain/gtfs/service-calendar";
import type { PassageStopTime } from "@/domain/passages/estimate-trip-passage";
import type { PassageTripCandidate } from "@/domain/passages/search-passages";

type TripRow = {
  route_id: string;
  route_name: string;
  trip_id: string;
  service_id: string;
  shape_id: string;
  headsign: string;
  direction_id: number;
  vehicle_series: string | null;
  vehicle_display_name: string | null;
  vehicle_confidence: "confirmed" | "expected" | "unknown" | null;
};

type ShapePointRow = {
  longitude: number;
  latitude: number;
};

type StopTimeRow = {
  stop_id: string;
  stop_sequence: number;
  arrival_seconds: number;
  departure_seconds: number;
  shape_distance: number | null;
  latitude: number;
  longitude: number;
};

type CalendarRow = {
  service_id: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  start_date: string;
  end_date: string;
};

type ExceptionRow = {
  service_id: string;
  date: string;
  exception_type: 1 | 2;
};

export type PassageTarget =
  | { shapeId: string; routeId?: never }
  | { routeId: string; shapeId?: never };

export function getPassageCandidates(
  database: Database.Database,
  target: PassageTarget,
): PassageTripCandidate[] {
  const byShape = "shapeId" in target;
  const tripRows = database
    .prepare(
      `SELECT
         routes.id AS route_id,
         routes.name AS route_name,
         trips.id AS trip_id,
         trips.service_id,
         trips.shape_id,
         trips.headsign,
         trips.direction_id,
         vehicle_assignments.vehicle_series,
         vehicle_assignments.display_name AS vehicle_display_name,
         vehicle_assignments.confidence AS vehicle_confidence
       FROM trips
       INNER JOIN routes ON routes.id = trips.route_id
       LEFT JOIN vehicle_assignments ON vehicle_assignments.trip_id = trips.id
       WHERE ${byShape ? "trips.shape_id" : "trips.route_id"} = ?
       ORDER BY trips.id`,
    )
    .all(byShape ? target.shapeId : target.routeId) as TripRow[];

  const shapeStatement = database.prepare(
    `SELECT longitude, latitude
     FROM shape_points
     WHERE shape_id = ?
     ORDER BY sequence`,
  );
  const stopTimeStatement = database.prepare(
    `SELECT
       stop_times.stop_id,
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
  );
  const shapes = new Map<string, number[][]>();

  return tripRows.map((trip): PassageTripCandidate => {
    let shapeCoordinates = shapes.get(trip.shape_id);
    if (!shapeCoordinates) {
      shapeCoordinates = (
        shapeStatement.all(trip.shape_id) as ShapePointRow[]
      ).map((point) => [point.longitude, point.latitude]);
      shapes.set(trip.shape_id, shapeCoordinates);
    }

    const stopTimes = (
      stopTimeStatement.all(trip.trip_id) as StopTimeRow[]
    ).map(
      (stopTime): PassageStopTime => ({
        stopId: stopTime.stop_id,
        stopSequence: stopTime.stop_sequence,
        arrivalSeconds: stopTime.arrival_seconds,
        departureSeconds: stopTime.departure_seconds,
        shapeDistance: stopTime.shape_distance,
        latitude: stopTime.latitude,
        longitude: stopTime.longitude,
      }),
    );

    return {
      routeId: trip.route_id,
      routeName: trip.route_name,
      tripId: trip.trip_id,
      serviceId: trip.service_id,
      shapeId: trip.shape_id,
      headsign: trip.headsign,
      directionId: trip.direction_id,
      shapeCoordinates,
      stopTimes,
      vehicleAssignment: trip.vehicle_confidence
        ? {
            tripId: trip.trip_id,
            vehicleSeries: trip.vehicle_series,
            displayName: trip.vehicle_display_name,
            confidence: trip.vehicle_confidence,
          }
        : null,
    };
  });
}

export function getServiceData(database: Database.Database): {
  calendars: ServiceCalendar[];
  exceptions: ServiceException[];
} {
  const calendarRows = database
    .prepare(
      `SELECT service_id, monday, tuesday, wednesday, thursday, friday,
              saturday, sunday, start_date, end_date
       FROM service_calendars`,
    )
    .all() as CalendarRow[];
  const exceptionRows = database
    .prepare(
      `SELECT service_id, date, exception_type
       FROM service_exceptions`,
    )
    .all() as ExceptionRow[];

  return {
    calendars: calendarRows.map((row) => ({
      serviceId: row.service_id,
      monday: row.monday === 1,
      tuesday: row.tuesday === 1,
      wednesday: row.wednesday === 1,
      thursday: row.thursday === 1,
      friday: row.friday === 1,
      saturday: row.saturday === 1,
      sunday: row.sunday === 1,
      startDate: row.start_date,
      endDate: row.end_date,
    })),
    exceptions: exceptionRows.map((row) => ({
      serviceId: row.service_id,
      date: row.date,
      exceptionType: row.exception_type,
    })),
  };
}
