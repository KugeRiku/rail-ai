import { describe, expect, it } from "vitest";
import {
  DEMO_AI_INPUT,
  DEMO_FALLBACK_CONDITIONS,
} from "@/config/demo";
import { structuredSearchConditionsSchema } from "@/schemas/ai-request";

describe("demo configuration", () => {
  it("uses fixed, valid conditions that match the documented input", () => {
    expect(DEMO_AI_INPUT).toContain("2026-08-16");
    expect(DEMO_AI_INPUT).toContain("Series-A");
    expect(
      structuredSearchConditionsSchema.parse(DEMO_FALLBACK_CONDITIONS),
    ).toEqual(DEMO_FALLBACK_CONDITIONS);
  });
});
