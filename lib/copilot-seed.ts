import type { CopilotWorkspace } from "./copilot-domain";

export function createSeedWorkspace(now = new Date().toISOString()): CopilotWorkspace {
  return {
    version: 2,
    dining: { initialized: false, offerings: [], sessions: [], orders: [] },
    sessions: [
      {
        id: "session_loofah", title: "絲瓜怎麼做得更有層次？", teaser: "想保留清甜，但不要再是普通的蛤蜊絲瓜。", status: "active", linkedDishId: "dish_clam_loofah",
        draft: {
          id: "draft_loofah", sessionId: "session_loofah", status: "active", workingTitle: "炙燒絲瓜蛤蜊", relationship: "existing_variation", readiness: "forming", revision: 2, updatedAt: now,
          claims: [
            { id: "claim_l1", kind: "sensory_target", text: "保留蛤蜊湯汁的清甜，增加一點焦香與層次。", sourceType: "user_message", sourceLabel: "你剛才說的", confidence: "confirmed", confirmation: "confirmed" },
            { id: "claim_l2", kind: "technique", text: "絲瓜切厚片，先乾煎上色，再與蛤蜊湯汁會合。", sourceType: "copilot_inference", sourceLabel: "Copilot 推測", confidence: "probable", confirmation: "unreviewed" },
            { id: "claim_l3", kind: "constraint", text: "薑量保守，避免蓋過蛤蜊。", sourceType: "cook_record", sourceLabel: "上次料理記錄", confidence: "confirmed", confirmation: "confirmed" },
            { id: "claim_l4", kind: "open_question", text: "焦香要來自絲瓜本身，還是最後補一點麻油？", sourceType: "copilot_inference", sourceLabel: "還沒確定", confidence: "uncertain", confirmation: "unreviewed" },
          ],
        },
        createdAt: now, updatedAt: now,
      },
      {
        id: "session_market", title: "市場看到漂亮的青辣椒", teaser: "還不知道要做什麼，只是不想忘記它的香氣。", status: "paused", linkedDishId: null, draft: null, createdAt: now, updatedAt: now,
      },
      {
        id: "session_chicken", title: "菜脯雞腿下一版", teaser: "Amy 覺得很下飯，但希望尾韻不要那麼鹹。", status: "paused", linkedDishId: "dish_chicken_daikon",
        draft: {
          id: "draft_chicken", sessionId: "session_chicken", status: "active", workingTitle: "菜脯燒雞腿・淡口版", relationship: "existing_variation", readiness: "loose", revision: 1, updatedAt: now,
          claims: [{ id: "claim_c1", kind: "constraint", text: "保留菜脯香，但降低收汁後的鹹度。", sourceType: "guest_feedback", sourceLabel: "Amy 的回饋", confidence: "confirmed", confirmation: "confirmed" }],
        },
        createdAt: now, updatedAt: now,
      },
    ],
    dishes: [
      {
        id: "dish_clam_loofah", name: "薑香蛤蜊絲瓜", stage: "confident", summary: "清甜、有湯汁，適合做成舒服的小份餐。", sensoryTarget: "清甜、溫熱、有湯汁",
        techniques: ["蛤蜊開口即先取出", "絲瓜用蛤蜊湯汁煨熟"], successfulPatterns: ["薑量保守", "蛤蜊先確認吐沙與鮮度"], openQuestions: ["不同大小蛤蜊對湯味的影響"], versionNotes: ["v3：薑量減半後比較乾淨"], timesCooked: 4, sharedCount: 2, updatedAt: now,
      },
      {
        id: "dish_chicken_daikon", name: "菜脯燒雞腿", stage: "confident", summary: "鹹香下飯，菜脯批次差異大，需要先試味。", sensoryTarget: "鹹香、油潤、白飯友善",
        techniques: ["雞腿先煎上色", "菜脯先泡後試味"], successfulPatterns: ["收汁前先試菜脯鹹度"], openQuestions: ["淡口版能否保留足夠尾韻"], versionNotes: ["v2：改用碎菜脯，香氣比較均勻"], timesCooked: 3, sharedCount: 1, updatedAt: now,
      },
      {
        id: "dish_tomato_egg", name: "番茄炒蛋", stage: "want_to_try", summary: "蛋的熟度已穩定，正在找更自然的番茄酸甜。", sensoryTarget: "滑嫩、明亮、帶一點酸香",
        techniques: ["蛋七分熟先取出"], successfulPatterns: ["蛋保持滑嫩"], openQuestions: ["番茄預炒時間是否能增加酸香"], versionNotes: [], timesCooked: 2, sharedCount: 0, updatedAt: now,
      },
    ],
    cookRecords: [
      { id: "cook_loofah_4", dishId: "dish_clam_loofah", title: "第四次蛤蜊絲瓜", cookedAt: "2026-08-22", reflection: "湯很乾淨，薑比上次少一半剛好。", changes: "蛤蜊開口後先取出，最後才放回。", photoAssetIds: [] },
      { id: "cook_chicken_3", dishId: "dish_chicken_daikon", title: "週末菜脯雞腿", cookedAt: "2026-08-16", reflection: "雞腿很好，但收汁後稍鹹。", changes: "菜脯泡水十分鐘。", photoAssetIds: [] },
    ],
    sharedMeals: [
      { id: "shared_loofah", dishId: "dish_clam_loofah", cookRecordId: "cook_loofah_4", dateLabel: "8月22日", guestNames: ["小林", "Ken"], summary: "兩份晚餐，配白飯和燙青菜。", feedbackIds: ["feedback_lin", "feedback_ken"] },
      { id: "shared_chicken", dishId: "dish_chicken_daikon", cookRecordId: "cook_chicken_3", dateLabel: "8月16日", guestNames: ["Amy"], summary: "一份菜脯雞腿便當。", feedbackIds: ["feedback_amy"] },
    ],
    feedback: [
      { id: "feedback_lin", sharedMealId: "shared_loofah", tasterName: "小林", comment: "湯很甜，絲瓜如果有一點焦香我會更喜歡。", chefReply: "收到，下次我想先把絲瓜煎一下。", createdAt: now },
      { id: "feedback_ken", sharedMealId: "shared_loofah", tasterName: "Ken", comment: "很舒服，飯可以再多一點。", chefReply: null, createdAt: now },
      { id: "feedback_amy", sharedMealId: "shared_chicken", tasterName: "Amy", comment: "雞腿很香，但最後幾口有一點鹹。", chefReply: "我也有同感，下一版會先調菜脯。", createdAt: now },
    ],
    captures: [],
    messages: [
      { id: "msg_l1", sessionId: "session_loofah", role: "chef", text: "今天市場的絲瓜很好，但我不想再做普通的蛤蜊絲瓜。", createdAt: now, captureId: null, photoCount: 0, webSources: [] },
      { id: "msg_l2", sessionId: "session_loofah", role: "copilot", text: "那就先不要急著換掉它。你上次已經把湯的清甜做穩了；這次也許只要替絲瓜本身加一點焦香。你想讓它仍然像家常湯菜，還是更像一小盤主菜？", createdAt: now, captureId: null, photoCount: 0, webSources: [] },
      { id: "msg_m1", sessionId: "session_market", role: "chef", text: "市場看到一批很香的青辣椒，先留著這個念頭。", createdAt: now, captureId: null, photoCount: 0, webSources: [] },
      { id: "msg_m2", sessionId: "session_market", role: "copilot", text: "好，先只留下香氣這件事，不替它硬湊成一道菜。等你想到想配的食材，再回來接著聊。", createdAt: now, captureId: null, photoCount: 0, webSources: [] },
      { id: "msg_c1", sessionId: "session_chicken", role: "chef", text: "Amy 喜歡菜脯雞腿，但說最後幾口有點鹹。我也覺得可以再乾淨一點。", createdAt: now, captureId: null, photoCount: 0, webSources: [] },
      { id: "msg_c2", sessionId: "session_chicken", role: "copilot", text: "這次不需要推翻原本做法。先把問題收在菜脯的批次鹹度和收汁程度，雞腿上色這個你已經做得很穩。", createdAt: now, captureId: null, photoCount: 0, webSources: [] },
    ],
    updatedAt: now,
  };
}
