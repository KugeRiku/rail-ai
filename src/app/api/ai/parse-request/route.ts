import { NextResponse } from "next/server";
import { aiParseRequestSchema } from "@/schemas/ai-request";
import {
  createOrcaRouterClient,
  OrcaRouterError,
} from "@/server/llm/orcarouter";
import { toPublicAiError } from "@/server/llm/public-error";
import { parseAiRequest } from "@/server/services/parse-ai-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 2_000;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: { code: "REQUEST_TOO_LARGE", message: "入力が長すぎます。" } },
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

  const input = aiParseRequestSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json(
      { error: { code: "INVALID_REQUEST", message: "入力内容が不正です。" } },
      { status: 400 },
    );
  }

  try {
    const client = createOrcaRouterClient({
      apiKey: process.env.ORCAROUTER_API_KEY,
    });
    const result = await parseAiRequest(input.data.text, client);
    if (!result.ok) {
      return NextResponse.json(
        {
          error: {
            code: "INSUFFICIENT_CONDITIONS",
            message: "撮影プラン検索に必要な条件が不足しています。",
            missingFields: result.missingFields,
          },
          conditions: result.conditions,
        },
        { status: 422 },
      );
    }

    return NextResponse.json(result.conditions);
  } catch (error) {
    if (error instanceof OrcaRouterError) {
      const publicError = toPublicAiError(error);
      return NextResponse.json(
        {
          error: {
            code: publicError.code,
            message: publicError.message,
          },
        },
        { status: publicError.status },
      );
    }

    console.error("Unexpected AI parse failure", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      {
        error: {
          code: "AI_UNAVAILABLE",
          message: "AI解析を完了できませんでした。",
        },
      },
      { status: 500 },
    );
  }
}
