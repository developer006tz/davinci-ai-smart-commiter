type AnthropicOpts = {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  system: string;
  user: string;
};

export async function callAnthropic(opts: AnthropicOpts): Promise<string> {
  const url = new URL("/v1/messages", opts.baseUrl).toString();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Anthropic API error (${res.status}): ${text}`);
  }

  const json = JSON.parse(text) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const firstText = json.content?.find((c) => c.type === "text")?.text;
  return firstText ?? "";
}

