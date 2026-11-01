# Davinci AI Smart Commiter (VS Code Extension)

Generate detailed Conventional Commits messages from your staged git diff, for example:

```text
feat(accounting): add export, lock date, and opening balances pages

- Implemented Export.vue for exporting accounting data with a dialog and table.
- Created LockDate.vue to manage the lock date for accounting entries, including form validation and error handling.
- Added OpeningBalances.vue for managing opening balances with a structured table and validation.
- Introduced new queries for handling export operations, including fetching companies and files.
- Updated routing to include new settings for export, lock date, and opening balances.
- Added tests for export functionality, including access control, validation, and job processing.

Refs: ACC-142
```

Supported providers:

- Anthropic Claude (`claude-haiku-4-5-20251001` by default)
- OpenAI (`gpt-4o-mini` by default)
- Kimi/Moonshot (`kimi-k2.6` by default)
- DeepSeek (`deepseek-v4-flash` by default)
- Google Gemini (`gemini-2.5-flash` by default)

## Usage

1. Make changes to your code.
2. Open Source Control.
3. Click the sparkle button in the Source Control toolbar (or run `Davinci AI Smart Commiter: Generate Commit Message`).
4. The extension will:
   - `git add -A` (if enabled)
   - list every staged file with its status (added/modified/deleted/renamed) and line counts
   - read the staged diff, skipping lock/minified/generated files; if the diff is too large, every file gets a fair share instead of the tail being cut off
   - read the most-changed modified files as surrounding context
   - read the branch name (issue keys such as `ACC-142` become a `Refs:` footer) and recent commit subjects (to reuse your scope names)
   - ask the configured provider for a Conventional Commits message
   - fill the Source Control commit message input box of the repository you clicked

Run `Davinci AI Smart Commiter: Show Log` to see what was sent (sizes only) and how long it took.

## Setup

Set your API key (stored in VS Code Secret Storage):

- `Davinci AI Smart Commiter: Setup Provider, Model, and API Key`
- `Davinci AI Smart Commiter: Set Anthropic API Key`
- `Davinci AI Smart Commiter: Set OpenAI API Key`
- `Davinci AI Smart Commiter: Set Kimi API Key`
- `Davinci AI Smart Commiter: Set DeepSeek API Key`
- `Davinci AI Smart Commiter: Set Gemini API Key`

Environment variable fallbacks:

- `ANTHROPIC_API_KEY` or `AI_COMMIT_ANTHROPIC_API_KEY`
- `OPENAI_API_KEY` or `AI_COMMIT_OPENAI_API_KEY`
- `MOONSHOT_API_KEY`, `KIMI_API_KEY`, or `AI_COMMIT_KIMI_API_KEY`
- `DEEPSEEK_API_KEY` or `AI_COMMIT_DEEPSEEK_API_KEY`
- `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `AI_COMMIT_GEMINI_API_KEY`

## Configuration

See `Settings` -> `Davinci AI Smart Commiter`.

Start with `Davinci AI Smart Commiter: Setup Provider, Model, and API Key`. In Settings, provider and model fields are dropdowns, so normal setup does not require typing model names manually. API keys are stored securely through the `Set ... API Key` commands instead of plain Settings JSON.

Kimi note: for `kimi-k2.6` and `kimi-k2.5`, the extension disables thinking mode when generating commit messages. Kimi enables thinking by default, which can consume the short commit-message token budget before returning final `content`.

DeepSeek note: for DeepSeek V4 models, the extension also disables thinking mode when generating commit messages. The commit workflow needs a final `content` value, not reasoning-only output.

Commit style:

- `aiCommitAssistant.commitStyle`: `detailed` (default; subject + bullet body) or `concise` (subject line only). Also available via `Davinci AI Smart Commiter: Select Commit Message Style`.
- `aiCommitAssistant.customInstructions`: extra rules, e.g. `Allowed scopes: api, web, accounting` or `Write bullets in imperative mood`.

Useful context settings:

- `aiCommitAssistant.diff.maxChars` (default 50000)
- `aiCommitAssistant.context.maxFiles`
- `aiCommitAssistant.context.maxChars`
- `aiCommitAssistant.context.maxCharsPerFile`
- `aiCommitAssistant.context.recentCommits` (default 10)
- `aiCommitAssistant.requestTimeoutSeconds` (default 90)

Model notes: Claude Opus 4.7+, Claude 5 models, OpenAI GPT-5/o-series and Kimi K2.5+ do not accept a custom `temperature`; the extension omits it and also adapts automatically if a provider rejects a parameter. Thinking/reasoning models (Claude 5, GPT-5, Gemini 2.5) run with low effort and at least 4096 output tokens.

## Author

Ludovick Konyo (`developer@socialsmarttech.com`)
