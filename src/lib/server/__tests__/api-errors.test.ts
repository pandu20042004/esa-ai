import { describe, it, expect } from "vitest";
import { errorResponse } from "../api-errors";

describe("errorResponse", () => {
  it("returns a json response with error envelope and correlation id header", async () => {
    const response = errorResponse({
      message: "Bad thing happened",
      code: "ERR_BAD",
      status: 400,
      details: { field: "title" },
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("X-Correlation-Id")).toMatch(/^[0-9a-f-]{36}$/i);

    const body = await response.json();
    expect(body.error).toBe("Bad thing happened");
    expect(body.code).toBe("ERR_BAD");
    expect(body.details).toEqual({ field: "title" });
    expect(body.correlationId).toBe(response.headers.get("X-Correlation-Id"));
  });
});
