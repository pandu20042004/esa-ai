import { describe, expect, it } from "vitest";

import { getThreadMessageActions, getRunIdFromMessageContext } from "../thread-actions";

describe("workflow thread actions", () => {
  it("allows user prompts to be edited or deleted", () => {
    expect(getThreadMessageActions("user")).toEqual(["edit", "delete"]);
  });

  it("allows agent output to be deleted but not edited", () => {
    expect(getThreadMessageActions("assistant")).toEqual(["delete"]);
  });

  it("extracts the linked run id from message context", () => {
    expect(getRunIdFromMessageContext({ runId: "run-123" })).toBe("run-123");
    expect(getRunIdFromMessageContext({ runId: 123 })).toBeNull();
    expect(getRunIdFromMessageContext(null)).toBeNull();
  });
});
