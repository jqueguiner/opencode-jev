# OpenCode + Jev (TypeSafe) model router

Personal fork of [anomalyco/opencode](https://github.com/anomalyco/opencode) that auto-selects an **OpenRouter** model per turn using **TypeSafe Jev**.

Repo: https://github.com/jqueguiner/opencode-jev

## Behavior

On each user message, the `@opencode-ai/jev-router` plugin:

1. Sends the prompt to TypeSafe System One (`jev-latest`)
2. Asks for **task kind** (`design` | `coding` | `reasoning` | `research` | `chat`) and **complexity** (0–4)
3. Picks from a curated OpenRouter catalog by:
   - optional **pins** via `defaultCodingModel` / `defaultDesignModel` / `defaults`
   - else preferred family: **design → OpenAI Astra**, **coding → GLM**
   - escalate capacity with complexity (highest `minComplexity` still ≤ score)
   - then cheapest blended price at that tier
4. Sets `message.model` to `{ providerID: "openrouter", modelID: "<slug>" }` for that turn

If `TYPESAFE_API_KEY` is missing, a local keyword heuristic is used instead.

## Default catalog (OpenRouter)

| Model | Roles | Min complexity | Notes |
| --- | --- | --- | --- |
| `z-ai/glm-5.3-flash` | coding, chat | 0 | Cheap coding |
| `z-ai/glm-5.2` | coding, chat | 1 | Mid GLM |
| `z-ai/glm-5.3` | coding, reasoning | 2 | Strong coding default |
| `openai/gpt-6-astra` | design (+ others) | 2 | Design default |
| `openai/gpt-6-astra-pro` | design, reasoning, research | 4 | Extreme design |
| plus DeepSeek / Qwen / Gemini / Kimi / Claude Sonnet as non-preferred fallbacks | | | |

Edit `packages/jev-router/src/catalog.ts` or pass `catalog` in plugin options.

## Setup

This fork enables the router in `.opencode/opencode.jsonc`:

```jsonc
{
  "model": "openrouter/z-ai/glm-5.3-flash",
  "provider": {
    "openrouter": {
      "options": { "apiKey": "{env:OPENROUTER_API_KEY}" }
    }
  },
  "plugin": [
    [
      "../packages/jev-router/src/index.ts",
      {
        "enabled": true,
        "force": true,
        "log": true,
        "typesafeApiKey": "{env:TYPESAFE_API_KEY}",
        "defaultCodingModel": "z-ai/glm-5.3",
        "defaultDesignModel": "openai/gpt-6-astra"
      }
    ]
  ]
}
```

OpenCode substitutes `{env:NAME}` when loading config. You can also paste a literal key, or use `{file:~/.config/typesafe/key}` if you keep secrets on disk.

```bash
export TYPESAFE_API_KEY=...
export OPENROUTER_API_KEY=...

bun install
bun run --cwd packages/jev-router test
bun run --cwd packages/opencode src/index.ts
```

In another project, copy the `provider` + `plugin` block from `examples/jev-router/opencode.json`.

## Plugin options

| Option | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Master switch |
| `typesafeApiKey` / `apiKey` | env `TYPESAFE_API_KEY` | TypeSafe key (use `{env:TYPESAFE_API_KEY}` in config) |
| `force` | `true` | Route even if current model is not OpenRouter |
| `log` | `true` | Print routing decisions to stderr |
| `heuristicFallback` | `true` | Keyword fallback without TypeSafe |
| `minKindConfidence` | `0.45` | Below this, blend in heuristic kind |
| `catalog` | built-in | Override model list |

## Syncing upstream

```bash
git remote add upstream https://github.com/anomalyco/opencode.git   # once
git fetch upstream
git merge upstream/dev
```
