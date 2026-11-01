import type { ProviderName } from "./settings";

export type ModelChoice = {
  id: string;
  label: string;
  description: string;
};

export const PROVIDER_MODELS: Record<ProviderName, ModelChoice[]> = {
  anthropic: [
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5", description: "Latest Haiku: fast and very low cost (default)" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", description: "Latest Sonnet: balanced speed and intelligence" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5", description: "Latest Opus: highest capability" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Previous Sonnet" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", description: "Previous Opus" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Previous Haiku" },
    { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku", description: "Legacy fast model" },
  ],
  openai: [
    { id: "gpt-6-luna", label: "GPT-6 Luna", description: "Latest fast, low-cost reasoning model (default)" },
    { id: "gpt-4o-mini", label: "GPT-4o mini", description: "Fast, affordable, non-reasoning" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", description: "Stronger coding model, lower cost than flagship" },
    { id: "gpt-5.4-nano", label: "GPT-5.4 nano", description: "Lowest latency and cost" },
    { id: "gpt-5.4", label: "GPT-5.4", description: "Higher capability" },
    { id: "gpt-5.5", label: "GPT-5.5", description: "Flagship coding and professional work model" },
  ],
  kimi: [
    { id: "kimi-k3.1-pro", label: "Kimi K3.1 Pro", description: "Latest Kimi model, always thinks (default)" },
    { id: "kimi-k3.1-pro-highspeed", label: "Kimi K3.1 Pro Highspeed", description: "Faster output variant of K3.1 Pro" },
    { id: "kimi-k2.6", label: "Kimi K2.6", description: "Previous Kimi coding and agent model" },
    { id: "kimi-k2.5", label: "Kimi K2.5", description: "Previous Kimi K2 multimodal model" },
    { id: "moonshot-v1-8k", label: "Moonshot V1 8K", description: "Short text generation model" },
    { id: "moonshot-v1-32k", label: "Moonshot V1 32K", description: "Longer text generation model" },
    { id: "moonshot-v1-128k", label: "Moonshot V1 128K", description: "Very long context text generation model" },
  ],
  deepseek: [
    { id: "deepseek-flash", label: "DeepSeek V4.1 Flash (1017)", description: "Latest Flash: DeepSeek-V4.1-Flash-1017 (default)" },
    { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", description: "Stronger reasoning/coding model (V4-Pro-0813)" },
    { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash (legacy)", description: "Retired name, now served by V4.1-Flash-1017" },
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
