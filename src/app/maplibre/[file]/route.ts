import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAPLIBRE_FILES = new Set([
  "maplibre-gl-worker.mjs",
  "maplibre-gl-shared.mjs",
]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;

  if (!MAPLIBRE_FILES.has(file)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const contents = await readFile(
      resolve(process.cwd(), "node_modules/maplibre-gl/dist", file),
    );

    return new Response(contents, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "text/javascript; charset=utf-8",
      },
    });
  } catch (error) {
    console.error(`Failed to serve MapLibre worker asset ${file}`, error);
    return new Response("Map worker unavailable", { status: 500 });
  }
}
