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
};

export async function callOpenAICompatible(opts: OpenAICompatibleOpts): Promise<string> {
  const url = buildChatCompletionsUrl(opts.baseUrl, opts.defaultChatCompletionsPath ?? "/v1/chat/completions");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${opts.providerLabel ?? "OpenAI-compatible"} API error (${res.status}): ${text}`);
  }

  const json = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return json.choices?.[0]?.message?.content ?? "";
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
