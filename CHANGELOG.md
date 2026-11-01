# Changelog

## 0.0.9

- New default models:
  - Anthropic: `claude-haiku-5-5` (Claude Haiku 5.5) with `low` effort.
  - OpenAI: `gpt-6-luna` (GPT-6 Luna) with `medium` reasoning effort.
  - DeepSeek: `deepseek-flash` (DeepSeek-V4.1-Flash-1017), thinking off by default. `deepseek-v4-flash` is retired upstream and kept as a legacy option; `deepseek-chat`/`deepseek-reasoner` were removed.
  - Kimi: `kimi-k3.1-pro` (Kimi K3.1 Pro) with `low` reasoning effort; `kimi-k3.1-pro-highspeed` added.
- New effort settings: `anthropic.effort`, `openai.reasoningEffort`, `kimi.reasoningEffort`, `deepseek.reasoningEffort`.
- The output-token budget grows with the effort level so reasoning cannot crowd out the message.
- Kimi K3+ never receives a `thinking` parameter (unsupported) and uses `max_completion_tokens`.
- Requests self-heal in both directions between `max_tokens` and `max_completion_tokens`.

## 0.0.8

- **Detailed commit messages**: new `commitStyle` setting (default `detailed`) produces a Conventional Commits subject plus a bulleted body covering every meaningful change. `concise` keeps the old one-line behavior.
- Fix: newlines in the model output were collapsed into a single line, which destroyed any commit body.
- Fix: large diffs were cut off at the end, so later files were invisible to the model. Every file now gets a fair share of the diff budget, and lock files, minified files, source maps and snapshots are excluded from the diff.
- Send the full list of changed files with status (added/modified/deleted/renamed) and line counts so nothing is missed.
- Send the branch name, an issue key detected from it (e.g. `ACC-142` -> `Refs:` footer), and recent commit subjects so scopes match the repository's conventions.
- Surrounding file context now focuses on the most-changed modified files (added files are already fully in the diff).
- New `customInstructions` setting for project-specific rules.
- Fix: the Source Control button now targets the repository it was clicked in (multi-repo workspaces); otherwise the active editor's repository or a picker is used.
- Fix: user git config (`color.ui=always`, `diff.noprefix`, external diff tools) no longer corrupts the diff.
- Fix: Claude Opus 4.7+ and OpenAI GPT-5/o-series requests failed because of unsupported `temperature`/`max_tokens` parameters. Requests now adapt automatically when a provider rejects a parameter.
- Add Claude Haiku 5.5, Sonnet 5.5 and Opus 5.5 models (low effort, thinking-aware token budget).
- Gemini 2.5 and OpenAI reasoning models get a larger token budget and low reasoning effort so thinking cannot consume the whole answer.
- Requests now time out (`requestTimeoutSeconds`, default 90s) and retry on rate limits / server errors.
- Warn when output hits the token limit and drop the incomplete last line.
- New `Show Log` output channel and `Select Commit Message Style` command; missing-API-key errors offer a `Set API Key` button.
- Default `maxTokens` raised to 1024 and `diff.maxChars` to 50000.

## 0.0.7

- Fix DeepSeek V4 commit generation by disabling thinking mode for short commit-message requests.
- Document DeepSeek thinking-mode behavior in settings and README.

## 0.0.6

- Add DOM lib typings so VS Code resolves the global `fetch` API in provider code.

## 0.0.5

- Fix Kimi K2.6/K2.5 commit generation by disabling thinking mode for short commit-message requests.
- Stop sending custom temperature for Kimi K2.6/K2.5 because those models use fixed values.
- Refresh Kimi model dropdown to current supported models and remove deprecated K2 entries.
- Improve OpenAI-compatible provider errors when a response has no final message content.

## 0.0.4

- Add setup commands for selecting provider, model, and API key from VS Code quick picks.
- Convert provider model settings from free text inputs to dropdown selections.
- Refresh default Anthropic model to `claude-haiku-4-5-20251001`.

## 0.0.3

- Improve Settings UI ordering, labels, and descriptions for easier provider setup.
- Update OpenAI default model to `gpt-4o-mini` and default max tokens to `360`.

## 0.0.2

- Add Kimi/Moonshot, DeepSeek, and Google Gemini provider integrations.
- Include staged source/config file context so generated commit messages better capture change intent.

## 0.0.1

- Initial implementation: stage all, read staged diff, call Claude/OpenAI, fill SCM input.
- Add Kimi/Moonshot and DeepSeek provider integrations.
- Add Google Gemini provider integration.
- Include staged source/config file context so generated commit messages better capture change intent.
