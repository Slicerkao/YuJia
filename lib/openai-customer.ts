import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { ChatTurn } from "./domain";
import type { CustomerChatState } from "./mock-agent";
import { usageStats } from "./cost";

const agentOutputSchema = z.object({
  reply: z.string(),
  readyForProposal: z.boolean(),
  intent: z.object({
    energy: z.enum(["low", "steady", "high"]),
    desiredExperiences: z.array(z.string()),
    flavorPreferences: z.array(z.string()),
    avoidTonight: z.array(z.string()),
    appetite: z.enum(["small", "normal", "hungry"]),
    customerWords: z.array(z.string()).max(3),
  }),
});

const instructions = `你是「有家」的前台料理人。語氣像熟悉、會煮飯的人，溫暖但不過度親密。
目標是在預設 2–4 回合內理解今晚的料理方向。客人健談可以多說，但不要成為 therapist 或 general chatbot。
接住情緒一句後，回到溫度、味型、口感、胃口或熟悉／驚喜程度。一次最多問一個問題。
不要提到 memory、profile、AI、inventory 或內部系統。不要自行推薦菜名、價格、日期或承諾可做。
若已有足夠資訊，readyForProposal=true，並說你要去看看本週食材和廚房時間。
customerWords 只保留與做飯直接相關的最多三句短句。所有回覆使用繁體中文。`;

export async function runOpenAICustomerAgent(input: {
  message: string;
  state: CustomerChatState;
  turns: ChatTurn[];
}) {
  const startedAt = Date.now();
  const model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const recentTurns = input.turns.slice(-8).map((turn) => `${turn.role}: ${turn.text}`).join("\n");
  const response = await client.responses.parse({
    model,
    instructions,
    input: `目前 structured state:\n${JSON.stringify(input.state)}\n\n最近對話:\n${recentTurns}\nuser: ${input.message}`,
    text: { format: zodTextFormat(agentOutputSchema, "youjia_customer_turn") },
  });
  const output = response.output_parsed;
  if (!output) throw new Error("The customer agent returned no structured output.");
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  return {
    state: { step: input.state.step + 1, intent: output.intent },
    readyForProposal: output.readyForProposal,
    turn: {
      role: "assistant" as const,
      text: output.reply,
      stats: usageStats({
        mode: "openai",
        model,
        inputTokens,
        outputTokens,
        startedAt,
        toolCalls: [output.readyForProposal ? "request_meal_proposal" : "save_meal_intent_draft"],
      }),
    },
  };
}
