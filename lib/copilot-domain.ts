import { z } from "zod";
import type { UsageStats } from "./domain";
import { diningSchema, emptyDining } from "./dining-domain";

export const confidenceSchema = z.enum(["confirmed", "probable", "uncertain"]);
export const sessionStatusSchema = z.enum(["active", "paused", "archived", "discarded"]);
export const dishStageSchema = z.enum(["want_to_try", "confident", "signature"]);
export const draftReadinessSchema = z.enum(["blank", "loose", "forming", "reviewable"]);

export const captureAssetSchema = z.object({
  id: z.string(),
  kind: z.literal("image"),
  name: z.string(),
  mimeType: z.string(),
  url: z.string(),
});

export const captureSchema = z.object({
  id: z.string(),
  sessionId: z.string().nullable(),
  createdAt: z.string(),
  text: z.string(),
  assets: z.array(captureAssetSchema),
  kind: z.enum(["brainstorm", "market_observation", "cooking_reflection", "general"]),
  interpretation: z.string(),
  confidence: confidenceSchema,
});

export const webSourceSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
});

export const draftClaimSchema = z.object({
  id: z.string(),
  kind: z.enum(["sensory_target", "ingredient", "technique", "constraint", "open_question", "decision"]),
  text: z.string(),
  sourceType: z.enum(["user_message", "copilot_inference", "cook_record", "guest_feedback", "external_source"]),
  sourceLabel: z.string(),
  confidence: confidenceSchema,
  confirmation: z.enum(["unreviewed", "confirmed", "corrected"]),
});

export const dishProposalDraftSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  status: z.enum(["active", "saved", "rejected", "superseded"]),
  workingTitle: z.string().nullable(),
  relationship: z.enum(["new_idea", "existing_variation", "uncertain"]),
  readiness: draftReadinessSchema,
  claims: z.array(draftClaimSchema),
  revision: z.number().int().positive(),
  updatedAt: z.string(),
});

export const brainstormSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  teaser: z.string(),
  status: sessionStatusSchema,
  linkedDishId: z.string().nullable(),
  draft: dishProposalDraftSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const dishSchema = z.object({
  id: z.string(),
  name: z.string(),
  stage: dishStageSchema,
  summary: z.string(),
  sensoryTarget: z.string(),
  techniques: z.array(z.string()),
  successfulPatterns: z.array(z.string()),
  openQuestions: z.array(z.string()),
  versionNotes: z.array(z.string()),
  timesCooked: z.number().int().nonnegative(),
  sharedCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

export const cookRecordSchema = z.object({
  id: z.string(),
  dishId: z.string(),
  title: z.string(),
  cookedAt: z.string(),
  reflection: z.string(),
  changes: z.string(),
  photoAssetIds: z.array(z.string()),
});

export const sharedMealSchema = z.object({
  id: z.string(),
  dishId: z.string(),
  cookRecordId: z.string().nullable(),
  dateLabel: z.string(),
  guestNames: z.array(z.string()),
  summary: z.string(),
  feedbackIds: z.array(z.string()),
});

export const tasterFeedbackSchema = z.object({
  id: z.string(),
  sharedMealId: z.string(),
  tasterName: z.string(),
  comment: z.string(),
  chefReply: z.string().nullable(),
  photoUrl: z.string().nullable().optional(),
  createdAt: z.string(),
});

const usageStatsSchema = z.object({
  mode: z.enum(["mock", "openai"]),
  model: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  estimatedCostUsd: z.number(),
  latencyMs: z.number(),
  toolCalls: z.array(z.string()),
});

export const copilotMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(["chef", "copilot"]),
  text: z.string(),
  createdAt: z.string(),
  captureId: z.string().nullable(),
  photoCount: z.number().int().nonnegative(),
  webSources: z.array(webSourceSchema),
  stats: usageStatsSchema.optional(),
});

export type CopilotMessage = z.infer<typeof copilotMessageSchema> & { stats?: UsageStats };

export const copilotWorkspaceSchema = z.object({
  version: z.literal(2),
  dining: diningSchema.default(emptyDining),
  sessions: z.array(brainstormSessionSchema),
  dishes: z.array(dishSchema),
  cookRecords: z.array(cookRecordSchema),
  sharedMeals: z.array(sharedMealSchema),
  feedback: z.array(tasterFeedbackSchema),
  captures: z.array(captureSchema),
  messages: z.array(copilotMessageSchema),
  updatedAt: z.string(),
});

export type Capture = z.infer<typeof captureSchema>;
export type CaptureAsset = z.infer<typeof captureAssetSchema>;
export type WebSource = z.infer<typeof webSourceSchema>;
export type DraftClaim = z.infer<typeof draftClaimSchema>;
export type DishProposalDraft = z.infer<typeof dishProposalDraftSchema>;
export type BrainstormSession = z.infer<typeof brainstormSessionSchema>;
export type Dish = z.infer<typeof dishSchema>;
export type CookRecord = z.infer<typeof cookRecordSchema>;
export type SharedMeal = z.infer<typeof sharedMealSchema>;
export type TasterFeedback = z.infer<typeof tasterFeedbackSchema>;
export type CopilotWorkspace = z.infer<typeof copilotWorkspaceSchema> & { messages: CopilotMessage[] };

const proposedClaimSchema = draftClaimSchema.omit({ id: true, confirmation: true });

export const copilotTurnDecisionSchema = z.object({
  reply: z.string(),
  sessionTitle: z.string().nullable(),
  sessionTeaser: z.string(),
  captureKind: captureSchema.shape.kind,
  interpretation: z.string(),
  confidence: confidenceSchema,
  linkedDishId: z.string().nullable(),
  draftUpdate: z.object({
    workingTitle: z.string().nullable(),
    relationship: dishProposalDraftSchema.shape.relationship,
    readiness: draftReadinessSchema,
    claims: z.array(proposedClaimSchema).max(16),
  }).nullable(),
});

export type CopilotTurnDecision = z.infer<typeof copilotTurnDecisionSchema>;

export const copilotTurnInputSchema = z.object({
  text: z.string().max(5000).default(""),
  sessionId: z.string(),
  webSearchRequested: z.boolean().default(false),
  images: z.array(z.object({
    name: z.string().max(160),
    mimeType: z.string().regex(/^image\//),
    dataUrl: z.string().max(8_000_000),
  })).max(6).default([]),
}).refine((value) => value.text.trim().length > 0 || value.images.length > 0, {
  message: "text or at least one image is required",
});

export type CopilotTurnInput = z.infer<typeof copilotTurnInputSchema>;

export type CopilotTurnResult = {
  workspace: CopilotWorkspace;
  mode: "mock" | "openai";
  model: string;
  stats: UsageStats;
};
