# Davinci AI Smart Commiter (VS Code Extension)

Generate Conventional Commits messages from your staged git diff using:

- Anthropic Claude (`claude-3-5-sonnet-20241022` by default)
- OpenAI (`gpt-3.5-turbo` by default)

## Usage

1. Make changes to your code.
2. Open Source Control.
3. Click the sparkle button in the Source Control toolbar (or run `Davinci AI Smart Commiter: Generate Commit Message`).
4. The extension will:
   - `git add -A` (if enabled)
   - read `git diff --cached` + `--numstat`
   - ask the configured provider for a Conventional Commits message
   - fill the Source Control commit message input box

## Setup

Set your API key (stored in VS Code Secret Storage):

- `Davinci AI Smart Commiter: Set Anthropic API Key`
- `Davinci AI Smart Commiter: Set OpenAI API Key`

Environment variable fallbacks:

- `ANTHROPIC_API_KEY` or `AI_COMMIT_ANTHROPIC_API_KEY`
- `OPENAI_API_KEY` or `AI_COMMIT_OPENAI_API_KEY`

## Configuration

See `Settings` -> `Davinci AI Smart Commiter`.

## Author

Ludovick Konyo (`developer@socialsmarttech.com`)
