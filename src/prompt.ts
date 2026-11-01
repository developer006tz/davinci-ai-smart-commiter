import type { CommitStyle } from "./settings";
import type { StagedFile } from "./git";

const TYPE_RULES = [
  "- type: one of feat, fix, refactor, perf, test, docs, style, build, ci, chore, revert.",
  "  Pick the type of the DOMINANT change (a new feature that also adds tests and docs is still `feat`).",
  "- scope: the main module, feature, or area affected (e.g. accounting, auth, api, settings).",
  "  Infer it from directory/feature names and reuse the scope names seen in recent commits when they fit.",
  "  Omit the scope (and its parentheses) when the change spans several unrelated areas.",
];

const DETAILED_RULES = [
  "You are an expert software engineer who writes precise, informative git commit messages",
  "following the Conventional Commits 1.0 specification.",
  "",
  "Goal: someone reading `git log` must understand WHAT changed and WHY without opening the diff.",
  "",
  "Message structure:",
  "<type>(<scope>): <subject>",
  "",
  "<body>",
  "",
  "<optional footer(s)>",
  "",
  "Subject line rules:",
  ...TYPE_RULES,
  "- subject: imperative mood (\"add\", not \"added\"), lowercase first word, no trailing period.",
  "  Summarize the overall change and name the 2-3 most important things. Keep the whole line <= 80 characters.",
  "",
  "Body rules:",
  "- A bulleted list. Every bullet starts with \"- \" followed by a past-tense verb",
  "  (Added, Implemented, Created, Introduced, Updated, Enhanced, Fixed, Refactored, Renamed, Moved, Removed).",
  "- Cover EVERY meaningful change in the diff: new files, components, pages, classes, functions, API endpoints,",
  "  queries, routes, database migrations, configuration, dependencies, tests, and removed code.",
  "  Walk through the \"Changed files\" list so that nothing important is left out.",
  "- Be specific: name the components, files, functions, endpoints, or settings involved and say what they do",
  "  or how behavior changed. Example: \"- Created LockDate.vue to manage the accounting lock date, including form",
  "  validation and error handling.\"",
  "- Group closely related small edits into one bullet. Order bullets from most to least important.",
  "- Scale with the change: 1-3 bullets for a small change, up to about 12 for a large one.",
  "  One sentence per bullet, no nested bullets, no blank lines between bullets.",
  "- Mention fixes and the problem they solve when a bug fix is visible.",
  "- Never invent anything the diff does not support. Skip pure formatting/whitespace edits unless that is the whole change.",
  "- For a trivial change (typo, one-line tweak) you may omit the body entirely.",
  "",
  "Footer rules:",
  "- If the change breaks a public API, configuration, data format, or existing behavior, put \"!\" before the colon",
  "  in the subject and add a footer: \"BREAKING CHANGE: <what breaks and how to migrate>\".",
  "- If an issue reference is provided, add a footer: \"Refs: <reference>\".",
];

const CONCISE_RULES = [
  "You are an expert software engineer who writes precise git commit messages",
  "following the Conventional Commits 1.0 specification.",
  "",
  "Write ONE line only: <type>(<scope>): <subject>",
  ...TYPE_RULES,
  "- subject: imperative mood, lowercase first word, no trailing period, <= 90 characters.",
  "  Summarize the overall change and name the most important things it does.",
  "- Use \"!\" before the colon for breaking changes.",
];

const OUTPUT_RULES = [
  "",
  "Output ONLY the raw commit message text: no code fences, no quotes, no headings, no explanations.",
];

export function buildSystemPrompt(style: CommitStyle, customInstructions?: string): string {
  const lines = [...(style === "concise" ? CONCISE_RULES : DETAILED_RULES), ...OUTPUT_RULES];
  const extra = customInstructions?.trim();
  if (extra) {
    lines.push("", "Additional project-specific instructions (follow them; they override the rules above):", extra);
  }
  return lines.join("\n");
}

export type PromptInput = {
  files: StagedFile[];
  diff: string;
  diffTruncated: boolean;
  omittedDiffFiles: string[];
  fileContext?: string;
  branch?: string;
  issueRef?: string;
  recentCommits?: string[];
};

export function buildUserPrompt(input: PromptInput): string {
  const sections: string[] = ["Write the commit message for the staged changes below.", ""];

  if (input.branch) sections.push(`Branch: ${input.branch}`);
  if (input.issueRef) sections.push(`Issue reference: ${input.issueRef}`);
  if (input.branch || input.issueRef) sections.push("");

  if (input.recentCommits?.length) {
    sections.push(
      "Recent commit subjects in this repository (match their scope names and conventions, not their content):",
      ...input.recentCommits.map((s) => `- ${s}`),
      "",
    );
  }

  sections.push(`Changed files (${input.files.length}):`, formatFileList(input.files), "");

  const context = input.fileContext?.trim();
  if (context) {
    sections.push(
      "Current content of some modified files (for understanding surrounding logic only; describe the diff, not this):",
      context,
      "",
    );
  }

  const notes: string[] = [];
  if (input.omittedDiffFiles.length) {
    notes.push(`diff omitted for lock/generated files: ${input.omittedDiffFiles.join(", ")}`);
  }
  if (input.diffTruncated) {
    notes.push("some large file diffs were trimmed; rely on the file list and visible hunks for the rest");
  }
  sections.push(`Staged diff${notes.length ? ` (${notes.join("; ")})` : ""}:`, input.diff.trim() || "(no textual diff)");

  return sections.join("\n");
}

const STATUS_LABELS: Record<string, string> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
  C: "copied",
  T: "type changed",
};

const MAX_LISTED_FILES = 300;

function formatFileList(files: StagedFile[]): string {
  if (!files.length) return "(none)";
  const lines = files.slice(0, MAX_LISTED_FILES).map((f) => {
    const status = STATUS_LABELS[f.status] ?? f.status;
    const name = f.oldPath && f.oldPath !== f.path ? `${f.oldPath} -> ${f.path}` : f.path;
    const stats = f.binary ? "binary" : `+${f.added ?? 0} -${f.deleted ?? 0}`;
    return `- [${status}] ${name} (${stats})`;
  });
  if (files.length > MAX_LISTED_FILES) {
    lines.push(`- ... and ${files.length - MAX_LISTED_FILES} more files`);
  }
  return lines.join("\n");
}
