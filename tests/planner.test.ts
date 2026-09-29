import { describe, expect, it } from "vitest";
import { demoKitchen } from "../lib/demo-data";
import { planMeals, reserveProposal } from "../lib/planner";
import type { MealIntent } from "../lib/domain";

const intent: MealIntent = {
  energy: "low",
  desiredExperiences: ["warm", "comforting", "not_too_heavy"],
  flavorPreferences: ["savory"],
  avoidTonight: [],
  appetite: "normal",
  customerWords: ["今天很累，想吃熱熱的"],
};

describe("deterministic meal planner", () => {
  it("ranks a proven comforting meal first", () => {
    const proposals = planMeals({ intent, constraints: [], kitchen: demoKitchen });
    expect(proposals[0].recipe.id).toBe("chicken-daikon");
    expect(proposals[0].status).toBe("ready");
  });

  it("filters shellfish for a shellfish allergy", () => {
    const proposals = planMeals({
      intent: { ...intent, flavorPreferences: ["light_broth"] },
      constraints: [{ kind: "allergy", ingredient: "shellfish", severity: "severe" }],
      kitchen: demoKitchen,
    });
    expect(proposals.some((proposal) => proposal.recipe.id === "clam-loofah")).toBe(false);
  });

  it("filters dishes above budget", () => {
    const proposals = planMeals({ intent, constraints: [], kitchen: demoKitchen, maxPrice: 19 });
    expect(proposals.every((proposal) => proposal.recipe.price <= 19)).toBe(true);
  });

  it("reserves capacity and one recipe portion atomically in domain state", () => {
    const proposal = planMeals({ intent, constraints: [], kitchen: demoKitchen })[0];
    const updated = reserveProposal(proposal, demoKitchen);
    expect(updated.committed).toBe(demoKitchen.committed + 1);
    expect(updated.recipes.find((recipe) => recipe.id === proposal.recipe.id)?.portionsAvailable).toBe(
      proposal.recipe.portionsAvailable - 1,
    );
    expect(demoKitchen.committed).toBe(3);
  });

  it("returns no proposals when kitchen capacity is full", () => {
    const proposals = planMeals({ intent, constraints: [], kitchen: { ...demoKitchen, committed: 10 } });
    expect(proposals).toEqual([]);
  });
});
