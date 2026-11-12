import * as vscode from "vscode";
import * as path from "node:path";
import {
  extractIssueRef,
  getCurrentBranch,
  getRecentCommitSubjects,
  getRepoRoot,
  getStagedDiff,
  getStagedFileContext,
  getStagedFiles,
  gitAddAll,
  isNoisyDiffFile,
} from "./git";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { describeChange } from "./analyze";
import { normalizeCommitMessage } from "./message";
import { generateCommitMessage } from "./providers";
import { getConfig, type ProviderName } from "./settings";
import { PROVIDER_MODELS, isKnownModel } from "./models";

const SECRET_KEYS = {
  anthropic: "aiCommitAssistant.anthropicApiKey",
  openai: "aiCommitAssistant.openaiApiKey",
  kimi: "aiCommitAssistant.kimiApiKey",
  deepseek: "aiCommitAssistant.deepseekApiKey",
  gemini: "aiCommitAssistant.geminiApiKey",
} as const;

const PROVIDER_LABELS: Record<ProviderName, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  kimi: "Kimi",
  deepseek: "DeepSeek",
  gemini: "Gemini",
};

const PROVIDERS: ProviderName[] = ["anthropic", "openai", "kimi", "deepseek", "gemini"];

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("aiCommitAssistant.setup", async () => {
      await setupProvider(context);
    }),
    vscode.commands.registerCommand("aiCommitAssistant.selectProvider", async () => {
      await selectProvider();
    }),
    vscode.commands.registerCommand("aiCommitAssistant.selectModel", async () => {
      await selectModelForCurrentProvider();
    }),
    vscode.commands.registerCommand("aiCommitAssistant.setAnthropicApiKey", async () => {
      await setApiKey(context, "anthropic");
    }),
    vscode.commands.registerCommand("aiCommitAssistant.setOpenAIApiKey", async () => {
      await setApiKey(context, "openai");
    }),
    vscode.commands.registerCommand("aiCommitAssistant.setKimiApiKey", async () => {
      await setApiKey(context, "kimi");
    }),
    vscode.commands.registerCommand("aiCommitAssistant.setDeepSeekApiKey", async () => {
      await setApiKey(context, "deepseek");
    }),
    vscode.commands.registerCommand("aiCommitAssistant.setGeminiApiKey", async () => {
      await setApiKey(context, "gemini");
    }),
    vscode.commands.registerCommand("aiCommitAssistant.generateCommitMessage", async (arg?: unknown) => {
      await generate(context, arg);
    }),
    vscode.commands.registerCommand("aiCommitAssistant.selectCommitStyle", async () => {
      await selectCommitStyle();
    }),
    vscode.commands.registerCommand("aiCommitAssistant.showLog", () => {
      output().show(true);
    }),
  );
}

export function deactivate() {
  outputChannel?.dispose();
}

async function selectCommitStyle() {
  const current = getConfig().commitStyle;
  const picked = await vscode.window.showQuickPick(
    [
      {
        label: "Detailed",
        description: current === "detailed" ? "current" : undefined,
        detail: "Subject, a summary of what the change does and why, and its key points (recommended)",
        style: "detailed" as const,
      },
      {
        label: "Concise",
        description: current === "concise" ? "current" : undefined,
        detail: "Single Conventional Commits subject line",
        style: "concise" as const,
      },
    ],
    { title: "Davinci AI Smart Commiter: Commit Message Style", ignoreFocusOut: true },
  );
  if (!picked) return;
  await updateSetting("commitStyle", picked.style);
  vscode.window.showInformationMessage(`Davinci AI Smart Commiter: Commit style set to ${picked.label}.`);
}

async function setupProvider(context: vscode.ExtensionContext) {
  const provider = await pickProvider(getConfig().provider);
  if (!provider) return;

  await updateSetting("provider", provider);

  const model = await pickModel(provider, getConfig()[provider].model);
  if (!model) return;

  await updateSetting(`${provider}.model`, model);

  const apiKeyChoice = await vscode.window.showQuickPick(
    [
      { label: "Set API key now", description: PROVIDER_LABELS[provider] },
      { label: "Skip API key", description: "Keep the current saved key or environment variable" },
    ],
    {
      title: "Davinci AI Smart Commiter Setup",
      placeHolder: "Do you want to set the API key for this provider?",
      ignoreFocusOut: true,
    },
  );

  if (apiKeyChoice?.label === "Set API key now") {
    await setApiKey(context, provider);
  }

  vscode.window.showInformationMessage(
    `Davinci AI Smart Commiter: ${PROVIDER_LABELS[provider]} selected with ${model}.`,
  );
}

async function selectProvider() {
  const provider = await pickProvider(getConfig().provider);
  if (!provider) return;

  await updateSetting("provider", provider);
  vscode.window.showInformationMessage(`Davinci AI Smart Commiter: Provider set to ${PROVIDER_LABELS[provider]}.`);
}

async function selectModelForCurrentProvider() {
  const config = getConfig();
  const provider = config.provider;
  const model = await pickModel(provider, config[provider].model);
  if (!model) return;

  await updateSetting(`${provider}.model`, model);
  vscode.window.showInformationMessage(`Davinci AI Smart Commiter: ${PROVIDER_LABELS[provider]} model set to ${model}.`);
}

async function setApiKey(context: vscode.ExtensionContext, provider: ProviderName) {
  const value = await vscode.window.showInputBox({
    title: `Set ${PROVIDER_LABELS[provider]} API Key`,
    password: true,
    prompt: "Stored securely in VS Code Secret Storage for this machine.",
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length < 10 ? "That doesn't look like a valid API key." : undefined),
  });
  if (!value) return;
  await context.secrets.store(SECRET_KEYS[provider], value.trim());
  vscode.window.showInformationMessage("Davinci AI Smart Commiter: API key saved.");
}

async function pickProvider(currentProvider: ProviderName): Promise<ProviderName | undefined> {
  const picked = await vscode.window.showQuickPick(
    PROVIDERS.map((provider) => ({
      label: PROVIDER_LABELS[provider],
      description: provider === currentProvider ? "current" : undefined,
      provider,
    })),
    {
      title: "Davinci AI Smart Commiter: Select AI Provider",
      placeHolder: "Choose the provider used to generate commit messages",
      ignoreFocusOut: true,
    },
  );

  return picked?.provider;
}

async function pickModel(provider: ProviderName, currentModel: string): Promise<string | undefined> {
  const knownCurrent = isKnownModel(provider, currentModel);
  const choices = PROVIDER_MODELS[provider].map((model) => ({
    label: model.label,
    description: model.id === currentModel ? "current" : model.description,
    detail: model.id,
    model: model.id,
  }));

  if (!knownCurrent && currentModel.trim()) {
    choices.unshift({
      label: `Keep current: ${currentModel}`,
      description: "current custom value",
      detail: currentModel,
      model: currentModel,
    });
  }

  const picked = await vscode.window.showQuickPick(choices, {
    title: `Davinci AI Smart Commiter: Select ${PROVIDER_LABELS[provider]} Model`,
    placeHolder: "Choose a model",
    ignoreFocusOut: true,
  });

  return picked?.model;
}

async function updateSetting(key: string, value: string): Promise<void> {
  const cfg = vscode.workspace.getConfiguration("aiCommitAssistant");
  await cfg.update(key, value, vscode.ConfigurationTarget.Global);
}

async function generate(context: vscode.ExtensionContext, arg?: unknown) {
  const repoRoot = await resolveTargetRepo(arg);
  if (!repoRoot) return;

  const config = getConfig();
  const provider = config.provider;
  const apiKey = await resolveApiKey(context, provider);
  if (!apiKey) {
    const action = await vscode.window.showErrorMessage(
      `Davinci AI Smart Commiter: Missing ${PROVIDER_LABELS[provider]} API key.`,
      "Set API Key",
    );
    if (action) await setApiKey(context, provider);
    return;
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.SourceControl, title: "Davinci AI Smart Commiter", cancellable: false },
    async () => {
      const started = Date.now();
      try {
        if (config.autoStage) {
          await gitAddAll(repoRoot);
        }

        const files = await getStagedFiles(repoRoot);
        if (!files.length) {
          vscode.window.showInformationMessage("Davinci AI Smart Commiter: No staged changes found.");
          return;
        }

        const shape = describeChange(files);
        const [{ diff, truncated: diffTruncated }, fileContext, branch, recentCommits] = await Promise.all([
          getStagedDiff(repoRoot, config.diffMaxChars, shape.testsOnly),
          getStagedFileContext(repoRoot, files, {
            maxFiles: config.contextMaxFiles,
            maxChars: config.contextMaxChars,
            maxCharsPerFile: config.contextMaxCharsPerFile,
          }),
          getCurrentBranch(repoRoot),
          getRecentCommitSubjects(repoRoot, config.contextRecentCommits),
        ]);

        const user = buildUserPrompt({
          files,
          shape,
          diff,
          diffTruncated,
          omittedDiffFiles: files.filter((f) => isNoisyDiffFile(f.path)).map((f) => f.path),
          fileContext,
          branch,
          issueRef: extractIssueRef(branch),
          recentCommits,
        });
        const system = buildSystemPrompt(config.commitStyle, config.customInstructions);

        const { model, baseUrl, effort } = config[provider];
        // A detailed message (subject + bullet body) needs more room than a single line.
        const maxTokens = config.commitStyle === "detailed" ? Math.max(config.maxTokens, 1024) : config.maxTokens;

        log(
          `Generating with ${PROVIDER_LABELS[provider]} (${model}, effort=${effort}), style=${config.commitStyle}, ` +
            `files=${files.length}, diffChars=${diff.length}${diffTruncated ? " (trimmed)" : ""}, ` +
            `contextChars=${fileContext.length}, promptChars=${system.length + user.length}`,
        );

        const result = await generateCommitMessage(provider, {
          apiKey,
          baseUrl,
          model,
          effort,
          temperature: config.temperature,
          maxTokens,
          system,
          user,
          timeoutMs: Math.max(10, config.requestTimeoutSeconds) * 1000,
        });

        const message = normalizeCommitMessage(result.text, config.commitStyle, result.truncated);
        if (!message) {
          vscode.window.showErrorMessage("Davinci AI Smart Commiter: Provider returned an empty commit message.");
          return;
        }

        await setCommitInputBoxValue(repoRoot, message);
        log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s${result.truncated ? " (output hit token limit)" : ""}:\n${message}\n`);
        if (result.truncated) {
          vscode.window.showWarningMessage(
            "Davinci AI Smart Commiter: The message hit the token limit and may be incomplete. Increase `aiCommitAssistant.maxTokens`.",
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`Error: ${msg}`);
        const action = await vscode.window.showErrorMessage(`Davinci AI Smart Commiter: ${msg}`, "Show Log");
        if (action) output().show(true);
      }
    },
  );
}

type GitRepository = {
  rootUri: vscode.Uri;
  inputBox: { value: string };
};

type GitExtensionApi = {
  repositories: GitRepository[];
};

async function getGitApi(): Promise<GitExtensionApi | undefined> {
  const gitExt = vscode.extensions.getExtension("vscode.git");
  if (!gitExt) return undefined;
  if (!gitExt.isActive) await gitExt.activate();
  return (gitExt.exports as { getAPI?: (version: number) => GitExtensionApi }).getAPI?.(1);
}

/** Picks the repository: the one whose SCM button was clicked, the active editor's, or asks. */
async function resolveTargetRepo(arg: unknown): Promise<string | undefined> {
  const argRoot = (arg as { rootUri?: vscode.Uri } | undefined)?.rootUri;
  if (argRoot?.fsPath) {
    const root = await getRepoRoot(argRoot.fsPath);
    if (root) return root;
  }

  const repos = (await getGitApi())?.repositories ?? [];
  if (repos.length === 1) return repos[0].rootUri.fsPath;

  if (repos.length > 1) {
    const activeFile = vscode.window.activeTextEditor?.document.uri;
    if (activeFile?.scheme === "file") {
      const match = repos
        .filter((r) => isInside(activeFile.fsPath, r.rootUri.fsPath))
        .sort((a, b) => b.rootUri.fsPath.length - a.rootUri.fsPath.length)[0];
      if (match) return match.rootUri.fsPath;
    }
    const picked = await vscode.window.showQuickPick(
      repos.map((r) => ({ label: path.basename(r.rootUri.fsPath), description: r.rootUri.fsPath, root: r.rootUri.fsPath })),
      { title: "Davinci AI Smart Commiter: Select Repository", ignoreFocusOut: true },
    );
    return picked?.root;
  }

  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showErrorMessage("Davinci AI Smart Commiter: Open a workspace folder first.");
    return undefined;
  }
  const root = await getRepoRoot(folder.uri.fsPath);
  if (!root) {
    vscode.window.showErrorMessage("Davinci AI Smart Commiter: This workspace is not a git repository.");
  }
  return root;
}

function isInside(file: string, dir: string): boolean {
  const rel = path.relative(dir, file);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

async function resolveApiKey(context: vscode.ExtensionContext, provider: ProviderName): Promise<string | undefined> {
  // Prefer Secret Storage, fall back to environment variables for CI/dev.
  const secret = await context.secrets.get(SECRET_KEYS[provider]);
  if (secret?.trim()) return secret.trim();

  if (provider === "anthropic") {
    const env = process.env.ANTHROPIC_API_KEY || process.env.AI_COMMIT_ANTHROPIC_API_KEY;
    return env?.trim() || undefined;
  }

  if (provider === "openai") {
    const env = process.env.OPENAI_API_KEY || process.env.AI_COMMIT_OPENAI_API_KEY;
    return env?.trim() || undefined;
  }

  if (provider === "kimi") {
    const env = process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY || process.env.AI_COMMIT_KIMI_API_KEY;
    return env?.trim() || undefined;
  }

  if (provider === "gemini") {
    const env = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.AI_COMMIT_GEMINI_API_KEY;
    return env?.trim() || undefined;
  }

  const env = process.env.DEEPSEEK_API_KEY || process.env.AI_COMMIT_DEEPSEEK_API_KEY;
  return env?.trim() || undefined;
}

async function setCommitInputBoxValue(repoRoot: string, value: string): Promise<void> {
  // Prefer the Git extension's per-repository input box so multi-repo workspaces get the right one.
  const repo = (await getGitApi())?.repositories.find(
    (r) => path.resolve(r.rootUri.fsPath) === path.resolve(repoRoot),
  );
  if (repo?.inputBox) {
    repo.inputBox.value = value;
    return;
  }

  const anyScm = vscode.scm as unknown as { inputBox?: { value: string } } | undefined;
  if (anyScm?.inputBox) {
    anyScm.inputBox.value = value;
    return;
  }

  throw new Error("Unable to find the Source Control commit message box for this repository.");
}

let outputChannel: vscode.OutputChannel | undefined;

function output(): vscode.OutputChannel {
  outputChannel ??= vscode.window.createOutputChannel("Davinci AI Smart Commiter");
  return outputChannel;
}

function log(message: string): void {
  output().appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
}
