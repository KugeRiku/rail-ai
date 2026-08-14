import { NextResponse } from "next/server";
import { openRailshotDatabase } from "@/server/db/database";
import { listRoutes } from "@/server/repositories/routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  let database;

  try {
    database = openRailshotDatabase();
    return NextResponse.json({ routes: listRoutes(database) });
  } catch (error) {
    console.error("Failed to load GTFS routes", error);
    return NextResponse.json(
      { error: { code: "ROUTES_UNAVAILABLE", message: "路線データを取得できませんでした。" } },
      { status: 500 },
    );
  } finally {
    database?.close();
  }
}
