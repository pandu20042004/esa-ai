export type ThreadMessageAction = "edit" | "delete";

export function getThreadMessageActions(role: string): ThreadMessageAction[] {
  return role === "user" ? ["edit", "delete"] : ["delete"];
}

export function getRunIdFromMessageContext(context: unknown): string | null {
  if (!context || typeof context !== "object") return null;
  const runId = (context as { runId?: unknown }).runId;
  return typeof runId === "string" && runId.trim() ? runId : null;
}
