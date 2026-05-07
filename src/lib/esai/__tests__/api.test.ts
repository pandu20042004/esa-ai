import { describe, expect, it } from "vitest";

import { createApiEnvelope, validateModelRequest } from "@/lib/esai/api";

describe("api helpers", () => {
  it("marks responses as mock mode when Supabase is not configured", () => {
    const response = createApiEnvelope([{ id: "demo" }], { supabaseConfigured: false });

    expect(response.meta.backendMode).toBe("mock");
    expect(response.data).toEqual([{ id: "demo" }]);
  });

  it("validates model execution requests", () => {
    expect(validateModelRequest({ model: "", reasoningEffort: "medium" }).success).toBe(false);
    expect(validateModelRequest({ model: "GPT-5.4", reasoningEffort: "medium" }).success).toBe(true);
  });
});

