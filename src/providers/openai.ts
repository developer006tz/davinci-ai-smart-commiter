type OpenAICompatibleOpts = {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  system: string;
  user: string;
  providerLabel?: string;
  defaultChatCompletionsPath?: string;
  omitTemperature?: boolean;
  extraBody?: Record<string, unknown>;
};

export async function callOpenAICompatible(opts: OpenAICompatibleOpts): Promise<string> {
  const url = buildChatCompletionsUrl(opts.baseUrl, opts.defaultChatCompletionsPath ?? "/v1/chat/completions");
  const body = {
    model: opts.model,
    ...(opts.omitTemperature ? {} : { temperature: opts.temperature }),
    max_tokens: opts.maxTokens,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    ...opts.extraBody,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${opts.providerLabel ?? "OpenAI-compatible"} API error (${res.status}): ${text}`);
  }

  const json = JSON.parse(text) as {
    choices?: Array<{
      finish_reason?: string;
      message?: { content?: string | null; reasoning_content?: string | null };
    }>;
  };

  const choice = json.choices?.[0];
  const content = choice?.message?.content?.trim();
  if (content) return content;

  const reasoningContent = choice?.message?.reasoning_content?.trim();
  if (reasoningContent) {
    throw new Error(
      `${opts.providerLabel ?? "Provider"} returned reasoning content but no final message. Increase max tokens or disable thinking for this model.`,
    );
  }

  if (choice?.finish_reason) {
    throw new Error(`${opts.providerLabel ?? "Provider"} returned no final message (finish_reason: ${choice.finish_reason}).`);
  }

  return "";
}

function buildChatCompletionsUrl(baseUrl: string, defaultPath: string): string {
  const parsed = new URL(baseUrl);
  const path = parsed.pathname.replace(/\/+$/, "");

  if (path.endsWith("/chat/completions")) {
    return parsed.toString();
  }

  if (!path) {
    return new URL(defaultPath, parsed.origin).toString();
  }

  return new URL(`${path}/chat/completions`, parsed.origin).toString();
}
