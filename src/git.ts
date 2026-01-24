import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

