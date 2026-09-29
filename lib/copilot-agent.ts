import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { usageStats } from "./cost";
import {
  copilotTurnDecisionSchema,
  type CopilotTurnDecision,
  type CopilotTurnInput,
  type CopilotWorkspace,
} from "./copilot-domain";
import { COPILOT_INSTRUCTIONS } from "./copilot-instructions";

function compactContext(workspace: CopilotWorkspace, sessionId: string) {
  const session = workspace.sessions.find((item) => item.id === sessionId) ?? null;
  const linkedDish = session?.linkedDishId ? workspace.dishes.find((dish) => dish.id === session.linkedDishId) ?? null : null;
  const relevantCookRecords = linkedDish ? workspace.cookRecords.filter((record) => record.dishId === linkedDish.id).slice(-3) : [];
  const relevantMeals = linkedDish ? workspace.sharedMeals.filter((meal) => meal.dishId === linkedDish.id) : [];
  const feedbackIds = new Set(relevantMeals.flatMap((meal) => meal.feedbackIds));
  return {
    session,
    recentMessages: workspace.messages.filter((message) => message.sessionId === sessionId).slice(-12).map(({ role, text }) => ({ role, text })),
    currentDraft: session?.draft ?? null,
    linkedDish,
    relevantCookRecords,
    guestFeedback: workspace.feedback.filter((item) => feedbackIds.has(item.id)),
    confidentDishes: workspace.dishes.filter((dish) => dish.stage !== "want_to_try").map(({ id, name, summary, sensoryTarget, successfulPatterns, openQuestions }) => ({ id, name, summary, sensoryTarget, successfulPatterns, openQuestions })),
  };
}

function mockDecision(turn: CopilotTurnInput, workspace: CopilotWorkspace): CopilotTurnDecision {
  const text = turn.text.trim();
  const session = workspace.sessions.find((item) => item.id === turn.sessionId);
  const existingClaims = session?.draft?.claims.slice(0, 5).map(({ id: _id, confirmation: _confirmation, ...claim }) => claim) ?? [];
  const looksLikeDish = /想做|想試|料理|做法|蛤蜊|絲瓜|雞|肉|魚|蛋|湯|炒|煮|煎|烤|味道|口感/.test(text);
  const isObservationOnly = /先留|還不知道|只是看到|不要忘記/.test(text) && !/想做|想試/.test(text);
  const linkedDish = workspace.dishes.find((dish) => text.includes(dish.name.slice(0, 2))) ?? (session?.linkedDishId ? workspace.dishes.find((dish) => dish.id === session.linkedDishId) : null);

  if (!looksLikeDish || isObservationOnly) {
    return {
      reply: turn.images.length ? "我先把照片和這個念頭放在這段討論裡，不急著替它變成一道菜。你想到想保留的香氣或口感時，再接著說就好。" : "好，先讓這個念頭停在這裡，不替它硬湊成一道菜。等你想接著發展時再回來。",
      sessionTitle: null,
      sessionTeaser: text || "從一張照片開始，方向還沒有形成。",
      captureKind: /市場|看到|買/.test(text) || turn.images.length ? "market_observation" : "general",
      interpretation: "Chef 正在留下尚未形成料理方向的觀察。",
      confidence: "probable",
      linkedDishId: linkedDish?.id ?? null,
      draftUpdate: null,
    };
  }

  const title = /絲瓜|蛤蜊/.test(text) ? "炙燒絲瓜蛤蜊" : linkedDish ? `${linkedDish.name}・下一版` : text.slice(0, 18) || "新的料理方向";
  const newClaim = {
    kind: "sensory_target" as const,
    text: /焦|炙燒/.test(text) ? "保留原本的清甜，再增加一點焦香。" : "先找出這道菜最想保留的味道與口感。",
    sourceType: "user_message" as const,
    sourceLabel: "你這一輪說的",
    confidence: "probable" as const,
  };
  return {
    reply: linkedDish ? `可以先把它當成「${linkedDish.name}」的下一版，而不是另起一道菜。我把目前方向放進料理草稿，你可以繼續聊，不用現在決定要不要留下。` : "這開始像一道可以發展的菜了。我先把目前最清楚的方向放進料理草稿；還不用決定要不要保存。",
    sessionTitle: session?.title === "新的料理討論" ? title : null,
    sessionTeaser: text || "從照片慢慢形成一道菜。",
    captureKind: "brainstorm",
    interpretation: "Chef 正在發展一道料理的味道或做法。",
    confidence: "probable",
    linkedDishId: linkedDish?.id ?? null,
    draftUpdate: {
      workingTitle: title,
      relationship: linkedDish ? "existing_variation" : "new_idea",
      readiness: existingClaims.length >= 3 ? "forming" : "loose",
      claims: [...existingClaims, newClaim].slice(-8),
    },
  };
}

function extractWebSources(response: unknown) {
  const output = (response as { output?: unknown[] }).output ?? [];
  const sources: Array<{ title: string; url: string; snippet: string }> = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const action = (item as { action?: { sources?: unknown[] } }).action;
    for (const source of action?.sources ?? []) {
      if (!source || typeof source !== "object") continue;
      const record = source as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url : "";
      if (!url) continue;
      sources.push({
        title: typeof record.title === "string" ? record.title : new URL(url).hostname,
        url,
        snippet: typeof record.snippet === "string" ? record.snippet : "",
      });
    }
  }
  return sources.filter((source, index) => sources.findIndex((candidate) => candidate.url === source.url) === index).slice(0, 5);
}

export async function runCopilotAgent(input: { turn: CopilotTurnInput; workspace: CopilotWorkspace }) {
  const startedAt = Date.now();
  const model = process.env.OPENAI_COPILOT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
  const useOpenAI = process.env.YOUJIA_COPILOT_MODE === "openai" && Boolean(process.env.OPENAI_API_KEY);

  if (!useOpenAI) {
    const decision = mockDecision(input.turn, input.workspace);
    return {
      decision,
      webSources: [],
      mode: "mock" as const,
      model: "copilot-rules-v2",
      stats: usageStats({ mode: "mock", model: "copilot-rules-v2", startedAt, toolCalls: [decision.draftUpdate ? "update_dish_draft" : "capture_only"] }),
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const contextText = [
    "以下是這一輪允許使用的 kitchen context。不要假設沒有列出的記憶：",
    JSON.stringify(compactContext(input.workspace, input.turn.sessionId)),
    `這一輪是否明確要求網路搜尋：${input.turn.webSearchRequested ? "是" : "否"}`,
    "Chef 的文字：",
    input.turn.text || "（Chef 只傳了照片）",
  ].join("\n\n");
  const content: Array<Record<string, unknown>> = [{ type: "input_text", text: contextText }];
  for (const image of input.turn.images) content.push({ type: "input_image", image_url: image.dataUrl, detail: "low" });

  const response = await client.responses.parse({
    model,
    instructions: COPILOT_INSTRUCTIONS,
    input: [{ role: "user", content }] as never,
    text: { format: zodTextFormat(copilotTurnDecisionSchema, "youjia_copilot_turn") },
    tools: input.turn.webSearchRequested ? [{ type: "web_search" }] : undefined,
    include: input.turn.webSearchRequested ? ["web_search_call.action.sources"] : undefined,
    reasoning: { effort: "low" },
    max_output_tokens: 1800,
    store: false,
  });
  const decision = response.output_parsed;
  if (!decision) throw new Error("The Copilot returned no structured decision.");
  const webSources = extractWebSources(response);
  const toolCalls = [decision.draftUpdate ? "update_dish_draft" : "capture_only"];
  if (input.turn.webSearchRequested) toolCalls.push("web_search");
  const stats = usageStats({
    mode: "openai", model, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0, startedAt, toolCalls,
  });
  return { decision, webSources, mode: "openai" as const, model, stats };
}
