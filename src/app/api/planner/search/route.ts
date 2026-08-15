import { NextResponse } from "next/server";
import { getActiveServiceIds } from "@/domain/gtfs/service-calendar";
import { serviceTimeHHMMToSeconds } from "@/domain/gtfs/time";
import { searchShootingPlans } from "@/domain/planner/search-shooting-plans";
import { plannerSearchRequestSchema } from "@/schemas/planner";
import { openRailshotDatabase } from "@/server/db/database";
import {
  getPassageCandidates,
  getServiceData,
} from "@/server/repositories/passages";
import { listRoutes } from "@/server/repositories/routes";
import { listApprovedShootingSpots } from "@/server/repositories/shooting-spots";

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

  const parsed = plannerSearchRequestSchema.safeParse(body);
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

  let database: ReturnType<typeof openRailshotDatabase> | undefined;
  try {
    const openedDatabase = openRailshotDatabase();
    database = openedDatabase;
    const trips = listRoutes(openedDatabase).flatMap((route) =>
      getPassageCandidates(openedDatabase, { routeId: route.id }),
    );
    const spots = listApprovedShootingSpots(openedDatabase);
    const { calendars, exceptions } = getServiceData(openedDatabase);
    const activeServiceIds = getActiveServiceIds(
      parsed.data.date,
      calendars,
      exceptions,
    );
    const candidates = searchShootingPlans({
      vehicleSeries: parsed.data.vehicleSeries,
      tripId: parsed.data.tripId,
      startSeconds,
      endSeconds,
      maxWalkMinutes: parsed.data.maxWalkMinutes,
      serviceDate: parsed.data.date,
      lightingPreference: parsed.data.lightingPreference,
      maxDistanceMeters: MAX_DISTANCE_METERS,
      activeServiceIds,
      spots,
      trips,
    });

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error("Failed to search shooting plans", error);
    return NextResponse.json(
      {
        error: {
          code: "PLANNER_SEARCH_UNAVAILABLE",
          message: "撮影プランを検索できませんでした。",
        },
      },
      { status: 500 },
    );
  } finally {
    database?.close();
  }
}
