import type { ProviderName } from "./settings";

export type ModelChoice = {
  id: string;
  label: string;
  description: string;
};

export const PROVIDER_MODELS: Record<ProviderName, ModelChoice[]> = {
  anthropic: [
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Fast and cost-effective" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Balanced speed and intelligence" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", description: "Highest capability" },
    { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku", description: "Legacy fast model" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini", description: "Fast, affordable, reliable for commit messages" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", description: "Stronger coding model, lower cost than flagship" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 nano", description: "Lowest latency and cost" },
    { id: "gpt-5.4", label: "GPT-5.4", description: "Higher capability" },
    { id: "gpt-5.5", label: "GPT-5.5", description: "Flagship coding and professional work model" },
  ],
  kimi: [
    { id: "kimi-k2.6", label: "Kimi K2.6", description: "Latest Kimi coding and agent model" },
    { id: "kimi-k2.5", label: "Kimi K2.5", description: "Versatile multimodal Kimi model" },
    { id: "kimi-k2-thinking", label: "Kimi K2 Thinking", description: "Deep reasoning model" },
    { id: "kimi-k2-turbo-preview", label: "Kimi K2 Turbo Preview", description: "Preview fast K2 variant" },
  ],
  deepseek: [
    { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", description: "Default fast model" },
    { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", description: "Stronger reasoning/coding model" },
    { id: "deepseek-chat", label: "DeepSeek Chat", description: "Legacy alias, deprecated after 2026-07-24" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner", description: "Legacy reasoning alias, deprecated after 2026-07-24" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Best price-performance default" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", description: "Fastest and most budget-friendly 2.5 model" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "More advanced reasoning and coding" },
  ],
};

export function isKnownModel(provider: ProviderName, model: string): boolean {
  return PROVIDER_MODELS[provider].some((choice) => choice.id === model);
}
