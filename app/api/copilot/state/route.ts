import { NextResponse } from "next/server";
import { getCopilotWorkspace } from "@/lib/copilot-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspace = await getCopilotWorkspace();
    const openAIEnabled = process.env.YOUJIA_COPILOT_MODE === "openai" && Boolean(process.env.OPENAI_API_KEY);
    return NextResponse.json({
      workspace,
      mode: openAIEnabled ? "openai" : "mock",
      model: openAIEnabled
        ? process.env.OPENAI_COPILOT_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.6-luna"
        : "copilot-rules-v2",
    });
  } catch (error) {
    console.error("Failed to load Copilot workspace", error);
    return NextResponse.json({ error: "無法讀取 Copilot workspace。" }, { status: 500 });
  }
}
