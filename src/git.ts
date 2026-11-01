import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const TEXT_FILE_EXTENSIONS = new Set([
  ".c", ".cc", ".cfg", ".conf", ".cpp", ".cs", ".css", ".dart", ".env", ".go", ".graphql", ".h", ".hpp",
  ".html", ".java", ".js", ".json", ".jsx", ".kt", ".less", ".lua", ".md", ".mjs", ".cjs", ".php", ".py",
  ".rb", ".rs", ".scss", ".sh", ".sql", ".svelte", ".swift", ".toml", ".ts", ".tsx", ".txt", ".vue",
  ".xml", ".yaml", ".yml", ".prisma", ".proto", ".blade.php", ".ex", ".exs", ".scala", ".m", ".mm",
]);

const TEXT_FILE_NAMES = new Set([".env.example", ".gitignore", ".npmrc", "Dockerfile", "Gemfile", "Makefile"]);

const GENERATED_OR_VENDOR_PATTERNS = [
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)coverage\//,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
];

/** Files whose diff is pure noise for the model: listed by name but their diff is not sent. */
const NOISY_DIFF_GLOBS = [
  "**/package-lock.json",
  "**/npm-shrinkwrap.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/bun.lockb",
  "**/composer.lock",
  "**/Cargo.lock",
  "**/poetry.lock",
  "**/Pipfile.lock",
  "**/Gemfile.lock",
  "**/go.sum",
  "**/*.min.js",
  "**/*.min.css",
  "**/*.map",
  "**/*.snap",
];

const NOISY_DIFF_PATTERNS = [
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|composer\.lock|Cargo\.lock|poetry\.lock|Pipfile\.lock|Gemfile\.lock|go\.sum)$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.snap$/,
];

export type StagedFile = {
  /** A, M, D, R, C, T ... (first letter of git's status) */
  status: string;
  path: string;
  oldPath?: string;
  added?: number;
  deleted?: number;
  binary?: boolean;
};

async function git(cwd: string, args: string[]): Promise<string> {
  // Disable user config that changes diff output (colors, external diff tools, custom prefixes).
  const { stdout } = await execFileAsync("git", ["-c", "core.quotepath=off", "-c", "color.ui=never", ...args], {
    cwd,
    maxBuffer: 1024 * 1024 * 100,
    env: { ...process.env, GIT_PAGER: "cat", LC_ALL: "C" },
  });
  return stdout;
}

export async function getRepoRoot(cwd: string): Promise<string | undefined> {
  try {
    const root = (await git(cwd, ["rev-parse", "--show-toplevel"])).trim();
    return root || undefined;
  } catch {
    return undefined;
  }
}

export async function gitAddAll(repoRoot: string): Promise<void> {
  await git(repoRoot, ["add", "-A"]);
}

export async function getStagedFiles(repoRoot: string): Promise<StagedFile[]> {
  const [nameStatus, numstat] = await Promise.all([
    git(repoRoot, ["diff", "--cached", "--name-status", "-z", "-M"]),
    git(repoRoot, ["diff", "--cached", "--numstat", "-z", "-M"]),
  ]);

  const files = new Map<string, StagedFile>();
  const ns = nameStatus.split("\0");
  for (let i = 0; i < ns.length; ) {
    const status = ns[i];
    if (!status) {
      i += 1;
      continue;
    }
    const letter = status[0];
    if (letter === "R" || letter === "C") {
      const oldPath = ns[i + 1];
      const path = ns[i + 2];
      if (path) files.set(path, { status: letter, path, oldPath });
      i += 3;
    } else {
      const path = ns[i + 1];
      if (path) files.set(path, { status: letter, path });
      i += 2;
    }
  }

  const nt = numstat.split("\0");
  for (let i = 0; i < nt.length; ) {
    const record = nt[i];
    if (!record) {
      i += 1;
      continue;
    }
    const [added, deleted, inlinePath] = record.split("\t");
    let path = inlinePath;
    if (path === "") {
      // Rename/copy: "added\tdeleted\t\0old\0new\0"
      path = nt[i + 2];
      i += 3;
    } else {
      i += 1;
    }
    const file = path ? files.get(path) : undefined;
    if (!file) continue;
    if (added === "-" || deleted === "-") {
      file.binary = true;
    } else {
      file.added = Number(added) || 0;
      file.deleted = Number(deleted) || 0;
    }
  }

  return [...files.values()];
}

export function isNoisyDiffFile(file: string): boolean {
  return NOISY_DIFF_PATTERNS.some((pattern) => pattern.test(file));
}

/**
 * Returns the staged diff, excluding lock/generated files, fitted into `maxChars`
 * by giving every file a fair share instead of cutting off the tail of the diff.
 */
export async function getStagedDiff(
  repoRoot: string,
  maxChars: number,
): Promise<{ diff: string; truncated: boolean }> {
  const excludes = NOISY_DIFF_GLOBS.map((glob) => `:(glob,exclude)${glob}`);
  const raw = await git(repoRoot, [
    "diff",
    "--cached",
    "--no-color",
    "--no-ext-diff",
    "--src-prefix=a/",
    "--dst-prefix=b/",
    "-M",
    "--",
    ".",
    ...excludes,
  ]);
  return fitDiffToBudget(raw, maxChars);
}

export function fitDiffToBudget(raw: string, maxChars: number): { diff: string; truncated: boolean } {
  if (raw.length <= maxChars) return { diff: raw, truncated: false };

  const sections = raw.split(/^(?=diff --git )/m).filter((s) => s.length > 0);
  const caps = waterFill(
    sections.map((s) => s.length),
    maxChars,
  );

  const parts = sections.map((section, idx) => {
    const cap = caps[idx];
    if (section.length <= cap) return section;
    // Cut at a line boundary so hunks stay readable.
    let cut = section.lastIndexOf("\n", Math.max(0, cap - 1));
    if (cut < Math.min(200, cap / 2)) cut = Math.max(0, cap);
    const omitted = section.length - cut;
    return `${section.slice(0, cut)}\n[... ${omitted} more characters of this file's diff omitted ...]\n`;
  });

  return { diff: parts.join(""), truncated: true };
}

/** Max-min fair allocation: small sections stay whole, large ones share what's left equally. */
function waterFill(sizes: number[], budget: number): number[] {
  const order = sizes.map((size, idx) => ({ size, idx })).sort((a, b) => a.size - b.size);
  const caps = new Array<number>(sizes.length).fill(0);
  let remaining = budget;
  for (let i = 0; i < order.length; i++) {
    const share = Math.floor(remaining / (order.length - i));
    const take = Math.min(order[i].size, Math.max(share, 0));
    caps[order[i].idx] = take;
    remaining -= take;
  }
  return caps;
}

export async function getCurrentBranch(repoRoot: string): Promise<string | undefined> {
  try {
    const branch = (await git(repoRoot, ["symbolic-ref", "--short", "-q", "HEAD"])).trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
}

/** Extracts an issue key like ABC-123 or GH-45 / #45 from a branch name. */
export function extractIssueRef(branch: string | undefined): string | undefined {
  if (!branch) return undefined;
  const jira = branch.match(/(?:^|[/_-])([A-Z][A-Z0-9]{1,9}-\d+)(?=$|[/_-])/);
  if (jira) return jira[1];
  const gh = branch.match(/(?:^|\/)(?:issue|issues|gh)[-_]?(\d+)(?=$|[/_-])/i);
  if (gh) return `#${gh[1]}`;
  return undefined;
}

export async function getRecentCommitSubjects(repoRoot: string, count: number): Promise<string[]> {
  if (count <= 0) return [];
  try {
    const out = await git(repoRoot, ["log", `-n${Math.floor(count)}`, "--no-merges", "--pretty=format:%s"]);
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return []; // e.g. no commits yet
  }
}

/**
 * Reads the staged version of the most-changed modified files as surrounding context.
 * Added files are skipped because their full content is already in the diff.
 */
export async function getStagedFileContext(
  repoRoot: string,
  files: StagedFile[],
  opts: { maxFiles: number; maxChars: number; maxCharsPerFile: number },
): Promise<string> {
  if (opts.maxFiles <= 0 || opts.maxChars <= 0 || opts.maxCharsPerFile <= 0) return "";

  const candidates = files
    .filter((f) => (f.status === "M" || f.status === "R") && !f.binary && shouldReadFileContext(f.path))
    .sort((a, b) => (b.added ?? 0) + (b.deleted ?? 0) - ((a.added ?? 0) + (a.deleted ?? 0)));

  const chunks: string[] = [];
  let usedChars = 0;

  for (const file of candidates) {
    if (chunks.length >= opts.maxFiles || usedChars >= opts.maxChars) break;

    const size = await gitObjectSize(repoRoot, file.path);
    if (size === undefined || size > opts.maxCharsPerFile * 4) continue;

    const content = await gitShowStagedFile(repoRoot, file.path);
    if (!content || content.includes("\0")) continue;

    const excerpt = truncateText(content, Math.min(opts.maxCharsPerFile, opts.maxChars - usedChars));
    if (!excerpt.trim()) continue;

    const chunk = `--- ${file.path} ---\n${excerpt}`;
    chunks.push(chunk);
    usedChars += chunk.length;
  }

  return chunks.join("\n\n");
}

async function gitObjectSize(repoRoot: string, file: string): Promise<number | undefined> {
  try {
    const size = Number((await git(repoRoot, ["cat-file", "-s", `:${file}`])).trim());
    return Number.isFinite(size) ? size : undefined;
  } catch {
    return undefined;
  }
}

async function gitShowStagedFile(repoRoot: string, file: string): Promise<string | undefined> {
  try {
    return await git(repoRoot, ["show", `:${file}`]);
  } catch {
    return undefined;
  }
}

function shouldReadFileContext(file: string): boolean {
  if (GENERATED_OR_VENDOR_PATTERNS.some((pattern) => pattern.test(file)) || isNoisyDiffFile(file)) return false;
  const name = file.split("/").pop() ?? file;
  if (TEXT_FILE_NAMES.has(name)) return true;
  const dotIndex = name.lastIndexOf(".");
  const ext = dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
  return TEXT_FILE_EXTENSIONS.has(ext);
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 40))}\n[file context truncated]\n`;
}
