import styles from "./SidePanel.module.css";

export function SidePanel() {
  return (
    <aside className={styles.panel} aria-labelledby="side-panel-title">
      <div className={styles.panelHeader}>
        <p className={styles.eyebrow}>撮影情報</p>
        <span className={styles.status}>準備中</span>
      </div>

      <div className={styles.emptyState}>
        <span className={styles.pin} aria-hidden="true">
          <span />
        </span>
        <p className={styles.step}>STEP 01</p>
        <h1 id="side-panel-title">地点を選択してください</h1>
        <p className={styles.description}>
          今後、地図で選んだ地点を通過する列車や推定時刻をここに表示します。
        </p>
      </div>

      <div className={styles.notice}>
        <span className={styles.noticeLine} aria-hidden="true" />
        <p>
          現在はWebアプリ基盤のみです。鉄道データと検索機能は後続フェーズで追加します。
        </p>
      </div>
    </aside>
  );
}
