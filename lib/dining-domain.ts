import { z } from "zod";

export const recipeSnapshotSchema = z.object({
  id: z.string(), name: z.string(), summary: z.string(), sensoryTarget: z.string(),
  techniques: z.array(z.string()), updatedAt: z.string(),
});
export const offeringSchema = z.object({
  id: z.string(), recipe: recipeSnapshotSchema, description: z.string(), chefNote: z.string(),
  price: z.number().int().nonnegative(), capacity: z.number().int().nonnegative(),
  pickup: z.string(), sides: z.array(z.string()), allergenNote: z.string(),
  published: z.boolean(), demoDetails: z.boolean(),
});
export const diningMessageSchema = z.object({ role: z.enum(["guest", "host"]), text: z.string(), at: z.string() });
export const diningSessionSchema = z.object({
  id: z.string(), messages: z.array(diningMessageSchema), recommendedOfferingId: z.string().nullable(),
  needsChef: z.boolean(), preferenceSummary: z.string(),
  runs: z.array(z.object({ model: z.string(), inputTokens: z.number(), outputTokens: z.number(), estimatedCostUsd: z.number(), latencyMs: z.number() })),
});
export const orderSchema = z.object({
  id: z.string(), guestId: z.string(), sessionId: z.string().nullable(), offeringId: z.string(),
  meal: offeringSchema, guestName: z.string(), quantity: z.number().int().min(1).max(6),
  dietary: z.string(), note: z.string(), preferenceSummary: z.string(),
  status: z.enum(["requested", "confirmed", "served", "declined"]),
  createdAt: z.string(), requestKey: z.string(),
  messages: z.array(z.object({ id: z.string(), author: z.enum(["guest", "chef"]), text: z.string(), at: z.string() })),
  feedback: z.object({ comment: z.string(), photoUrl: z.string().nullable(), at: z.string() }).nullable(),
});
export const diningSchema = z.object({
  initialized: z.boolean(), offerings: z.array(offeringSchema), sessions: z.array(diningSessionSchema), orders: z.array(orderSchema),
});
export const emptyDining = () => ({ initialized: false, offerings: [], sessions: [], orders: [] });
export type Offering = z.infer<typeof offeringSchema>;
export type DinnerOrder = z.infer<typeof orderSchema>;
export type DiningSession = z.infer<typeof diningSessionSchema>;
export type Dining = z.infer<typeof diningSchema>;
export function remainingPortions(dining: Dining, offeringId: string) {
  const offer = dining.offerings.find(o => o.id === offeringId);
  return Math.max(0, (offer?.capacity ?? 0) - dining.orders.filter(o => o.offeringId === offeringId && o.status !== "declined").reduce((n, o) => n + o.quantity, 0));
}
export const checkoutSchema = z.object({
  offeringId: z.string(), guestName: z.string().trim().min(1).max(60), quantity: z.number().int().min(1).max(6),
  dietary: z.string().trim().min(1).max(500), note: z.string().trim().max(1000),
  reviewed: z.literal(true), requestKey: z.string().min(8).max(100),
});
export function validateCheckout(dining: Dining, input: z.infer<typeof checkoutSchema>) {
  const offer = dining.offerings.find(o => o.id === input.offeringId && o.published);
  if (!offer) throw new Error("這道菜暫時沒有供應，請重新選一道。");
  if (input.quantity > remainingPortions(dining, offer.id)) throw new Error("剩下的份數不夠了，請調整份數或換一道。");
  return offer;
}
