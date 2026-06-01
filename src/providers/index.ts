import { callAnthropic } from "./anthropic";
import { callOpenAICompatible } from "./openai";
import type { ProviderName } from "../settings";

const OPENAI_COMPATIBLE_PROVIDER_META: Partial<
  Record<ProviderName, { label: string; defaultChatCompletionsPath: string }>
> = {
  openai: { label: "OpenAI", defaultChatCompletionsPath: "/v1/chat/completions" },
  kimi: { label: "Kimi", defaultChatCompletionsPath: "/v1/chat/completions" },
  deepseek: { label: "DeepSeek", defaultChatCompletionsPath: "/chat/completions" },
};

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
  return callOpenAICompatible({
    ...opts,
    providerLabel: meta?.label,
    defaultChatCompletionsPath: meta?.defaultChatCompletionsPath,
  });
}
