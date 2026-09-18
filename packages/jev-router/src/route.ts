import { DEFAULT_CATALOG, type CatalogEntry } from "./catalog"
import { heuristicJudgment, selectModel, type Judgment } from "./select"
import { judgePrompt, resolveApiKey } from "./typesafe"

export type RouterOptions = {
  /** When false, plugin is a no-op. Default true. */
  enabled?: boolean
  /** TypeSafe API key. Prefer `{env:TYPESAFE_API_KEY}` in opencode.json. */
  typesafeApiKey?: string
  /** Alias for `typesafeApiKey`. */
  apiKey?: string
  /** Override default OpenRouter catalog. */
  catalog?: CatalogEntry[]
  /** If true (default), always route. If false, skip when user already set a non-openrouter model. */
  force?: boolean
  /** Minimum kind confidence to trust Jev; below this, use heuristic kind. Default 0.45 */
  minKindConfidence?: number
  /** Log routing decisions to stderr. Default true. */
  log?: boolean
  /** Allow heuristic fallback when TypeSafe is unavailable. Default true. */
  heuristicFallback?: boolean
}

export type RouteResult = {
  providerID: string
  modelID: string
  judgment: Judgment
  reason: string
  source: "jev" | "heuristic"
}

export async function routePrompt(prompt: string, options: RouterOptions = {}): Promise<RouteResult | undefined> {
  const catalog = options.catalog ?? DEFAULT_CATALOG
  const apiKey = resolveApiKey(options.typesafeApiKey ?? options.apiKey)
  let judgment: Judgment
  let source: "jev" | "heuristic"

  if (apiKey) {
    try {
      judgment = await judgePrompt(prompt, { apiKey })
      source = "jev"
      const minConf = options.minKindConfidence ?? 0.45
      if (judgment.kindConfidence < minConf) {
        const heuristic = heuristicJudgment(prompt)
        judgment = {
          ...judgment,
          kind: heuristic.kind,
          kindConfidence: Math.max(judgment.kindConfidence, heuristic.kindConfidence),
        }
      }
    } catch (err) {
      if (options.heuristicFallback === false) throw err
      judgment = heuristicJudgment(prompt)
      source = "heuristic"
    }
  } else if (options.heuristicFallback !== false) {
    judgment = heuristicJudgment(prompt)
    source = "heuristic"
  } else {
    return undefined
  }

  const selected = selectModel(catalog, judgment)
  if (!selected) return undefined

  return {
    providerID: selected.entry.providerID,
    modelID: selected.entry.modelID,
    judgment,
    reason: selected.reason,
    source,
  }
}

export function extractText(parts: Array<{ type: string; text?: string; synthetic?: boolean }>): string {
  return parts
    .filter((p) => p.type === "text" && !p.synthetic && typeof p.text === "string")
    .map((p) => p.text!)
    .join("\n")
    .trim()
}
