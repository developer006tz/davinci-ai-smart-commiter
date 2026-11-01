export type ProviderResult = {
  text: string;
  /** True when the model stopped because it hit the token limit. */
  truncated: boolean;
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    label: string,
  ) {
    super(`${label} API error (${status}): ${summarizeErrorBody(body)}`);
  }
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 3;

export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  opts: { label: string; timeoutMs: number },
): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    let status = 0;
    let text = "";
    let retryAfter: string | null = null;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      status = res.status;
      retryAfter = res.headers.get("retry-after");
      text = await res.text();
      if (res.ok) {
        try {
          return JSON.parse(text);
        } catch {
          throw new Error(`${opts.label} returned an invalid JSON response.`);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        throw new Error(
          `${opts.label} request timed out after ${Math.round(opts.timeoutMs / 1000)}s. ` +
            "Increase `aiCommitAssistant.requestTimeoutSeconds` or pick a faster model.",
        );
      }
      if (err instanceof Error && err.message.includes("invalid JSON")) throw err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
        continue;
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`${opts.label} network error: ${msg}`);
    } finally {
      clearTimeout(timer);
    }

    if (RETRYABLE_STATUS.has(status) && attempt < MAX_ATTEMPTS) {
      await sleep(retryDelayMs(retryAfter, attempt));
      continue;
    }
    throw new HttpError(status, text, opts.label);
  }
}

function backoffMs(attempt: number): number {
  return 1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 300);
}

function retryDelayMs(retryAfter: string | null, attempt: number): number {
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 15000);
  return backoffMs(attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeErrorBody(body: string): string {
  try {
    const json = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    const msg = typeof json.error === "string" ? json.error : json.error?.message ?? json.message;
    if (msg) return msg;
  } catch {
    // not JSON
  }
  return body.length > 500 ? `${body.slice(0, 500)}…` : body;
}

/** True when a 400 error body says the given request parameter is not supported. */
export function rejectsParam(err: unknown, ...needles: string[]): boolean {
  if (!(err instanceof HttpError) || (err.status !== 400 && err.status !== 422)) return false;
  const body = err.body.toLowerCase();
  return needles.some((n) => body.includes(n.toLowerCase()));
}
