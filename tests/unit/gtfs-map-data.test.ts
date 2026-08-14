import { describe, expect, it } from "vitest";
import {
  createRouteShapeGeoJson,
  createStopsGeoJson,
  normalizeRouteColor,
  type TripSummary,
} from "@/domain/gtfs/map-data";

const route = {
  id: "ROUTE_A",
  shortName: "A",
  name: "テスト路線",
  color: "#123456",
};

describe("createRouteShapeGeoJson", () => {
  it("groups points into ordered LineString features with trip metadata", () => {
    const trips: TripSummary[] = [
      { id: "TRIP_1", shapeId: "SHAPE_1", headsign: "終点", directionId: 0 },
      { id: "TRIP_2", shapeId: "SHAPE_1", headsign: "終点", directionId: 0 },
    ];

    const result = createRouteShapeGeoJson(route, trips, [
      { shapeId: "SHAPE_1", sequence: 2, longitude: 139.2, latitude: 35.2 },
      { shapeId: "SHAPE_1", sequence: 1, longitude: 139.1, latitude: 35.1 },
    ]);

    expect(result.features).toHaveLength(1);
    expect(result.features[0]?.geometry).toEqual({
      type: "LineString",
      coordinates: [
        [139.1, 35.1],
        [139.2, 35.2],
      ],
    });
    expect(result.features[0]?.properties).toMatchObject({
      routeId: "ROUTE_A",
      routeColor: "#123456",
      shapeId: "SHAPE_1",
      directionIds: [0],
      tripIds: ["TRIP_1", "TRIP_2"],
    });
  });

  it("omits invalid shapes with fewer than two points", () => {
    const result = createRouteShapeGeoJson(route, [], [
      { shapeId: "SHAPE_1", sequence: 1, longitude: 139.1, latitude: 35.1 },
    ]);

    expect(result.features).toEqual([]);
  });
});

describe("createStopsGeoJson", () => {
  it("creates Point features with station names", () => {
    const result = createStopsGeoJson("ROUTE_A", [
      { id: "STOP_1", name: "朝日駅", longitude: 139.1, latitude: 35.1 },
    ]);

    expect(result.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [139.1, 35.1] },
      properties: { id: "STOP_1", name: "朝日駅", routeId: "ROUTE_A" },
    });
  });
});

describe("normalizeRouteColor", () => {
  it.each([
    ["18866F", "#18866F"],
    ["#abcdef", "#abcdef"],
    ["invalid", "#18866f"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeRouteColor(input)).toBe(expected);
  });
});
