import { NextResponse } from "next/server";
import { openRailshotDatabase } from "@/server/db/database";
import { listApprovedShootingSpots } from "@/server/repositories/shooting-spots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  let database;

  try {
    database = openRailshotDatabase();
    return NextResponse.json({
      shootingSpots: listApprovedShootingSpots(database),
    });
  } catch (error) {
    console.error("Failed to load approved shooting spots", error);
    return NextResponse.json(
      {
        error: {
          code: "SHOOTING_SPOTS_UNAVAILABLE",
          message: "撮影候補地点を取得できませんでした。",
        },
      },
      { status: 500 },
    );
  } finally {
    database?.close();
  }
}
