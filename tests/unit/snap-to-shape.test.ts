import { describe, expect, it } from "vitest";
import { snapPointToShape } from "@/domain/geo/snap-to-shape";

const EQUATOR_LINE = [
  [0, 0],
  [0.01, 0],
];

describe("snapPointToShape", () => {
  it("snaps to the nearest point and measures distances along the shape", () => {
    const result = snapPointToShape(
      EQUATOR_LINE,
      { longitude: 0.005, latitude: 0.001 },
      200,
    );

    expect(result).not.toBeNull();
    expect(result?.longitude).toBeCloseTo(0.005, 6);
    expect(result?.latitude).toBeCloseTo(0, 6);
    expect(result?.distanceFromShape).toBeCloseTo(111.2, 0);
    expect(result?.distanceAlongShape).toBeCloseTo(556, 0);
    expect(result?.totalShapeDistance).toBeCloseTo(1_112, 0);
  });

  it("rejects a click farther away than the configured threshold", () => {
    const result = snapPointToShape(
      EQUATOR_LINE,
      { longitude: 0.005, latitude: 0.001 },
      50,
    );

    expect(result).toBeNull();
  });

  it("measures an endpoint as the full shape distance", () => {
    const result = snapPointToShape(
      EQUATOR_LINE,
      { longitude: 0.01, latitude: 0 },
      1,
    );

    expect(result).not.toBeNull();
    expect(result?.distanceAlongShape).toBeCloseTo(
      result?.totalShapeDistance ?? 0,
      6,
    );
  });
});
