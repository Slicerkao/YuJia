import { NextResponse } from "next/server";
import type { ChatTurn } from "@/lib/domain";
import { mockCustomerReply, type CustomerChatState } from "@/lib/mock-agent";
import { runOpenAICustomerAgent } from "@/lib/openai-customer";

export async function POST(request: Request) {
  const body = (await request.json()) as { message: string; state: CustomerChatState; turns: ChatTurn[] };
  if (!body.message?.trim()) return NextResponse.json({ error: "message is required" }, { status: 400 });
  try {
    const useOpenAI = process.env.YOUJIA_AGENT_MODE === "openai" && Boolean(process.env.OPENAI_API_KEY);
    const result = useOpenAI
      ? await runOpenAICustomerAgent(body)
      : mockCustomerReply(body.message, body.state);
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Agent run failed. Switch YOUJIA_AGENT_MODE=mock to continue testing." }, { status: 500 });
  }
}
