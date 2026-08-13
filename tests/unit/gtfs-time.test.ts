import { describe, expect, it } from "vitest";
import { gtfsTimeToSeconds } from "@/domain/gtfs/time";

describe("gtfsTimeToSeconds", () => {
  it.each([
    ["12:00:00", 43_200],
    ["23:59:00", 86_340],
    ["24:30:00", 88_200],
    ["25:10:00", 90_600],
  ])("converts %s to %i service-day seconds", (input, expected) => {
    expect(gtfsTimeToSeconds(input)).toBe(expected);
  });

  it.each(["", "12:00", "12:60:00", "12:00:60", "invalid"])(
    "rejects invalid time %j",
    (input) => {
      expect(() => gtfsTimeToSeconds(input)).toThrow("Invalid GTFS time");
    },
  );
});
