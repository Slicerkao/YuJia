import { z } from "zod";

export const mealIntentSchema = z.object({
  energy: z.enum(["low", "steady", "high"]).default("steady"),
  desiredExperiences: z.array(z.string()).default([]),
  flavorPreferences: z.array(z.string()).default([]),
  avoidTonight: z.array(z.string()).default([]),
  appetite: z.enum(["small", "normal", "hungry"]).default("normal"),
  customerWords: z.array(z.string()).max(3).default([]),
});

export type MealIntent = z.infer<typeof mealIntentSchema>;

export type Constraint = {
  kind: "allergy" | "dietary" | "dislike";
  ingredient: string;
  severity?: "mild" | "severe";
};

export type RecipeCapability = {
  id: string;
  name: string;
  description: string;
  maturity: "note" | "tested_once" | "repeatable" | "stable" | "batch_ready";
  tags: string[];
  ingredients: string[];
  allergens: string[];
  portionsAvailable: number;
  leadDays: number;
  cost: number;
  price: number;
  activeMinutes: number;
  allowedVariations: string[];
  chefNotes: string[];
  palette: string;
};

export type KitchenWindow = {
  id: string;
  weekLabel: string;
  serviceDate: string;
  capacity: number;
  committed: number;
  marketNotes: string[];
  experiment: string;
  recipes: RecipeCapability[];
};

export type Proposal = {
  id: string;
  recipe: RecipeCapability;
  score: number;
  fitReasons: string[];
  status: "ready" | "chef_review" | "unavailable";
  warnings: string[];
};

export type Order = {
  id: string;
  customerName: string;
  recipeId: string;
  recipeName: string;
  serviceDate: string;
  pickupWindow: string;
  adjustments: string[];
  constraints: Constraint[];
  intent: MealIntent;
  price: number;
  status: "confirmed" | "prepping" | "ready" | "completed";
};

export type UsageStats = {
  mode: "mock" | "openai";
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  toolCalls: string[];
};

export type ChatTurn = {
  role: "assistant" | "user";
  text: string;
  stats?: UsageStats;
};
