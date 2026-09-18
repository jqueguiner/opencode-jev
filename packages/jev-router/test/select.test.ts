import { describe, expect, test } from "bun:test"
import { DEFAULT_CATALOG, blendPrice } from "../src/catalog"
import { heuristicJudgment, selectModel } from "../src/select"
import { parseJudgment, resolveApiKey } from "../src/typesafe"
import { extractText } from "../src/route"

describe("selectModel", () => {
  test("design prefers Astra over cheaper coding models", () => {
    const result = selectModel(DEFAULT_CATALOG, {
      kind: "design",
      kindConfidence: 0.9,
      complexity: 3,
      complexityConfidence: 0.8,
    })
    expect(result?.entry.modelID).toBe("openai/gpt-6-astra")
  })

  test("coding escalates GLM tier with complexity then picks cheapest at that floor", () => {
    // No coding pin — auto path among preferred GLM family
    const simple = selectModel(DEFAULT_CATALOG, {
      kind: "coding",
      kindConfidence: 0.9,
      complexity: 0.5,
      complexityConfidence: 0.8,
    })
    // preferred coding includes opus (min 0) — max floor at 0.5 is 0 → cheapest among floor 0 preferred
    // preferred with minComplexity 0: glm-5.3-flash and opus-4.7 → cheapest is flash
    expect(simple?.entry.modelID).toBe("z-ai/glm-5.3-flash")

    const medium = selectModel(DEFAULT_CATALOG, {
      kind: "coding",
      kindConfidence: 0.9,
      complexity: 1.2,
      complexityConfidence: 0.8,
    })
    expect(medium?.entry.modelID).toBe("z-ai/glm-5.2")

    const hard = selectModel(DEFAULT_CATALOG, {
      kind: "coding",
      kindConfidence: 0.9,
      complexity: 2.5,
      complexityConfidence: 0.8,
    })
    expect(hard?.entry.modelID).toBe("z-ai/glm-5.3")
  })

  test("defaultCodingModel pins coding to opus 4.7", () => {
    const result = selectModel(
      DEFAULT_CATALOG,
      {
        kind: "coding",
        kindConfidence: 0.9,
        complexity: 1,
        complexityConfidence: 0.8,
      },
      { defaults: { coding: "anthropic/claude-opus-4.7" } },
    )
    expect(result?.entry.modelID).toBe("anthropic/claude-opus-4.7")
    expect(result?.reason).toContain("default pin")
  })

  test("defaultCodingModel accepts openrouter/ prefix", () => {
    const result = selectModel(
      DEFAULT_CATALOG,
      {
        kind: "coding",
        kindConfidence: 0.9,
        complexity: 2.5,
        complexityConfidence: 0.8,
      },
      { defaults: { coding: "openrouter/anthropic/claude-opus-4.7" } },
    )
    expect(result?.entry.modelID).toBe("anthropic/claude-opus-4.7")
  })

  test("extreme design prefers astra-pro when complexity requires it", () => {
    const result = selectModel(DEFAULT_CATALOG, {
      kind: "design",
      kindConfidence: 0.95,
      complexity: 4,
      complexityConfidence: 0.9,
    })
    expect(result?.entry.modelID).toBe("openai/gpt-6-astra-pro")
  })
})

describe("heuristicJudgment", () => {
  test("detects design prompts", () => {
    expect(heuristicJudgment("Redesign the landing page hero and typography").kind).toBe("design")
  })

  test("detects coding prompts", () => {
    expect(heuristicJudgment("Fix the TypeScript compile error in route.ts").kind).toBe("coding")
  })
})

describe("parseJudgment", () => {
  test("reads choice + score answers", () => {
    const j = parseJudgment({
      answers: {
        kind: { type: "choice", choice: "design", confidence: 0.88 },
        complexity: { type: "score", score: 3.2, confidence: 0.7 },
      },
    })
    expect(j.kind).toBe("design")
    expect(j.complexity).toBe(3.2)
    expect(j.kindConfidence).toBe(0.88)
  })
})

describe("resolveApiKey", () => {
  test("prefers explicit config key over env", () => {
    expect(resolveApiKey("from-config", { TYPESAFE_API_KEY: "from-env" })).toBe("from-config")
    expect(resolveApiKey(undefined, { TYPESAFE_API_KEY: "from-env" })).toBe("from-env")
    expect(resolveApiKey("  ", {})).toBeUndefined()
  })
})

describe("extractText", () => {
  test("joins non-synthetic text parts", () => {
    expect(
      extractText([
        { type: "text", text: "Hello" },
        { type: "text", text: "ignore", synthetic: true },
        { type: "file" },
        { type: "text", text: "world" },
      ]),
    ).toBe("Hello\nworld")
  })
})
