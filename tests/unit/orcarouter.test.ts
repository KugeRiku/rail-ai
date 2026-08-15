import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOrcaRouterClient,
  ORCAROUTER_BASE_URL,
  ORCAROUTER_MAX_TOKENS,
  ORCAROUTER_MODEL,
  ORCAROUTER_TIMEOUT_MS,
  PARSE_REQUEST_TOOL_NAME,
  OrcaRouterError,
} from "@/server/llm/orcarouter";

const VALID_CONTENT = {
  vehicleSeries: "Series-A",
  tripId: null,
  date: null,
  startTime: "12:00",
  endTime: "17:00",
  maxWalkMinutes: 10,
  lightingPreference: null,
};

afterEach(() => vi.restoreAllMocks());

function mockCompletion(
  content: unknown,
  options: { argumentsText?: string; toolName?: string } = {},
) {
  return new Response(
    JSON.stringify({
      id: "request_test",
      model: "test-model",
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                type: "function",
                function: {
                  name: options.toolName ?? PARSE_REQUEST_TOOL_NAME,
                  arguments:
                    options.argumentsText ?? JSON.stringify(content),
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Orca-Resolved-Model": "provider/resolved-model",
      },
    },
  );
}

describe("OrcaRouter client", () => {
  it("uses a 30 second default timeout suitable for routed models", () => {
    expect(ORCAROUTER_TIMEOUT_MS).toBe(30_000);
  });

  it("uses the configured OpenAI-compatible endpoint and model", async () => {
    const logSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(mockCompletion(VALID_CONTENT));
    const client = createOrcaRouterClient({
      apiKey: "test-key",
      fetchImpl: fetchMock,
    });

    await expect(
      client.parseConditions({
        text: "明日の午後にSeries-A",
        referenceDate: "2026-08-15",
        timeZone: "Asia/Tokyo",
      }),
    ).resolves.toEqual(VALID_CONTENT);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(options.body)) as {
      model: string;
      max_tokens: number;
      messages: Array<{ role: string; content: string }>;
      response_format?: unknown;
      tools: Array<{ function: { name: string; parameters: unknown } }>;
      tool_choice: { function: { name: string } };
    };
    expect(url).toBe(`${ORCAROUTER_BASE_URL}/chat/completions`);
    expect(body.model).toBe(ORCAROUTER_MODEL);
    expect(body.max_tokens).toBe(ORCAROUTER_MAX_TOKENS);
    expect(body.messages[0].content).toContain("Asia/Tokyo");
    expect(body.response_format).toBeUndefined();
    expect(body.tools[0].function.name).toBe(PARSE_REQUEST_TOOL_NAME);
    expect(body.tool_choice.function.name).toBe(PARSE_REQUEST_TOOL_NAME);
    expect(new Headers(options.headers).get("Authorization")).toBe(
      "Bearer test-key",
    );
    const safeLog = JSON.parse(String(logSpy.mock.calls.at(-1)?.[0])) as Record<
      string,
      unknown
    >;
    expect(safeLog.resolvedModel).toBe("provider/resolved-model");
    expect(JSON.stringify(safeLog)).not.toContain("明日の午後にSeries-A");
    expect(JSON.stringify(safeLog)).not.toContain("test-key");
  });

  it("distinguishes a missing tool call", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const client = createOrcaRouterClient({
      apiKey: "test-key",
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "ordinary prose" } }],
          }),
          { status: 200 },
        ),
      ),
    });

    await expect(
      client.parseConditions({
        text: "test",
        referenceDate: "2026-08-15",
        timeZone: "Asia/Tokyo",
      }),
    ).rejects.toMatchObject({ code: "TOOL_CALL_MISSING" });
  });

  it("distinguishes invalid tool argument JSON", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const client = createOrcaRouterClient({
      apiKey: "test-key",
      fetchImpl: vi
        .fn()
        .mockResolvedValue(
          mockCompletion(VALID_CONTENT, { argumentsText: "not json" }),
        ),
    });

    await expect(
      client.parseConditions({
        text: "test",
        referenceDate: "2026-08-15",
        timeZone: "Asia/Tokyo",
      }),
    ).rejects.toMatchObject({ code: "TOOL_ARGUMENTS_INVALID_JSON" });
  });

  it("distinguishes tool argument schema violations", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const client = createOrcaRouterClient({
      apiKey: "test-key",
      fetchImpl: vi.fn().mockResolvedValue(mockCompletion({ trainTime: "12:00" })),
    });

    await expect(
      client.parseConditions({
        text: "test",
        referenceDate: "2026-08-15",
        timeZone: "Asia/Tokyo",
      }),
    ).rejects.toMatchObject({ code: "TOOL_ARGUMENTS_SCHEMA_INVALID" });
  });

  it.each([
    [401, "AUTHENTICATION_ERROR"],
    [402, "PAYMENT_REQUIRED"],
    [429, "RATE_LIMIT"],
    [500, "UPSTREAM_ERROR"],
    [503, "UPSTREAM_ERROR"],
  ] as const)(
    "maps HTTP %i to %s without exposing response contents",
    async (status, code) => {
      vi.spyOn(console, "info").mockImplementation(() => undefined);
      const client = createOrcaRouterClient({
        apiKey: "test-key",
        fetchImpl: vi.fn().mockResolvedValue(
          new Response("secret upstream details", { status }),
        ),
      });

      await expect(
        client.parseConditions({
          text: "test",
          referenceDate: "2026-08-15",
          timeZone: "Asia/Tokyo",
        }),
      ).rejects.toEqual(new OrcaRouterError(code, status));
    },
  );

  it("handles timeouts", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const fetchMock = vi.fn(
      (_url: string, options?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const client = createOrcaRouterClient({
      apiKey: "test-key",
      fetchImpl: fetchMock as typeof fetch,
      timeoutMs: 1,
    });

    await expect(
      client.parseConditions({
        text: "test",
        referenceDate: "2026-08-15",
        timeZone: "Asia/Tokyo",
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("fails safely when ORCAROUTER_API_KEY is missing", async () => {
    const fetchMock = vi.fn();
    const client = createOrcaRouterClient({
      apiKey: undefined,
      fetchImpl: fetchMock,
    });

    await expect(
      client.parseConditions({
        text: "test",
        referenceDate: "2026-08-15",
        timeZone: "Asia/Tokyo",
      }),
    ).rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
