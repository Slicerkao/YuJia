import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSeedWorkspace } from "../lib/copilot-seed";
import type { CopilotWorkspace } from "../lib/copilot-domain";
const memory=vi.hoisted(()=>({workspace:null as unknown as CopilotWorkspace}));
vi.mock("../lib/dining-store",()=>({getDiningWorkspace:async()=>memory.workspace,mutateDining:async(fn:(w:CopilotWorkspace)=>unknown)=>{const draft=structuredClone(memory.workspace);const value=await fn(draft);memory.workspace=draft;return {workspace:draft,value};}}));
vi.mock("../lib/dining-agent",()=>({runDiningAgent:vi.fn(async()=>({decision:{reply:"可以看看這份雞腿。",offeringId:"offer",needsChef:false,preferenceSummary:"喜歡鹹香"},stats:{model:"test",inputTokens:1,outputTokens:1,estimatedCostUsd:0,latencyMs:1}}))}));
import { GET as guestGet, POST as guestPost } from "../app/api/dining/guest/route";
import { POST as chefPost } from "../app/api/dining/chef/route";
const guest="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", other="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
function request(body?:object,owner=guest){return new NextRequest("http://localhost/api/dining/guest",{method:body?"POST":"GET",headers:{cookie:`youjia_guest=${owner}`,"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});}
async function post(body:object,owner=guest){const r=await guestPost(request(body,owner));return {status:r.status,body:await r.json()};}
async function chef(body:object){const r=await chefPost(request(body));return {status:r.status,body:await r.json()};}
const reservation={type:"order",offeringId:"offer",guestName:"測試食客",quantity:1,dietary:"無",note:"謝謝你煮飯",reviewed:true,requestKey:"unique-request-key"};
beforeEach(()=>{memory.workspace=createSeedWorkspace();const d=memory.workspace.dishes[0];memory.workspace.dining={initialized:true,sessions:[],orders:[],offerings:[{id:"offer",recipe:{id:d.id,name:d.name,summary:d.summary,sensoryTarget:d.sensoryTarget,techniques:d.techniques,updatedAt:d.updatedAt},description:"家常菜",chefNote:"",price:260,capacity:2,pickup:"週六",sides:["白飯"],allergenNote:"待確認",published:true,demoDetails:true}]};});
describe("Guest and chef API loop",()=>{
  it("runs chat → reserve → chef reply → serve → photo feedback linked to the original dish",async()=>{
    expect((await post({type:"chat",text:"想吃鹹香"})).status).toBe(200);
    const reserved=await post(reservation);expect(reserved.status).toBe(200);const id=reserved.body.orderId;
    expect((await post(reservation)).body.orderId).toBe(id);
    expect(memory.workspace.dining.orders).toHaveLength(1);
    expect((await post({type:"feedback",orderId:id,comment:"好吃",photo:null})).status).toBe(400);
    expect((await chef({type:"status",orderId:id,status:"confirmed",reply:"週六見！"})).status).toBe(200);
    expect((await chef({type:"status",orderId:id,status:"served",reply:"煮好了"})).status).toBe(200);
    const photo="data:image/png;base64,iVBORw0KGgo=";
    expect((await post({type:"feedback",orderId:id,comment:"醬汁很香，下次少一點鹽",photo})).status).toBe(200);
    expect((await chef({type:"reply",orderId:id,text:"收到，下次留意鹹度。"})).status).toBe(200);
    const feedback=memory.workspace.feedback.find(f=>f.id===`feedback_${id}`);
    expect(feedback?.chefReply).toBe("收到，下次留意鹹度。");expect(feedback?.photoUrl).toBe(photo);
    const meal=memory.workspace.sharedMeals.find(m=>m.id===feedback?.sharedMealId);
    expect(meal?.dishId).toBe(memory.workspace.dining.offerings[0].recipe.id);
    const state=await (await guestGet(request())).json();expect(state.orders[0].messages.at(-1).text).toBe("收到，下次留意鹹度。");
  });
  it("isolates guests and does not allow another guest to read or change an order",async()=>{
    const {body}=await post(reservation);const state=await(await guestGet(request(undefined,other))).json();expect(state.orders).toEqual([]);
    expect((await post({type:"message",orderId:body.orderId,text:"tamper"},other)).status).toBe(400);
  });
  it("rejects capacity reductions below reservations and leaves order snapshots unchanged",async()=>{
    await post(reservation);const o=memory.workspace.dining.offerings[0];
    const input={...o,type:"offer",offeringId:o.id,refreshRecipe:false,price:900,capacity:0};
    expect((await chef(input)).status).toBe(400);
    expect((await chef({...input,capacity:2})).status).toBe(200);
    expect(memory.workspace.dining.orders[0].meal.price).toBe(260);
  });
});
