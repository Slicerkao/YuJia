import type { UsageStats } from "./domain";

export function estimateCost(inputTokens: number, outputTokens: number) {
  const inputRate = Number(process.env.OPENAI_INPUT_USD_PER_MILLION ?? 0.2);
  const outputRate = Number(process.env.OPENAI_OUTPUT_USD_PER_MILLION ?? 1.2);
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}

export function usageStats(input: {
  mode: UsageStats["mode"];
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  startedAt: number;
  toolCalls?: string[];
}): UsageStats {
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  return {
    mode: input.mode,
    model: input.model,
    inputTokens,
    outputTokens,
    estimatedCostUsd: input.mode === "mock" ? 0 : estimateCost(inputTokens, outputTokens),
    latencyMs: Date.now() - input.startedAt,
    toolCalls: input.toolCalls ?? [],
  };
}
