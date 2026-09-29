import type { CopilotWorkspace } from "./copilot-domain";
import type { DinnerOrder } from "./dining-domain";

export function setDinnerStatus(workspace: CopilotWorkspace, order: DinnerOrder, status: DinnerOrder["status"]) {
  const allowed: Record<DinnerOrder["status"], DinnerOrder["status"][]> = { requested:["confirmed","declined"],confirmed:["served","declined"],served:[],declined:[] };
  if (!allowed[order.status].includes(status)) throw new Error("這一餐的狀態已經改變，請重新讀取。");
  order.status=status;
  if (status === "served") {
    const dish=workspace.dishes.find(d=>d.id===order.meal.recipe.id);
    const recordId=`cook_${order.id}`;
    workspace.cookRecords.push({id:recordId,dishId:order.meal.recipe.id,title:`給 ${order.guestName} 的 ${order.meal.recipe.name}`,cookedAt:new Date().toISOString().slice(0,10),reflection:"由 Sam 在餐桌訂單標記已出餐。",changes:"",photoAssetIds:[]});
    workspace.sharedMeals.push({id:`meal_${order.id}`,dishId:order.meal.recipe.id,cookRecordId:recordId,dateLabel:new Date().toISOString().slice(0,10),guestNames:[order.guestName],summary:`${order.quantity} 份 ${order.meal.recipe.name}`,feedbackIds:[]});
    if(dish) { dish.timesCooked++; dish.sharedCount++; }
  }
}
