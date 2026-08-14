import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRouteMapData, listRoutes } from "@/server/repositories/routes";

let database: Database.Database;

beforeEach(() => {
  database = new Database(":memory:");
  database.exec(`
    CREATE TABLE routes (id TEXT PRIMARY KEY, short_name TEXT, name TEXT, color TEXT);
    CREATE TABLE trips (id TEXT PRIMARY KEY, route_id TEXT, service_id TEXT, shape_id TEXT, headsign TEXT, direction_id INTEGER);
    CREATE TABLE shape_points (shape_id TEXT, sequence INTEGER, latitude REAL, longitude REAL, distance REAL);
    CREATE TABLE stops (id TEXT PRIMARY KEY, name TEXT, latitude REAL, longitude REAL);
    CREATE TABLE stop_times (trip_id TEXT, stop_id TEXT, stop_sequence INTEGER, arrival_seconds INTEGER, departure_seconds INTEGER, shape_distance REAL);

    INSERT INTO routes VALUES ('ROUTE_A', 'A', 'テスト路線', '336699');
    INSERT INTO trips VALUES ('TRIP_A', 'ROUTE_A', 'WEEKDAY', 'SHAPE_A', '終点', 0);
    INSERT INTO trips VALUES ('TRIP_B', 'ROUTE_A', 'WEEKDAY', 'SHAPE_A', '終点', 0);
    INSERT INTO shape_points VALUES ('SHAPE_A', 1, 35.1, 139.1, 0);
    INSERT INTO shape_points VALUES ('SHAPE_A', 2, 35.2, 139.2, 1000);
    INSERT INTO stops VALUES ('STOP_A', '始発駅', 35.1, 139.1);
    INSERT INTO stops VALUES ('STOP_B', '終着駅', 35.2, 139.2);
    INSERT INTO stop_times VALUES ('TRIP_A', 'STOP_A', 1, 3600, 3600, 0);
    INSERT INTO stop_times VALUES ('TRIP_A', 'STOP_B', 2, 4200, 4200, 1000);
  `);
});

afterEach(() => database.close());

describe("routes repository", () => {
  it("lists routes with distinct trip and shape counts", () => {
    expect(listRoutes(database)).toEqual([
      {
        id: "ROUTE_A",
        shortName: "A",
        name: "テスト路線",
        color: "#336699",
        tripCount: 2,
        shapeCount: 1,
      },
    ]);
  });

  it("returns route, trip, LineString and station data", () => {
    const result = getRouteMapData(database, "ROUTE_A");

    expect(result?.trips).toHaveLength(2);
    expect(result?.shapes.features[0]?.geometry.coordinates).toEqual([
      [139.1, 35.1],
      [139.2, 35.2],
    ]);
    expect(result?.stops.features.map((feature) => feature.properties.name)).toEqual([
      "始発駅",
      "終着駅",
    ]);
  });

  it("returns null for an unknown route", () => {
    expect(getRouteMapData(database, "UNKNOWN")).toBeNull();
  });
});
