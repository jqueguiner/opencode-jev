import type { Plugin } from "@opencode-ai/plugin"
import { extractText, routePrompt, type RouterOptions } from "./route"

export type { RouterOptions, RouteResult } from "./route"
export { DEFAULT_CATALOG, blendPrice, type CatalogEntry, type TaskKind } from "./catalog"
export { selectModel, heuristicJudgment, normalizeModelID } from "./select"
export { routePrompt, extractText } from "./route"

/**
 * OpenCode plugin: before each user turn, ask TypeSafe Jev for task kind +
 * complexity, then set `message.model` to the cheapest fitting OpenRouter model.
 *
 * Requires OpenRouter for inference and TypeSafe for routing. Keys can live in
 * opencode.json (with `{env:...}` substitution) or the process environment.
 *
 * opencode.json:
 * ```json
 * {
 *   "provider": { "openrouter": { "options": { "apiKey": "{env:OPENROUTER_API_KEY}" } } },
 *   "plugin": [["@opencode-ai/jev-router", {
 *     "enabled": true,
 *     "typesafeApiKey": "{env:TYPESAFE_API_KEY}",
 *     "defaultCodingModel": "z-ai/glm-5.3",
 *     "defaultDesignModel": "openai/gpt-6-astra"
 *   }]]
 * }
 * ```
 */
const plugin: Plugin = async (_input, options: RouterOptions = {}) => {
  const enabled = options.enabled !== false
  const log = options.log !== false

  return {
    "chat.message": async (input, output) => {
      if (!enabled) return

      if (options.force === false && input.model && input.model.providerID !== "openrouter") {
        return
      }

      const prompt = extractText(output.parts as Array<{ type: string; text?: string; synthetic?: boolean }>)
      if (!prompt) return

      try {
        const routed = await routePrompt(prompt, options)
        if (!routed) return

        output.message.model = {
          providerID: routed.providerID,
          modelID: routed.modelID,
        }

        if (log) {
          console.error(
            `[jev-router] ${routed.source} kind=${routed.judgment.kind}(${routed.judgment.kindConfidence.toFixed(2)}) ` +
              `complexity=${routed.judgment.complexity.toFixed(2)} → ${routed.providerID}/${routed.modelID} (${routed.reason})`,
          )
        }
      } catch (err) {
        if (log) {
          console.error(`[jev-router] skipped: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    },
  }
}

export default plugin
