"use client";

import { MapView } from "@/components/map/MapView";
import { SidePanel } from "@/components/panel/SidePanel";
import type { SelectedRailPoint } from "@/domain/geo/snap-to-shape";
import type { ShootingPlanCandidate } from "@/domain/planner/search-shooting-plans";
import { useCallback, useState } from "react";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  const [selection, setSelection] = useState<SelectedRailPoint | null>(null);
  const [highlightedShapeId, setHighlightedShapeId] = useState<string | null>(
    null,
  );
  const [selectedPlanCandidate, setSelectedPlanCandidate] =
    useState<ShootingPlanCandidate | null>(null);
  const handleSelection = useCallback((point: SelectedRailPoint) => {
    setSelection(point);
    setSelectedPlanCandidate(null);
    setHighlightedShapeId(null);
  }, []);
  const handleTripShapeChange = useCallback((shapeId: string | null) => {
    setHighlightedShapeId(shapeId);
  }, []);
  const handlePlanCandidateSelect = useCallback(
    (candidate: ShootingPlanCandidate | null) => {
      setSelectedPlanCandidate(candidate);
      setHighlightedShapeId(candidate?.trip.shapeId ?? null);
    },
    [],
  );

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            RS
          </span>
          <div>
            <p className={styles.productName}>RailShot AI</p>
            <p className={styles.tagline}>鉄道撮影プランナー</p>
          </div>
        </div>
        <p className={styles.phaseLabel}>MVP FOUNDATION</p>
      </header>

      <div className={styles.workspace}>
        <section className={styles.mapArea} aria-label="鉄道路線マップ">
          <MapView
            highlightedShapeId={highlightedShapeId}
            selectedPlanCandidate={selectedPlanCandidate}
            onSelection={handleSelection}
          />
        </section>
        <SidePanel
          selection={selection}
          selectedPlanCandidate={selectedPlanCandidate}
          onPlanCandidateSelect={handlePlanCandidateSelect}
          onTripShapeChange={handleTripShapeChange}
        />
      </div>
    </main>
  );
}
