import type Database from "better-sqlite3";
import type { ShootingSpot } from "@/domain/shooting-spots/shooting-spot";

type ShootingSpotRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  nearest_station: string;
  walk_minutes: number;
  camera_bearing: number;
  notes: string;
  safety_status: ShootingSpot["safetyStatus"];
};

export function listApprovedShootingSpots(
  database: Database.Database,
): ShootingSpot[] {
  const rows = database
    .prepare(
      `SELECT
         id,
         name,
         latitude,
         longitude,
         nearest_station,
         walk_minutes,
         camera_bearing,
         notes,
         safety_status
       FROM shooting_spots
       WHERE safety_status = 'approved'
       ORDER BY id`,
    )
    .all() as ShootingSpotRow[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    nearestStation: row.nearest_station,
    walkMinutes: row.walk_minutes,
    cameraBearing: row.camera_bearing,
    notes: row.notes,
    safetyStatus: row.safety_status,
  }));
}
