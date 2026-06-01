# Changelog

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
