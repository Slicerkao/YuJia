import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDiningWorkspace, mutateDining } from "@/lib/dining-store";
import { checkoutSchema, remainingPortions, validateCheckout, type DiningSession } from "@/lib/dining-domain";
import { runDiningAgent } from "@/lib/dining-agent";
export const runtime = "nodejs";
const cookieName = "youjia_guest";
function guestId(request: NextRequest) { const id = request.cookies.get(cookieName)?.value; return id && /^[a-f0-9-]{36}$/.test(id) ? id : crypto.randomUUID(); }
function respond(id: string, body: unknown, status = 200) { const r=NextResponse.json(body, { status }); r.cookies.set(cookieName, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60*60*24*90 }); r.headers.set("Cache-Control", "no-store"); return r; }
export async function GET(request: NextRequest) {
  const id = guestId(request);
  const w = await getDiningWorkspace();
  return respond(id, { offerings: w.dining.offerings.filter(o => o.published).map(o => ({ ...o, remaining: remainingPortions(w.dining, o.id) })), orders: w.dining.orders.filter(o => o.guestId === id), session: w.dining.sessions.find(s => s.id === id) ?? null, mode: process.env.YOUJIA_DINING_MODE ?? process.env.YOUJIA_COPILOT_MODE ?? "mock" });
}
const bodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chat"), text: z.string().trim().min(1).max(2000) }),
  checkoutSchema.extend({ type: z.literal("order") }),
  z.object({ type: z.literal("message"), orderId: z.string(), text: z.string().trim().min(1).max(2000) }),
  z.object({ type: z.literal("feedback"), orderId: z.string(), comment: z.string().trim().min(1).max(2000), photo: z.string().max(5_400_000).nullable() }),
]);
export async function POST(request: NextRequest) {
  const id = guestId(request);
  try {
    const raw = await request.text();
    if (raw.length > 5_500_000) return respond(id, { error: "照片請小於 4 MB。" }, 413);
    const body = bodySchema.parse(JSON.parse(raw));
    if (body.type === "chat") {
      const w=await getDiningWorkspace();
      const session: DiningSession = w.dining.sessions.find(s=>s.id===id) ?? { id, messages: [], recommendedOfferingId: null, needsChef:false, preferenceSummary:"", runs:[] };
      const result = await runDiningAgent(w.dining, session, body.text);
      await mutateDining(w => { const current=w.dining.sessions.find(s=>s.id===id) ?? session; if (!w.dining.sessions.some(s=>s.id===id)) w.dining.sessions.push(current); current.messages.push({role:"guest", text:body.text, at:new Date().toISOString()}, {role:"host",text:result.decision.reply,at:new Date().toISOString()}); current.recommendedOfferingId=result.decision.offeringId; current.needsChef ||= result.decision.needsChef; current.preferenceSummary=result.decision.preferenceSummary; current.runs.push(result.stats); });
      return respond(id, { ok: true });
    }
    const result = await mutateDining(w => {
      const dining = w.dining;
      if (body.type === "order") {
        const existing=dining.orders.find(o=>o.guestId===id && o.requestKey===body.requestKey);
        if (existing) return { orderId: existing.id };
        const offer = validateCheckout(dining, body);
        const session=dining.sessions.find(s=>s.id===id);
        const orderId=crypto.randomUUID();
        dining.orders.unshift({ id:orderId,guestId:id,sessionId:session?.id??null,offeringId:offer.id,meal:structuredClone(offer),guestName:body.guestName,quantity:body.quantity,dietary:body.dietary,note:body.note,preferenceSummary:session?.preferenceSummary??"",status:"requested",createdAt:new Date().toISOString(),requestKey:body.requestKey,messages:[],feedback:null });
        return { orderId };
      }
      const order = dining.orders.find(o=>o.id===body.orderId && o.guestId===id);
      if (!order) throw new Error("找不到這一餐。請用預留餐點時的瀏覽器打開。");
      if (body.type === "message") { order.messages.push({id:crypto.randomUUID(),author:"guest",text:body.text,at:new Date().toISOString()}); return { ok:true }; }
      if (order.status !== "served") throw new Error("出餐後，就可以留下這頓的回話。");
      if (order.feedback) throw new Error("這一餐已經收到你的回話了，想補充可以直接留言給 Sam。");
      if (body.photo && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.photo)) throw new Error("照片請使用 JPG、PNG 或 WebP。");
      order.feedback={comment:body.comment,photoUrl:body.photo,at:new Date().toISOString()};
      const mealId=`meal_${order.id}`, feedbackId=`feedback_${order.id}`;
      const shared = w.sharedMeals.find(m=>m.id===mealId);
      if (!shared) throw new Error("找不到出餐紀錄，請讓 Sam 重新查看這一餐。");
      shared.feedbackIds.push(feedbackId);
      w.feedback.push({id:feedbackId,sharedMealId:mealId,tasterName:order.guestName,comment:body.comment,photoUrl:body.photo,chefReply:null,createdAt:new Date().toISOString()});
      return { ok:true };
    });
    return respond(id, result.value);
  } catch(e) {
    console.error("Dining guest action:", e instanceof Error ? e.message : "unknown");
    return respond(id, { error: e instanceof z.ZodError ? "請確認名字、份數、飲食限制與確認欄位都填好了。" : e instanceof Error && !/API|401|429|400|500|key|connection|fetch|timeout/i.test(e.message) ? e.message : "小幫手暫時連不上。你可以稍後重試，或直接選這週的菜；想給 Sam 的話也可以留在餐點裡。" }, 400);
  }
}
