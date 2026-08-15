import type { SelectedRailPoint } from "@/domain/geo/snap-to-shape";
import type { ShootingPlanCandidate } from "@/domain/planner/search-shooting-plans";
import { AiPlanner } from "@/components/planner/AiPlanner";
import { PassageSearch } from "./PassageSearch";
import styles from "./SidePanel.module.css";

type SidePanelProps = {
  selection: SelectedRailPoint | null;
  selectedPlanCandidate: ShootingPlanCandidate | null;
  onPlanCandidateSelect: (candidate: ShootingPlanCandidate | null) => void;
  onTripShapeChange: (shapeId: string | null) => void;
};

function formatDistance(distanceMeters: number): string {
  return distanceMeters >= 1_000
    ? `${(distanceMeters / 1_000).toFixed(2)} km`
    : `${Math.round(distanceMeters)} m`;
}

export function SidePanel({
  selection,
  selectedPlanCandidate,
  onPlanCandidateSelect,
  onTripShapeChange,
}: SidePanelProps) {
  return (
    <aside className={styles.panel} aria-labelledby="side-panel-title">
      <div className={styles.panelHeader}>
        <p className={styles.eyebrow}>撮影情報</p>
        <span className={styles.status}>{selection ? "選択済み" : "地点未選択"}</span>
      </div>

      <AiPlanner
        selectedCandidate={selectedPlanCandidate}
        onCandidateSelect={onPlanCandidateSelect}
      />

      {selection ? (
        <div className={styles.selection}>
          <p className={styles.step}>SELECTED POINT</p>
          <h1 id="side-panel-title">選択地点</h1>
          <dl className={styles.details}>
            <div>
              <dt>緯度</dt>
              <dd>{selection.latitude.toFixed(6)}</dd>
            </div>
            <div>
              <dt>経度</dt>
              <dd>{selection.longitude.toFixed(6)}</dd>
            </div>
            <div>
              <dt>Route ID</dt>
              <dd>{selection.routeId}</dd>
            </div>
            <div>
              <dt>Shape ID</dt>
              <dd>{selection.shapeId}</dd>
            </div>
            <div>
              <dt>始点からの距離</dt>
              <dd>{formatDistance(selection.distanceAlongShape)}</dd>
            </div>
            <div>
              <dt>Shape全長</dt>
              <dd>{formatDistance(selection.totalShapeDistance)}</dd>
            </div>
          </dl>
          <PassageSearch
            key={`${selection.shapeId}:${selection.latitude}:${selection.longitude}`}
            selection={selection}
            onTripShapeChange={onTripShapeChange}
          />
        </div>
      ) : (
        <div className={styles.emptyState}>
          <span className={styles.pin} aria-hidden="true">
            <span />
          </span>
          <p className={styles.step}>STEP 01</p>
          <h1 id="side-panel-title">地点を選択してください</h1>
          <p className={styles.description}>
            地図上の線路をクリックすると、最寄りの線路上へ地点をスナップします。
          </p>
        </div>
      )}

      <div className={styles.notice}>
        <span className={styles.noticeLine} aria-hidden="true" />
        <p>
          通過時刻は駅間距離から求めた推定値です。実際の運行時刻とは異なる場合があります。
        </p>
      </div>
    </aside>
  );
}
