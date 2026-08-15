import { describe, expect, it } from "vitest";
import { evaluateSolarLighting } from "@/domain/lighting/solar-lighting";

describe("evaluateSolarLighting", () => {
  it("calculates a high summer-noon sun over Tokyo", () => {
    const result = evaluateSolarLighting({
      serviceDate: "2026-06-21",
      serviceSeconds: 12 * 60 * 60,
      latitude: 35.6812,
      longitude: 139.7671,
      cameraBearing: 0,
    });

    expect(result.sunAzimuth).toBeGreaterThan(165);
    expect(result.sunAzimuth).toBeLessThan(205);
    expect(result.sunAltitude).toBeGreaterThan(75);
    expect(result.sunAltitude).toBeLessThan(80);
    expect(result).toMatchObject({
      cameraBearing: 0,
      lightingScore: 80,
      lightingLabel: "良好",
    });
  });

  it("treats the sun below the horizon as unsuitable", () => {
    const result = evaluateSolarLighting({
      serviceDate: "2026-06-21",
      serviceSeconds: 0,
      latitude: 35.6812,
      longitude: 139.7671,
      cameraBearing: 0,
    });

    expect(result.sunAltitude).toBeLessThan(0);
    expect(result.lightingScore).toBe(0);
    expect(result.lightingLabel).toBe("厳しい");
  });

  it("supports service times after 24:00", () => {
    const afterMidnight = evaluateSolarLighting({
      serviceDate: "2026-06-20",
      serviceSeconds: 36 * 60 * 60,
      latitude: 35.6812,
      longitude: 139.7671,
      cameraBearing: 0,
    });
    const nextDayNoon = evaluateSolarLighting({
      serviceDate: "2026-06-21",
      serviceSeconds: 12 * 60 * 60,
      latitude: 35.6812,
      longitude: 139.7671,
      cameraBearing: 0,
    });

    expect(afterMidnight).toEqual(nextDayNoon);
  });
});
