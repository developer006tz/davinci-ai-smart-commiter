import * as vscode from "vscode";
import * as path from "node:path";
import { getRepoRoot, gitAddAll, gitDiffCached, gitDiffNumstat } from "./git";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import { generateCommitMessage } from "./providers";
import { getConfig, type ProviderName } from "./settings";

const SECRET_KEYS = {
  anthropic: "aiCommitAssistant.anthropicApiKey",
  openai: "aiCommitAssistant.openaiApiKey",
  kimi: "aiCommitAssistant.kimiApiKey",
  deepseek: "aiCommitAssistant.deepseekApiKey",
} as const;

const PROVIDER_LABELS: Record<ProviderName, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  kimi: "Kimi",
  deepseek: "DeepSeek",
};

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
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
    vscode.commands.registerCommand("aiCommitAssistant.generateCommitMessage", async () => {
      await generate(context);
    }),
  );
}

export function deactivate() {}

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

async function generate(context: vscode.ExtensionContext) {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    vscode.window.showErrorMessage("Davinci AI Smart Commiter: Open a workspace folder first.");
    return;
  }

  const config = getConfig();

  const repoRoot = await getRepoRoot(folder.uri.fsPath);
  if (!repoRoot) {
    vscode.window.showErrorMessage("Davinci AI Smart Commiter: This workspace is not a git repository.");
    return;
  }

  const provider = config.provider;
  const apiKey = await resolveApiKey(context, provider);
  if (!apiKey) {
    const msg = `Davinci AI Smart Commiter: Missing ${PROVIDER_LABELS[provider]} API key. Run “Davinci AI Smart Commiter: Set ${PROVIDER_LABELS[provider]} API Key”.`;
    vscode.window.showErrorMessage(msg);
    return;
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.SourceControl, title: "Davinci AI Smart Commiter", cancellable: false },
    async () => {
      try {
        if (config.autoStage) {
          await gitAddAll(repoRoot);
        }

        const numstat = await gitDiffNumstat(repoRoot);
        const diff = await gitDiffCached(repoRoot, config.diffMaxChars);
        if (!diff.trim()) {
          vscode.window.showInformationMessage("Davinci AI Smart Commiter: No staged changes found.");
          return;
        }

        const prompt = buildUserPrompt({ numstat, diff });

        const message = await generateCommitMessage(provider, {
          apiKey,
          baseUrl: getProviderConfig(config, provider).baseUrl,
          model: getProviderConfig(config, provider).model,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          system: SYSTEM_PROMPT,
          user: prompt,
        });

        let cleaned = message.trim().replace(/\s+/g, " ");
        // Some models wrap the answer in quotes; strip a single pair if present.
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
          cleaned = cleaned.slice(1, -1).trim();
        }
        if (!cleaned) {
          vscode.window.showErrorMessage("Davinci AI Smart Commiter: Provider returned an empty commit message.");
          return;
        }

        // Fill the Source Control commit message input.
        await setCommitInputBoxValue(repoRoot, cleaned);
        vscode.window.showInformationMessage("Davinci AI Smart Commiter: Commit message generated.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Davinci AI Smart Commiter: ${msg}`);
      }
    },
  );
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

  const env = process.env.DEEPSEEK_API_KEY || process.env.AI_COMMIT_DEEPSEEK_API_KEY;
  return env?.trim() || undefined;
}

function getProviderConfig(
  config: ReturnType<typeof getConfig>,
  provider: ProviderName,
): { model: string; baseUrl: string } {
  return config[provider];
}

type GitExtensionApi = {
  repositories: Array<{
    rootUri: vscode.Uri;
    inputBox: { value: string };
  }>;
};

async function setCommitInputBoxValue(repoRoot: string, value: string): Promise<void> {
  // Prefer the global SCM input box when available.
  const anyScm = vscode.scm as unknown as { inputBox?: { value: string } } | undefined;
  if (anyScm?.inputBox) {
    anyScm.inputBox.value = value;
    return;
  }

  // Fallback: use the built-in Git extension API (per-repository input box).
  const gitExt = vscode.extensions.getExtension("vscode.git");
  if (!gitExt) {
    throw new Error("Unable to access VS Code Git extension to set the commit message.");
  }
  if (!gitExt.isActive) {
    await gitExt.activate();
  }

  const api = (gitExt.exports as { getAPI?: (version: number) => GitExtensionApi }).getAPI?.(1);
  const repo = api?.repositories?.find((r) => path.resolve(r.rootUri.fsPath) === path.resolve(repoRoot));
  if (!repo?.inputBox) {
    throw new Error("Unable to find an active Git repository input box to set the commit message.");
  }

  repo.inputBox.value = value;
}
