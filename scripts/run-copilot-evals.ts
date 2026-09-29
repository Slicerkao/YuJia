import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { copilotTurnDecisionSchema, copilotTurnInputSchema, type CopilotWorkspace } from "../lib/copilot-domain";
import { applyCopilotDecision } from "../lib/copilot-engine";
import { createSeedWorkspace } from "../lib/copilot-seed";

async function main() {

const scenarios = [
  { id: "observation_only", text: "市場看到很香的青辣椒，先留著，還不知道要做什麼", webSearchRequested: false, expectDraft: false },
  { id: "dish_direction", text: "我想拿青辣椒跟雞腿做成香但不太辣的家常菜", webSearchRequested: false, expectDraft: true },
  { id: "continue_direction", text: "雞腿先煎香，辣椒後下，我想保留它的青香", webSearchRequested: false, expectDraft: true },
] as const;

let workspace: CopilotWorkspace = createSeedWorkspace("2026-08-29T00:00:00.000Z");
const results = [];
for (const scenario of scenarios) {
  const turn = copilotTurnInputSchema.parse({ text: scenario.text, sessionId: "session_market", images: [], webSearchRequested: scenario.webSearchRequested });
  const decision = copilotTurnDecisionSchema.parse({
    reply: scenario.expectDraft ? "我先把方向放進料理草稿。" : "先留在討論裡，不替它硬湊成一道菜。",
    sessionTitle: scenario.expectDraft ? "青辣椒雞腿的家常方向" : null,
    sessionTeaser: scenario.text,
    captureKind: scenario.expectDraft ? "brainstorm" : "market_observation",
    interpretation: scenario.expectDraft ? "Chef 正在形成一道菜。" : "Chef 只是在留下市場觀察。",
    confidence: "confirmed",
    linkedDishId: null,
    draftUpdate: scenario.expectDraft ? {
      workingTitle: "青辣椒香煎雞腿",
      relationship: "new_idea",
      readiness: scenario.id === "continue_direction" ? "forming" : "loose",
      claims: [{ kind: "sensory_target", text: "保留青辣椒香氣但降低辣感。", sourceType: "user_message", sourceLabel: "你說的", confidence: "confirmed" }],
    } : null,
  });
  const stats = { mode: "mock" as const, model: "simulated-chef-v1", inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, latencyMs: 0, toolCalls: [decision.draftUpdate ? "update_dish_draft" : "capture_only"] };
  const applied = applyCopilotDecision({ workspace, turn, decision, webSources: [], stats });
  workspace = applied.workspace;
  const draft = workspace.sessions.find((item) => item.id === "session_market")?.draft ?? null;
  results.push({
    id: scenario.id,
    passed: Boolean(draft) === scenario.expectDraft,
    expectedDraft: scenario.expectDraft,
    actualDraft: Boolean(draft),
    title: draft?.workingTitle ?? null,
    claimCount: draft?.claims.length ?? 0,
    stats,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: "mock",
  passed: results.every((result) => result.passed),
  totalEstimatedCostUsd: results.reduce((sum, result) => sum + result.stats.estimatedCostUsd, 0),
  results,
};
const outputDirectory = path.join(process.cwd(), "eval-results");
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "copilot-eval.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
