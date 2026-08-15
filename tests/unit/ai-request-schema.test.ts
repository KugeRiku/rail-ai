import { describe, expect, it } from "vitest";
import { aiParseRequestSchema } from "@/schemas/ai-request";

describe("aiParseRequestSchema", () => {
  it("accepts a normal Japanese input", () => {
    expect(
      aiParseRequestSchema.safeParse({
        text: "明日の午後にSeries-Aを撮りたい。駅から10分以内がいい",
      }).success,
    ).toBe(true);
  });

  it("rejects empty and overly long inputs", () => {
    expect(aiParseRequestSchema.safeParse({ text: "" }).success).toBe(false);
    expect(
      aiParseRequestSchema.safeParse({ text: "あ".repeat(501) }).success,
    ).toBe(false);
  });
});
