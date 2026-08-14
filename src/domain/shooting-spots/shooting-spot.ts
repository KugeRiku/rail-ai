export type ShootingSpotSafetyStatus =
  | "approved"
  | "pending"
  | "rejected";

export type ShootingSpot = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  nearestStation: string;
  walkMinutes: number;
  cameraBearing: number;
  notes: string;
  safetyStatus: ShootingSpotSafetyStatus;
};
