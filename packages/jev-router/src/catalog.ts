/** OpenRouter model catalog for Jev-driven routing. Prices are USD / 1M tokens. */

export type TaskKind = "design" | "coding" | "reasoning" | "research" | "chat"

export type CatalogEntry = {
  /** OpenRouter slug, e.g. `z-ai/glm-5.3` */
  modelID: string
  providerID: string
  /** Task kinds this model is allowed to serve */
  roles: TaskKind[]
  /** Minimum complexity score (0–4) before this model is considered */
  minComplexity: number
  inputPerMTok: number
  outputPerMTok: number
  /** Prefer this model when kind matches and complexity is met (before price) */
  preferredFor?: TaskKind[]
}

export const PROVIDER_ID = "openrouter"

/**
 * Curated OpenRouter list. Design prefers Astra; coding prefers GLM.
 * Selection filters by role + minComplexity, then prefers preferredFor, then cheapest blend.
 */
export const DEFAULT_CATALOG: CatalogEntry[] = [
  {
    modelID: "deepseek/deepseek-v4-flash-0731",
    providerID: PROVIDER_ID,
    roles: ["chat", "coding"],
    minComplexity: 0,
    inputPerMTok: 0.06,
    outputPerMTok: 0.12,
  },
  {
    modelID: "z-ai/glm-5.3-flash",
    providerID: PROVIDER_ID,
    roles: ["coding", "chat"],
    minComplexity: 0,
    inputPerMTok: 0.09,
    outputPerMTok: 0.3,
    preferredFor: ["coding"],
  },
  {
    modelID: "qwen/qwen3.8-flash",
    providerID: PROVIDER_ID,
    roles: ["chat", "coding"],
    minComplexity: 0,
    inputPerMTok: 0.15,
    outputPerMTok: 0.47,
  },
  {
    modelID: "z-ai/glm-5.2",
    providerID: PROVIDER_ID,
    roles: ["coding", "chat"],
    minComplexity: 1,
    inputPerMTok: 0.5614,
    outputPerMTok: 1.7644,
    preferredFor: ["coding"],
  },
  {
    modelID: "deepseek/deepseek-v4-pro-0813",
    providerID: PROVIDER_ID,
    roles: ["coding", "reasoning"],
    minComplexity: 2,
    inputPerMTok: 0.6587,
    outputPerMTok: 1.976,
  },
  {
    modelID: "moonshotai/kimi-k2.7-code",
    providerID: PROVIDER_ID,
    roles: ["coding"],
    minComplexity: 2,
    inputPerMTok: 0.7062,
    outputPerMTok: 3.21,
  },
  {
    modelID: "google/gemini-3.8-flash",
    providerID: PROVIDER_ID,
    roles: ["chat", "research", "reasoning"],
    minComplexity: 1,
    inputPerMTok: 0.75,
    outputPerMTok: 3.75,
  },
  {
    modelID: "z-ai/glm-5.3",
    providerID: PROVIDER_ID,
    roles: ["coding", "reasoning"],
    minComplexity: 2,
    inputPerMTok: 1.4,
    outputPerMTok: 4.4,
    preferredFor: ["coding"],
  },
  {
    modelID: "anthropic/claude-sonnet-5",
    providerID: PROVIDER_ID,
    roles: ["coding", "reasoning", "research"],
    minComplexity: 3,
    inputPerMTok: 2.0,
    outputPerMTok: 10.0,
  },
  {
    modelID: "openai/gpt-6-astra",
    providerID: PROVIDER_ID,
    roles: ["design", "reasoning", "research", "coding"],
    minComplexity: 2,
    inputPerMTok: 10.0,
    outputPerMTok: 50.0,
    preferredFor: ["design"],
  },
  {
    modelID: "openai/gpt-6-astra-pro",
    providerID: PROVIDER_ID,
    roles: ["design", "reasoning", "research"],
    minComplexity: 4,
    inputPerMTok: 10.0,
    outputPerMTok: 50.0,
    preferredFor: ["design"],
  },
]

/** Blended USD / 1M tokens assuming ~1:3 input:output mix for agent turns. */
export function blendPrice(entry: CatalogEntry): number {
  return entry.inputPerMTok * 0.25 + entry.outputPerMTok * 0.75
}
