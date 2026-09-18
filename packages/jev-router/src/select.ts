import { blendPrice, type CatalogEntry, type TaskKind } from "./catalog"

export type Judgment = {
  kind: TaskKind
  kindConfidence: number
  /** 0 trivial … 4 extreme */
  complexity: number
  complexityConfidence: number
}

export type Selection = {
  entry: CatalogEntry
  reason: string
}

const KIND_FALLBACK: TaskKind = "coding"

/**
 * Pick an OpenRouter model for a Jev judgment.
 *
 * 1. Prefer the kind's preferred family (design→Astra, coding→GLM) when any
 *    member meets complexity.
 * 2. Within that pool, take the highest minComplexity still ≤ judgment
 *    (escalate capacity with difficulty), then the cheapest blend price.
 * 3. If no preferred models qualify, repeat over all role-eligible models.
 */
export function selectModel(catalog: CatalogEntry[], judgment: Judgment): Selection | undefined {
  const kind = judgment.kind
  const complexity = clamp(judgment.complexity, 0, 4)

  const byRole = catalog.filter((e) => e.roles.includes(kind) && e.minComplexity <= complexity)
  const preferred = byRole.filter((e) => e.preferredFor?.includes(kind))
  const pool = preferred.length > 0 ? preferred : byRole

  if (pool.length === 0) {
    const any = catalog
      .filter((e) => e.minComplexity <= complexity)
      .sort((a, b) => blendPrice(a) - blendPrice(b))
    if (any.length === 0) return undefined
    return {
      entry: any[0]!,
      reason: `no ${kind} models at complexity ${complexity}; fell back to cheapest eligible`,
    }
  }

  const maxFloor = Math.max(...pool.map((e) => e.minComplexity))
  const tier = pool.filter((e) => e.minComplexity === maxFloor)
  const sorted = [...tier].sort((a, b) => {
    const price = blendPrice(a) - blendPrice(b)
    if (price !== 0) return price
    return a.modelID.localeCompare(b.modelID)
  })
  const entry = sorted[0]!
  return {
    entry,
    reason: preferred.length
      ? `kind=${kind} complexity=${complexity.toFixed(2)} preferred tier=${maxFloor} cheapest → ${entry.modelID}`
      : `kind=${kind} complexity=${complexity.toFixed(2)} tier=${maxFloor} cheapest → ${entry.modelID}`,
  }
}

export function heuristicJudgment(prompt: string): Judgment {
  const text = prompt.toLowerCase()
  const design =
    /\b(ui|ux|design|layout|visual|brand|typography|css|tailwind|figma|palette|hero|landing)\b/.test(
      text,
    )
  const research = /\b(research|compare|benchmark|explain|summariz|investigate|docs)\b/.test(text)
  const reasoning = /\b(architect|trade-?off|plan|design system|migrate|refactor multi)\b/.test(text)
  const coding =
    /\b(fix|bug|implement|code|function|typescript|python|api|test|compile|error|pr)\b/.test(text)

  let kind: TaskKind = KIND_FALLBACK
  if (design) kind = "design"
  else if (reasoning) kind = "reasoning"
  else if (research) kind = "research"
  else if (coding) kind = "coding"
  else kind = "chat"

  let complexity = 1
  if (text.length > 2000 || /\b(multi-?file|codebase|migrate|production|security)\b/.test(text))
    complexity = 3
  else if (text.length > 400 || /\b(refactor|architect|debug|integrate)\b/.test(text)) complexity = 2
  else if (text.length < 80 && /\b(typo|rename|what is|hello)\b/.test(text)) complexity = 0

  return { kind, kindConfidence: 0.4, complexity, complexityConfidence: 0.4 }
}

function clamp(n: number, min: number, max: number) {
  if (Number.isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}
