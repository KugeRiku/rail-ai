import { NextResponse } from "next/server";
import { openRailshotDatabase } from "@/server/db/database";
import { getRouteMapData } from "@/server/repositories/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ROUTE_ID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: { code: "INVALID_ROUTE_ID", message: "路線IDが不正です。" } },
      { status: 400 },
    );
  }

  let database;

  try {
    database = openRailshotDatabase();
    const routeMapData = getRouteMapData(database, id);

    if (!routeMapData) {
      return NextResponse.json(
        { error: { code: "ROUTE_NOT_FOUND", message: "路線が見つかりません。" } },
        { status: 404 },
      );
    }

    return NextResponse.json(routeMapData);
  } catch (error) {
    console.error(`Failed to load GTFS shape for route ${id}`, error);
    return NextResponse.json(
      { error: { code: "ROUTE_SHAPE_UNAVAILABLE", message: "路線形状を取得できませんでした。" } },
      { status: 500 },
    );
  } finally {
    database?.close();
  }
}
