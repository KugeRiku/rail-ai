"use client";

import * as maplibregl from "maplibre-gl";
import type { Feature, LineString, Point } from "geojson";
import { useEffect, useRef, useState } from "react";
import { mapConfig } from "@/config/map";
import {
  snapPointToShape,
  type SelectedRailPoint,
} from "@/domain/geo/snap-to-shape";
import type {
  RouteLineProperties,
  RouteMapData,
  RouteSummary,
} from "@/domain/gtfs/map-data";
import type { ShootingPlanCandidate } from "@/domain/planner/search-shooting-plans";
import type { ShootingSpot } from "@/domain/shooting-spots/shooting-spot";
import styles from "./MapView.module.css";

type MapStatus = "loading" | "ready" | "error";

type RoutesResponse = { routes: RouteSummary[] };
type ShootingSpotsResponse = { shootingSpots: ShootingSpot[] };

type MapViewProps = {
  highlightedShapeId: string | null;
  selectedPlanCandidate: ShootingPlanCandidate | null;
  onSelection: (selection: SelectedRailPoint) => void;
};

type RailwayLoadResult = {
  routeCount: number;
  stopCount: number;
  shapeFeatures: Array<Feature<LineString, RouteLineProperties>>;
};

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}: ${url}`);
  }

  return (await response.json()) as T;
}

async function loadRailwayData(
  map: maplibregl.Map,
  signal: AbortSignal,
): Promise<RailwayLoadResult> {
  const { routes } = await fetchJson<RoutesResponse>("/api/routes", signal);

  if (routes.length === 0) {
    throw new Error("No GTFS routes are available");
  }

  const routeData = await Promise.all(
    routes.map((route) =>
      fetchJson<RouteMapData>(
        `/api/routes/${encodeURIComponent(route.id)}/shape`,
        signal,
      ),
    ),
  );
  const shapeFeatures = routeData.flatMap((data) => data.shapes.features);
  const stopFeatures = routeData.flatMap((data) => data.stops.features);

  if (shapeFeatures.length === 0) {
    throw new Error("No GTFS shapes are available");
  }

  map.addSource("gtfs-route-shapes", {
    type: "geojson",
    data: { type: "FeatureCollection", features: shapeFeatures },
  });
  map.addLayer({
    id: "gtfs-route-casing",
    type: "line",
    source: "gtfs-route-shapes",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#ffffff",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 7, 15, 12],
      "line-opacity": 0.92,
    },
  });
  map.addLayer({
    id: "gtfs-route-lines",
    type: "line",
    source: "gtfs-route-shapes",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": ["coalesce", ["get", "routeColor"], "#18866f"],
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 4.5, 15, 8],
      "line-opacity": 0.95,
    },
  });
  map.addLayer({
    id: "gtfs-route-hit-area",
    type: "line",
    source: "gtfs-route-shapes",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#000000",
      "line-width": 28,
      "line-opacity": 0,
    },
  });
  map.addLayer({
    id: "gtfs-selected-trip",
    type: "line",
    source: "gtfs-route-shapes",
    filter: ["==", ["get", "shapeId"], ""],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#ffb000",
      "line-width": ["interpolate", ["linear"], ["zoom"], 9, 6, 15, 10],
      "line-opacity": 0.94,
    },
  });

  map.addSource("gtfs-stops", {
    type: "geojson",
    data: { type: "FeatureCollection", features: stopFeatures },
  });
  map.addLayer({
    id: "gtfs-stops",
    type: "circle",
    source: "gtfs-stops",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 5, 15, 7],
      "circle-color": "#ffffff",
      "circle-stroke-color": "#153e32",
      "circle-stroke-width": 2,
    },
  });

  map.addSource("selected-rail-point", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: "selected-rail-point-halo",
    type: "circle",
    source: "selected-rail-point",
    paint: {
      "circle-radius": 13,
      "circle-color": "rgba(255, 197, 61, 0.28)",
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "selected-rail-point-core",
    type: "circle",
    source: "selected-rail-point",
    paint: {
      "circle-radius": 6,
      "circle-color": "#ffb000",
      "circle-stroke-color": "#563c00",
      "circle-stroke-width": 2,
    },
  });

  const bounds = new maplibregl.LngLatBounds();
  for (const feature of shapeFeatures) {
    for (const coordinate of feature.geometry.coordinates) {
      bounds.extend([coordinate[0], coordinate[1]]);
    }
  }

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, {
      padding: mapConfig.routeBoundsPadding,
      maxZoom: mapConfig.routeBoundsMaxZoom,
      duration: 0,
    });
  }

  return {
    routeCount: routes.length,
    stopCount: stopFeatures.length,
    shapeFeatures,
  };
}

async function loadShootingSpotsData(
  map: maplibregl.Map,
  signal: AbortSignal,
): Promise<number> {
  let shootingSpots: ShootingSpot[] = [];

  try {
    const response = await fetchJson<ShootingSpotsResponse>(
      "/api/shooting-spots",
      signal,
    );
    shootingSpots = response.shootingSpots;
  } catch (error) {
    if (!signal.aborted) {
      console.error("Failed to load approved shooting spots", error);
    }
  }

  map.addSource("approved-shooting-spots", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: shootingSpots.map(
        (spot): Feature<Point, ShootingSpot> => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [spot.longitude, spot.latitude],
          },
          properties: spot,
        }),
      ),
    },
  });
  map.addLayer(
    {
      id: "approved-shooting-spots",
      type: "circle",
      source: "approved-shooting-spots",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4, 15, 7],
        "circle-color": "#f4a62a",
        "circle-opacity": 0.78,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    },
    "selected-rail-point-halo",
  );

  map.addSource("selected-planner-spot", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer(
    {
      id: "selected-planner-spot-halo",
      type: "circle",
      source: "selected-planner-spot",
      paint: {
        "circle-radius": 18,
        "circle-color": "rgba(255, 176, 0, 0.26)",
        "circle-stroke-color": "rgba(255, 255, 255, 0.94)",
        "circle-stroke-width": 3,
      },
    },
    "selected-rail-point-halo",
  );
  map.addLayer(
    {
      id: "selected-planner-spot-core",
      type: "circle",
      source: "selected-planner-spot",
      paint: {
        "circle-radius": 8,
        "circle-color": "#ffb000",
        "circle-stroke-color": "#563c00",
        "circle-stroke-width": 2,
      },
    },
    "selected-rail-point-halo",
  );

  map.on("click", "approved-shooting-spots", (event) => {
    const properties = event.features?.[0]?.properties;
    if (!properties || typeof properties.name !== "string") {
      return;
    }

    new maplibregl.Popup({ closeButton: false, offset: 10 })
      .setLngLat(event.lngLat)
      .setText(
        `${properties.name}｜最寄り：${properties.nearestStation}｜徒歩${properties.walkMinutes}分`,
      )
      .addTo(map);
  });
  map.on("mouseenter", "approved-shooting-spots", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "approved-shooting-spots", () => {
    map.getCanvas().style.cursor = "";
  });

  return shootingSpots.length;
}

export function MapView({
  highlightedShapeId,
  selectedPlanCandidate,
  onSelection,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const [mapSummary, setMapSummary] = useState("路線データを準備中");
  const [shootingSpotCount, setShootingSpotCount] = useState(0);
  const [showShootingSpots, setShowShootingSpots] = useState(false);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    let map: maplibregl.Map | null = null;
    let isActive = true;
    let hasSettled = false;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const abortController = new AbortController();

    try {
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
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
      mapRef.current = map;

      const handleLoad = async () => {
        if (!isActive || hasSettled) {
          return;
        }

        try {
          const { routeCount, stopCount, shapeFeatures } = await loadRailwayData(
            map as maplibregl.Map,
            abortController.signal,
          );
          const approvedSpotCount = await loadShootingSpotsData(
            map as maplibregl.Map,
            abortController.signal,
          );

          if (!isActive || hasSettled) {
            return;
          }

          hasSettled = true;
          clearTimeout(loadTimer);
          (map as maplibregl.Map).on(
            "click",
            "gtfs-route-hit-area",
            (event) => {
              const renderedFeature = event.features?.[0];
              const routeId = renderedFeature?.properties?.routeId;
              const shapeId = renderedFeature?.properties?.shapeId;

              if (typeof routeId !== "string" || typeof shapeId !== "string") {
                return;
              }

              const shape = shapeFeatures.find(
                (feature) =>
                  feature.properties.routeId === routeId &&
                  feature.properties.shapeId === shapeId,
              );

              if (!shape) {
                return;
              }

              const measurement = snapPointToShape(
                shape.geometry.coordinates,
                {
                  longitude: event.lngLat.lng,
                  latitude: event.lngLat.lat,
                },
                mapConfig.selectionMaxDistanceMeters,
              );

              if (!measurement) {
                return;
              }

              const pointFeature: Feature<Point> = {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [measurement.longitude, measurement.latitude],
                },
                properties: {},
              };
              const selectionSource = (map as maplibregl.Map).getSource(
                "selected-rail-point",
              ) as maplibregl.GeoJSONSource;
              selectionSource.setData(pointFeature);
              onSelection({ routeId, shapeId, ...measurement });
            },
          );
          (map as maplibregl.Map).on("click", "gtfs-stops", (event) => {
            const feature = event.features?.[0];
            const stationName = feature?.properties?.name;

            if (typeof stationName !== "string") {
              return;
            }

            new maplibregl.Popup({ closeButton: false, offset: 10 })
              .setLngLat(event.lngLat)
              .setText(stationName)
              .addTo(map as maplibregl.Map);
          });
          (map as maplibregl.Map).on("mouseenter", "gtfs-stops", () => {
            (map as maplibregl.Map).getCanvas().style.cursor = "pointer";
          });
          (map as maplibregl.Map).on("mouseleave", "gtfs-stops", () => {
            (map as maplibregl.Map).getCanvas().style.cursor = "";
          });
          (map as maplibregl.Map).on(
            "mouseenter",
            "gtfs-route-hit-area",
            () => {
              (map as maplibregl.Map).getCanvas().style.cursor = "pointer";
            },
          );
          (map as maplibregl.Map).on(
            "mouseleave",
            "gtfs-route-hit-area",
            () => {
              (map as maplibregl.Map).getCanvas().style.cursor = "";
            },
          );
          setMapSummary(`${routeCount}路線・${stopCount}駅`);
          setShootingSpotCount(approvedSpotCount);
          setStatus("ready");
        } catch (error) {
          if (abortController.signal.aborted || !isActive || hasSettled) {
            return;
          }

          console.error("Failed to display GTFS railway data", error);
          hasSettled = true;
          clearTimeout(loadTimer);
          setStatus("error");
        }
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
        abortController.abort();
        clearTimeout(loadTimer);
        map?.off("load", handleLoad);
        map?.off("error", handleError);
        map?.remove();
        mapRef.current = null;
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
  }, [onSelection, retryKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("gtfs-selected-trip")) {
      return;
    }

    map.setFilter("gtfs-selected-trip", [
      "==",
      ["get", "shapeId"],
      highlightedShapeId ?? "",
    ]);
  }, [highlightedShapeId, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("approved-shooting-spots")) {
      return;
    }

    map.setLayoutProperty(
      "approved-shooting-spots",
      "visibility",
      showShootingSpots ? "visible" : "none",
    );
  }, [showShootingSpots, status]);

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource(
      "selected-planner-spot",
    ) as maplibregl.GeoJSONSource | undefined;
    if (!map || !source) {
      return;
    }

    if (!selectedPlanCandidate) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    source.setData({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          selectedPlanCandidate.spot.longitude,
          selectedPlanCandidate.spot.latitude,
        ],
      },
      properties: { spotId: selectedPlanCandidate.spot.id },
    });
    map.flyTo({
      center: [
        selectedPlanCandidate.spot.longitude,
        selectedPlanCandidate.spot.latitude,
      ],
      zoom: Math.max(map.getZoom(), 14),
      duration: 700,
      essential: true,
    });
  }, [selectedPlanCandidate, status]);

  const retry = () => {
    setStatus("loading");
    setShowShootingSpots(false);
    setShootingSpotCount(0);
    setRetryKey((current) => current + 1);
  };

  return (
    <div className={styles.root}>
      <div ref={containerRef} className={styles.map} />

      <div className={styles.mapLabel} aria-hidden="true">
        <span className={styles.mapLabelDot} />
        {mapSummary}
      </div>

      {status === "ready" && shootingSpotCount > 0 && (
        <button
          type="button"
          className={styles.shootingSpotsToggle}
          aria-pressed={showShootingSpots}
          onClick={() => setShowShootingSpots((current) => !current)}
        >
          撮影地点{showShootingSpots ? "を隠す" : "を表示"}
          <span>{shootingSpotCount}</span>
        </button>
      )}

      {status === "loading" && (
        <div className={styles.stateOverlay} role="status" aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <strong>路線図を読み込んでいます</strong>
          <span>背景地図とGTFSデータを準備しています。</span>
        </div>
      )}

      {status === "error" && (
        <div className={styles.stateOverlay} role="alert">
          <span className={styles.errorMark} aria-hidden="true">
            !
          </span>
          <strong>路線図を読み込めませんでした</strong>
          <span>背景地図またはGTFSデータを確認して、もう一度お試しください。</span>
          <button type="button" onClick={retry}>
            再読み込み
          </button>
        </div>
      )}
    </div>
  );
}
