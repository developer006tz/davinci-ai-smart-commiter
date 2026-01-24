export const SYSTEM_PROMPT = [
  "You are a senior software engineer writing git commit messages.",
  "Output a single Conventional Commits message line only (no code fences, no extra text).",
  "Format: <type>(<optional-scope>): <subject>",
  "Use imperative mood, keep it explainatory, and avoid trailing period.",
  "If scope is unknown, omit it.",
  "Choose the most accurate type: feat, fix, docs, refactor, perf, test, build, ci, chore, revert.",
  "Subject should be <= 90 characters most of the time and  when more long message needed dont exceed 130 characters.",
].join("\n");

export function buildUserPrompt(input: { numstat: string; diff: string }): string {
  return [
    "Generate the best Conventional Commits message for these staged changes.",
    "",
    "File statistics (git diff --cached --numstat):",
    input.numstat || "(no file stats)",
    "",
    "Diff (git diff --cached):",
    input.diff || "(empty)",
  ].join("\n");
}

