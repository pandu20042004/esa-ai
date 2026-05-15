import { describe, expect, it } from "vitest";

import { selectInitialCompetition } from "../competition-selection";

describe("competition selection", () => {
  const competitions = [
    { id: "new-empty", title: "New" },
    { id: "old-with-history", title: "Old" },
  ];

  it("restores the last opened competition when it still exists", () => {
    expect(selectInitialCompetition(competitions, "old-with-history")?.id).toBe("old-with-history");
  });

  it("falls back to the first competition when there is no saved match", () => {
    expect(selectInitialCompetition(competitions, "missing")?.id).toBe("new-empty");
    expect(selectInitialCompetition(competitions, null)?.id).toBe("new-empty");
  });
});
