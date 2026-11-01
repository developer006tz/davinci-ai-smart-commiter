import * as vscode from "vscode";

export type ProviderName = "anthropic" | "openai" | "kimi" | "deepseek" | "gemini";
export type CommitStyle = "detailed" | "concise";

export function getConfig() {
  const cfg = vscode.workspace.getConfiguration("aiCommitAssistant");
  return {
    provider: cfg.get<ProviderName>("provider", "anthropic"),
    commitStyle: cfg.get<CommitStyle>("commitStyle", "detailed"),
    customInstructions: cfg.get<string>("customInstructions", ""),
    autoStage: cfg.get<boolean>("autoStage", true),
    temperature: cfg.get<number>("temperature", 0.2),
    maxTokens: cfg.get<number>("maxTokens", 1024),
    requestTimeoutSeconds: cfg.get<number>("requestTimeoutSeconds", 90),
    diffMaxChars: cfg.get<number>("diff.maxChars", 50000),
    contextMaxFiles: cfg.get<number>("context.maxFiles", 6),
    contextMaxChars: cfg.get<number>("context.maxChars", 12000),
    contextMaxCharsPerFile: cfg.get<number>("context.maxCharsPerFile", 4000),
    contextRecentCommits: cfg.get<number>("context.recentCommits", 10),
    anthropic: {
      model: cfg.get<string>("anthropic.model", "claude-haiku-5-5"),
      effort: cfg.get<string>("anthropic.effort", "low"),
      baseUrl: cfg.get<string>("anthropic.baseUrl", "https://api.anthropic.com"),
    },
    openai: {
      model: cfg.get<string>("openai.model", "gpt-6-luna"),
      effort: cfg.get<string>("openai.reasoningEffort", "medium"),
      baseUrl: cfg.get<string>("openai.baseUrl", "https://api.openai.com"),
    },
    kimi: {
      model: cfg.get<string>("kimi.model", "kimi-k3.1-pro"),
      effort: cfg.get<string>("kimi.reasoningEffort", "low"),
      baseUrl: cfg.get<string>("kimi.baseUrl", "https://api.moonshot.ai/v1"),
    },
    deepseek: {
      model: cfg.get<string>("deepseek.model", "deepseek-flash"),
      effort: cfg.get<string>("deepseek.reasoningEffort", "none"),
      baseUrl: cfg.get<string>("deepseek.baseUrl", "https://api.deepseek.com"),
    },
    gemini: {
      model: cfg.get<string>("gemini.model", "gemini-2.5-flash"),
      effort: "low",
      baseUrl: cfg.get<string>("gemini.baseUrl", "https://generativelanguage.googleapis.com/v1beta/openai"),
    },
  };
}

export type Config = ReturnType<typeof getConfig>;
