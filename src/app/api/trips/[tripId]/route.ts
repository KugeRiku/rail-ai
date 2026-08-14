import { NextResponse } from "next/server";
import { openRailshotDatabase } from "@/server/db/database";
import { getTripDetail } from "@/server/repositories/trips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRIP_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;

  if (!TRIP_ID_PATTERN.test(tripId)) {
    return NextResponse.json(
      { error: { code: "INVALID_TRIP_ID", message: "列車IDが不正です。" } },
      { status: 400 },
    );
  }

  let database;
  try {
    database = openRailshotDatabase();
    const detail = getTripDetail(database, tripId);

    if (!detail) {
      return NextResponse.json(
        { error: { code: "TRIP_NOT_FOUND", message: "列車が見つかりません。" } },
        { status: 404 },
      );
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error(`Failed to load trip ${tripId}`, error);
    return NextResponse.json(
      {
        error: {
          code: "TRIP_UNAVAILABLE",
          message: "列車詳細を取得できませんでした。",
        },
      },
      { status: 500 },
    );
  } finally {
    database?.close();
  }
}
