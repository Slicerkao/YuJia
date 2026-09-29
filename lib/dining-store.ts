import "server-only";
import { getCopilotWorkspace, updateCopilotWorkspace } from "./copilot-store";
import type { CopilotWorkspace } from "./copilot-domain";
import type { Offering } from "./dining-domain";

export function initializeDining(w: CopilotWorkspace) {
  if (w.dining.initialized) return;
  const names = ["白味噌茴香藤椒燉羊肉", "青辣椒香煎雞腿"];
  w.dining.offerings = names.flatMap((name, i) => {
    const d = w.dishes.find(d => d.name === name);
    if (!d) return [];
    const offer: Offering = {
      id: `week_${d.id}`, recipe: { id: d.id, name: d.name, summary: d.summary, sensoryTarget: d.sensoryTarget, techniques: [...d.techniques], updatedAt: d.updatedAt },
      description: i === 0 ? "白味噌的鹹甜、茴香的香氣，最後留一點藤椒的微麻。" : "雞腿煎出油香，青辣椒保留清香，辣度溫和但不是完全不辣。",
      chefNote: "", price: i === 0 ? 320 : 260, capacity: 8,
      pickup: "本週六 18:00–19:00 · 自取（時間與地點由 Sam 回覆確認）",
      sides: ["白飯"],
      allergenNote: i === 0 ? "食譜提到乳製品、大豆（白味噌）；味噌品牌及其他過敏原待 Sam 確認。" : "含青辣椒；醃料、調味料與交叉接觸情況待 Sam 確認。",
      published: true, demoDetails: true,
    };
    return [offer];
  });
  w.dining.initialized = true;
}
export async function getDiningWorkspace() {
  const w = await getCopilotWorkspace();
  if (w.dining.initialized) return w;
  return (await updateCopilotWorkspace(w => { initializeDining(w); return { workspace: w, value: null }; })).workspace;
}
export function mutateDining<T>(fn: (w: CopilotWorkspace) => T | Promise<T>) {
  return updateCopilotWorkspace(async w => { initializeDining(w); return { workspace: w, value: await fn(w) }; });
}
