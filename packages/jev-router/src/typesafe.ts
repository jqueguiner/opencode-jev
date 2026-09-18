import type { Judgment } from "./select"
import type { TaskKind } from "./catalog"

const ENDPOINT = "https://api.typesafe.ai/v1/systemone"
const MODEL = "jev-latest"

export type TypeSafeConfig = {
  apiKey: string
  endpoint?: string
  model?: string
  timeoutMs?: number
}

type ChoiceAnswer = {
  type: "choice"
  choice: string
  confidence?: number
}

type ScoreAnswer = {
  type: "score"
  score: number
  confidence?: number
}

type SystemOneResponse = {
  model?: string
  answers?: Record<string, ChoiceAnswer | ScoreAnswer | { type: string }>
}

const KIND_CRITERIA: Record<TaskKind, string> = {
  design:
    "UI/UX, visual design, layout, branding, CSS/Tailwind styling, landing pages, design systems aesthetics",
  coding: "Writing, fixing, refactoring, or testing application code and engineering implementation",
  reasoning: "Architecture, trade-offs, multi-step planning, complex debugging strategy",
  research: "Looking up, comparing, summarizing, or investigating information without primarily editing code",
  chat: "Casual conversation, clarifications, or short questions that need little specialized capability",
}

/**
 * Ask Jev for task kind + complexity in one System One call.
 */
export async function judgePrompt(prompt: string, config: TypeSafeConfig): Promise<Judgment> {
  const body = {
    state: {
      user_prompt: prompt.slice(0, 12_000),
    },
    model: config.model ?? MODEL,
    questions: {
      kind: {
        type: "choice",
        instructions:
          "What is the primary kind of work this OpenCode agent turn needs? Pick the single best fit for model routing.",
        criteria: KIND_CRITERIA,
      },
      complexity: {
        type: "score",
        instructions:
          "How demanding is this turn for an AI coding agent? Higher means harder reasoning, larger scope, or riskier edits.",
        criteria: [
          "Trivial one-liner or typo; any cheap model is fine",
          "Simple local change or short answer",
          "Moderate multi-step coding or design work",
          "Hard: multi-file, subtle bugs, architecture, or careful UX",
          "Extreme: large migration, deep research+design, or high-stakes reasoning",
        ],
      },
    },
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 20_000)
  try {
    const res = await fetch(config.endpoint ?? ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`TypeSafe HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
    const json = (await res.json()) as SystemOneResponse
    return parseJudgment(json)
  } finally {
    clearTimeout(timeout)
  }
}

export function parseJudgment(json: SystemOneResponse): Judgment {
  const kindAns = json.answers?.kind
  const complexityAns = json.answers?.complexity

  let kind: TaskKind = "coding"
  let kindConfidence = 0
  if (kindAns && kindAns.type === "choice") {
    const choice = (kindAns as ChoiceAnswer).choice
    if (isTaskKind(choice)) kind = choice
    kindConfidence = (kindAns as ChoiceAnswer).confidence ?? 0
  }

  let complexity = 2
  let complexityConfidence = 0
  if (complexityAns && complexityAns.type === "score") {
    complexity = (complexityAns as ScoreAnswer).score
    complexityConfidence = (complexityAns as ScoreAnswer).confidence ?? 0
  }

  return { kind, kindConfidence, complexity, complexityConfidence }
}

function isTaskKind(value: string): value is TaskKind {
  return value === "design" || value === "coding" || value === "reasoning" || value === "research" || value === "chat"
}

export function resolveApiKey(
  explicit?: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const fromOption = explicit?.trim()
  if (fromOption) return fromOption
  const key = env.TYPESAFE_API_KEY?.trim()
  return key || undefined
}
