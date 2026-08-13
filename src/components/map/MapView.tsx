"use client";

import * as maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { mapConfig } from "@/config/map";
import styles from "./MapView.module.css";

type MapStatus = "loading" | "ready" | "error";

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let map: maplibregl.Map | null = null;
    let isActive = true;
    let hasSettled = false;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: mapConfig.style,
        center: [
          mapConfig.initialView.longitude,
          mapConfig.initialView.latitude,
        ],
        zoom: mapConfig.initialView.zoom,
        minZoom: mapConfig.minZoom,
        maxZoom: mapConfig.maxZoom,
        attributionControl: {},
      });

      const handleLoad = () => {
        if (!isActive || hasSettled) {
          return;
        }

        hasSettled = true;
        clearTimeout(loadTimer);
        setStatus("ready");
      };
      const handleError = (event: maplibregl.ErrorEvent) => {
        console.error("MapLibre resource error", event.error);

        if (!isActive || hasSettled) {
          return;
        }

        hasSettled = true;
        clearTimeout(loadTimer);
        setStatus("error");
      };

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-left",
      );
      map.once("load", handleLoad);
      map.on("error", handleError);
      loadTimer = setTimeout(() => {
        if (!isActive || hasSettled) {
          return;
        }

        hasSettled = true;
        console.error("MapLibre load timed out");
        setStatus("error");
      }, mapConfig.loadTimeoutMs);

      return () => {
        isActive = false;
        clearTimeout(loadTimer);
        map?.off("load", handleLoad);
        map?.off("error", handleError);
        map?.remove();
      };
    } catch (error) {
      console.error("MapLibre initialization failed", error);
      let cancelled = false;

      queueMicrotask(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });

      return () => {
        isActive = false;
        cancelled = true;
      };
    }
  }, [retryKey]);

  const retry = () => {
    setStatus("loading");
    setRetryKey((current) => current + 1);
  };

  return (
    <div className={styles.root}>
      <div ref={containerRef} className={styles.map} />

      <div className={styles.mapLabel} aria-hidden="true">
        <span className={styles.mapLabelDot} />
        Map preview
      </div>

      {status === "loading" && (
        <div className={styles.stateOverlay} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <strong>地図を読み込んでいます</strong>
          <span>表示の準備ができるまでお待ちください。</span>
        </div>
      )}

      {status === "error" && (
        <div className={styles.stateOverlay} role="alert">
          <span className={styles.errorMark} aria-hidden="true">
            !
          </span>
          <strong>地図を読み込めませんでした</strong>
          <span>ネットワーク接続を確認して、もう一度お試しください。</span>
          <button type="button" onClick={retry}>
            再読み込み
          </button>
        </div>
      )}
    </div>
  );
}
