import { describe, expect, it } from "vitest";
import {
  formatVehicleAssignment,
  type VehicleAssignment,
} from "@/domain/vehicles/vehicle-assignment";

function assignment(
  confidence: VehicleAssignment["confidence"],
  vehicleSeries: string | null = "Series-A",
): VehicleAssignment {
  return {
    tripId: "TRIP_A",
    vehicleSeries,
    displayName: vehicleSeries ? "デモ車両" : null,
    confidence,
  };
}

describe("formatVehicleAssignment", () => {
  it("shows confirmed vehicle information without a qualifier", () => {
    expect(formatVehicleAssignment(assignment("confirmed"))).toBe(
      "車両：Series-A",
    );
  });

  it("marks expected vehicle information as a plan", () => {
    expect(formatVehicleAssignment(assignment("expected"))).toBe(
      "車両：Series-A予定",
    );
  });

  it("does not invent a series for unknown or missing assignments", () => {
    expect(formatVehicleAssignment(assignment("unknown", null))).toBe(
      "車両形式不明",
    );
    expect(formatVehicleAssignment(null)).toBe("車両形式不明");
  });
});
