const SCORE_SUFFIX = /（\+\d+）$/u;
const NESTED_SCORE_SUFFIX = /、\+\d+）$/u;

export function buildRecommendationText(scoreReasons: string[]): string {
  const reasons = scoreReasons
    .map((reason) =>
      reason.replace(SCORE_SUFFIX, "").replace(NESTED_SCORE_SUFFIX, "）"),
    )
    .filter((reason) => reason.length > 0);

  return reasons.length > 0
    ? `指定条件を満たします。${reasons.join("、")}。`
    : "指定条件を満たす登録済みの撮影地点です。";
}
