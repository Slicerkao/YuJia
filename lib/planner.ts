import type { Constraint, KitchenWindow, MealIntent, Proposal, RecipeCapability } from "./domain";

const maturityScore: Record<RecipeCapability["maturity"], number> = {
  note: -100,
  tested_once: -20,
  repeatable: 2,
  stable: 5,
  batch_ready: 6,
};

const aliases: Record<string, string[]> = {
  shellfish: ["shellfish", "蛤蜊", "蝦", "蟹"],
  fish: ["fish", "魚", "鯖魚"],
  soy: ["soy", "黃豆", "豆腐", "味噌", "醬油"],
  egg: ["egg", "雞蛋", "蛋"],
  peanut: ["peanut", "花生"],
};

function recipeViolates(recipe: RecipeCapability, constraints: Constraint[]) {
  const haystack = [...recipe.ingredients, ...recipe.allergens].join("|").toLowerCase();
  return constraints.find((constraint) => {
    if (constraint.kind === "dislike") return false;
    const terms = aliases[constraint.ingredient.toLowerCase()] ?? [constraint.ingredient];
    return terms.some((term) => haystack.includes(term.toLowerCase()));
  });
}

export function planMeals(input: {
  intent: MealIntent;
  constraints: Constraint[];
  kitchen: KitchenWindow;
  maxPrice?: number;
}): Proposal[] {
  const { intent, constraints, kitchen, maxPrice = Infinity } = input;
  if (kitchen.committed >= kitchen.capacity) return [];

  return kitchen.recipes
    .map((recipe): Proposal => {
      const violation = recipeViolates(recipe, constraints);
      const unavailable = recipe.portionsAvailable < 1 || recipe.price > maxPrice || recipe.maturity === "note";
      const desired = [...intent.desiredExperiences, ...intent.flavorPreferences];
      const tagMatches = desired.filter((tag) => recipe.tags.includes(tag));
      const avoidMatches = intent.avoidTonight.filter((item) =>
        recipe.ingredients.some((ingredient) => ingredient.includes(item)),
      );
      const dislikeMatches = constraints.filter(
        (constraint) =>
          constraint.kind === "dislike" &&
          recipe.ingredients.some((ingredient) => ingredient.includes(constraint.ingredient)),
      );
      const score = maturityScore[recipe.maturity] + tagMatches.length * 4 - avoidMatches.length * 8 - dislikeMatches.length * 4;
      const status: Proposal["status"] = violation || unavailable ? "unavailable" : recipe.maturity === "tested_once" ? "chef_review" : "ready";
      return {
        id: `proposal-${recipe.id}`,
        recipe,
        score,
        fitReasons: tagMatches.length ? tagMatches.slice(0, 3) : ["本週食材狀態很好", "份量與時間都合適"],
        status,
        warnings: [
          ...(violation ? [`與限制「${violation.ingredient}」衝突`] : []),
          ...(recipe.portionsAvailable < 1 ? ["本週份量已滿"] : []),
          ...(recipe.price > maxPrice ? ["超出預算"] : []),
        ],
      };
    })
    .filter((proposal) => proposal.status !== "unavailable")
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function reserveProposal(proposal: Proposal, kitchen: KitchenWindow): KitchenWindow {
  if (proposal.status !== "ready") throw new Error("This proposal is not ready to commit.");
  if (kitchen.committed >= kitchen.capacity) throw new Error("Kitchen capacity is full.");
  const recipe = kitchen.recipes.find((item) => item.id === proposal.recipe.id);
  if (!recipe || recipe.portionsAvailable < 1) throw new Error("Recipe inventory is no longer available.");
  return {
    ...kitchen,
    committed: kitchen.committed + 1,
    recipes: kitchen.recipes.map((item) =>
      item.id === recipe.id ? { ...item, portionsAvailable: item.portionsAvailable - 1 } : item,
    ),
  };
}
