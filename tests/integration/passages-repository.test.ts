import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getPassageCandidates,
  getServiceData,
} from "@/server/repositories/passages";

let database: Database.Database;

beforeEach(() => {
  database = new Database(":memory:");
  database.exec(`
    CREATE TABLE routes (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE trips (id TEXT PRIMARY KEY, route_id TEXT, service_id TEXT, shape_id TEXT, headsign TEXT, direction_id INTEGER);
    CREATE TABLE vehicle_assignments (trip_id TEXT PRIMARY KEY, vehicle_series TEXT, display_name TEXT, confidence TEXT);
    CREATE TABLE shape_points (shape_id TEXT, sequence INTEGER, latitude REAL, longitude REAL);
    CREATE TABLE stops (id TEXT PRIMARY KEY, latitude REAL, longitude REAL);
    CREATE TABLE stop_times (trip_id TEXT, stop_id TEXT, stop_sequence INTEGER, arrival_seconds INTEGER, departure_seconds INTEGER, shape_distance REAL);
    CREATE TABLE service_calendars (service_id TEXT, monday INTEGER, tuesday INTEGER, wednesday INTEGER, thursday INTEGER, friday INTEGER, saturday INTEGER, sunday INTEGER, start_date TEXT, end_date TEXT);
    CREATE TABLE service_exceptions (service_id TEXT, date TEXT, exception_type INTEGER);

    INSERT INTO routes VALUES ('ROUTE_A', 'テスト路線');
    INSERT INTO trips VALUES ('OUT', 'ROUTE_A', 'WEEKDAY', 'SHAPE_OUT', '終点', 0);
    INSERT INTO trips VALUES ('IN', 'ROUTE_A', 'WEEKDAY', 'SHAPE_IN', '始点', 1);
    INSERT INTO vehicle_assignments VALUES ('OUT', 'Series-A', '特急車両A', 'confirmed');
    INSERT INTO shape_points VALUES ('SHAPE_OUT', 1, 35, 139);
    INSERT INTO shape_points VALUES ('SHAPE_OUT', 2, 35, 139.01);
    INSERT INTO shape_points VALUES ('SHAPE_IN', 1, 35, 139.01);
    INSERT INTO shape_points VALUES ('SHAPE_IN', 2, 35, 139);
    INSERT INTO stops VALUES ('A', 35, 139);
    INSERT INTO stops VALUES ('B', 35, 139.01);
    INSERT INTO stop_times VALUES ('OUT', 'B', 2, 4200, 4200, 1000);
    INSERT INTO stop_times VALUES ('OUT', 'A', 1, 3600, 3600, 0);
    INSERT INTO stop_times VALUES ('IN', 'B', 1, 7200, 7200, 0);
    INSERT INTO stop_times VALUES ('IN', 'A', 2, 7800, 7800, 1000);
    INSERT INTO service_calendars VALUES ('WEEKDAY', 1, 1, 1, 1, 1, 0, 0, '20260801', '20261231');
    INSERT INTO service_exceptions VALUES ('WEEKDAY', '20260815', 1);
  `);
});

afterEach(() => database.close());

describe("passages repository", () => {
  it("loads both directions and orders each trip's stop_times", () => {
    const candidates = getPassageCandidates(database, { routeId: "ROUTE_A" });

    expect(candidates.map((candidate) => candidate.directionId)).toEqual([1, 0]);
    const outbound = candidates.find((candidate) => candidate.tripId === "OUT");
    expect(outbound?.stopTimes.map((stopTime) => stopTime.stopSequence)).toEqual([
      1, 2,
    ]);
    expect(outbound?.vehicleAssignment).toEqual({
      tripId: "OUT",
      vehicleSeries: "Series-A",
      displayName: "特急車両A",
      confidence: "confirmed",
    });
    expect(
      candidates.find((candidate) => candidate.tripId === "IN")
        ?.vehicleAssignment,
    ).toBeNull();
  });

  it("loads service calendars and exceptions", () => {
    const serviceData = getServiceData(database);

    expect(serviceData.calendars[0]).toMatchObject({
      serviceId: "WEEKDAY",
      friday: true,
      saturday: false,
    });
    expect(serviceData.exceptions).toEqual([
      { serviceId: "WEEKDAY", date: "20260815", exceptionType: 1 },
    ]);
  });
});
