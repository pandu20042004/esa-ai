import { describe, expect, it } from "vitest";

import { getSearchBudget } from "../search-budget";

describe("getSearchBudget", () => {
  it("uses balanced as the default quality-preserving budget", () => {
    expect(getSearchBudget("ideation")).toMatchObject({
      mode: "balanced",
      webSoftLimit: 10,
      webHardLimit: 25,
    });
  });

  it("gives research a larger scholarly budget and web fallback guard", () => {
    expect(getSearchBudget("research", "deep")).toMatchObject({
      mode: "deep",
      scholarlySoftLimit: 150,
      scholarlyHardLimit: 300,
      webSoftLimit: 50,
      webHardLimit: 100,
    });
  });

  it("keeps fast mode cheap for rough ideation", () => {
    expect(getSearchBudget("ideation", "fast")).toMatchObject({
      mode: "fast",
      webSoftLimit: 3,
      webHardLimit: 6,
    });
  });

  it("caps deep ideation web search at the agreed hard guard", () => {
    expect(getSearchBudget("ideation", "deep")).toMatchObject({
      mode: "deep",
      webSoftLimit: 20,
      webHardLimit: 30,
    });
  });

  it("keeps writing from doing new search by default", () => {
    expect(getSearchBudget("writing", "balanced")).toMatchObject({
      scholarlySoftLimit: 0,
      webSoftLimit: 0,
      webHardLimit: 0,
    });
  });
});
