import { NextResponse } from "next/server";
import { z } from "zod";
import { getDiningWorkspace, mutateDining } from "@/lib/dining-store";
import { remainingPortions } from "@/lib/dining-domain";
import { setDinnerStatus } from "@/lib/dining-engine";
export const runtime="nodejs";
// Single-owner local prototype. Never expose this endpoint publicly without chef authentication.
export async function GET() {
  const w=await getDiningWorkspace();
  return NextResponse.json({ offerings:w.dining.offerings.map(o=>({...o,remaining:remainingPortions(w.dining,o.id)})),orders:w.dining.orders,runs:w.dining.sessions.flatMap(s=>s.runs.map(r=>({...r,sessionId:s.id}))),dishes:w.dishes },{headers:{"Cache-Control":"no-store"}});
}
const inputSchema=z.discriminatedUnion("type",[
  z.object({type:z.literal("offer"),offeringId:z.string(),description:z.string().trim().min(1).max(500),chefNote:z.string().max(1000),price:z.number().int().min(0).max(10000),capacity:z.number().int().min(0).max(100),pickup:z.string().trim().min(1).max(300),sides:z.array(z.string().trim().min(1).max(100)).max(5),allergenNote:z.string().trim().min(1).max(1000),published:z.boolean(),demoDetails:z.boolean(),refreshRecipe:z.boolean().default(false)}),
  z.object({type:z.literal("status"),orderId:z.string(),status:z.enum(["confirmed","served","declined"]),reply:z.string().trim().max(2000)}),
  z.object({type:z.literal("reply"),orderId:z.string(),text:z.string().trim().min(1).max(2000)}),
]);
export async function POST(request:Request) {
  try {
    const body=inputSchema.parse(await request.json());
    await mutateDining(w=>{
      if(body.type==="offer") {
        const o=w.dining.offerings.find(o=>o.id===body.offeringId);
        if(!o) throw new Error("找不到這道本週供應。");
        const reserved=w.dining.orders.filter(order=>order.offeringId===o.id&&order.status!=="declined").reduce((n,order)=>n+order.quantity,0);
        if(body.capacity<reserved) throw new Error(`已預留 ${reserved} 份，供應總量不能小於這個數字。`);
        const {type:_type,offeringId:_id,refreshRecipe,...fields}=body;
        Object.assign(o,fields);
        if(refreshRecipe) { const d=w.dishes.find(d=>d.id===o.recipe.id); if(d) o.recipe={id:d.id,name:d.name,summary:d.summary,sensoryTarget:d.sensoryTarget,techniques:[...d.techniques],updatedAt:d.updatedAt}; }
        return;
      }
      const order=w.dining.orders.find(o=>o.id===body.orderId);
      if(!order) throw new Error("找不到這一餐。");
      if(body.type==="status") {
        if(body.status==="declined"&&!body.reply) throw new Error("請留一句話，讓客人知道這次為什麼無法安排。");
        setDinnerStatus(w,order,body.status);
        if(body.reply) order.messages.push({id:crypto.randomUUID(),author:"chef",text:body.reply,at:new Date().toISOString()});
      } else {
        order.messages.push({id:crypto.randomUUID(),author:"chef",text:body.text,at:new Date().toISOString()});
        if(order.feedback) { const feedback=w.feedback.find(f=>f.id===`feedback_${order.id}`); if(feedback) feedback.chefReply=body.text; }
      }
    });
    return NextResponse.json({ok:true});
  } catch(e) { return NextResponse.json({error:e instanceof z.ZodError?"請確認供應資料填寫完整。":e instanceof Error?e.message:"這次沒存成功，請再試一次。"},{status:400}); }
}
