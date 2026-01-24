import * as vscode from "vscode";

export type ProviderName = "anthropic" | "openai";

export function getConfig() {
  const cfg = vscode.workspace.getConfiguration("aiCommitAssistant");
  return {
    provider: cfg.get<ProviderName>("provider", "anthropic"),
    autoStage: cfg.get<boolean>("autoStage", true),
    temperature: cfg.get<number>("temperature", 0.2),
    maxTokens: cfg.get<number>("maxTokens", 200),
    diffMaxChars: cfg.get<number>("diff.maxChars", 35000),
    anthropic: {
      model: cfg.get<string>("anthropic.model", "claude-3-5-sonnet-20241022"),
      baseUrl: cfg.get<string>("anthropic.baseUrl", "https://api.anthropic.com"),
    },
    openai: {
      model: cfg.get<string>("openai.model", "gpt-3.5-turbo"),
      baseUrl: cfg.get<string>("openai.baseUrl", "https://api.openai.com"),
    },
  };
}

