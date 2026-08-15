import type { OrcaRouterError } from "@/server/llm/orcarouter";

export type PublicAiError = {
  status: number;
  code: string;
  message: string;
};

export function toPublicAiError(error: OrcaRouterError): PublicAiError {
  switch (error.code) {
    case "CONFIGURATION_ERROR":
      return {
        status: 503,
        code: "AI_NOT_CONFIGURED",
        message: "AI解析機能が設定されていません。",
      };
    case "TIMEOUT":
      return {
        status: 504,
        code: "AI_TIMEOUT",
        message: "AI解析がタイムアウトしました。もう一度お試しください。",
      };
    case "RATE_LIMIT":
      return {
        status: 429,
        code: "AI_RATE_LIMITED",
        message: "AI解析が混み合っています。少し待ってから再度お試しください。",
      };
    case "AUTHENTICATION_ERROR":
      return {
        status: 503,
        code: "AI_AUTHENTICATION_FAILED",
        message: "AI解析の認証設定に問題があります。",
      };
    case "PAYMENT_REQUIRED":
      return {
        status: 503,
        code: "AI_QUOTA_UNAVAILABLE",
        message: "AI解析の利用枠を確認してください。",
      };
    case "INVALID_OUTPUT":
      return {
        status: 502,
        code: "AI_INVALID_OUTPUT",
        message: "AIの応答形式を検証できませんでした。もう一度お試しください。",
      };
    case "TOOL_CALL_MISSING":
      return {
        status: 502,
        code: "AI_TOOL_CALL_MISSING",
        message: "AIから構造化された検索条件を取得できませんでした。もう一度お試しください。",
      };
    case "TOOL_ARGUMENTS_INVALID_JSON":
      return {
        status: 502,
        code: "AI_TOOL_ARGUMENTS_INVALID",
        message: "AIの検索条件を読み取れませんでした。もう一度お試しください。",
      };
    case "TOOL_ARGUMENTS_SCHEMA_INVALID":
      return {
        status: 502,
        code: "AI_TOOL_SCHEMA_INVALID",
        message: "AIの検索条件を検証できませんでした。もう一度お試しください。",
      };
    case "UPSTREAM_ERROR":
      return {
        status: 502,
        code: "AI_UPSTREAM_ERROR",
        message: "AI解析サービスから正常な応答を受け取れませんでした。",
      };
  }
}
