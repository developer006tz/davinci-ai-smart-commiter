import * as vscode from "vscode";
import * as path from "node:path";
import { getRepoRoot, gitAddAll, gitDiffCached, gitDiffNumstat, gitStagedFileContext } from "./git";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
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
    vscode.commands.registerCommand("aiCommitAssistant.generateCommitMessage", async () => {
      await generate(context);
    }),
  );
}

export function deactivate() {}

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
        const fileContext = await gitStagedFileContext(repoRoot, {
          maxFiles: config.contextMaxFiles,
          maxChars: config.contextMaxChars,
          maxCharsPerFile: config.contextMaxCharsPerFile,
        });

        const prompt = buildUserPrompt({ numstat, diff, fileContext });

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

  if (provider === "gemini") {
    const env = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.AI_COMMIT_GEMINI_API_KEY;
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
