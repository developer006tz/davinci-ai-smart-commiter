import { postJson, rejectsParam, type ProviderResult } from "./http";

type AnthropicOpts = {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  system: string;
  user: string;
  timeoutMs: number;
};

/** Claude Opus 4.7+ and the Claude 5 family reject sampling parameters such as temperature. */
const NO_SAMPLING_MODELS = /^claude-(opus-4-[7-9]|(opus|sonnet|haiku|fable|mythos)-[5-9])/;
/** Claude 5 family models think by default; keep effort low and leave room for thinking tokens. */
const THINKING_BY_DEFAULT_MODELS = /^claude-(opus|sonnet|haiku|fable|mythos)-[5-9]/;

export async function callAnthropic(opts: AnthropicOpts): Promise<ProviderResult> {
  const url = new URL("/v1/messages", opts.baseUrl).toString();
  const thinking = THINKING_BY_DEFAULT_MODELS.test(opts.model);

  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: thinking ? Math.max(opts.maxTokens, 4096) : opts.maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  };
  if (!NO_SAMPLING_MODELS.test(opts.model)) body.temperature = opts.temperature;
  if (thinking) body.output_config = { effort: "low" };

  const headers = { "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" };

  let json: unknown;
  for (let adjustments = 0; ; adjustments++) {
    try {
      json = await postJson(url, headers, body, { label: "Anthropic", timeoutMs: opts.timeoutMs });
      break;
    } catch (err) {
      // Self-heal for models with a different parameter surface.
      if (adjustments < 2 && "temperature" in body && rejectsParam(err, "temperature")) {
        delete body.temperature;
        continue;
      }
      if (adjustments < 2 && "output_config" in body && rejectsParam(err, "output_config", "effort")) {
        delete body.output_config;
        continue;
      }
      throw err;
    }
  }

  const res = json as {
    stop_reason?: string;
    content?: Array<{ type: string; text?: string }>;
  };

  if (res.stop_reason === "refusal") {
    throw new Error("Anthropic declined to generate a message for this diff. Try another model.");
  }

  const text = (res.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n")
    .trim();

  if (!text && res.stop_reason === "max_tokens") {
    throw new Error("Anthropic ran out of tokens before writing the message. Increase `aiCommitAssistant.maxTokens`.");
  }

  return { text, truncated: res.stop_reason === "max_tokens" };
}
