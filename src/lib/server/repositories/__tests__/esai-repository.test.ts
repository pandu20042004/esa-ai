import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createEsaiRepository } from "@/lib/server/repositories/esai-repository";

describe("esai repository", () => {
  it("uses deterministic mock data when Supabase is not configured", async () => {
    const repository = createEsaiRepository({ supabaseConfigured: false });
    const competitions = await repository.listCompetitions();

    expect(competitions.meta.backendMode).toBe("mock");
    expect(competitions.data).toEqual([]);
  });
});
