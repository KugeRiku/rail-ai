import type { StyleSpecification } from "maplibre-gl";

const backgroundMapStyle: StyleSpecification = {
  version: 8,
  name: "RailShot AI background map",
  sources: {
    "carto-voyager": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#dce7e3",
      },
    },
    {
      id: "carto-voyager",
      type: "raster",
      source: "carto-voyager",
      minzoom: 0,
      maxzoom: 21,
    },
  ],
};

export const mapConfig = {
  initialView: {
    longitude: 139.7671,
    latitude: 35.6812,
    zoom: 11,
  },
  style: backgroundMapStyle,
  minZoom: 3,
  maxZoom: 18,
  loadTimeoutMs: 15_000,
} as const;
