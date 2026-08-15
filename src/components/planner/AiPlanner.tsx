"use client";

import { useState } from "react";
import {
  DEMO_AI_INPUT,
  DEMO_FALLBACK_CONDITIONS,
} from "@/config/demo";
import type { ShootingPlanCandidate } from "@/domain/planner/search-shooting-plans";
import { buildRecommendationText } from "@/domain/planner/recommendation";
import type { StructuredSearchConditions } from "@/schemas/ai-request";
import { formatVehicleAssignment } from "@/domain/vehicles/vehicle-assignment";
import styles from "../panel/SidePanel.module.css";

type PlannerStatus =
  | "idle"
  | "parsing"
  | "searching"
  | "success"
  | "ai-error"
  | "planner-error";

type ApiError = {
  error?: { code?: string; message?: string };
  conditions?: StructuredSearchConditions;
};

type AiPlannerProps = {
  selectedCandidate: ShootingPlanCandidate | null;
  onCandidateSelect: (candidate: ShootingPlanCandidate | null) => void;
};

function formatDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function candidateKey(candidate: ShootingPlanCandidate): string {
  return `${candidate.spot.id}:${candidate.trip.id}`;
}

export function AiPlanner({
  selectedCandidate,
  onCandidateSelect,
}: AiPlannerProps) {
  const [text, setText] = useState(DEMO_AI_INPUT);
  const [status, setStatus] = useState<PlannerStatus>("idle");
  const [conditions, setConditions] =
    useState<StructuredSearchConditions | null>(null);
  const [candidates, setCandidates] = useState<ShootingPlanCandidate[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fallbackAvailable, setFallbackAvailable] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);

  async function searchPlans(parsedConditions: StructuredSearchConditions) {
    setStatus("searching");
    setErrorMessage(null);
    try {
      const plannerResponse = await fetch("/api/planner/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleSeries: parsedConditions.vehicleSeries ?? undefined,
          tripId: parsedConditions.tripId ?? undefined,
          date: parsedConditions.date,
          startTime: parsedConditions.startTime,
          endTime: parsedConditions.endTime,
          maxWalkMinutes: parsedConditions.maxWalkMinutes,
          lightingPreference: parsedConditions.lightingPreference ?? undefined,
        }),
      });
      const plannerBody = (await plannerResponse.json()) as
        | { candidates: ShootingPlanCandidate[] }
        | ApiError;
      if (!plannerResponse.ok || !("candidates" in plannerBody)) {
        throw new Error(
          "error" in plannerBody
            ? plannerBody.error?.message ?? "撮影プランを検索できませんでした。"
            : "撮影プランを検索できませんでした。",
        );
      }

      setCandidates(plannerBody.candidates);
      setStatus("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "撮影プランを検索できませんでした。",
      );
      setStatus("planner-error");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("parsing");
    setConditions(null);
    setCandidates([]);
    setErrorMessage(null);
    setFallbackAvailable(false);
    setFallbackMode(false);
    onCandidateSelect(null);

    let parsedConditions: StructuredSearchConditions;
    try {
      const parseResponse = await fetch("/api/ai/parse-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const parsedBody = (await parseResponse.json()) as
        | StructuredSearchConditions
        | ApiError;
      if (!parseResponse.ok) {
        const errorBody = parsedBody as ApiError;
        if (errorBody.conditions) {
          setConditions(errorBody.conditions);
        }
        const isAiServiceFailure = Boolean(
          errorBody.error?.code?.startsWith("AI_") &&
            errorBody.error.code !== "AI_INVALID_REQUEST",
        );
        setFallbackAvailable(isAiServiceFailure);
        throw new Error(
          isAiServiceFailure
            ? "AI撮影プランナーに接続できませんでした。地図と列車検索は引き続き利用できます。"
            : errorBody.error?.message ?? "自然言語を解析できませんでした。",
        );
      }

      parsedConditions = parsedBody as StructuredSearchConditions;
      if (
        (!parsedConditions.vehicleSeries && !parsedConditions.tripId) ||
        !parsedConditions.date ||
        !parsedConditions.startTime ||
        !parsedConditions.endTime ||
        parsedConditions.maxWalkMinutes === null
      ) {
        throw new Error("撮影プラン検索に必要な条件が不足しています。");
      }
      setConditions(parsedConditions);
    } catch (error) {
      if (!(error instanceof Error)) {
        setFallbackAvailable(true);
      } else if (error instanceof TypeError) {
        setFallbackAvailable(true);
      }
      setErrorMessage(
        error instanceof TypeError
          ? "AI撮影プランナーに接続できませんでした。地図と列車検索は引き続き利用できます。"
          : error instanceof Error
            ? error.message
            : "AI撮影プランナーに接続できませんでした。地図と列車検索は引き続き利用できます。",
      );
      setStatus("ai-error");
      return;
    }

    await searchPlans(parsedConditions);
  }

  const busy = status === "parsing" || status === "searching";

  return (
    <section className={styles.aiPlanner} aria-labelledby="ai-planner-title">
      <p className={styles.step}>AI PLANNER</p>
      <h2 id="ai-planner-title">撮影条件をAIで整理</h2>
      <form className={styles.aiForm} onSubmit={handleSubmit}>
        <label htmlFor="ai-planner-input">
          どんな列車を、いつ、どんな条件で撮りたいですか？
        </label>
        <textarea
          id="ai-planner-input"
          value={text}
          maxLength={500}
          onChange={(event) => setText(event.target.value)}
          disabled={busy}
          required
        />
        <button type="submit" disabled={busy}>
          {status === "parsing"
            ? "条件を解析中…"
            : status === "searching"
              ? "撮影地点を検索中…"
              : "撮影プランを検索"}
        </button>
      </form>

      {errorMessage && (
        <p className={styles.aiError} role="alert">
          <strong>
            {status === "planner-error" ? "検索エラー" : "AI解析エラー"}
          </strong>
          {errorMessage}
        </p>
      )}

      {fallbackAvailable && status === "ai-error" && (
        <div className={styles.fallbackBox}>
          <strong>デモ緊急用フォールバック</strong>
          <p>OrcaRouterを使わず、事前定義した条件で検索します。</p>
          <button
            type="button"
            onClick={() => {
              setFallbackAvailable(false);
              setFallbackMode(true);
              setConditions(DEMO_FALLBACK_CONDITIONS);
              void searchPlans(DEMO_FALLBACK_CONDITIONS);
            }}
          >
            事前定義条件で検索（AI未使用）
          </button>
        </div>
      )}

      {fallbackMode && (
        <p className={styles.fallbackBanner} role="status">
          デモ緊急モード：OrcaRouterは使用していません
        </p>
      )}

      {status === "parsing" && (
        <p className={styles.aiProgress} role="status">
          OrcaRouterで撮影条件を解析しています…
        </p>
      )}
      {status === "searching" && (
        <p className={styles.aiProgress} role="status">
          条件に合う登録済み撮影地点を検索しています…
        </p>
      )}

      {conditions && (
        <div className={styles.understoodConditions}>
          <h3>
            {fallbackMode
              ? "事前定義した検索条件（AI未使用）"
              : "AIが理解した条件"}
          </h3>
          <dl>
            <div>
              <dt>対象</dt>
              <dd>{conditions.vehicleSeries ?? conditions.tripId ?? "未指定"}</dd>
            </div>
            <div>
              <dt>日付</dt>
              <dd>{conditions.date ? formatDate(conditions.date) : "未指定"}</dd>
            </div>
            <div>
              <dt>時間</dt>
              <dd>
                {conditions.startTime && conditions.endTime
                  ? `${conditions.startTime}〜${conditions.endTime}`
                  : "未指定"}
              </dd>
            </div>
            <div>
              <dt>徒歩</dt>
              <dd>
                {conditions.maxWalkMinutes === null
                  ? "未指定"
                  : `${conditions.maxWalkMinutes}分以内`}
              </dd>
            </div>
            {conditions.lightingPreference && (
              <div>
                <dt>光線</dt>
                <dd>良好な候補を優先</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {status === "success" && candidates.length === 0 && (
        <p className={styles.aiEmpty}>条件に合う撮影候補はありません。</p>
      )}
      {status === "success" && candidates.length > 0 && (
        <div className={styles.planResults}>
          <div className={styles.planResultsHeading}>
            <h3>おすすめ撮影地点</h3>
            <span>{candidates.length}件</span>
          </div>
          <p className={styles.lightingNotice}>
            光線評価は太陽位置と撮影方向から算出した簡易的な参考指標です。現地の建物や天候は反映していません。
          </p>
          <ol className={styles.planList}>
            {candidates.map((candidate) => {
              const key = candidateKey(candidate);
              const isSelected = selectedCandidate
                ? candidateKey(selectedCandidate) === key
                : false;

              return (
                <li key={key}>
                  <button
                    type="button"
                    className={styles.planCard}
                    aria-pressed={isSelected}
                    onClick={() => onCandidateSelect(candidate)}
                  >
                    <div className={styles.planCardHeading}>
                      <strong>{candidate.spot.name}</strong>
                      <span>{candidate.score}点</span>
                    </div>
                    <p>
                      通過：<time>{candidate.estimatedPassageTime}ごろ</time>
                      <span> · {candidate.trip.headsign}方面</span>
                    </p>
                    <p>{formatVehicleAssignment(candidate.vehicle)}</p>
                    <p>
                      最寄駅：{candidate.spot.nearestStation} · 徒歩
                      {candidate.walkMinutes}分
                    </p>
                    <p className={styles.lightingSummary}>
                      光線：
                      <strong data-lighting-label={candidate.lightingLabel}>
                        {candidate.lightingLabel}
                      </strong>
                      <span>
                        太陽 方位{candidate.sunAzimuth.toFixed(1)}°・高度
                        {candidate.sunAltitude.toFixed(1)}°／撮影方向
                        {candidate.cameraBearing.toFixed(1)}°
                      </span>
                    </p>
                    <p className={styles.recommendationReason}>
                      <strong>おすすめ理由：</strong>
                      {buildRecommendationText(candidate.scoreReasons)}
                    </p>
                    <span className={styles.planCardAction}>
                      {isSelected ? "地図に表示中" : "地図で見る"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
