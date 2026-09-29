import { describe, expect, it } from "vitest";
import { initialCustomerState, mockCustomerReply, parseChefWeek } from "../lib/mock-agent";

describe("mock customer agent", () => {
  it("turns tiredness into culinary intent without becoming therapy", () => {
    const result = mockCustomerReply("今天工作很累，想吃熱熱的", initialCustomerState);
    expect(result.state.intent.energy).toBe("low");
    expect(result.state.intent.desiredExperiences).toContain("comforting");
    expect(result.state.intent.flavorPreferences).toContain("light_broth");
    expect(result.turn.text).toMatch(/今晚|湯汁|下飯/);
  });

  it("allows a decisive guest to reach a proposal in one turn", () => {
    const result = mockCustomerReply("你幫我決定就好", initialCustomerState);
    expect(result.readyForProposal).toBe(true);
  });
});

describe("chef weekly capture", () => {
  it("extracts capacity and an experiment from natural language", () => {
    const draft = parseChefWeek("今天蛤蜊很漂亮。想試蛤蜊絲瓜。週五最多 6 份。");
    expect(draft.capacity).toBe(6);
    expect(draft.marketNotes[0]).toContain("蛤蜊");
    expect(draft.experiment).toContain("蛤蜊絲瓜");
  });
});
