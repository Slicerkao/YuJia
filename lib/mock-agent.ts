import type { ChatTurn, MealIntent, UsageStats } from "./domain";

export type CustomerChatState = {
  step: number;
  intent: MealIntent;
};

const baseIntent: MealIntent = {
  energy: "steady",
  desiredExperiences: [],
  flavorPreferences: [],
  avoidTonight: [],
  appetite: "normal",
  customerWords: [],
};

export const initialCustomerState: CustomerChatState = { step: 0, intent: baseIntent };

function stats(started: number, toolCalls: string[] = []): UsageStats {
  return {
    mode: "mock",
    model: "youjia-rules-v1",
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    latencyMs: Date.now() - started,
    toolCalls,
  };
}

export function openingTurn(): ChatTurn {
  return {
    role: "assistant",
    text: "小林說，你可能會喜歡來有家吃飯。\n\n今天過得還好嗎？今晚想吃一點熱熱安穩的，還是清爽、讓人醒過來的味道？",
    stats: stats(Date.now()),
  };
}

export function mockCustomerReply(message: string, state: CustomerChatState) {
  const started = Date.now();
  const text = message.toLowerCase();
  const next: CustomerChatState = {
    step: state.step + 1,
    intent: {
      ...state.intent,
      customerWords: [...state.intent.customerWords, message].slice(-3),
    },
  };

  if (/累|糟|忙|沒力|疲|tired|bad day|exhaust/.test(text)) {
    next.intent.energy = "low";
    next.intent.desiredExperiences = ["warm", "comforting", "not_too_heavy"];
  }
  if (/清爽|清淡|fresh|light|醒/.test(text)) next.intent.desiredExperiences.push("fresh");
  if (/湯|熱熱|暖|soup|warm/.test(text)) next.intent.flavorPreferences.push("light_broth");
  if (/鹹|下飯|savory/.test(text)) next.intent.flavorPreferences.push("savory");
  if (/魚|fish/.test(text)) next.intent.flavorPreferences.push("fish");
  if (/很餓|餓爆|hungry/.test(text)) next.intent.appetite = "hungry";
  if (/不想吃|不要|avoid/.test(text)) {
    const match = message.match(/(?:不想吃|不要)\s*([^，。,.]+)/);
    if (match) next.intent.avoidTonight.push(match[1].trim());
  }

  const ready = next.step >= 2 || message.length > 42 || /隨便|你.*決定|幫我想|surprise me/.test(text);
  const reply = ready
    ? "好，我大概知道了。你先坐一下，我去看看這週的食材和廚房時間，替你想一份真的做得到的。"
    : next.intent.energy === "low"
      ? "唉，那今晚先不要再做太多決定。比較想要有一點湯汁、慢慢吃，還是鹹香一點、第一口就很下飯？"
      : "那今天的胃口呢？比較想吃熟悉的家常味，還是可以有一點沒吃過的小變化？";

  return {
    state: next,
    readyForProposal: ready,
    turn: { role: "assistant", text: reply, stats: stats(started, ready ? ["request_meal_proposal"] : ["save_meal_intent_draft"]) } satisfies ChatTurn,
  };
}

export function parseChefWeek(message: string) {
  const portions = Number(message.match(/(?:最多|大概|約|可以做)\s*(\d+)\s*份/)?.[1] ?? 8);
  const marketNotes = message
    .split(/[。\n]/)
    .map((line) => line.trim())
    .filter((line) => /新鮮|漂亮|買|剩|市場|優先/.test(line));
  const experiment = message
    .split(/[。\n]/)
    .find((line) => /試|experiment|想做/.test(line))
    ?.trim();
  return {
    capacity: portions,
    marketNotes: marketNotes.length ? marketNotes : ["本週市場筆記待補"],
    experiment: experiment ?? "本週先以穩定料理為主",
  };
}
