import { callAnthropic } from "./anthropic";
import { callOpenAICompatible } from "./openai";
import type { ProviderName } from "../settings";

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
  },
): Promise<string> {
  if (provider === "anthropic") return callAnthropic(opts);

  const meta = OPENAI_COMPATIBLE_PROVIDER_META[provider];
  const disableKimiThinking = provider === "kimi" && KIMI_THINKING_MODELS.has(opts.model);
  const disableDeepSeekThinking = provider === "deepseek" && DEEPSEEK_THINKING_MODELS.has(opts.model);
  const disableThinking = disableKimiThinking || disableDeepSeekThinking;

  return callOpenAICompatible({
    ...opts,
    providerLabel: meta?.label,
    defaultChatCompletionsPath: meta?.defaultChatCompletionsPath,
    omitTemperature: disableKimiThinking,
    extraBody: disableThinking ? { thinking: { type: "disabled" } } : undefined,
  });
}
