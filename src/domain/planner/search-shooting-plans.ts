import type { PassageTripCandidate } from "@/domain/passages/search-passages";
import { searchPassages } from "@/domain/passages/search-passages";
import {
  evaluateSolarLighting,
  type LightingLabel,
} from "@/domain/lighting/solar-lighting";
import type { ShootingSpot } from "@/domain/shooting-spots/shooting-spot";
import type { VehicleAssignment } from "@/domain/vehicles/vehicle-assignment";

export type ShootingPlanCandidate = {
  spot: ShootingSpot;
  trip: {
    id: string;
    routeId: string;
    routeName: string;
    shapeId: string;
    headsign: string;
    directionId: number;
  };
  estimatedPassageTime: string;
  estimatedPassageSeconds: number;
  isEstimated: true;
  vehicle: VehicleAssignment | null;
  walkMinutes: number;
  sunAzimuth: number;
  sunAltitude: number;
  cameraBearing: number;
  lightingScore: number;
  lightingLabel: LightingLabel;
  score: number;
  scoreReasons: string[];
};

type ShootingPlanSearchInput = {
  vehicleSeries?: string;
  tripId?: string;
  startSeconds: number;
  endSeconds: number;
  maxWalkMinutes: number;
  serviceDate: string;
  lightingPreference?: "good";
  maxDistanceMeters: number;
  activeServiceIds: ReadonlySet<string>;
  spots: ShootingSpot[];
  trips: PassageTripCandidate[];
  limit?: number;
};

const TIME_SCORE = 40;
const TARGET_SCORE = 20;
const MAX_WALK_SCORE = 30;
const MIN_WALK_SCORE = 15;
const MAX_LIGHTING_BONUS = 5;

function calculateWalkScore(walkMinutes: number, maxWalkMinutes: number) {
  if (maxWalkMinutes === 0) {
    return MAX_WALK_SCORE;
  }

  return Math.round(
    MAX_WALK_SCORE -
      (walkMinutes / maxWalkMinutes) * (MAX_WALK_SCORE - MIN_WALK_SCORE),
  );
}

function confidenceScore(vehicle: VehicleAssignment | null): number {
  if (vehicle?.confidence === "confirmed") {
    return 10;
  }
  if (vehicle?.confidence === "expected") {
    return 5;
  }
  return 0;
}

function matchesTarget(
  trip: PassageTripCandidate,
  vehicleSeries: string | undefined,
  tripId: string | undefined,
): boolean {
  return (
    (!vehicleSeries || trip.vehicleAssignment?.vehicleSeries === vehicleSeries) &&
    (!tripId || trip.tripId === tripId)
  );
}

export function searchShootingPlans({
  vehicleSeries,
  tripId,
  startSeconds,
  endSeconds,
  maxWalkMinutes,
  serviceDate,
  lightingPreference,
  maxDistanceMeters,
  activeServiceIds,
  spots,
  trips,
  limit = 20,
}: ShootingPlanSearchInput): ShootingPlanCandidate[] {
  if ((!vehicleSeries && !tripId) || limit <= 0) {
    return [];
  }

  const targetTrips = trips.filter((trip) =>
    matchesTarget(trip, vehicleSeries, tripId),
  );
  const eligibleSpots = spots.filter(
    (spot) =>
      spot.safetyStatus === "approved" &&
      spot.walkMinutes <= maxWalkMinutes,
  );
  const candidates: ShootingPlanCandidate[] = [];

  for (const spot of eligibleSpots) {
    const passages = searchPassages({
      latitude: spot.latitude,
      longitude: spot.longitude,
      startSeconds,
      endSeconds,
      maxDistanceMeters,
      activeServiceIds,
      candidates: targetTrips,
    });

    for (const passage of passages) {
      const trip = targetTrips.find((item) => item.tripId === passage.tripId);
      if (!trip) {
        continue;
      }

      const walkScore = calculateWalkScore(
        spot.walkMinutes,
        maxWalkMinutes,
      );
      const vehicleConfidenceScore = confidenceScore(trip.vehicleAssignment);
      const lighting = evaluateSolarLighting({
        serviceDate,
        serviceSeconds: passage.estimatedSeconds,
        latitude: spot.latitude,
        longitude: spot.longitude,
        cameraBearing: spot.cameraBearing,
      });
      const lightingBonus =
        lightingPreference === "good"
          ? Math.round(
              (lighting.lightingScore / 100) * MAX_LIGHTING_BONUS,
            )
          : 0;
      const scoreReasons = [
        `指定時間帯に通過（+${TIME_SCORE}）`,
        vehicleSeries
          ? `対象車両 ${vehicleSeries} と一致（+${TARGET_SCORE}）`
          : `対象列車 ${trip.tripId} と一致（+${TARGET_SCORE}）`,
        `徒歩${spot.walkMinutes}分（上限${maxWalkMinutes}分以内、+${walkScore}）`,
      ];

      if (trip.vehicleAssignment?.confidence === "confirmed") {
        scoreReasons.push(`車両形式は確定情報（+${vehicleConfidenceScore}）`);
      } else if (trip.vehicleAssignment?.confidence === "expected") {
        scoreReasons.push(`車両形式は予定情報（+${vehicleConfidenceScore}）`);
      } else {
        scoreReasons.push("車両形式の確度加点なし（+0）");
      }
      if (lightingPreference === "good") {
        scoreReasons.push(
          `光線条件は${lighting.lightingLabel}（+${lightingBonus}）`,
        );
      }

      candidates.push({
        spot,
        trip: {
          id: trip.tripId,
          routeId: trip.routeId,
          routeName: trip.routeName,
          shapeId: trip.shapeId,
          headsign: trip.headsign,
          directionId: trip.directionId,
        },
        estimatedPassageTime: passage.estimatedTime,
        estimatedPassageSeconds: passage.estimatedSeconds,
        isEstimated: true,
        vehicle: trip.vehicleAssignment,
        walkMinutes: spot.walkMinutes,
        ...lighting,
        score:
          TIME_SCORE +
          TARGET_SCORE +
          walkScore +
          vehicleConfidenceScore +
          lightingBonus,
        scoreReasons,
      });
    }
  }

  return candidates
    .toSorted(
      (left, right) =>
        right.score - left.score ||
        left.walkMinutes - right.walkMinutes ||
        left.estimatedPassageSeconds - right.estimatedPassageSeconds ||
        left.spot.id.localeCompare(right.spot.id) ||
        left.trip.id.localeCompare(right.trip.id),
    )
    .slice(0, limit);
}
