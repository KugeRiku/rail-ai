"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { PassageListItem } from "@/domain/passages/search-passages";
import type { TripDetail } from "@/domain/trips/trip-detail";
import styles from "./SidePanel.module.css";

type TripDetailPanelProps = {
  passage: PassageListItem;
  onBack: () => void;
};

type DetailStatus = "loading" | "success" | "error";

export function TripDetailPanel({ passage, onBack }: TripDetailPanelProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<DetailStatus>("loading");
  const [detail, setDetail] = useState<TripDetail | null>(null);

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ block: "start" });
  }, []);

  useEffect(() => {
    if (status === "success") {
      sectionRef.current?.scrollIntoView({ block: "start" });
    }
  }, [status]);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadDetail() {
      setStatus("loading");

      try {
        const response = await fetch(
          `/api/trips/${encodeURIComponent(passage.tripId)}`,
          { signal: abortController.signal },
        );

        if (!response.ok) {
          throw new Error(`Trip request failed with status ${response.status}`);
        }

        setDetail((await response.json()) as TripDetail);
        setStatus("success");
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        console.error("Failed to load trip detail", error);
        setDetail(null);
        setStatus("error");
      }
    }

    void loadDetail();
    return () => abortController.abort();
  }, [passage.tripId]);

  return (
    <section
      ref={sectionRef}
      className={styles.tripDetail}
      aria-labelledby="trip-detail-title"
    >
      <button type="button" className={styles.backButton} onClick={onBack}>
        <span aria-hidden="true">←</span> 戻る
      </button>

      <p className={styles.step}>TRIP DETAIL</p>
      <h2 id="trip-detail-title">{passage.headsign}方面</h2>
      <p className={styles.tripMeta}>
        {passage.routeName} · {passage.tripId}
      </p>

      {status === "loading" && (
        <p className={styles.searchState} role="status">
          列車詳細を読み込んでいます…
        </p>
      )}
      {status === "error" && (
        <p className={styles.searchError} role="alert">
          列車詳細を取得できませんでした。一覧へ戻って再度お試しください。
        </p>
      )}
      {status === "success" && detail && (
        <ol className={styles.tripTimeline}>
          {detail.stopTimes.map((stopTime, index) => {
            const nextStop = detail.stopTimes[index + 1];
            const insertSelectedPoint =
              stopTime.stopId === passage.previousStopId &&
              nextStop?.stopId === passage.nextStopId;

            return (
              <Fragment key={stopTime.stopId}>
                <li className={styles.stationEvent}>
                  <span className={styles.timelineMarker} aria-hidden="true" />
                  <div>
                    <strong>{stopTime.stopName}</strong>
                    <span className={styles.stopId}>{stopTime.stopId}</span>
                  </div>
                  <div className={styles.stopTimes}>
                    {stopTime.arrivalTime === stopTime.departureTime ? (
                      <time>{stopTime.departureTime}</time>
                    ) : (
                      <>
                        <span>着 {stopTime.arrivalTime}</span>
                        <span>発 {stopTime.departureTime}</span>
                      </>
                    )}
                  </div>
                </li>
                {insertSelectedPoint && (
                  <li className={styles.selectedPointEvent}>
                    <span className={styles.cameraMarker} aria-hidden="true">
                      ●
                    </span>
                    <div>
                      <strong>選択地点</strong>
                      <span>撮影地点の推定通過時刻</span>
                    </div>
                    <time>{passage.estimatedTime}ごろ</time>
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>
      )}

      <p className={styles.estimateNotice}>
        選択地点の時刻は、前後駅の発着時刻と線路距離から求めた推定値です。
      </p>
    </section>
  );
}
