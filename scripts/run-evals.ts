import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { demoKitchen } from "../lib/demo-data";
import type { ChatTurn, Constraint } from "../lib/domain";
import { initialCustomerState, mockCustomerReply } from "../lib/mock-agent";
import { runOpenAICustomerAgent } from "../lib/openai-customer";
import { planMeals } from "../lib/planner";

type Scenario = {
  id: string;
  description: string;
  messages: string[];
  constraints?: Constraint[];
  checks: { maxRounds: number; forbidden?: RegExp[]; requiresProposal?: boolean };
};

const scenarios: Scenario[] = [
  { id: "quiet-tired", description: "安靜又疲累的客人", messages: ["累", "熱的就好"], checks: { maxRounds: 3, requiresProposal: true } },
  { id: "decisive", description: "不想聊天、交給 Chef", messages: ["今天不想聊，你幫我決定"], checks: { maxRounds: 2, requiresProposal: true } },
  { id: "talkative", description: "健談但需要被帶回食物", messages: ["今天老闆又讓我加班，真的講不完", "好啦，我想吃鹹香下飯的"], checks: { maxRounds: 4, forbidden: [/你願意多說/i, /你的感受是/i], requiresProposal: true } },
  { id: "shellfish-allergy", description: "想喝湯但有甲殼類過敏", messages: ["想吃清甜有湯的，你幫我想"], constraints: [{ kind: "allergy", ingredient: "shellfish", severity: "severe" }], checks: { maxRounds: 2, requiresProposal: true } },
  { id: "avoid-tonight", description: "只限今晚不想吃魚", messages: ["今天不要魚，想吃溫暖一點的", "鹹香下飯"], checks: { maxRounds: 3, requiresProposal: true } },
];

async function runScenario(scenario: Scenario) {
  let state = structuredClone(initialCustomerState);
  const turns: ChatTurn[] = [];
  let ready = false;
  for (const message of scenario.messages) {
    turns.push({ role: "user", text: message });
    const useOpenAI = process.env.YOUJIA_AGENT_MODE === "openai" && Boolean(process.env.OPENAI_API_KEY);
    const result = useOpenAI
      ? await runOpenAICustomerAgent({ message, state, turns })
      : mockCustomerReply(message, state);
    state = result.state;
    ready = result.readyForProposal;
    turns.push(result.turn);
    if (ready) break;
  }
  const proposals = ready
    ? planMeals({ intent: state.intent, constraints: scenario.constraints ?? [], kitchen: demoKitchen })
    : [];
  const assistantText = turns.filter((turn) => turn.role === "assistant").map((turn) => turn.text).join("\n");
  const stats = turns.flatMap((turn) => (turn.stats ? [turn.stats] : []));
  const checks = {
    rounds: stats.length <= scenario.checks.maxRounds,
    forbiddenLanguage: !(scenario.checks.forbidden ?? []).some((pattern) => pattern.test(assistantText)),
    proposal: !scenario.checks.requiresProposal || proposals.length > 0,
    allergy: scenario.id !== "shellfish-allergy" || !proposals.some((proposal) => proposal.recipe.allergens.includes("shellfish")),
  };
  return {
    scenario: scenario.id,
    description: scenario.description,
    passed: Object.values(checks).every(Boolean),
    checks,
    transcript: turns,
    proposal: proposals[0]?.recipe.name ?? null,
    usage: {
      runs: stats.length,
      inputTokens: stats.reduce((sum, item) => sum + item.inputTokens, 0),
      outputTokens: stats.reduce((sum, item) => sum + item.outputTokens, 0),
      estimatedCostUsd: stats.reduce((sum, item) => sum + item.estimatedCostUsd, 0),
      latencyMs: stats.reduce((sum, item) => sum + item.latencyMs, 0),
    },
  };
}

async function main() {
  const results = [];
  for (const scenario of scenarios) results.push(await runScenario(scenario));
  const summary = {
    generatedAt: new Date().toISOString(),
    mode: process.env.YOUJIA_AGENT_MODE === "openai" ? "openai" : "mock",
    passed: results.filter((result) => result.passed).length,
    total: results.length,
    estimatedCostUsd: results.reduce((sum, result) => sum + result.usage.estimatedCostUsd, 0),
    inputTokens: results.reduce((sum, result) => sum + result.usage.inputTokens, 0),
    outputTokens: results.reduce((sum, result) => sum + result.usage.outputTokens, 0),
  };
  const report = { summary, results };
  const directory = resolve("eval-results");
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, `eval-${Date.now()}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  for (const result of results) console.log(`${result.passed ? "PASS" : "FAIL"} ${result.scenario} -> ${result.proposal ?? "no proposal"} ($${result.usage.estimatedCostUsd.toFixed(5)})`);
  if (summary.passed !== summary.total) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
