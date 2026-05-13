import { randomUUID } from "node:crypto";

export type ApiErrorInput = {
  message: string;
  code: string;
  status: number;
  details?: Record<string, unknown>;
  cause?: unknown;
};

export function errorResponse(input: ApiErrorInput): Response {
  const correlationId = randomUUID();
  if (input.cause) {
    console.error(`[api-error] ${correlationId} ${input.code}:`, input.message, input.cause);
  } else {
    console.error(`[api-error] ${correlationId} ${input.code}:`, input.message);
  }

  return Response.json(
    {
      error: input.message,
      code: input.code,
      correlationId,
      details: input.details,
    },
    {
      status: input.status,
      headers: { "X-Correlation-Id": correlationId },
    },
  );
}
