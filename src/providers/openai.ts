import { postJson, rejectsParam, type ProviderResult } from "./http";

type OpenAICompatibleOpts = {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  system: string;
  user: string;
  timeoutMs: number;
  providerLabel?: string;
  defaultChatCompletionsPath?: string;
  omitTemperature?: boolean;
  /** Use `max_completion_tokens` instead of `max_tokens` (OpenAI reasoning models). */
  useMaxCompletionTokens?: boolean;
  reasoningEffort?: string;
  extraBody?: Record<string, unknown>;
};

export async function callOpenAICompatible(opts: OpenAICompatibleOpts): Promise<ProviderResult> {
  const label = opts.providerLabel ?? "OpenAI-compatible";
  const url = buildChatCompletionsUrl(opts.baseUrl, opts.defaultChatCompletionsPath ?? "/v1/chat/completions");

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    ...opts.extraBody,
  };
  if (!opts.omitTemperature) body.temperature = opts.temperature;
  if (opts.useMaxCompletionTokens) body.max_completion_tokens = opts.maxTokens;
  else body.max_tokens = opts.maxTokens;
  if (opts.reasoningEffort) body.reasoning_effort = opts.reasoningEffort;

  const headers = { authorization: `Bearer ${opts.apiKey}` };

  let json: unknown;
  for (let adjustments = 0; ; adjustments++) {
    try {
      json = await postJson(url, headers, body, { label, timeoutMs: opts.timeoutMs });
      break;
    } catch (err) {
      // Self-heal when a model has a different parameter surface than expected.
      if (adjustments < 3) {
        if ("max_tokens" in body && rejectsParam(err, "max_completion_tokens")) {
          body.max_completion_tokens = body.max_tokens;
          delete body.max_tokens;
          continue;
        }
        if ("max_completion_tokens" in body && rejectsParam(err, "max_completion_tokens")) {
          body.max_tokens = body.max_completion_tokens;
          delete body.max_completion_tokens;
          continue;
        }
        if ("temperature" in body && rejectsParam(err, "temperature")) {
          delete body.temperature;
          continue;
        }
        if ("reasoning_effort" in body && rejectsParam(err, "reasoning_effort", "reasoning effort")) {
          delete body.reasoning_effort;
          continue;
        }
      }
      throw err;
    }
  }

  const res = json as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string | null; reasoning_content?: string | null };
    }>;
  };

  const choice = res.choices?.[0];
  const truncated = choice?.finish_reason === "length";
  const content = choice?.message?.content?.trim();
  if (content) return { text: content, truncated };

  if (truncated || choice?.message?.reasoning_content?.trim()) {
    throw new Error(
      `${label} used its whole token budget before writing the message. Increase \`aiCommitAssistant.maxTokens\` or pick a non-reasoning model.`,
    );
  }
  if (choice?.finish_reason) {
    throw new Error(`${label} returned no final message (finish_reason: ${choice.finish_reason}).`);
  }
  return { text: "", truncated: false };
}

function buildChatCompletionsUrl(baseUrl: string, defaultPath: string): string {
  const parsed = new URL(baseUrl);
  const path = parsed.pathname.replace(/\/+$/, "");

  if (path.endsWith("/chat/completions")) return parsed.toString();
  if (!path) return new URL(defaultPath, parsed.origin).toString();
  return new URL(`${path}/chat/completions`, parsed.origin).toString();
}
