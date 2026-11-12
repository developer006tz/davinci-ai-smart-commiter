# Davinci AI Smart Commiter (VS Code Extension)

Generate detailed Conventional Commits messages from your staged git diff, for example:

```text
feat(realtime): add a WebSocket engine for live updates

One socket per workspace per tab. Writes publish signals through
pg_notify inside their transaction, a LISTEN runner fans them out to
the connected tabs, and the browser refetches.

- Tickets: 30 s single use, stored as sha256, sent as a subprotocol,
  never in the URL
- Topics: user and account joined automatically, company topics
  authorized per module
- Notify runs in a savepoint, so a failed notify never aborts the write

Also fixes the admin workspace never running module install.

Refs: ACC-142
```

The message describes what the change does, not which files it touched. Before writing, the extension sorts the staged files into source, migrations, config, docs and tests and tells the model which areas changed. Docs and specs come first, because they explain why the change was made. Tests that come with a feature never become the commit type or its bullets. On a large diff, test files are reduced to their test names, and large source files to their declarations.

Supported providers:

| Provider | Default model | Default effort | Effort setting |
| --- | --- | --- | --- |
| Anthropic Claude | `claude-haiku-5-5` (Claude Haiku 5.5) | `low` | `aiCommitAssistant.anthropic.effort` |
| OpenAI | `gpt-6-luna` (GPT-6 Luna) | `medium` | `aiCommitAssistant.openai.reasoningEffort` |
| Kimi/Moonshot | `kimi-k3.1-pro` (Kimi K3.1 Pro) | `low` | `aiCommitAssistant.kimi.reasoningEffort` |
| DeepSeek | `deepseek-flash` (DeepSeek-V4.1-Flash-1017) | `none` (thinking off) | `aiCommitAssistant.deepseek.reasoningEffort` |
| Google Gemini | `gemini-2.5-flash` | `low` | — |

If you previously picked a model with the Setup command, that choice is kept; run `Davinci AI Smart Commiter: Select Default Model` to switch to the new defaults.

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

Kimi note: Kimi K3.1 Pro always thinks; the extension sends `reasoning_effort` (default `low`, the API's own default is `max`). For `kimi-k2.6` and `kimi-k2.5`, the extension disables thinking.

DeepSeek note: `deepseek-flash` is the official API name for DeepSeek-V4.1-Flash-1017. With `deepseek.reasoningEffort` = `none` the extension disables thinking; any other value enables thinking with that effort.

Commit style:

- `aiCommitAssistant.commitStyle`: `detailed` (default; subject, summary paragraph, key points) or `concise` (subject line only). Also available via `Davinci AI Smart Commiter: Select Commit Message Style`.
- `aiCommitAssistant.customInstructions`: extra rules, e.g. `Allowed scopes: api, web, accounting` or `Write bullets in imperative mood`.

Useful context settings:

- `aiCommitAssistant.diff.maxChars` (default 50000)
- `aiCommitAssistant.context.maxFiles`
- `aiCommitAssistant.context.maxChars`
- `aiCommitAssistant.context.maxCharsPerFile`
- `aiCommitAssistant.context.recentCommits` (default 10)
- `aiCommitAssistant.requestTimeoutSeconds` (default 90)

Model notes: Claude Opus 4.7+, Claude 5 models, OpenAI GPT-5/o-series and Kimi K2.5+ do not accept a custom `temperature`; the extension omits it and also adapts automatically if a provider rejects a parameter. Thinking/reasoning models get an output-token budget that scales with effort (low 4096, medium 8192, high 16384, higher 32000) so reasoning cannot crowd out the message.

## Author

Ludovick Konyo (`developer@socialsmarttech.com`)
