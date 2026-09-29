export type SessionStatus = "exploring" | "inviting" | "confirmed" | "completed";

export type TasterSummary = {
  id: string;
  name: string;
  status: "invited" | "replied" | "confirmed";
  intent?: string;
  allergy?: string;
  adjustment?: string;
};

export type MealSessionSummary = {
  id: string;
  title: string;
  dateLabel: string;
  intention: string;
  status: SessionStatus;
  capacity: number;
  committed: number;
  dishId?: string;
  dishName?: string;
  memoryCue?: string;
  chefNote?: string;
  tasters: TasterSummary[];
};

export type CopilotMessage = {
  id: string;
  role: "chef" | "copilot";
  text: string;
  createdAt: string;
  photos?: string[];
  receipt?: {
    label: string;
    interpretation: string;
    confidence: "confirmed" | "probable" | "uncertain";
  };
};

export const demoMealSessions: MealSessionSummary[] = [
  {
    id: "meal_0807_clams",
    title: "星期五的蛤蜊絲瓜",
    dateLabel: "8月7日 · 18:00",
    intention: "想煮得清甜一點，最多分享四份。",
    status: "confirmed",
    capacity: 4,
    committed: 3,
    dishId: "dish_clam_loofah",
    dishName: "薑香蛤蜊絲瓜",
    memoryCue: "上次你覺得薑太多；較小的蛤蜊讓湯味偏淡。",
    chefNote: "今天市場的蛤蜊很好，我想煮得清甜一點。",
    tasters: [
      { id: "lin", name: "小林", status: "confirmed", intent: "熱的、舒服、不要太油", allergy: "花生嚴重過敏", adjustment: "少飯、多絲瓜、不加香菜" },
      { id: "amy", name: "Amy", status: "confirmed", intent: "清爽、有湯汁", adjustment: "標準份量" },
      { id: "ken", name: "Ken", status: "replied", intent: "想吃飽一點", adjustment: "等待你確認" },
    ],
  },
  {
    id: "meal_0810_chicken",
    title: "星期一想煮菜脯雞腿",
    dateLabel: "8月10日 · 時間未定",
    intention: "想找兩位朋友一起吃，但還沒決定要不要開放。",
    status: "exploring",
    capacity: 2,
    committed: 0,
    dishId: "dish_chicken_daikon",
    dishName: "菜脯燒雞腿",
    memoryCue: "這道你已經穩定煮過三次；菜脯批次鹹度需要先試味。",
    tasters: [],
  },
];

export const initialCopilotMessages: CopilotMessage[] = [
  {
    id: "hello",
    role: "copilot",
    text: "早。星期五那頓已經有三位朋友回覆；小林的花生過敏我放在最前面。你今天想到什麼，直接留在這裡就好。",
    createdAt: "09:12",
  },
];
