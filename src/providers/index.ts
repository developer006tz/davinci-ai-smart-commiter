import { callAnthropic } from "./anthropic";
import { callOpenAICompatible } from "./openai";
import type { ProviderResult } from "./http";
import type { ProviderName } from "../settings";

export type { ProviderResult } from "./http";

const OPENAI_COMPATIBLE_PROVIDER_META: Partial<
  Record<ProviderName, { label: string; defaultChatCompletionsPath: string }>
> = {
  openai: { label: "OpenAI", defaultChatCompletionsPath: "/v1/chat/completions" },
  kimi: { label: "Kimi", defaultChatCompletionsPath: "/v1/chat/completions" },
  deepseek: { label: "DeepSeek", defaultChatCompletionsPath: "/chat/completions" },
  gemini: { label: "Gemini", defaultChatCompletionsPath: "/v1beta/openai/chat/completions" },
};

/** Kimi K2.5/K2.6 think by default but accept `thinking: disabled`. */
const KIMI_DISABLE_THINKING_MODELS = new Set(["kimi-k2.6", "kimi-k2.5"]);
/** Kimi K3+ always think (no `thinking` param); depth via `reasoning_effort` (low/high/max). */
const KIMI_ALWAYS_THINKING_MODELS = /^kimi-k([3-9]|\d{2,})/;
/** Kimi models with fixed sampling values that reject a custom temperature. */
const KIMI_FIXED_SAMPLING_MODELS = /^kimi-k(2\.[5-9]|[3-9]|\d{2,})/;
/** DeepSeek models with switchable thinking (`thinking: enabled|disabled` + `reasoning_effort`). */
const DEEPSEEK_THINKING_MODELS = /^deepseek-(flash|pro|v4|v5|reasoner)/;
/** OpenAI reasoning models: no custom temperature, use max_completion_tokens, spend tokens on reasoning. */
const OPENAI_REASONING_MODELS = /^(gpt-([5-9]|\d{2,})|o\d)/;
/** Gemini 2.5+ models think by default; that thinking counts against the output token budget. */
const GEMINI_THINKING_MODELS = /^gemini-(2\.5|[3-9])/;

/** Output-token floor so reasoning cannot consume the whole budget before the message is written. */
export function tokenFloorForEffort(effort: string | undefined): number {
  switch (effort) {
    case undefined:
    case "":
    case "none":
      return 0;
    case "minimal":
    case "low":
      return 4096;
    case "medium":
      return 8192;
    case "high":
      return 16384;
    default:
      return 32000; // xhigh, max
  }
}

export async function generateCommitMessage(
  provider: ProviderName,
  opts: {
    apiKey: string;
    baseUrl: string;
    model: string;
    effort?: string;
    temperature: number;
    maxTokens: number;
    system: string;
    user: string;
    timeoutMs: number;
  },
): Promise<ProviderResult> {
  if (provider === "anthropic") return callAnthropic(opts);

  const meta = OPENAI_COMPATIBLE_PROVIDER_META[provider];
  const model = opts.model;
  const effort = opts.effort?.trim() || undefined;

  let reasoningEffort: string | undefined;
  let extraBody: Record<string, unknown> | undefined;
  let omitTemperature = false;
  let useMaxCompletionTokens = false;

  if (provider === "openai" && OPENAI_REASONING_MODELS.test(model)) {
    reasoningEffort = effort ?? "medium";
    useMaxCompletionTokens = true;
    omitTemperature = reasoningEffort !== "none";
  } else if (provider === "kimi") {
    omitTemperature = KIMI_FIXED_SAMPLING_MODELS.test(model);
    if (KIMI_ALWAYS_THINKING_MODELS.test(model)) {
      reasoningEffort = effort && effort !== "none" ? effort : "low";
      useMaxCompletionTokens = true;
    } else if (KIMI_DISABLE_THINKING_MODELS.has(model)) {
      extraBody = { thinking: { type: "disabled" } };
    }
  } else if (provider === "deepseek" && DEEPSEEK_THINKING_MODELS.test(model)) {
    if (!effort || effort === "none") {
      extraBody = { thinking: { type: "disabled" } };
    } else {
      extraBody = { thinking: { type: "enabled" } };
      reasoningEffort = effort;
      omitTemperature = true; // ignored in thinking mode anyway
    }
  } else if (provider === "gemini" && GEMINI_THINKING_MODELS.test(model)) {
    reasoningEffort = effort ?? "low";
  }

  return callOpenAICompatible({
    ...opts,
    maxTokens: Math.max(opts.maxTokens, tokenFloorForEffort(reasoningEffort)),
    providerLabel: meta?.label,
    defaultChatCompletionsPath: meta?.defaultChatCompletionsPath,
    omitTemperature,
    useMaxCompletionTokens,
    reasoningEffort,
    extraBody,
  });
}
