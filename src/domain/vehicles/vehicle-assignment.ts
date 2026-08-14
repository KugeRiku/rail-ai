export type VehicleAssignmentConfidence =
  | "confirmed"
  | "expected"
  | "unknown";

export type VehicleAssignment = {
  tripId: string;
  vehicleSeries: string | null;
  displayName: string | null;
  confidence: VehicleAssignmentConfidence;
};

export function formatVehicleAssignment(
  assignment: VehicleAssignment | null,
): string {
  if (
    assignment?.confidence === "confirmed" &&
    assignment.vehicleSeries
  ) {
    return `車両：${assignment.vehicleSeries}`;
  }

  if (assignment?.confidence === "expected" && assignment.vehicleSeries) {
    return `車両：${assignment.vehicleSeries}予定`;
  }

  return "車両形式不明";
}
