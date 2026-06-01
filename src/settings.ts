import * as vscode from "vscode";

export type ProviderName = "anthropic" | "openai" | "kimi" | "deepseek" | "gemini";

export function getConfig() {
  const cfg = vscode.workspace.getConfiguration("aiCommitAssistant");
  return {
    provider: cfg.get<ProviderName>("provider", "anthropic"),
    autoStage: cfg.get<boolean>("autoStage", true),
    temperature: cfg.get<number>("temperature", 0.2),
    maxTokens: cfg.get<number>("maxTokens", 360),
    diffMaxChars: cfg.get<number>("diff.maxChars", 35000),
    contextMaxFiles: cfg.get<number>("context.maxFiles", 6),
    contextMaxChars: cfg.get<number>("context.maxChars", 12000),
    contextMaxCharsPerFile: cfg.get<number>("context.maxCharsPerFile", 4000),
    anthropic: {
      model: cfg.get<string>("anthropic.model", "claude-3-haiku-20240307"),
      baseUrl: cfg.get<string>("anthropic.baseUrl", "https://api.anthropic.com"),
    },
    openai: {
      model: cfg.get<string>("openai.model", "gpt-4o-mini"),
      baseUrl: cfg.get<string>("openai.baseUrl", "https://api.openai.com"),
    },
    kimi: {
      model: cfg.get<string>("kimi.model", "kimi-k2.6"),
      baseUrl: cfg.get<string>("kimi.baseUrl", "https://api.moonshot.ai/v1"),
    },
    deepseek: {
      model: cfg.get<string>("deepseek.model", "deepseek-v4-flash"),
      baseUrl: cfg.get<string>("deepseek.baseUrl", "https://api.deepseek.com"),
    },
    gemini: {
      model: cfg.get<string>("gemini.model", "gemini-2.5-flash"),
      baseUrl: cfg.get<string>("gemini.baseUrl", "https://generativelanguage.googleapis.com/v1beta/openai"),
    },
  };
}
