import { NextResponse } from "next/server";
import { getActiveServiceIds } from "@/domain/gtfs/service-calendar";
import { serviceTimeHHMMToSeconds } from "@/domain/gtfs/time";
import { searchPassages } from "@/domain/passages/search-passages";
import { passageRequestSchema } from "@/schemas/passages";
import { openRailshotDatabase } from "@/server/db/database";
import {
  getPassageCandidates,
  getServiceData,
} from "@/server/repositories/passages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 10_000;
const MAX_DISTANCE_METERS = 250;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: { code: "REQUEST_TOO_LARGE", message: "入力が大きすぎます。" } },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "JSON形式が不正です。" } },
      { status: 400 },
    );
  }

  const parsed = passageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "検索条件が不正です。" } },
      { status: 400 },
    );
  }

  const startSeconds = serviceTimeHHMMToSeconds(parsed.data.startTime);
  const endSeconds = serviceTimeHHMMToSeconds(parsed.data.endTime);
  if (startSeconds > endSeconds) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_TIME_RANGE",
          message: "終了時刻は開始時刻以降にしてください。",
        },
      },
      { status: 400 },
    );
  }

  let database;
  try {
    database = openRailshotDatabase();
    const target = parsed.data.shapeId
      ? { shapeId: parsed.data.shapeId }
      : { routeId: parsed.data.routeId as string };
    const candidates = getPassageCandidates(database, target);
    const { calendars, exceptions } = getServiceData(database);
    const activeServiceIds = getActiveServiceIds(
      parsed.data.date,
      calendars,
      exceptions,
    );
    const passages = searchPassages({
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      startSeconds,
      endSeconds,
      maxDistanceMeters: MAX_DISTANCE_METERS,
      activeServiceIds,
      candidates,
    });

    return NextResponse.json({ passages });
  } catch (error) {
    console.error("Failed to search train passages", error);
    return NextResponse.json(
      {
        error: {
          code: "PASSAGES_UNAVAILABLE",
          message: "通過列車を検索できませんでした。",
        },
      },
      { status: 500 },
    );
  } finally {
    database?.close();
  }
}
