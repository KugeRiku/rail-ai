"use client";

import { useEffect } from "react";
import styles from "./route-state.module.css";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("RailShot AI page error", error);
  }, [error]);

  return (
    <main className={styles.page}>
      <div className={styles.card} role="alert">
        <p className={styles.eyebrow}>RailShot AI</p>
        <h1>画面を表示できませんでした</h1>
        <p>一時的な問題が発生しました。もう一度読み込みをお試しください。</p>
        <button className={styles.button} type="button" onClick={reset}>
          もう一度読み込む
        </button>
      </div>
    </main>
  );
}
