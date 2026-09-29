import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createSeedWorkspace } from "@/lib/copilot-seed";
import { saveCopilotImages, updateCopilotWorkspace } from "@/lib/copilot-store";

export const runtime = "nodejs";

const imageSchema = z.object({ name: z.string().max(160), mimeType: z.string().regex(/^image\//), dataUrl: z.string().max(8_000_000) });
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create_session") }),
  z.object({ type: z.literal("set_session_status"), sessionId: z.string(), status: z.enum(["active", "paused", "archived", "discarded"]) }),
  z.object({ type: z.literal("reject_draft"), sessionId: z.string() }),
  z.object({ type: z.literal("save_draft"), sessionId: z.string(), target: z.enum(["idea", "version"]) }),
  z.object({ type: z.literal("update_claim"), sessionId: z.string(), claimId: z.string(), text: z.string().min(1).max(800), confirmation: z.enum(["confirmed", "corrected"]) }),
  z.object({ type: z.literal("set_dish_stage"), dishId: z.string(), stage: z.enum(["want_to_try", "confident", "signature"]) }),
  z.object({ type: z.literal("record_cook"), dishId: z.string(), reflection: z.string().min(1).max(2000), changes: z.string().max(1500).default(""), images: z.array(imageSchema).max(4).default([]) }),
  z.object({ type: z.literal("reply_feedback"), feedbackId: z.string(), reply: z.string().min(1).max(1000) }),
  z.object({ type: z.literal("reset_demo") }),
]);

export async function POST(request: Request) {
  try {
    const action = actionSchema.parse(await request.json());
    const result = await updateCopilotWorkspace<{ ok: boolean; createdSessionId?: string; dishId?: string }>(async (workspace) => {
      const now = new Date().toISOString();
      if (action.type === "reset_demo") return { workspace: createSeedWorkspace(now), value: { ok: true } };

      if (action.type === "create_session") {
        const sessionId = `session_${crypto.randomUUID()}`;
        const next = {
          id: sessionId, title: "新的料理討論", teaser: "從一句話、一張照片，或一個還不確定的念頭開始。", status: "active" as const,
          linkedDishId: null, draft: null, createdAt: now, updatedAt: now,
        };
        return { workspace: { ...workspace, sessions: [next, ...workspace.sessions], updatedAt: now }, value: { ok: true, createdSessionId: sessionId } };
      }

      if (action.type === "set_session_status") {
        const sessions = workspace.sessions.map((session) => session.id === action.sessionId ? { ...session, status: action.status, updatedAt: now } : session);
        return { workspace: { ...workspace, sessions, updatedAt: now }, value: { ok: true } };
      }

      if (action.type === "reject_draft") {
        const sessions = workspace.sessions.map((session) => session.id === action.sessionId ? { ...session, draft: null, updatedAt: now } : session);
        return { workspace: { ...workspace, sessions, updatedAt: now }, value: { ok: true } };
      }

      if (action.type === "update_claim") {
        const sessions = workspace.sessions.map((session) => session.id === action.sessionId && session.draft ? {
          ...session,
          draft: {
            ...session.draft,
            claims: session.draft.claims.map((claim) => claim.id === action.claimId ? { ...claim, text: action.text, confirmation: action.confirmation, confidence: "confirmed" as const } : claim),
            revision: session.draft.revision + 1,
            updatedAt: now,
          },
          updatedAt: now,
        } : session);
        return { workspace: { ...workspace, sessions, updatedAt: now }, value: { ok: true } };
      }

      if (action.type === "save_draft") {
        const session = workspace.sessions.find((item) => item.id === action.sessionId);
        if (!session?.draft) throw new Error("料理草稿不存在");
        const draft = session.draft;
        const techniques = draft.claims.filter((claim) => claim.kind === "technique" || claim.kind === "decision").map((claim) => claim.text);
        const openQuestions = draft.claims.filter((claim) => claim.kind === "open_question").map((claim) => claim.text);
        const sensoryTarget = draft.claims.find((claim) => claim.kind === "sensory_target")?.text ?? "";
        let dishes = workspace.dishes;
        let linkedDishId = session.linkedDishId;
        if (action.target === "version" && linkedDishId) {
          dishes = dishes.map((dish) => dish.id === linkedDishId ? {
            ...dish,
            techniques: [...new Set([...dish.techniques, ...techniques])],
            openQuestions: [...new Set([...dish.openQuestions, ...openQuestions])],
            versionNotes: [...dish.versionNotes, `${draft.workingTitle ?? "下一版"}：${session.teaser}`],
            updatedAt: now,
          } : dish);
        } else {
          linkedDishId = `dish_${crypto.randomUUID()}`;
          dishes = [{
            id: linkedDishId,
            name: draft.workingTitle ?? session.title,
            stage: "want_to_try" as const,
            summary: session.teaser,
            sensoryTarget,
            techniques,
            successfulPatterns: [],
            openQuestions,
            versionNotes: ["從料理草稿留下"],
            timesCooked: 0,
            sharedCount: 0,
            updatedAt: now,
          }, ...dishes];
        }
        const sessions = workspace.sessions.map((item) => item.id === session.id ? {
          ...item, linkedDishId, draft: { ...draft, status: "saved" as const, updatedAt: now }, status: "paused" as const, updatedAt: now,
        } : item);
        return { workspace: { ...workspace, sessions, dishes, updatedAt: now }, value: { ok: true, dishId: linkedDishId } };
      }

      if (action.type === "set_dish_stage") {
        const dishes = workspace.dishes.map((dish) => dish.id === action.dishId ? { ...dish, stage: action.stage, updatedAt: now } : dish);
        return { workspace: { ...workspace, dishes, updatedAt: now }, value: { ok: true } };
      }

      if (action.type === "reply_feedback") {
        const feedback = workspace.feedback.map((item) => item.id === action.feedbackId ? { ...item, chefReply: action.reply } : item);
        const order = workspace.dining.orders.find(item => `feedback_${item.id}` === action.feedbackId);
        if (order) order.messages.push({ id: crypto.randomUUID(), author: "chef", text: action.reply, at: now });
        return { workspace: { ...workspace, feedback, updatedAt: now }, value: { ok: true } };
      }

      const dish = workspace.dishes.find((item) => item.id === action.dishId);
      if (!dish) throw new Error("找不到料理");
      const captureId = `capture_${crypto.randomUUID()}`;
      const capture = {
        id: captureId,
        sessionId: null,
        createdAt: now,
        text: action.reflection,
        assets: action.images.map((image) => ({ id: `asset_${crypto.randomUUID()}`, kind: "image" as const, name: image.name, mimeType: image.mimeType, url: "" })),
        kind: "cooking_reflection" as const,
        interpretation: "Chef 記錄一次實際料理與想留給下次的觀察。",
        confidence: "confirmed" as const,
      };
      capture.assets = capture.assets.map((asset) => ({ ...asset, url: `/api/copilot/assets/${asset.id}` }));
      const nextWorkspace = {
        ...workspace,
        dishes: workspace.dishes.map((item) => item.id === dish.id ? { ...item, timesCooked: item.timesCooked + 1, updatedAt: now } : item),
        cookRecords: [{ id: `cook_${crypto.randomUUID()}`, dishId: dish.id, title: `${dish.name}・第 ${dish.timesCooked + 1} 次`, cookedAt: now.slice(0, 10), reflection: action.reflection, changes: action.changes, photoAssetIds: capture.assets.map((asset) => asset.id) }, ...workspace.cookRecords],
        captures: [...workspace.captures, capture],
        updatedAt: now,
      };
      await saveCopilotImages(nextWorkspace, captureId, action.images);
      return { workspace: nextWorkspace, value: { ok: true } };
    });
    return NextResponse.json({ workspace: result.workspace, ...result.value });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: "操作格式不正確。", issues: error.issues }, { status: 400 });
    console.error("Copilot action failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "這個操作暫時無法完成。" }, { status: 500 });
  }
}
