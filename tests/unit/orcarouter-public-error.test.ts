import { describe, expect, it } from "vitest";
import { OrcaRouterError } from "@/server/llm/orcarouter";
import { toPublicAiError } from "@/server/llm/public-error";

describe("toPublicAiError", () => {
  it.each([
    ["CONFIGURATION_ERROR", 503, "AI_NOT_CONFIGURED"],
    ["TIMEOUT", 504, "AI_TIMEOUT"],
    ["AUTHENTICATION_ERROR", 503, "AI_AUTHENTICATION_FAILED"],
    ["PAYMENT_REQUIRED", 503, "AI_QUOTA_UNAVAILABLE"],
    ["RATE_LIMIT", 429, "AI_RATE_LIMITED"],
    ["UPSTREAM_ERROR", 502, "AI_UPSTREAM_ERROR"],
    ["INVALID_OUTPUT", 502, "AI_INVALID_OUTPUT"],
    ["TOOL_CALL_MISSING", 502, "AI_TOOL_CALL_MISSING"],
    ["TOOL_ARGUMENTS_INVALID_JSON", 502, "AI_TOOL_ARGUMENTS_INVALID"],
    ["TOOL_ARGUMENTS_SCHEMA_INVALID", 502, "AI_TOOL_SCHEMA_INVALID"],
  ] as const)("maps %s to HTTP %i and %s", (errorCode, status, publicCode) => {
    expect(toPublicAiError(new OrcaRouterError(errorCode))).toMatchObject({
      status,
      code: publicCode,
    });
  });
});
