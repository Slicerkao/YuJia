import { describe, expect, it } from "vitest";
import { copilotWorkspaceSchema } from "../lib/copilot-domain";
import { createSeedWorkspace } from "../lib/copilot-seed";
import { checkoutSchema, remainingPortions, validateCheckout, type Offering, type DinnerOrder } from "../lib/dining-domain";
import { setDinnerStatus } from "../lib/dining-engine";

function fixture() {
  const w=createSeedWorkspace();
  const d=w.dishes[0];
  const offer:Offering={id:"offer",recipe:{id:d.id,name:d.name,summary:d.summary,sensoryTarget:d.sensoryTarget,techniques:[...d.techniques],updatedAt:d.updatedAt},description:"試用",chefNote:"",price:260,capacity:2,pickup:"星期六",sides:["飯"],allergenNote:"待確認",published:true,demoDetails:true};
  w.dining={initialized:true,offerings:[offer],orders:[],sessions:[]};
  const order:DinnerOrder={id:"order",guestId:"guest",sessionId:null,offeringId:offer.id,meal:structuredClone(offer),guestName:"測試",quantity:1,dietary:"無",note:"",preferenceSummary:"",status:"requested",createdAt:"today",requestKey:"request-key",messages:[],feedback:null};
  return {w,offer,order};
}
describe("Dining reservation and recipe boundaries",()=>{
  it("adds an empty dining layer to existing workspaces without changing recipes",()=>{
    const seed=createSeedWorkspace();
    const {dining:_dining,...legacy}=seed;
    const parsed=copilotWorkspaceSchema.parse(legacy);
    expect(parsed.dining.orders).toEqual([]);
    expect(parsed.dishes).toEqual(seed.dishes);
  });
  it("requires dietary review and positive integral quantities",()=>{
    const valid={offeringId:"offer",guestName:"Sam",quantity:1,dietary:"無",note:"",reviewed:true,requestKey:"request-1"};
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
    for(const change of [{quantity:0},{quantity:1.2},{dietary:" "},{reviewed:false}]) expect(checkoutSchema.safeParse({...valid,...change}).success).toBe(false);
  });
  it("reserves pending orders, rejects overbooking and unpublished dishes, releases declined portions",()=>{
    const {w,order,offer}=fixture();w.dining.orders.push(order);
    expect(remainingPortions(w.dining,offer.id)).toBe(1);
    const input=checkoutSchema.parse({offeringId:offer.id,guestName:"A",quantity:2,dietary:"無",note:"",reviewed:true,requestKey:"request-2"});
    expect(()=>validateCheckout(w.dining,input)).toThrow("份數");
    setDinnerStatus(w,order,"declined");
    expect(remainingPortions(w.dining,offer.id)).toBe(2);
    offer.published=false;
    expect(()=>validateCheckout(w.dining,{...input,quantity:1})).toThrow("供應");
  });
  it("retains the ordered price and recipe when the menu changes",()=>{
    const {offer,order}=fixture();offer.price=500;offer.recipe.techniques.push("new technique");
    expect(order.meal.price).toBe(260);
    expect(order.meal.recipe.techniques).not.toContain("new technique");
  });
  it("requires chef confirmation before serving and creates exactly one linked cooking record",()=>{
    const {w,order}=fixture();const count=w.cookRecords.length;const stage=w.dishes[0].stage;
    expect(()=>setDinnerStatus(w,order,"served")).toThrow();
    setDinnerStatus(w,order,"confirmed");setDinnerStatus(w,order,"served");
    expect(w.cookRecords).toHaveLength(count+1);
    expect(w.sharedMeals.find(m=>m.id===`meal_${order.id}`)?.dishId).toBe(order.meal.recipe.id);
    expect(w.dishes[0].stage).toBe(stage);
    expect(()=>setDinnerStatus(w,order,"served")).toThrow();
  });
});
