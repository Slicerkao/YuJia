import { describe, expect, it } from "vitest";
import { copilotTurnDecisionSchema, copilotTurnInputSchema } from "../lib/copilot-domain";
import { applyCopilotDecision } from "../lib/copilot-engine";
import { createSeedWorkspace } from "../lib/copilot-seed";
import type { UsageStats } from "../lib/domain";

const stats: UsageStats = {
  mode: "mock", model: "test", inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, latencyMs: 1, toolCalls: [],
};

describe("Copilot V2 artifact boundaries", () => {
  it("allows a discussion to remain without a 料理草稿", () => {
    const workspace = createSeedWorkspace("2026-08-01T00:00:00.000Z");
    const turn = copilotTurnInputSchema.parse({ text: "市場看到青辣椒，先留著，不知道要做什麼", sessionId: "session_market", images: [], webSearchRequested: false });
    const decision = copilotTurnDecisionSchema.parse({
      reply: "先留在這裡。", sessionTitle: null, sessionTeaser: "一個市場觀察。", captureKind: "market_observation",
      interpretation: "Chef 留下一個未形成料理的觀察。", confidence: "confirmed", linkedDishId: null, draftUpdate: null,
    });
    const result = applyCopilotDecision({ workspace, turn, decision, stats, createId: () => "x" });
    expect(result.workspace.sessions.find((item) => item.id === "session_market")?.draft).toBeNull();
    expect(result.workspace.captures.at(-1)?.kind).toBe("market_observation");
  });

  it("updates a session-local draft without committing a dish", () => {
    const workspace = createSeedWorkspace("2026-08-01T00:00:00.000Z");
    const originalDishes = structuredClone(workspace.dishes);
    const turn = copilotTurnInputSchema.parse({ text: "絲瓜想先煎出焦香", sessionId: "session_loofah", images: [], webSearchRequested: false });
    const decision = copilotTurnDecisionSchema.parse({
      reply: "先放進草稿。", sessionTitle: null, sessionTeaser: "替絲瓜增加焦香。", captureKind: "brainstorm",
      interpretation: "Chef 想調整絲瓜的技法。", confidence: "confirmed", linkedDishId: "dish_clam_loofah",
      draftUpdate: {
        workingTitle: "炙燒絲瓜蛤蜊", relationship: "existing_variation", readiness: "forming",
        claims: [{ kind: "technique", text: "絲瓜先煎出焦香。", sourceType: "user_message", sourceLabel: "你說的", confidence: "confirmed" }],
      },
    });
    let n = 0;
    const result = applyCopilotDecision({ workspace, turn, decision, stats, createId: () => String(++n) });
    expect(result.workspace.sessions.find((item) => item.id === "session_loofah")?.draft?.claims[0].confirmation).toBe("confirmed");
    expect(result.workspace.dishes).toEqual(originalDishes);
  });

  it("rejects turns with neither text nor images", () => {
    expect(() => copilotTurnInputSchema.parse({ text: "", sessionId: "session_loofah", images: [], webSearchRequested: false })).toThrow();
  });
});
