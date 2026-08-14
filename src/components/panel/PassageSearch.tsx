"use client";

import { useEffect, useState } from "react";
import type { SelectedRailPoint } from "@/domain/geo/snap-to-shape";
import type { PassageListItem } from "@/domain/passages/search-passages";
import styles from "./SidePanel.module.css";

type PassageSearchProps = {
  selection: SelectedRailPoint;
};

type Filters = {
  date: string;
  startTime: string;
  endTime: string;
};

type SearchStatus = "loading" | "success" | "error";

const INITIAL_FILTERS: Filters = {
  date: "2026-08-14",
  startTime: "05:00",
  endTime: "26:00",
};

export function PassageSearch({ selection }: PassageSearchProps) {
  const [draftFilters, setDraftFilters] = useState(INITIAL_FILTERS);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [status, setStatus] = useState<SearchStatus>("loading");
  const [passages, setPassages] = useState<PassageListItem[]>([]);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadPassages() {
      setStatus("loading");

      try {
        const response = await fetch("/api/passages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: selection.latitude,
            longitude: selection.longitude,
            routeId: selection.routeId,
            date: filters.date,
            startTime: filters.startTime,
            endTime: filters.endTime,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Passage request failed with status ${response.status}`);
        }

        const data = (await response.json()) as { passages: PassageListItem[] };
        setPassages(data.passages);
        setStatus("success");
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        console.error("Failed to load train passages", error);
        setPassages([]);
        setStatus("error");
      }
    }

    void loadPassages();
    return () => abortController.abort();
  }, [filters, selection]);

  return (
    <section className={styles.passageSection} aria-labelledby="passage-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.step}>PASSAGE SEARCH</p>
          <h2 id="passage-title">この地点を通過する列車</h2>
        </div>
        {status === "success" && (
          <span className={styles.count}>{passages.length}本</span>
        )}
      </div>

      <form
        className={styles.searchForm}
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({ ...draftFilters });
        }}
      >
        <label className={styles.dateField}>
          <span>日付</span>
          <input
            type="date"
            value={draftFilters.date}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                date: event.target.value,
              }))
            }
            required
          />
        </label>
        <label>
          <span>開始</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{1,3}:[0-5][0-9]"
            value={draftFilters.startTime}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                startTime: event.target.value,
              }))
            }
            aria-label="検索開始時刻"
            required
          />
        </label>
        <label>
          <span>終了</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{1,3}:[0-5][0-9]"
            value={draftFilters.endTime}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                endTime: event.target.value,
              }))
            }
            aria-label="検索終了時刻"
            required
          />
        </label>
        <button type="submit">検索</button>
      </form>

      {status === "loading" && (
        <p className={styles.searchState} role="status">
          通過列車を検索しています…
        </p>
      )}
      {status === "error" && (
        <p className={styles.searchError} role="alert">
          通過列車を取得できませんでした。条件を確認して再検索してください。
        </p>
      )}
      {status === "success" && passages.length === 0 && (
        <p className={styles.searchState}>指定時間帯に通過する列車はありません。</p>
      )}
      {status === "success" && passages.length > 0 && (
        <ol className={styles.passageList}>
          {passages.map((passage) => (
            <li key={passage.tripId}>
              <time>{passage.estimatedTime}ごろ</time>
              <div>
                <strong>{passage.headsign}方面</strong>
                <span>
                  {passage.routeName} · {passage.tripId}
                </span>
              </div>
              <span className={styles.estimateBadge}>推定</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
