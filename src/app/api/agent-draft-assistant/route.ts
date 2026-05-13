import { CONTROLLED_OUTPUT_LABELS, createSafeContractKey } from "@/lib/esai/agent-contracts";
import { getRequestUser, unauthorizedResponse } from "@/lib/server/auth";

const meta = { backendMode: "supabase", appliesToDraftOnly: true };

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user) return unauthorizedResponse();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isAssistantBody(body)) {
    return Response.json({ error: "Describe what this agent should do first." }, { status: 400 });
  }

  if (!hasAssistantModelConfigured()) {
    return Response.json(
      {
        error: "Choose a model first.",
        message: "The Assistant needs a configured model before it can suggest prompt and output labels.",
      },
      { status: 409 },
    );
  }

  const agentName = body.agentName.trim() || "Custom agent";
  const key = createSafeContractKey(agentName);
  const role = CONTROLLED_OUTPUT_LABELS.includes("final_output") ? "final_output" : "custom_output";

  return Response.json({
    data: {
      explanation: "Draft suggestion prepared. Review it before applying.",
      draftSkillContent: [
        `# ${agentName}`,
        "",
        body.message.trim(),
        "",
        "Return a clear result and label the produced output for downstream agents.",
      ].join("\n"),
      needs: [],
      produces: [
        {
          key: `${key}_output`,
          label: `${agentName} output`,
          role,
          defaultFilename: `${key}_output.md`,
        },
      ],
    },
    meta,
  });
}

type AssistantBody = {
  agentName: string;
  message: string;
};

function isAssistantBody(value: unknown): value is AssistantBody {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as AssistantBody).agentName === "string" &&
    typeof (value as AssistantBody).message === "string" &&
    Boolean((value as AssistantBody).message.trim())
  );
}

function hasAssistantModelConfigured() {
  return Boolean(
    process.env.ENABLE_LOCAL_CLI_PROVIDERS === "true" ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENROUTER_API_KEY,
  );
}
