import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const TEXT_FILE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cfg",
  ".conf",
  ".cpp",
  ".cs",
  ".css",
  ".dart",
  ".env",
  ".go",
  ".graphql",
  ".h",
  ".hpp",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".less",
  ".lua",
  ".md",
  ".mjs",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
]);

const TEXT_FILE_NAMES = new Set([
  ".env",
  ".env.example",
  ".gitignore",
  ".npmrc",
  "Dockerfile",
  "Gemfile",
  "Makefile",
]);

const GENERATED_OR_VENDOR_PATTERNS = [
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)coverage\//,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
];

async function git(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, { cwd, maxBuffer: 1024 * 1024 * 50 });
}

export async function getRepoRoot(cwd: string): Promise<string | undefined> {
  try {
    const { stdout } = await git(cwd, ["rev-parse", "--show-toplevel"]);
    const root = stdout.trim();
    return root ? root : undefined;
  } catch {
    return undefined;
  }
}

export async function gitAddAll(repoRoot: string): Promise<void> {
  // Stage tracked + untracked changes (equivalent to "git add -A").
  await git(repoRoot, ["add", "-A"]);
}

export async function gitDiffNumstat(repoRoot: string): Promise<string> {
  // Example lines: "10\t2\tsrc/file.ts"
  const { stdout } = await git(repoRoot, ["diff", "--cached", "--numstat"]);
  return stdout.trim();
}

export async function gitDiffCached(repoRoot: string, maxChars: number): Promise<string> {
  const { stdout } = await git(repoRoot, ["diff", "--cached"]);
  if (stdout.length <= maxChars) return stdout;

  // Truncate to stay within token limits; keep a clear marker for the model.
  return `${stdout.slice(0, Math.max(0, maxChars - 80))}\n\n[diff truncated]\n`;
}

export async function gitStagedFileContext(
  repoRoot: string,
  opts: { maxFiles: number; maxChars: number; maxCharsPerFile: number },
): Promise<string> {
  if (opts.maxFiles <= 0 || opts.maxChars <= 0 || opts.maxCharsPerFile <= 0) {
    return "";
  }

  const files = await gitDiffNameOnly(repoRoot);
  const chunks: string[] = [];
  let usedChars = 0;
  let includedFiles = 0;

  for (const file of files) {
    if (includedFiles >= opts.maxFiles || usedChars >= opts.maxChars) break;
    if (!shouldReadFileContext(file)) continue;

    const size = await gitObjectSize(repoRoot, file);
    if (size === undefined || size > opts.maxCharsPerFile * 4) continue;

    const content = await gitShowStagedFile(repoRoot, file);
    if (!content || looksBinary(content)) continue;

    const excerpt = truncateText(content, Math.min(opts.maxCharsPerFile, opts.maxChars - usedChars));
    if (!excerpt.trim()) continue;

    const chunk = [`--- ${file} ---`, excerpt].join("\n");
    chunks.push(chunk);
    usedChars += chunk.length;
    includedFiles += 1;
  }

  return chunks.join("\n\n");
}

async function gitDiffNameOnly(repoRoot: string): Promise<string[]> {
  const { stdout } = await git(repoRoot, ["diff", "--cached", "--name-only", "-z"]);
  return stdout.split("\0").filter(Boolean);
}

async function gitObjectSize(repoRoot: string, file: string): Promise<number | undefined> {
  try {
    const { stdout } = await git(repoRoot, ["cat-file", "-s", `:${file}`]);
    const size = Number(stdout.trim());
    return Number.isFinite(size) ? size : undefined;
  } catch {
    return undefined;
  }
}

async function gitShowStagedFile(repoRoot: string, file: string): Promise<string | undefined> {
  try {
    const { stdout } = await git(repoRoot, ["show", `:${file}`]);
    return stdout;
  } catch {
    return undefined;
  }
}

function shouldReadFileContext(file: string): boolean {
  if (GENERATED_OR_VENDOR_PATTERNS.some((pattern) => pattern.test(file))) {
    return false;
  }

  const name = file.split("/").pop() ?? file;
  if (TEXT_FILE_NAMES.has(name)) return true;

  const dotIndex = name.lastIndexOf(".");
  const ext = dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : "";
  return TEXT_FILE_EXTENSIONS.has(ext);
}

function looksBinary(text: string): boolean {
  return text.includes("\0");
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 40))}\n[file context truncated]\n`;
}
