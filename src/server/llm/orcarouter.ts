import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  llmParsedConditionsSchema,
  type LlmParsedConditions,
} from "@/schemas/ai-request";

export const ORCAROUTER_BASE_URL = "https://api.orcarouter.ai/v1";
export const ORCAROUTER_MODEL = "orcarouter/auto";
export const ORCAROUTER_TIMEOUT_MS = 30_000;
export const ORCAROUTER_MAX_TOKENS = 1_000;
export const PARSE_REQUEST_TOOL_NAME = "parse_shooting_request";

const parseRequestTool = {
  type: "function",
  function: {
    name: PARSE_REQUEST_TOOL_NAME,
    description: "ユーザーが明示した鉄道撮影検索条件だけを抽出する。",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        vehicleSeries: { type: ["string", "null"], maxLength: 100 },
        tripId: {
          type: ["string", "null"],
          pattern: "^[A-Za-z0-9_-]{1,100}$",
        },
        date: {
          type: ["string", "null"],
          pattern: "^\\d{4}-\\d{2}-\\d{2}$",
          description: "明示された絶対日付。相対日付または未指定ならnull。",
        },
        startTime: {
          type: ["string", "null"],
          pattern: "^\\d{1,3}:[0-5]\\d$",
          description: "明示された時間帯の開始時刻。午後は12:00、夕方は16:00。",
        },
        endTime: {
          type: ["string", "null"],
          pattern: "^\\d{1,3}:[0-5]\\d$",
          description: "明示された時間帯の終了時刻。午後は17:00、夕方は18:00。",
        },
        maxWalkMinutes: {
          type: ["integer", "null"],
          minimum: 0,
          maximum: 180,
        },
        lightingPreference: { enum: ["good", null] },
      },
      required: [
        "vehicleSeries",
        "tripId",
        "date",
        "startTime",
        "endTime",
        "maxWalkMinutes",
        "lightingPreference",
      ],
    },
  },
} as const;

const chatCompletionSchema = z
  .object({
    id: z.string().optional(),
    model: z.string().optional(),
    choices: z.array(
      z.object({
        message: z
          .object({
            content: z.string().nullable().optional(),
            tool_calls: z
              .array(
                z
                  .object({
                    type: z.literal("function").optional(),
                    function: z.object({
                      name: z.string(),
                      arguments: z.string(),
                    }),
                  })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      }),
    ),
    usage: z
      .object({
        prompt_tokens: z.number().optional(),
        completion_tokens: z.number().optional(),
      })
      .optional(),
  })
  .passthrough();

export type OrcaRouterErrorCode =
  | "CONFIGURATION_ERROR"
  | "TIMEOUT"
  | "AUTHENTICATION_ERROR"
  | "PAYMENT_REQUIRED"
  | "RATE_LIMIT"
  | "UPSTREAM_ERROR"
  | "TOOL_CALL_MISSING"
  | "TOOL_ARGUMENTS_INVALID_JSON"
  | "TOOL_ARGUMENTS_SCHEMA_INVALID"
  | "INVALID_OUTPUT";

export class OrcaRouterError extends Error {
  constructor(
    public readonly code: OrcaRouterErrorCode,
    public readonly upstreamStatus?: number,
  ) {
    super(code);
    this.name = "OrcaRouterError";
  }
}

export type ParseConditionsInput = {
  text: string;
  referenceDate: string;
  timeZone: "Asia/Tokyo";
};

export interface ConditionsParserClient {
  parseConditions(input: ParseConditionsInput): Promise<LlmParsedConditions>;
}

type OrcaRouterClientOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const SYSTEM_PROMPT = `あなたは鉄道撮影検索条件を構造化するパーサーです。
必ずparse_shooting_requestツールを1回呼び出してください。通常の文章で回答しないでください。
ダイヤ、車両運用、撮影地点、通過時刻を推測・創作・計算してはいけません。
ユーザーが明示した車両形式またはtrip IDだけを抽出し、不明な値はnullにしてください。
「今日」「明日」などの相対日付はアプリ側で決定的に解釈するためdate=nullにしてください。
明示された絶対日付だけをdateへYYYY-MM-DD形式で入れてください。
「午後」はstartTime="12:00"、endTime="17:00"として構造化できます。
「夕方」はstartTime="16:00"、endTime="18:00"として構造化できます。
光線の希望が明示された場合だけlightingPreference="good"、それ以外はnullにしてください。
ツール引数では必ず定義済みの全キーを返し、不明・未指定の値はnullにしてください。`;

function logRequest(event: Record<string, unknown>) {
  console.info(JSON.stringify({ event: "railshot.llm.request", ...event }));
}

export function createOrcaRouterClient({
  apiKey,
  fetchImpl = fetch,
  timeoutMs = ORCAROUTER_TIMEOUT_MS,
}: OrcaRouterClientOptions = {}): ConditionsParserClient {
  return {
    async parseConditions(input) {
      if (!apiKey) {
        throw new OrcaRouterError("CONFIGURATION_ERROR");
      }

      const requestId = randomUUID();
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let upstreamRequestId: string | null = null;
      let resolvedModel: string | null = null;
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let upstreamStatus: number | null = null;
      let success = false;
      let errorCode: OrcaRouterErrorCode | null = null;

      try {
        const response = await fetchImpl(
          `${ORCAROUTER_BASE_URL}/chat/completions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "X-Request-ID": requestId,
            },
            body: JSON.stringify({
              model: ORCAROUTER_MODEL,
              temperature: 0,
              max_tokens: ORCAROUTER_MAX_TOKENS,
              tools: [parseRequestTool],
              tool_choice: {
                type: "function",
                function: { name: PARSE_REQUEST_TOOL_NAME },
              },
              messages: [
                {
                  role: "system",
                  content: `${SYSTEM_PROMPT}\n基準日は${input.referenceDate}、タイムゾーンは${input.timeZone}です。`,
                },
                { role: "user", content: input.text },
              ],
            }),
            signal: controller.signal,
          },
        );
        upstreamStatus = response.status;
        upstreamRequestId = response.headers.get("x-request-id");
        resolvedModel = response.headers.get("x-orca-resolved-model");
        if (!response.ok) {
          errorCode =
            response.status === 401 || response.status === 403
              ? "AUTHENTICATION_ERROR"
              : response.status === 402
                ? "PAYMENT_REQUIRED"
                : response.status === 429
                  ? "RATE_LIMIT"
                  : "UPSTREAM_ERROR";
          throw new OrcaRouterError(errorCode, response.status);
        }

        const completion = chatCompletionSchema.safeParse(await response.json());
        if (!completion.success || !completion.data.choices[0]) {
          errorCode = "INVALID_OUTPUT";
          throw new OrcaRouterError("INVALID_OUTPUT");
        }

        upstreamRequestId ??= completion.data.id ?? null;
        resolvedModel ??= completion.data.model ?? null;
        inputTokens = completion.data.usage?.prompt_tokens ?? null;
        outputTokens = completion.data.usage?.completion_tokens ?? null;

        const toolCall = completion.data.choices[0].message.tool_calls?.find(
          (call) => call.function.name === PARSE_REQUEST_TOOL_NAME,
        );
        if (!toolCall) {
          errorCode = "TOOL_CALL_MISSING";
          throw new OrcaRouterError("TOOL_CALL_MISSING");
        }

        let toolArguments: unknown;
        try {
          toolArguments = JSON.parse(toolCall.function.arguments);
        } catch {
          errorCode = "TOOL_ARGUMENTS_INVALID_JSON";
          throw new OrcaRouterError("TOOL_ARGUMENTS_INVALID_JSON");
        }

        const parsed = llmParsedConditionsSchema.safeParse(toolArguments);
        if (!parsed.success) {
          errorCode = "TOOL_ARGUMENTS_SCHEMA_INVALID";
          throw new OrcaRouterError("TOOL_ARGUMENTS_SCHEMA_INVALID");
        }

        success = true;
        return parsed.data;
      } catch (error) {
        if (error instanceof OrcaRouterError) {
          throw error;
        }
        if (controller.signal.aborted) {
          errorCode = "TIMEOUT";
          throw new OrcaRouterError("TIMEOUT");
        }
        errorCode = "UPSTREAM_ERROR";
        throw new OrcaRouterError("UPSTREAM_ERROR");
      } finally {
        clearTimeout(timeout);
        logRequest({
          purpose: "parse_search_request",
          requestId,
          upstreamRequestId,
          startedAt: new Date(startedAt).toISOString(),
          requestedModel: ORCAROUTER_MODEL,
          resolvedModel,
          elapsedMs: Date.now() - startedAt,
          inputTokens,
          outputTokens,
          cacheHit: null,
          success,
          httpStatus: upstreamStatus,
          errorType: errorCode,
          timedOut: errorCode === "TIMEOUT",
        });
      }
    },
  };
}
