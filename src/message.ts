import type { CommitStyle } from "./settings";

/**
 * Cleans a raw model response into a well-formed commit message while
 * preserving the subject/body structure.
 */
export function normalizeCommitMessage(raw: string, style: CommitStyle, truncated = false): string {
  let text = raw.replace(/\r\n?/g, "\n");

  // Drop reasoning blocks some models emit inline.
  text = text.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, "");
  text = text.trim();

  // Unwrap a surrounding code fence.
  const fence = text.match(/^```[a-zA-Z-]*\n([\s\S]*?)\n?```$/);
  if (fence) text = fence[1].trim();
  text = text.replace(/^```[a-zA-Z-]*\n?/, "").replace(/\n?```$/, "").trim();

  // Drop leading labels such as "Commit message:".
  text = text.replace(/^(?:\*\*)?(?:suggested\s+)?commit message(?:\*\*)?\s*:?\s*\n?/i, "").trim();

  // Strip one pair of surrounding quotes.
  if (/^(["'`]).*\1$/s.test(text) && text.length > 1) {
    text = text.slice(1, -1).trim();
  }

  let lines = text.split("\n").map((line) => line.replace(/\s+$/, ""));

  // When output was cut off by the token limit, drop the incomplete last line.
  if (truncated && lines.length > 2) lines.pop();

  // Subject: first non-empty line, single spaces, no trailing period, no markdown emphasis.
  while (lines.length && !lines[0].trim()) lines.shift();
  if (!lines.length) return "";
  const subject = lines[0]
    .replace(/^#+\s*/, "")
    .replace(/^\*\*(.*)\*\*$/, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");

  if (style === "concise") return subject;

  const bodyLines = lines
    .slice(1)
    .map((line) => line.replace(/^(\s*)[*•]\s+/, "$1- "))
    .filter((line, i, all) => line.trim() !== "" || (all[i - 1] ?? "").trim() !== ""); // collapse blank runs
  const isBullet = (line: string | undefined) => !!line && /^\s*- /.test(line);
  const body = bodyLines
    // Remove blank lines between consecutive bullets; keep the blank line before footers.
    .filter((line, i) => line.trim() !== "" || !(isBullet(bodyLines[i - 1]) && isBullet(bodyLines[i + 1])))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return body ? `${subject}\n\n${wrapBody(body)}` : subject;
}

const WIDTH = 72;
const FOOTER = /^(BREAKING[ -]CHANGE|[A-Za-z][A-Za-z-]*)(: | #)/;

function unwrap(body: string): string[] {
  const out: string[] = [];
  for (const line of body.split("\n")) {
    const last = out.length ? out[out.length - 1] : "";
    const startsNew =
      !line.trim() || /^\s*- /.test(line) || FOOTER.test(line) || /^\s{4,}/.test(line) || /^\s*```/.test(line);
    if (!startsNew && last.trim() && !FOOTER.test(last) && !/^\s{4,}/.test(last) && !/^\s*```/.test(last)) {
      out[out.length - 1] = `${last} ${line.trim()}`;
    } else {
      out.push(line);
    }
  }
  return out;
}

function wrapBody(body: string): string {
  return unwrap(body)
    .flatMap((line) => {
      if (line.length <= WIDTH || FOOTER.test(line) || /^\s{4,}/.test(line)) return [line];
      const bullet = line.match(/^(\s*- )/);
      const lead = bullet ? bullet[1] : (line.match(/^\s*/)?.[0] ?? "");
      const indent = " ".repeat(lead.length);
      const words = line.slice(lead.length).split(/ +/);
      const out: string[] = [];
      let current = lead;
      for (const word of words) {
        const prefix = out.length ? indent : lead;
        if (current.length > prefix.length && current.length + 1 + word.length > WIDTH) {
          out.push(current);
          current = indent + word;
        } else {
          current = current.length > prefix.length ? `${current} ${word}` : current + word;
        }
      }
      out.push(current);
      return out;
    })
    .join("\n");
}
