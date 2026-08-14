import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTripDetail } from "@/server/repositories/trips";

let database: Database.Database;

beforeEach(() => {
  database = new Database(":memory:");
  database.exec(`
    CREATE TABLE routes (id TEXT PRIMARY KEY, short_name TEXT, name TEXT, color TEXT);
    CREATE TABLE trips (id TEXT PRIMARY KEY, route_id TEXT, service_id TEXT, shape_id TEXT, headsign TEXT, direction_id INTEGER);
    CREATE TABLE stops (id TEXT PRIMARY KEY, name TEXT, latitude REAL, longitude REAL);
    CREATE TABLE stop_times (trip_id TEXT, stop_id TEXT, stop_sequence INTEGER, arrival_seconds INTEGER, departure_seconds INTEGER, shape_distance REAL);

    INSERT INTO routes VALUES ('ROUTE_A', 'A', 'テスト路線', '336699');
    INSERT INTO trips VALUES ('NIGHT', 'ROUTE_A', 'WEEKDAY', 'SHAPE_A', '終点', 0);
    INSERT INTO stops VALUES ('STOP_A', '始発駅', 35.1, 139.1);
    INSERT INTO stops VALUES ('STOP_B', '終着駅', 35.2, 139.2);
    INSERT INTO stop_times VALUES ('NIGHT', 'STOP_B', 2, 90600, 90600, 1000);
    INSERT INTO stop_times VALUES ('NIGHT', 'STOP_A', 1, 88200, 88260, 0);
  `);
});

afterEach(() => database.close());

describe("trips repository", () => {
  it("returns trip, route and ordered stop_times with display times", () => {
    const detail = getTripDetail(database, "NIGHT");

    expect(detail).toMatchObject({
      trip: {
        id: "NIGHT",
        shapeId: "SHAPE_A",
        headsign: "終点",
      },
      route: {
        id: "ROUTE_A",
        shortName: "A",
        name: "テスト路線",
        color: "#336699",
      },
    });
    expect(detail?.stopTimes.map((stopTime) => stopTime.stopId)).toEqual([
      "STOP_A",
      "STOP_B",
    ]);
    expect(detail?.stopTimes[1]).toMatchObject({
      stopName: "終着駅",
      arrivalSeconds: 90_600,
      arrivalTime: "25:10",
    });
  });

  it("returns null for an unknown trip", () => {
    expect(getTripDetail(database, "UNKNOWN")).toBeNull();
  });
});
