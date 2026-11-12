import type { StagedFile } from "./git";

export type FileRole = "docs" | "source" | "migration" | "config" | "test" | "generated";

const NOISY = [
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|composer\.lock|Cargo\.lock|poetry\.lock|Pipfile\.lock|Gemfile\.lock|go\.sum)$/,
  /\.min\.(js|css)$/,
  /\.map$/,
  /\.snap$/,
  /(^|\/)(dist|build|coverage|node_modules|vendor)\//,
];

const TEST = [
  /(^|\/)(tests?|__tests__|spec|specs|e2e|testdata|fixtures)\//i,
  /_test\.(go|py|rb|exs)$/,
  /\.(test|spec)\.[a-z0-9]+$/i,
  /(^|\/)test_[^/]+\.py$/,
  /Tests?\.(cs|java|kt|swift|php)$/,
];

const DOCS = [
  /\.(md|mdx|rst|adoc|txt)$/i,
  /(^|\/)docs?\//i,
  /(^|\/)(README|CHANGELOG|CLAUDE|AGENTS|CONTRIBUTING)(\.[a-z]+)?$/i,
];

const MIGRATION = [/(^|\/)migrations?\//i, /\.sql$/i, /(^|\/)schema\.prisma$/];

const CONFIG = [
  /(^|\/)(package\.json|go\.mod|composer\.json|Cargo\.toml|pyproject\.toml|requirements[^/]*\.txt|Gemfile|Makefile|Dockerfile|docker-compose[^/]*\.ya?ml|nixpacks\.toml|tsconfig[^/]*\.json|vite\.config\.[a-z]+|\.env\.example)$/,
  /(^|\/)(\.github|\.gitlab|\.circleci)\//,
  /(^|\/)config\//,
  /\.(ya?ml|toml|ini|cfg|conf)$/i,
];

export function roleOf(path: string): FileRole {
  if (NOISY.some((p) => p.test(path))) return "generated";
  if (TEST.some((p) => p.test(path))) return "test";
  if (DOCS.some((p) => p.test(path))) return "docs";
  if (MIGRATION.some((p) => p.test(path))) return "migration";
  if (CONFIG.some((p) => p.test(path))) return "config";
  return "source";
}

const ROOT_SEGMENTS = new Set(["src", "app", "lib", "pkg", "internal", "resources", "js", "ts", "packages", "apps", "modules", "services", "workspaces", "client", "server"]);

export function areaOf(path: string): string {
  const parts = path.split("/").slice(0, -1);
  const kept: string[] = [];
  for (const part of parts) {
    kept.push(part);
    if (!ROOT_SEGMENTS.has(part.toLowerCase()) && kept.length >= 2) break;
    if (kept.length >= 4) break;
  }
  return kept.length ? kept.join("/") : "(root)";
}

const ROLE_LABELS: Record<FileRole, string> = {
  docs: "docs and specs",
  source: "source",
  migration: "migrations and schema",
  config: "config and build",
  test: "tests",
  generated: "lock and generated files",
};

const lines = (f: StagedFile) => (f.added ?? 0) + (f.deleted ?? 0);

export type ChangeShape = {
  overview: string;
  testsOnly: boolean;
  docsOnly: boolean;
};

export function describeChange(files: StagedFile[]): ChangeShape {
  const byRole = new Map<FileRole, StagedFile[]>();
  for (const f of files) {
    const role = roleOf(f.path);
    byRole.set(role, [...(byRole.get(role) ?? []), f]);
  }
  const meaningful = files.filter((f) => roleOf(f.path) !== "generated");
  const testsOnly = meaningful.length > 0 && meaningful.every((f) => ["test", "docs"].includes(roleOf(f.path))) && (byRole.get("test")?.length ?? 0) > 0;
  const docsOnly = meaningful.length > 0 && meaningful.every((f) => roleOf(f.path) === "docs");

  const out: string[] = ["By kind:"];
  for (const role of ["source", "migration", "config", "docs", "test", "generated"] as FileRole[]) {
    const group = byRole.get(role);
    if (!group?.length) continue;
    const added = group.filter((f) => f.status === "A").length;
    out.push(`- ${ROLE_LABELS[role]}: ${group.length} files (${added} new), ${group.reduce((n, f) => n + lines(f), 0)} lines changed`);
  }

  const areas = new Map<string, { files: number; lines: number }>();
  for (const f of meaningful) {
    if (roleOf(f.path) === "test") continue;
    const area = areaOf(f.path);
    const entry = areas.get(area) ?? { files: 0, lines: 0 };
    entry.files += 1;
    entry.lines += lines(f);
    areas.set(area, entry);
  }
  const ranked = [...areas.entries()].sort((a, b) => b[1].lines - a[1].lines);
  if (ranked.length) {
    out.push("", "Areas touched by non-test files, largest first:");
    for (const [area, entry] of ranked.slice(0, 20)) out.push(`- ${area}: ${entry.files} files, ${entry.lines} lines`);
    if (ranked.length > 20) out.push(`- ... and ${ranked.length - 20} smaller areas`);
  }

  return { overview: out.join("\n"), testsOnly, docsOnly };
}

const TEST_NAME = /^[+-]\s*(func (\([^)]*\)\s*)?Test\w*|(describe|it|test|context)\s*\(|def test_\w+|public function test\w+|@Test|#\[test\]|func test\w+)/;

const DECLARATION = /^[+-]\s*(export\s|func\s|type\s|class\s|interface\s|enum\s|def\s|async def\s|struct\s|trait\s|impl\s|pub\s|public\s|protected\s|private\s|const\s+[A-Z]|module\.exports|router\.|Route::|CREATE\s|ALTER\s|DROP\s|##?\s)/;

type Section = { path: string; role: FileRole; text: string };

function sectionPath(section: string): string {
  const header = section.slice(0, section.indexOf("\n") >>> 0);
  const match = header.match(/^diff --git a\/(.*) b\/(.*)$/);
  return match ? match[2] : header;
}

function splitSections(raw: string): Section[] {
  return raw
    .split(/^(?=diff --git )/m)
    .filter((s) => s.length > 0)
    .map((text) => {
      const path = sectionPath(text);
      return { path, role: roleOf(path), text };
    });
}

function headerOf(text: string): string {
  const firstHunk = text.indexOf("\n@@");
  return firstHunk >= 0 ? text.slice(0, firstHunk + 1) : text;
}

function outline(text: string, pattern: RegExp, label: string): string {
  const picked = text.split("\n").filter((line) => pattern.test(line)).map((line) => line.slice(0, 160));
  if (!picked.length) return `${headerOf(text)}[${label}: diff omitted]\n`;
  return `${headerOf(text)}[${label}, ${picked.length} declarations shown]\n${picked.join("\n")}\n`;
}

function trim(section: Section, cap: number): string {
  if (section.text.length <= cap) return section.text;
  let cut = section.text.lastIndexOf("\n", Math.max(0, cap - 1));
  if (cut < Math.min(200, cap / 2)) cut = Math.max(0, cap);
  const rest = section.text.slice(cut);
  const shown = rest.split("\n").filter((line) => DECLARATION.test(line)).slice(0, 40).map((line) => line.slice(0, 160));
  const tail = shown.length ? `\n[rest of this file trimmed; its declarations:]\n${shown.join("\n")}\n` : `\n[... ${rest.length} more characters of this file omitted ...]\n`;
  return section.text.slice(0, cut) + tail;
}

function waterFill(sizes: number[], budget: number): number[] {
  const order = sizes.map((size, idx) => ({ size, idx })).sort((a, b) => a.size - b.size);
  const caps = new Array<number>(sizes.length).fill(0);
  let remaining = Math.max(0, budget);
  for (let i = 0; i < order.length; i++) {
    const take = Math.min(order[i].size, Math.floor(remaining / (order.length - i)));
    caps[order[i].idx] = take;
    remaining -= take;
  }
  return caps;
}

const TIERS: { roles: FileRole[]; share: number }[] = [
  { roles: ["docs"], share: 0.25 },
  { roles: ["migration", "config"], share: 0.15 },
  { roles: ["source"], share: 1 },
];

/**
 * Fits the diff into the budget by importance: docs and specs explain the intent, source carries
 * the change, tests are reduced to their test names unless the commit is only tests.
 */
export function fitDiff(raw: string, maxChars: number, testsOnly: boolean): { diff: string; truncated: boolean } {
  let result = fitOnce(raw, maxChars, testsOnly);
  for (let budget = maxChars * 0.85; result.diff.length > maxChars && budget > maxChars * 0.3; budget *= 0.85) {
    result = fitOnce(raw, Math.floor(budget), testsOnly);
  }
  return result;
}

function fitOnce(raw: string, maxChars: number, testsOnly: boolean): { diff: string; truncated: boolean } {
  const sections = splitSections(raw);
  const out = new Map<Section, string>();
  let truncated = false;

  const tests = sections.filter((s) => s.role === "test");
  if (!testsOnly) {
    for (const s of tests) {
      out.set(s, outline(s.text, TEST_NAME, "test file, only test names shown"));
      if (s.text.length > 0) truncated = true;
    }
  }
  let budget = maxChars - [...out.values()].reduce((n, t) => n + t.length, 0);

  const tiers = testsOnly ? [...TIERS, { roles: ["test"] as FileRole[], share: 1 }] : TIERS;
  for (const tier of tiers) {
    const group = sections.filter((s) => tier.roles.includes(s.role) && !out.has(s));
    if (!group.length) continue;
    const allowance = Math.floor(Math.max(0, budget) * tier.share);
    const total = group.reduce((n, s) => n + s.text.length, 0);
    if (total <= allowance) {
      for (const s of group) out.set(s, s.text);
      budget -= total;
      continue;
    }
    truncated = true;
    const caps = waterFill(group.map((s) => s.text.length), allowance);
    group.forEach((s, i) => {
      const text = caps[i] < 400 ? outline(s.text, DECLARATION, "file trimmed for size") : trim(s, caps[i]);
      out.set(s, text);
      budget -= text.length;
    });
  }

  for (const s of sections) if (!out.has(s)) out.set(s, outline(s.text, DECLARATION, "file trimmed for size"));

  return { diff: sections.map((s) => out.get(s)).join(""), truncated };
}
