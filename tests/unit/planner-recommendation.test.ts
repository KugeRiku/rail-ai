import { describe, expect, it } from "vitest";
import { buildRecommendationText } from "@/domain/planner/recommendation";

describe("buildRecommendationText", () => {
  it("builds a deterministic explanation from score reasons", () => {
    expect(
      buildRecommendationText([
        "指定時間帯に通過（+40）",
        "対象車両 Series-A と一致（+20）",
        "徒歩6分（上限10分以内、+21）",
      ]),
    ).toBe(
      "指定条件を満たします。指定時間帯に通過、対象車両 Series-A と一致、徒歩6分（上限10分以内）。",
    );
  });

  it("uses a safe fallback when reasons are unavailable", () => {
    expect(buildRecommendationText([])).toBe(
      "指定条件を満たす登録済みの撮影地点です。",
    );
  });
});
