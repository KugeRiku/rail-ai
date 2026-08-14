import Database from "better-sqlite3";
import { parse } from "csv-parse/sync";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { gtfsTimeToSeconds } from "../src/domain/gtfs/time";

const DEFAULT_GTFS_DIRECTORY = "data/gtfs/demo";
const DEFAULT_DATABASE_PATH = "data/railshot.sqlite";
const DEFAULT_SHOOTING_SPOTS_PATH = "data/shooting_spots.json";
const VEHICLE_ASSIGNMENTS_FILE = "vehicle_assignments.csv";
const VEHICLE_ASSIGNMENT_HEADERS = [
  "trip_id",
  "vehicle_series",
  "display_name",
  "confidence",
] as const;

const shootingSpotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  nearestStation: z.string().min(1),
  walkMinutes: z.number().int().nonnegative(),
  cameraBearing: z.number().min(0).lt(360),
  notes: z.string().min(1),
  safetyStatus: z.enum(["approved", "pending", "rejected"]),
});
const shootingSpotsSchema = z.array(shootingSpotSchema);

const REQUIRED_HEADERS = {
  "routes.txt": [
    "route_id",
    "route_short_name",
    "route_long_name",
    "route_type",
    "route_color",
  ],
  "trips.txt": [
    "route_id",
    "service_id",
    "trip_id",
    "trip_headsign",
    "direction_id",
    "shape_id",
  ],
  "stops.txt": ["stop_id", "stop_name", "stop_lat", "stop_lon"],
  "stop_times.txt": [
    "trip_id",
    "arrival_time",
    "departure_time",
    "stop_id",
    "stop_sequence",
    "shape_dist_traveled",
  ],
  "shapes.txt": [
    "shape_id",
    "shape_pt_lat",
    "shape_pt_lon",
    "shape_pt_sequence",
    "shape_dist_traveled",
  ],
  "calendar.txt": [
    "service_id",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "start_date",
    "end_date",
  ],
  "calendar_dates.txt": ["service_id", "date", "exception_type"],
} as const;

type GtfsFileName = keyof typeof REQUIRED_HEADERS;
type CsvRow = Record<string, string>;

const SCHEMA_SQL = `
  DROP TABLE IF EXISTS import_metadata;
  DROP TABLE IF EXISTS service_exceptions;
  DROP TABLE IF EXISTS service_calendars;
  DROP TABLE IF EXISTS stop_times;
  DROP TABLE IF EXISTS shape_points;
  DROP TABLE IF EXISTS vehicle_assignments;
  DROP TABLE IF EXISTS shooting_spots;
  DROP TABLE IF EXISTS trips;
  DROP TABLE IF EXISTS stops;
  DROP TABLE IF EXISTS routes;

  CREATE TABLE routes (
    id TEXT PRIMARY KEY,
    short_name TEXT NOT NULL,
    name TEXT NOT NULL,
    route_type INTEGER NOT NULL,
    color TEXT NOT NULL
  ) STRICT;

  CREATE TABLE stops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180)
  ) STRICT;

  CREATE TABLE trips (
    id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL REFERENCES routes(id),
    service_id TEXT NOT NULL,
    shape_id TEXT NOT NULL,
    headsign TEXT NOT NULL,
    direction_id INTEGER NOT NULL CHECK (direction_id IN (0, 1))
  ) STRICT;

  CREATE TABLE vehicle_assignments (
    trip_id TEXT PRIMARY KEY REFERENCES trips(id),
    vehicle_series TEXT,
    display_name TEXT,
    confidence TEXT NOT NULL CHECK (confidence IN ('confirmed', 'expected', 'unknown')),
    CHECK (
      confidence = 'unknown'
      OR (vehicle_series IS NOT NULL AND length(vehicle_series) > 0)
    )
  ) STRICT;

  CREATE TABLE shooting_spots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    nearest_station TEXT NOT NULL,
    walk_minutes INTEGER NOT NULL CHECK (walk_minutes >= 0),
    camera_bearing REAL NOT NULL CHECK (camera_bearing >= 0 AND camera_bearing < 360),
    notes TEXT NOT NULL,
    safety_status TEXT NOT NULL CHECK (safety_status IN ('approved', 'pending', 'rejected'))
  ) STRICT;

  CREATE TABLE shape_points (
    shape_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence > 0),
    latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    distance REAL NOT NULL CHECK (distance >= 0),
    PRIMARY KEY (shape_id, sequence)
  ) STRICT;

  CREATE TABLE stop_times (
    trip_id TEXT NOT NULL REFERENCES trips(id),
    stop_id TEXT NOT NULL REFERENCES stops(id),
    stop_sequence INTEGER NOT NULL CHECK (stop_sequence > 0),
    arrival_seconds INTEGER NOT NULL CHECK (arrival_seconds >= 0),
    departure_seconds INTEGER NOT NULL CHECK (departure_seconds >= 0),
    shape_distance REAL NOT NULL CHECK (shape_distance >= 0),
    PRIMARY KEY (trip_id, stop_sequence)
  ) STRICT;

  CREATE TABLE service_calendars (
    service_id TEXT PRIMARY KEY,
    monday INTEGER NOT NULL CHECK (monday IN (0, 1)),
    tuesday INTEGER NOT NULL CHECK (tuesday IN (0, 1)),
    wednesday INTEGER NOT NULL CHECK (wednesday IN (0, 1)),
    thursday INTEGER NOT NULL CHECK (thursday IN (0, 1)),
    friday INTEGER NOT NULL CHECK (friday IN (0, 1)),
    saturday INTEGER NOT NULL CHECK (saturday IN (0, 1)),
    sunday INTEGER NOT NULL CHECK (sunday IN (0, 1)),
    start_date TEXT NOT NULL CHECK (length(start_date) = 8),
    end_date TEXT NOT NULL CHECK (length(end_date) = 8)
  ) STRICT;

  CREATE TABLE service_exceptions (
    service_id TEXT NOT NULL,
    date TEXT NOT NULL CHECK (length(date) = 8),
    exception_type INTEGER NOT NULL CHECK (exception_type IN (1, 2)),
    PRIMARY KEY (service_id, date)
  ) STRICT;

  CREATE TABLE import_metadata (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    source_directory TEXT NOT NULL,
    imported_at TEXT NOT NULL
  ) STRICT;

  CREATE INDEX trips_route_id_idx ON trips(route_id);
  CREATE INDEX trips_service_id_idx ON trips(service_id);
  CREATE INDEX trips_shape_id_idx ON trips(shape_id);
  CREATE INDEX stop_times_stop_id_idx ON stop_times(stop_id);
  CREATE INDEX stop_times_arrival_seconds_idx ON stop_times(arrival_seconds);
`;

function readGtfsFile(directory: string, fileName: GtfsFileName): CsvRow[] {
  const filePath = resolve(directory, fileName);
  let fileContents: string;

  try {
    fileContents = readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`Could not read required GTFS file: ${filePath}`, {
      cause: error,
    });
  }

  const rows = parse(fileContents, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];

  const firstRow = rows[0];
  if (!firstRow) {
    throw new Error(`GTFS file has no data rows: ${filePath}`);
  }

  const missingHeaders = REQUIRED_HEADERS[fileName].filter(
    (header) => !(header in firstRow),
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `GTFS file ${fileName} is missing headers: ${missingHeaders.join(", ")}`,
    );
  }

  return rows;
}

function readVehicleAssignments(directory: string): CsvRow[] {
  const filePath = resolve(directory, VEHICLE_ASSIGNMENTS_FILE);
  if (!existsSync(filePath)) {
    return [];
  }

  const rows = parse(readFileSync(filePath, "utf8"), {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];
  const firstRow = rows[0];
  if (!firstRow) {
    return [];
  }

  const missingHeaders = VEHICLE_ASSIGNMENT_HEADERS.filter(
    (header) => !(header in firstRow),
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `${VEHICLE_ASSIGNMENTS_FILE} is missing headers: ${missingHeaders.join(", ")}`,
    );
  }

  return rows;
}

function readShootingSpots(filePath: string) {
  if (!existsSync(filePath)) {
    return [];
  }

  let input: unknown;
  try {
    input = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not parse shooting spots file: ${filePath}`, {
      cause: error,
    });
  }

  const parsed = shootingSpotsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid shooting spots data: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

function required(row: CsvRow, field: string, context: string): string {
  const value = row[field];
  if (value === undefined || value === "") {
    throw new Error(`${context}: ${field} is required`);
  }
  return value;
}

function integer(row: CsvRow, field: string, context: string): number {
  const value = required(row, field, context);
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`${context}: ${field} must be an integer`);
  }
  return Number(value);
}

function number(row: CsvRow, field: string, context: string): number {
  const value = required(row, field, context);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${context}: ${field} must be a number`);
  }
  return parsed;
}

function date(row: CsvRow, field: string, context: string): string {
  const value = required(row, field, context);
  if (!/^\d{8}$/.test(value)) {
    throw new Error(`${context}: ${field} must use YYYYMMDD format`);
  }
  return value;
}

function importGtfs(
  gtfsDirectory: string,
  databasePath: string,
  shootingSpotsPath: string,
) {
  const files = Object.fromEntries(
    (Object.keys(REQUIRED_HEADERS) as GtfsFileName[]).map((fileName) => [
      fileName,
      readGtfsFile(gtfsDirectory, fileName),
    ]),
  ) as Record<GtfsFileName, CsvRow[]>;
  const vehicleAssignments = readVehicleAssignments(gtfsDirectory);
  const shootingSpots = readShootingSpots(shootingSpotsPath);

  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");

  try {
    const runImport = database.transaction(() => {
      database.exec(SCHEMA_SQL);

      const insertRoute = database.prepare(`
        INSERT INTO routes (id, short_name, name, route_type, color)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const [index, row] of files["routes.txt"].entries()) {
        const context = `routes.txt row ${index + 2}`;
        insertRoute.run(
          required(row, "route_id", context),
          required(row, "route_short_name", context),
          required(row, "route_long_name", context),
          integer(row, "route_type", context),
          required(row, "route_color", context),
        );
      }

      const insertStop = database.prepare(`
        INSERT INTO stops (id, name, latitude, longitude)
        VALUES (?, ?, ?, ?)
      `);
      for (const [index, row] of files["stops.txt"].entries()) {
        const context = `stops.txt row ${index + 2}`;
        insertStop.run(
          required(row, "stop_id", context),
          required(row, "stop_name", context),
          number(row, "stop_lat", context),
          number(row, "stop_lon", context),
        );
      }

      const insertTrip = database.prepare(`
        INSERT INTO trips (id, route_id, service_id, shape_id, headsign, direction_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const [index, row] of files["trips.txt"].entries()) {
        const context = `trips.txt row ${index + 2}`;
        insertTrip.run(
          required(row, "trip_id", context),
          required(row, "route_id", context),
          required(row, "service_id", context),
          required(row, "shape_id", context),
          required(row, "trip_headsign", context),
          integer(row, "direction_id", context),
        );
      }

      const insertVehicleAssignment = database.prepare(`
        INSERT INTO vehicle_assignments (
          trip_id,
          vehicle_series,
          display_name,
          confidence
        ) VALUES (?, ?, ?, ?)
      `);
      for (const [index, row] of vehicleAssignments.entries()) {
        const context = `${VEHICLE_ASSIGNMENTS_FILE} row ${index + 2}`;
        const confidence = required(row, "confidence", context);
        if (!["confirmed", "expected", "unknown"].includes(confidence)) {
          throw new Error(
            `${context}: confidence must be confirmed, expected, or unknown`,
          );
        }

        insertVehicleAssignment.run(
          required(row, "trip_id", context),
          row.vehicle_series || null,
          row.display_name || null,
          confidence,
        );
      }

      const insertShootingSpot = database.prepare(`
        INSERT INTO shooting_spots (
          id,
          name,
          latitude,
          longitude,
          nearest_station,
          walk_minutes,
          camera_bearing,
          notes,
          safety_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const spot of shootingSpots) {
        insertShootingSpot.run(
          spot.id,
          spot.name,
          spot.latitude,
          spot.longitude,
          spot.nearestStation,
          spot.walkMinutes,
          spot.cameraBearing,
          spot.notes,
          spot.safetyStatus,
        );
      }

      const insertShapePoint = database.prepare(`
        INSERT INTO shape_points (shape_id, sequence, latitude, longitude, distance)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const [index, row] of files["shapes.txt"].entries()) {
        const context = `shapes.txt row ${index + 2}`;
        insertShapePoint.run(
          required(row, "shape_id", context),
          integer(row, "shape_pt_sequence", context),
          number(row, "shape_pt_lat", context),
          number(row, "shape_pt_lon", context),
          number(row, "shape_dist_traveled", context),
        );
      }

      const insertStopTime = database.prepare(`
        INSERT INTO stop_times (
          trip_id,
          stop_id,
          stop_sequence,
          arrival_seconds,
          departure_seconds,
          shape_distance
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const [index, row] of files["stop_times.txt"].entries()) {
        const context = `stop_times.txt row ${index + 2}`;
        insertStopTime.run(
          required(row, "trip_id", context),
          required(row, "stop_id", context),
          integer(row, "stop_sequence", context),
          gtfsTimeToSeconds(required(row, "arrival_time", context)),
          gtfsTimeToSeconds(required(row, "departure_time", context)),
          number(row, "shape_dist_traveled", context),
        );
      }

      const insertCalendar = database.prepare(`
        INSERT INTO service_calendars (
          service_id,
          monday,
          tuesday,
          wednesday,
          thursday,
          friday,
          saturday,
          sunday,
          start_date,
          end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const [index, row] of files["calendar.txt"].entries()) {
        const context = `calendar.txt row ${index + 2}`;
        insertCalendar.run(
          required(row, "service_id", context),
          integer(row, "monday", context),
          integer(row, "tuesday", context),
          integer(row, "wednesday", context),
          integer(row, "thursday", context),
          integer(row, "friday", context),
          integer(row, "saturday", context),
          integer(row, "sunday", context),
          date(row, "start_date", context),
          date(row, "end_date", context),
        );
      }

      const insertCalendarDate = database.prepare(`
        INSERT INTO service_exceptions (service_id, date, exception_type)
        VALUES (?, ?, ?)
      `);
      for (const [index, row] of files["calendar_dates.txt"].entries()) {
        const context = `calendar_dates.txt row ${index + 2}`;
        insertCalendarDate.run(
          required(row, "service_id", context),
          date(row, "date", context),
          integer(row, "exception_type", context),
        );
      }

      database
        .prepare(
          `INSERT INTO import_metadata (id, source_directory, imported_at)
           VALUES (1, ?, ?)`,
        )
        .run(gtfsDirectory, new Date().toISOString());
    });

    runImport();

    const tableCounts = database
      .prepare(`
        SELECT 'routes' AS table_name, COUNT(*) AS row_count FROM routes
        UNION ALL SELECT 'stops', COUNT(*) FROM stops
        UNION ALL SELECT 'trips', COUNT(*) FROM trips
        UNION ALL SELECT 'vehicle_assignments', COUNT(*) FROM vehicle_assignments
        UNION ALL SELECT 'shooting_spots', COUNT(*) FROM shooting_spots
        UNION ALL SELECT 'stop_times', COUNT(*) FROM stop_times
        UNION ALL SELECT 'shape_points', COUNT(*) FROM shape_points
        UNION ALL SELECT 'service_calendars', COUNT(*) FROM service_calendars
        UNION ALL SELECT 'service_exceptions', COUNT(*) FROM service_exceptions
      `)
      .all() as Array<{ table_name: string; row_count: number }>;

    console.log(`Imported GTFS from ${gtfsDirectory} to ${databasePath}`);
    for (const { table_name: tableName, row_count: rowCount } of tableCounts) {
      console.log(`  ${tableName}: ${rowCount}`);
    }
  } finally {
    database.close();
  }
}

const gtfsDirectory = resolve(process.argv[2] ?? DEFAULT_GTFS_DIRECTORY);
const databasePath = resolve(process.argv[3] ?? DEFAULT_DATABASE_PATH);
const shootingSpotsPath = resolve(
  process.argv[4] ?? DEFAULT_SHOOTING_SPOTS_PATH,
);

try {
  importGtfs(gtfsDirectory, databasePath, shootingSpotsPath);
} catch (error) {
  console.error("GTFS import failed:", error);
  process.exitCode = 1;
}
