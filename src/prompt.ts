export const SYSTEM_PROMPT = [
  "You are a senior software engineer writing git commit messages.",
  "Output a single Conventional Commits message line only (no code fences, no extra text).",
  "Format: <type>(<optional-scope>): <subject>",
  "Use imperative mood, keep it explanatory, and avoid trailing period.",
  "If scope is unknown, omit it.",
  "Choose the most accurate type: feat, fix, docs, refactor, perf, test, build, ci, chore, revert.",
  "Infer the user's intent from the diff first, then use surrounding file context to understand the affected behavior.",
  "Do not describe implementation mechanics when a clearer product or behavior change is visible.",
  "Subject should be <= 90 characters most of the time; when more detail is needed, do not exceed 130 characters.",
].join("\n");

export function buildUserPrompt(input: { numstat: string; diff: string; fileContext?: string }): string {
  return [
    "Generate the best Conventional Commits message for these staged changes.",
    "The diff is authoritative. Use the additional file context only to understand surrounding logic and intent.",
    "",
    "File statistics (git diff --cached --numstat):",
    input.numstat || "(no file stats)",
    "",
    "Relevant staged file context:",
    input.fileContext?.trim() || "(not available)",
    "",
    "Diff (git diff --cached):",
    input.diff || "(empty)",
  ].join("\n");
}
