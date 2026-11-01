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

const KIMI_THINKING_MODELS = new Set(["kimi-k2.6", "kimi-k2.5"]);
const DEEPSEEK_THINKING_MODELS = new Set(["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-reasoner"]);
/** OpenAI reasoning models: no custom temperature, use max_completion_tokens, spend tokens on reasoning. */
const OPENAI_REASONING_MODELS = /^(gpt-5|o\d)/;
/** Gemini 2.5+ models think by default; that thinking counts against the output token budget. */
const GEMINI_THINKING_MODELS = /^gemini-(2\.5|[3-9])/;

export async function generateCommitMessage(
  provider: ProviderName,
  opts: {
    apiKey: string;
    baseUrl: string;
    model: string;
    temperature: number;
    maxTokens: number;
    system: string;
    user: string;
    timeoutMs: number;
  },
): Promise<ProviderResult> {
  if (provider === "anthropic") return callAnthropic(opts);

  const meta = OPENAI_COMPATIBLE_PROVIDER_META[provider];
  const disableKimiThinking = provider === "kimi" && KIMI_THINKING_MODELS.has(opts.model);
  const disableDeepSeekThinking = provider === "deepseek" && DEEPSEEK_THINKING_MODELS.has(opts.model);
  const openaiReasoning = provider === "openai" && OPENAI_REASONING_MODELS.test(opts.model);
  const geminiThinking = provider === "gemini" && GEMINI_THINKING_MODELS.test(opts.model);

  return callOpenAICompatible({
    ...opts,
    maxTokens: openaiReasoning || geminiThinking ? Math.max(opts.maxTokens, 4096) : opts.maxTokens,
    providerLabel: meta?.label,
    defaultChatCompletionsPath: meta?.defaultChatCompletionsPath,
    omitTemperature: disableKimiThinking || openaiReasoning,
    useMaxCompletionTokens: openaiReasoning,
    reasoningEffort: openaiReasoning || geminiThinking ? "low" : undefined,
    extraBody: disableKimiThinking || disableDeepSeekThinking ? { thinking: { type: "disabled" } } : undefined,
  });
}
