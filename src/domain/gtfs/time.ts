const GTFS_TIME_PATTERN = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/;

/**
 * Converts a GTFS time to elapsed seconds from midnight of its service day.
 * GTFS hours may exceed 23 for trips that continue after midnight.
 */
export function gtfsTimeToSeconds(value: string): number {
  const match = GTFS_TIME_PATTERN.exec(value);

  if (!match) {
    throw new Error(`Invalid GTFS time: ${value}`);
  }

  const [, hoursText, minutesText, secondsText] = match;
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);

  return hours * 60 * 60 + minutes * 60 + seconds;
}

/** Formats service-day elapsed seconds without wrapping hours at 24. */
export function formatServiceTimeHHMM(elapsedSeconds: number): string {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new Error(`Invalid service-day elapsed seconds: ${elapsedSeconds}`);
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
