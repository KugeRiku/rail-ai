import { describe, expect, it } from "vitest";
import { getActiveServiceIds } from "@/domain/gtfs/service-calendar";

const weekdayCalendar = {
  serviceId: "WEEKDAY",
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
  sunday: false,
  startDate: "20260801",
  endDate: "20261231",
};

describe("getActiveServiceIds", () => {
  it("uses the weekly calendar", () => {
    expect([...getActiveServiceIds("2026-08-14", [weekdayCalendar], [])]).toEqual([
      "WEEKDAY",
    ]);
  });

  it("applies added and removed service exceptions", () => {
    expect(
      getActiveServiceIds("2026-08-15", [weekdayCalendar], [
        { serviceId: "WEEKDAY", date: "20260815", exceptionType: 1 },
      ]).has("WEEKDAY"),
    ).toBe(true);
    expect(
      getActiveServiceIds("2026-08-17", [weekdayCalendar], [
        { serviceId: "WEEKDAY", date: "20260817", exceptionType: 2 },
      ]).has("WEEKDAY"),
    ).toBe(false);
  });
});
