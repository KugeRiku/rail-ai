const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const JULIAN_UNIX_EPOCH = 2_440_588;
const JULIAN_J2000 = 2_451_545;
const TOKYO_OFFSET_SECONDS = 9 * 60 * 60;

export type LightingLabel = "良好" | "普通" | "厳しい";

export type LightingEvaluation = {
  sunAzimuth: number;
  sunAltitude: number;
  cameraBearing: number;
  lightingScore: number;
  lightingLabel: LightingLabel;
};

type SolarLightingInput = {
  serviceDate: string;
  serviceSeconds: number;
  latitude: number;
  longitude: number;
  cameraBearing: number;
};

function normalizeBearing(value: number): number {
  return ((value % 360) + 360) % 360;
}

function angularDifference(left: number, right: number): number {
  const difference = Math.abs(normalizeBearing(left) - normalizeBearing(right));
  return Math.min(difference, 360 - difference);
}

function serviceDateTimeToUtc(
  serviceDate: string,
  serviceSeconds: number,
): Date {
  const [year, month, day] = serviceDate.split("-").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day) +
      (serviceSeconds - TOKYO_OFFSET_SECONDS) * 1_000,
  );
}

function calculateSunPosition(
  date: Date,
  latitude: number,
  longitude: number,
): { azimuth: number; altitude: number } {
  const julianDay =
    date.valueOf() / 86_400_000 - 0.5 + JULIAN_UNIX_EPOCH;
  const daysSinceJ2000 = julianDay - JULIAN_J2000;
  const solarMeanAnomaly =
    DEG_TO_RAD * (357.5291 + 0.98560028 * daysSinceJ2000);
  const equationOfCenter =
    DEG_TO_RAD *
    (1.9148 * Math.sin(solarMeanAnomaly) +
      0.02 * Math.sin(2 * solarMeanAnomaly) +
      0.0003 * Math.sin(3 * solarMeanAnomaly));
  const eclipticLongitude =
    solarMeanAnomaly + equationOfCenter + DEG_TO_RAD * 102.9372 + Math.PI;
  const obliquity = DEG_TO_RAD * 23.4397;
  const declination = Math.asin(
    Math.sin(eclipticLongitude) * Math.sin(obliquity),
  );
  const rightAscension = Math.atan2(
    Math.sin(eclipticLongitude) * Math.cos(obliquity),
    Math.cos(eclipticLongitude),
  );
  const latitudeRadians = latitude * DEG_TO_RAD;
  const siderealTime =
    DEG_TO_RAD * (280.16 + 360.9856235 * daysSinceJ2000 + longitude);
  const hourAngle = siderealTime - rightAscension;
  const altitude = Math.asin(
    Math.sin(latitudeRadians) * Math.sin(declination) +
      Math.cos(latitudeRadians) *
        Math.cos(declination) *
        Math.cos(hourAngle),
  );
  const southBasedAzimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latitudeRadians) -
      Math.tan(declination) * Math.cos(latitudeRadians),
  );

  return {
    azimuth: normalizeBearing(southBasedAzimuth * RAD_TO_DEG + 180),
    altitude: altitude * RAD_TO_DEG,
  };
}

function directionScore(sunAzimuth: number, cameraBearing: number): number {
  const preferredSunBearing = normalizeBearing(cameraBearing + 180);
  const difference = angularDifference(sunAzimuth, preferredSunBearing);

  if (difference <= 30) return 70;
  if (difference <= 60) return 50;
  if (difference <= 90) return 30;
  if (difference <= 120) return 15;
  return 0;
}

function altitudeScore(sunAltitude: number): number {
  if (sunAltitude <= 0) return 0;
  if (sunAltitude < 10) return 20;
  if (sunAltitude <= 55) return 30;
  if (sunAltitude <= 70) return 20;
  return 10;
}

export function evaluateSolarLighting({
  serviceDate,
  serviceSeconds,
  latitude,
  longitude,
  cameraBearing,
}: SolarLightingInput): LightingEvaluation {
  const normalizedCameraBearing = normalizeBearing(cameraBearing);
  const position = calculateSunPosition(
    serviceDateTimeToUtc(serviceDate, serviceSeconds),
    latitude,
    longitude,
  );
  const lightingScore =
    position.altitude <= 0
      ? 0
      : directionScore(position.azimuth, normalizedCameraBearing) +
        altitudeScore(position.altitude);
  const lightingLabel: LightingLabel =
    lightingScore >= 75 ? "良好" : lightingScore >= 45 ? "普通" : "厳しい";

  return {
    sunAzimuth: Number(position.azimuth.toFixed(1)),
    sunAltitude: Number(position.altitude.toFixed(1)),
    cameraBearing: Number(normalizedCameraBearing.toFixed(1)),
    lightingScore,
    lightingLabel,
  };
}
