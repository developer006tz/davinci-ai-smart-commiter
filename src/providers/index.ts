import { callAnthropic } from "./anthropic";
import { callOpenAI } from "./openai";
import type { ProviderName } from "../settings";

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
  return callOpenAI(opts);
}

