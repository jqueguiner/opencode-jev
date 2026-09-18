import type { Plugin } from "@opencode-ai/plugin"
import { extractText, routePrompt, type RouterOptions } from "./route"

export type { RouterOptions, RouteResult } from "./route"
export { DEFAULT_CATALOG, blendPrice, type CatalogEntry, type TaskKind } from "./catalog"
export { selectModel, heuristicJudgment } from "./select"
export { routePrompt, extractText } from "./route"

/**
 * OpenCode plugin: before each user turn, ask TypeSafe Jev for task kind +
 * complexity, then set `message.model` to the cheapest fitting OpenRouter model.
 *
 * Requires `OPENROUTER_API_KEY` for inference and `TYPESAFE_API_KEY` for routing
 * (falls back to heuristics if TypeSafe is missing).
 *
 * opencode.json:
 * ```json
 * { "plugin": [["@opencode-ai/jev-router", { "enabled": true }]] }
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
