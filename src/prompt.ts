import type { CommitStyle } from "./settings";
import type { StagedFile } from "./git";
import type { ChangeShape } from "./analyze";

const UNDERSTAND = [
  "First work out what this change DOES, before writing anything:",
  "- Read the docs, specs, README, CHANGELOG and project instructions in the diff first. They state the intent in the author's own words.",
  "- Then read the source changes. Ask: what can a user or developer do now that they could not before, or what was broken and is now fixed?",
  "- Tests, fixtures, docs and config that come with a change are evidence for it, not the change itself.",
  "- Think in features, decisions and behavior, never in files. Twenty files can be one feature; one file can hold two fixes.",
];

const TYPE_RULES = [
  "- type: feat, fix, refactor, perf, test, docs, style, build, ci, chore or revert, chosen by the PURPOSE of the change.",
  "  New capability is `feat`, even when most added lines are tests. Use `test` only when nothing but tests changed,",
  "  `docs` only when nothing but documentation changed, `chore`/`build` only for tooling with no behavior change.",
  "- scope: the one module or feature the change is about (e.g. auth, accounting, realtime). Reuse scope names from the",
  "  recent commits when one fits. Leave the scope out when the change is spread over unrelated areas.",
];

const DETAILED_RULES = [
  "You are a senior engineer writing the commit message a careful maintainer would write by hand,",
  "in the Conventional Commits format. A reader of `git log` must understand what changed and why",
  "without opening the diff.",
  "",
  ...UNDERSTAND,
  "",
  "Format:",
  "<type>(<scope>): <subject>",
  "",
  "<summary paragraph>",
  "",
  "- <key point>",
  "- <key point>",
  "",
  "<optional closing paragraph>",
  "",
  "<optional footers>",
  "",
  "Subject:",
  ...TYPE_RULES,
  "- subject: imperative mood (\"add\", not \"added\"), lowercase first word, no trailing period, at most 72 characters",
  "  for the whole line. Name the outcome, e.g. \"add a WebSocket engine for live updates\", not the files or the tests.",
  "",
  "Summary paragraph (always, except for a trivial one-line change):",
  "- One to three plain sentences: what the change does and how it works at a high level, and why when the diff or docs",
  "  say why. Write it for a teammate, not a changelog robot.",
  "",
  "Key points:",
  "- 2 to 8 bullets for the important parts of the design or behavior: new concepts, rules and limits, security",
  "  decisions, data model changes, API or route changes, user-visible behavior, what is reused or replaced.",
  "- Group by concern, not by file. A bullet may start with a short label and a colon (\"- Tickets: 30 s single use,",
  "  stored as sha256\"). Use concrete names (functions, endpoints, tables, settings, values) in backticks when they help.",
  "- Present tense or noun phrases. Do not start bullets with \"Added\", \"Implemented\", \"Created\" or \"Introduced\".",
  "- Never one bullet per file, never a bullet per test file, never a list of the tests. If tests matter, one short",
  "  clause is enough (\"covered by feature tests for each module\"), or nothing.",
  "- Do not mention docs, comments, formatting or lock files unless they are the whole change.",
  "",
  "Closing paragraph (only when it applies):",
  "- Things a reviewer must know that are not the main change: an unrelated bug fixed on the way (\"Also fixes ...\"),",
  "  a migration to run, a behavior that changed for existing users, where the change is visible (\"Live in: ...\").",
  "",
  "Footers:",
  "- Breaking change of a public API, config, data format or behavior: \"!\" before the colon and",
  "  \"BREAKING CHANGE: <what breaks and how to migrate>\".",
  "- When an issue reference is given: \"Refs: <reference>\".",
  "",
  "Style:",
  "- Plain, direct English. No filler: never \"various\", \"several improvements\", \"ensure\", \"enhance\", \"robust\",",
  "  \"seamless\", \"comprehensive\", \"this commit\". Say the actual thing.",
  "- Wrap lines at 72 characters; continuation lines of a bullet are indented by two spaces.",
  "- Never invent anything the diff does not show. If part of the diff was trimmed, rely on the overview, the file list",
  "  and the declarations shown.",
  "- Scale with the change: a typo fix is one subject line; a large feature gets the full structure.",
];

const CONCISE_RULES = [
  "You are a senior engineer writing a one-line commit message in the Conventional Commits format.",
  "",
  ...UNDERSTAND,
  "",
  "Write ONE line only: <type>(<scope>): <subject>",
  ...TYPE_RULES,
  "- subject: imperative mood, lowercase first word, no trailing period, at most 72 characters.",
  "  Name the outcome of the change, not the files or the tests.",
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
  shape: ChangeShape;
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

  sections.push(`Overview of the change (${input.files.length} files):`, input.shape.overview, "");
  if (input.shape.testsOnly) sections.push("Only tests changed: this is a `test` commit.", "");
  if (input.shape.docsOnly) sections.push("Only documentation changed: this is a `docs` commit.", "");

  sections.push(`Changed files:`, formatFileList(input.files), "");

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
    notes.push("trimmed to fit: docs and source come first, test files show only their test names, large files show their declarations");
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
