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
