import { NextResponse } from "next/server";
import { getCopilotAsset } from "@/lib/copilot-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  try {
    const { assetId } = await context.params;
    const asset = await getCopilotAsset(assetId);
    if (!asset) return NextResponse.json({ error: "找不到照片。" }, { status: 404 });
    return new Response(asset.bytes, {
      headers: {
        "content-type": asset.mimeType,
        "cache-control": "private, max-age=3600",
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
      },
    });
  } catch (error) {
    console.error("Copilot asset read failed", error);
    return NextResponse.json({ error: "無法讀取照片。" }, { status: 404 });
  }
}
