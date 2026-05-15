export type AgentChoiceOption = {
  id?: string;
  key?: string;
  label: string;
  description?: string;
  detail?: string;
  result?: string;
};

export type AgentChoice = {
  needs_user_choice: true;
  question: string;
  options: AgentChoiceOption[];
};

const jsonFenceRegex = /```json\s*\n([\s\S]*?)\n```/g;

export function extractAgentChoiceFromMessage(
  content: string,
  context: unknown,
): { displayText: string; choice: AgentChoice | null } {
  const contextChoice = getContextChoice(context);
  if (contextChoice) return { displayText: content.trim(), choice: contextChoice };

  let choice: AgentChoice | null = null;
  const displayText = content.replace(jsonFenceRegex, (match, body: string) => {
    const parsed = parseAgentChoice(body);
    if (!parsed) return match;
    choice = parsed;
    return "";
  });

  return {
    displayText: displayText.replace(/\n{3,}/g, "\n\n").trim(),
    choice: choice ?? buildFallbackChoice(displayText),
  };
}

export function isAgentChoice(value: unknown): value is AgentChoice {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AgentChoice>;
  return (
    candidate.needs_user_choice === true &&
    typeof candidate.question === "string" &&
    candidate.question.trim().length > 0 &&
    Array.isArray(candidate.options) &&
    candidate.options.length > 0 &&
    candidate.options.every((option) => Boolean(option) && typeof option === "object" && typeof (option as AgentChoiceOption).label === "string")
  );
}

function getContextChoice(context: unknown): AgentChoice | null {
  if (!context || typeof context !== "object") return null;
  const choice = (context as { needsUserChoice?: unknown }).needsUserChoice;
  return isAgentChoice(choice) ? choice : null;
}

function parseAgentChoice(raw: string): AgentChoice | null {
  try {
    const value = JSON.parse(raw.trim());
    return isAgentChoice(value) ? value : null;
  } catch {
    return null;
  }
}

function buildFallbackChoice(content: string): AgentChoice | null {
  const text = content.trim();
  if (!hasStrongChoiceIntent(text)) return null;

  const numbered = Array.from(text.matchAll(/^\s*(\d+)[.)]\s+(.+)$/gm))
    .map((match) => ({ number: Number(match[1]), label: match[2].trim() }))
    .filter((item) => Number.isInteger(item.number) && item.number >= 1 && item.number <= 9);

  const hasAnglePrompt = /\b(angle|ideation|resonates|pilih|choose|fresh round|refine|refinement)\b/i.test(text);
  const firstFive = numbered.filter((item) => item.number >= 1 && item.number <= 5);
  if (hasAnglePrompt && firstFive.length >= 3) {
    return {
      needs_user_choice: true,
      question: "Choose an ideation direction.",
      options: [
        ...firstFive.slice(0, 5).map((item) => ({
          id: `angle_${item.number}`,
          label: `Angle ${item.number}`,
          description: item.label.slice(0, 500),
        })),
        { id: "revise", label: "Revise", description: "Ask the agent to refine one or more angles." },
        { id: "fresh_round", label: "Fresh round", description: "Generate a new set of angles." },
      ],
    };
  }

  if (/\b(approve|approved|confirm|confirmation|ready|lanjut|setuju|konfirmasi)\b/i.test(text)) {
    return {
      needs_user_choice: true,
      question: "Confirm the next step.",
      options: [
        { id: "approve_continue", label: "Approve", description: "Accept this stage output and continue." },
        { id: "revise", label: "Revise", description: "Keep discussing or ask the agent to revise." },
      ],
    };
  }

  return null;
}

function hasStrongChoiceIntent(text: string): boolean {
  return /\b(pilih|choose|which|resonates|approve|confirm|confirmation|ready|lanjut|setuju|konfirmasi|fresh round|refine)\b/i.test(text);
}
