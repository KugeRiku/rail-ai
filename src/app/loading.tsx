import styles from "./route-state.module.css";

export default function Loading() {
  return (
    <main className={styles.page} aria-busy="true">
      <div className={styles.card} role="status" aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <p className={styles.eyebrow}>RailShot AI</p>
        <h1>画面を準備しています</h1>
        <p>地図と撮影情報パネルを読み込んでいます。</p>
      </div>
    </main>
  );
}
