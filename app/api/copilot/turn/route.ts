import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { runCopilotAgent } from "@/lib/copilot-agent";
import { copilotTurnInputSchema } from "@/lib/copilot-domain";
import { applyCopilotDecision } from "@/lib/copilot-engine";
import { saveCopilotImages, updateCopilotWorkspace } from "@/lib/copilot-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const turn = copilotTurnInputSchema.parse(await request.json());
    const result = await updateCopilotWorkspace(async (workspace) => {
      const agentResult = await runCopilotAgent({ turn, workspace });
      const applied = applyCopilotDecision({
        workspace,
        turn,
        decision: agentResult.decision,
        webSources: agentResult.webSources,
        stats: agentResult.stats,
      });
      await saveCopilotImages(applied.workspace, applied.captureId, turn.images);
      return {
        workspace: applied.workspace,
        value: {
          mode: agentResult.mode,
          model: agentResult.model,
          stats: agentResult.stats,
        },
      };
    });

    return NextResponse.json({ workspace: result.workspace, ...result.value });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "輸入格式不正確。", issues: error.issues }, { status: 400 });
    }
    console.error("Copilot turn failed", error);
    return NextResponse.json({
      error: "Copilot 暫時沒有回應。你的輸入尚未保存，請稍後再試。",
    }, { status: 500 });
  }
}
