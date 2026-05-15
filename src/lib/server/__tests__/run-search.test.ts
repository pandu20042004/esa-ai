import { describe, expect, it } from "vitest";

import { formatSearchContext, type SearchSource } from "../run-search";

describe("formatSearchContext", () => {
  it("does not claim app search happened when no sources were collected", () => {
    expect(formatSearchContext([])).toContain("Do not claim that the ESAI web-search layer found sources");
  });

  it("serializes real provider sources for the agent prompt", () => {
    const sources: SearchSource[] = [{
      provider: "openalex",
      capturedFrom: "app_search",
      query: "Indonesia youth innovation",
      url: "https://openalex.org/W123",
      title: "Youth innovation in Indonesia",
      snippet: "A short abstract.",
    }];
    const context = formatSearchContext(sources);
    expect(context).toContain("[openalex] Youth innovation in Indonesia");
    expect(context).toContain("URL: https://openalex.org/W123");
    expect(context).toContain("Query: Indonesia youth innovation");
  });
});
