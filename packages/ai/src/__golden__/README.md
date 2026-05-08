# Golden Files

This directory holds recorded API responses for live-replay integration tests.

The golden files were originally recorded against the Anthropic Messages API (tool-use format) and have been removed as part of the DeepSeek migration. The unit tests in `structure-experience.test.ts` now use inline synthetic JSON mocks instead.

## Regenerating golden files

Once a real `DEEPSEEK_API_KEY` is available, regenerate golden files by running the live test suite:

```bash
LIVE_API=true pnpm --filter @solo-compass/ai test:live
```

The live tests should record new golden files in OpenAI-compatible format (matching the DeepSeek client response shape).
