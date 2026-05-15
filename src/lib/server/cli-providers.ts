import "server-only";

import { execSync } from "child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export type CliProvider = {
  id: string;
  name: string;
  command: string;
  version: string | null;
  installed: boolean;
  color: string;
  models: CliModel[];
  warnings?: string[];
};

export type CliModel = {
  id: string;
  label: string;
  provider: string;
  description?: string;
  reasoningEfforts?: string[];
  defaultReasoningEffort?: string;
  source?: string;
};

type ProviderSpec = {
  id: string;
  name: string;
  command: string;
  color: string;
  versionFlag: string;
  detectModels?: () => CliModel[];
};

const KNOWN_PROVIDERS: ProviderSpec[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    command: "claude",
    color: "#e8956d",
    versionFlag: "--version",
    detectModels: detectClaudeModels,
  },
  {
    id: "codex-cli",
    name: "Codex CLI",
    command: "codex",
    color: "#10b981",
    versionFlag: "--version",
    detectModels: detectCodexModels,
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    command: "gemini",
    color: "#6366f1",
    versionFlag: "--version",
    detectModels: detectGeminiModels,
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    command: "openclaw",
    color: "#ef4444",
    versionFlag: "--version",
    detectModels: detectOpenClawModels,
  },
  {
    id: "devin",
    name: "Devin for Terminal",
    command: "devin",
    color: "#6b7280",
    versionFlag: "--version",
  },
  {
    id: "opencode",
    name: "OpenCode",
    command: "opencode",
    color: "#10b981",
    versionFlag: "--version",
  },
  {
    id: "hermes",
    name: "Hermes",
    command: "hermes",
    color: "#8b5cf6",
    versionFlag: "--version",
  },
];

function run(command: string, timeout = 5000, env?: Partial<NodeJS.ProcessEnv>): string {
  return execSync(command, {
    timeout,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    env: env ? { ...process.env, ...env } : process.env,
  }).trim();
}

function detectVersion(command: string, flag: string): string | null {
  try {
    const output = run(`${command} ${flag}`, 5000);
    const firstLine = output.split("\n")[0]?.trim() ?? "";
    return firstLine.slice(0, 120) || command;
  } catch {
    return null;
  }
}

function isCommandAvailable(command: string): boolean {
  try {
    const whereCmd = process.platform === "win32" ? "where" : "which";
    run(`${whereCmd} ${command}`, 3000);
    return true;
  } catch {
    return false;
  }
}

// --- Per-provider model detection ----------------------------------------------------

export function parseCodexDebugModels(raw: string): CliModel[] {
  const parsed = JSON.parse(raw) as { models?: Array<Record<string, unknown>> };
  const models = Array.isArray(parsed.models) ? parsed.models : [];
  return models
    .filter((model) => typeof model.slug === "string")
    .filter((model) => {
      const visibility = typeof model.visibility === "string" ? model.visibility : "list";
      return visibility === "list";
    })
    .map((model) => ({
      id: String(model.slug),
      label: typeof model.display_name === "string" ? model.display_name : prettifyId(String(model.slug)),
      provider: "codex-cli",
      description: typeof model.description === "string" ? model.description : undefined,
      reasoningEfforts: parseReasoningEfforts(model.supported_reasoning_levels),
      defaultReasoningEffort: typeof model.default_reasoning_level === "string" ? model.default_reasoning_level : undefined,
      source: "codex-debug-models",
    }));
}

function parseReasoningEfforts(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const efforts = value
    .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>).effort : null))
    .filter((effort): effort is string => typeof effort === "string" && effort.length > 0);
  return efforts.length > 0 ? efforts : undefined;
}

function detectCodexModels(): CliModel[] {
  for (const command of ["codex debug models", "codex debug models --bundled"]) {
    try {
      const models = parseCodexDebugModels(run(command, 10_000));
      if (models.length > 0) return markConfiguredModel(models, readCodexConfiguredModel());
    } catch {
      // try next source
    }
  }

  const configured = readCodexConfiguredModel();
  return configured
    ? [{ id: configured, label: `${prettifyId(configured)} (configured)`, provider: "codex-cli", source: "codex-config" }]
    : [];
}

function readCodexConfiguredModel(): string | null {
  const configPath = path.join(homedir(), ".codex", "config.toml");
  if (!existsSync(configPath)) return null;
  try {
    const text = readFileSync(configPath, "utf8");
    const match = text.match(/^\s*model\s*=\s*"([^"]+)"/m);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function detectClaudeModels(): CliModel[] {
  const out = new Map<string, CliModel>();
  const configured = readClaudeConfiguredModel();

  if (configured) {
    out.set(configured, {
      id: configured,
      label: `${labelForClaudeId(configured)} (configured)`,
      provider: "claude-code",
      source: "claude-settings",
    });
  }

  try {
    const help = run("claude --help", 5000);
    const fullMatches = help.match(/\bclaude-(?:opus|sonnet|haiku)(?:-\d+(?:-\d+)?)?\b/gi) ?? [];
    for (const match of fullMatches) {
      const id = match.toLowerCase();
      out.set(id, { id, label: labelForClaudeId(id), provider: "claude-code", source: "claude-help" });
    }

    const aliasMatches = help.match(/'((?:opus|sonnet|haiku)(?:\[[^\]]+\])?)'/gi) ?? [];
    for (const rawAlias of aliasMatches) {
      const id = rawAlias.replace(/'/g, "");
      out.set(id, { id, label: labelForClaudeId(id), provider: "claude-code", source: "claude-help" });
    }
  } catch {
    // configured model remains enough
  }

  return Array.from(out.values());
}

function readClaudeConfiguredModel(): string | null {
  const settingsPath = path.join(homedir(), ".claude", "settings.json");
  if (!existsSync(settingsPath)) return null;
  try {
    const json = JSON.parse(readFileSync(settingsPath, "utf8")) as { model?: unknown };
    return typeof json.model === "string" ? json.model : null;
  } catch {
    return null;
  }
}

export function parseGeminiModelCatalog(text: string): CliModel[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(/"((?:auto-)?gemini-[a-z0-9._-]+)"/gi)) {
    ids.add(match[1]);
  }

  return Array.from(ids)
    .filter((id) => id === "auto-gemini-3" || id === "auto-gemini-2.5" || /^gemini-\d(?:\.\d)?[-_]/i.test(id))
    .filter((id) => !id.endsWith("-base"))
    .sort((a, b) => geminiRank(a) - geminiRank(b) || a.localeCompare(b))
    .map((id) => ({
      id,
      label: geminiLabel(id),
      provider: "gemini-cli",
      source: "gemini-cli-catalog",
    }));
}

function detectGeminiModels(): CliModel[] {
  for (const command of ["gemini models list", "gemini models"]) {
    try {
      const raw = run(command, 8000, { GEMINI_CLI_TRUST_WORKSPACE: "true" });
      const models = parseGeminiCommandList(raw);
      if (models.length > 0) return models;
    } catch {
      // try installed catalog
    }
  }

  const catalogText = readGeminiInstalledCatalog();
  return catalogText ? parseGeminiModelCatalog(catalogText) : [];
}

function parseGeminiCommandList(raw: string): CliModel[] {
  const out = new Map<string, CliModel>();
  for (const rawLine of raw.split(/\r?\n/)) {
    const id = rawLine.trim().split(/\s+/)[0];
    if (!id) continue;
    if (/^(NAME|MODEL|ID|---)/i.test(id)) continue;
    if (!/^(auto-)?gemini-[a-z0-9._-]+/i.test(id)) continue;
    out.set(id, { id, label: geminiLabel(id), provider: "gemini-cli", source: "gemini-models-list" });
  }
  return Array.from(out.values());
}

function readGeminiInstalledCatalog(): string | null {
  try {
    const globalRoot = run("npm root -g", 5000);
    const candidates = [
      path.join(globalRoot, "@google", "gemini-cli", "bundle", "docs", "cli", "model.md"),
      path.join(globalRoot, "@google", "gemini-cli", "bundle", "docs", "reference", "configuration.md"),
    ];
    return candidates
      .filter((candidate) => existsSync(candidate))
      .map((candidate) => readFileSync(candidate, "utf8"))
      .join("\n");
  } catch {
    return null;
  }
}

export function parseOpenClawModelsStatus(raw: string): CliModel[] {
  const parsed = JSON.parse(raw) as { defaultModel?: unknown; resolvedDefault?: unknown; allowed?: unknown };
  const current = typeof parsed.resolvedDefault === "string"
    ? parsed.resolvedDefault
    : typeof parsed.defaultModel === "string"
      ? parsed.defaultModel
      : null;
  const allowed = Array.isArray(parsed.allowed) ? parsed.allowed.filter((item): item is string => typeof item === "string") : [];

  return allowed.map((id) => ({
    id,
    label: id === current ? `${id} (current)` : id,
    provider: "openclaw",
    source: "openclaw-models-status",
  }));
}

function detectOpenClawModels(): CliModel[] {
  try {
    return parseOpenClawModelsStatus(run("openclaw models status --json", 10_000));
  } catch {
    return [];
  }
}

function markConfiguredModel(models: CliModel[], configured: string | null): CliModel[] {
  if (!configured) return models;
  let found = false;
  const marked = models.map((model) => {
    if (model.id !== configured) return model;
    found = true;
    return { ...model, label: `${model.label} (current)` };
  });
  return found
    ? marked
    : [{ id: configured, label: `${prettifyId(configured)} (configured)`, provider: "codex-cli", source: "codex-config" }, ...marked];
}

function labelForClaudeId(id: string): string {
  if (id.startsWith("claude-")) return prettifyId(id.replace(/^claude-/, "Claude "));
  if (id.includes("[")) return `Claude ${id}`;
  return `Claude ${prettifyId(id)} (alias)`;
}

function geminiLabel(id: string): string {
  if (id === "auto-gemini-3") return "Auto (Gemini 3)";
  if (id === "auto-gemini-2.5") return "Auto (Gemini 2.5)";
  return prettifyId(id);
}

function geminiRank(id: string): number {
  if (id === "auto-gemini-3") return 0;
  if (id === "auto-gemini-2.5") return 1;
  if (id.startsWith("gemini-3")) return 2;
  if (id.startsWith("gemini-2.5")) return 3;
  return 10;
}

function prettifyId(id: string): string {
  return id
    .replace(/[-_]/g, " ")
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\bGpt\b/, "GPT")
    .replace(/\bUi\b/, "UI");
}

// --- Cache and public API ------------------------------------------------------------

let cachedProviders: CliProvider[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

export function detectCliProviders(forceRefresh = false): CliProvider[] {
  const now = Date.now();
  if (!forceRefresh && cachedProviders && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedProviders;
  }

  if (process.env.ENABLE_LOCAL_CLI_PROVIDERS !== "true") {
    cachedProviders = KNOWN_PROVIDERS.map((spec) => ({
      id: spec.id,
      name: spec.name,
      command: spec.command,
      version: null,
      installed: false,
      color: spec.color,
      models: [],
    }));
    cacheTimestamp = now;
    return cachedProviders;
  }

  const providers: CliProvider[] = KNOWN_PROVIDERS.map((spec) => {
    const available = isCommandAvailable(spec.command);
    const version = available ? detectVersion(spec.command, spec.versionFlag) : null;
    const warnings: string[] = [];
    let models: CliModel[] = [];

    if (available && spec.detectModels) {
      try {
        models = dedupeModels(spec.detectModels());
      } catch (error) {
        warnings.push((error as Error).message);
      }
    }

    if (available && models.length === 0 && spec.detectModels) {
      warnings.push("No models discovered from this CLI.");
    }

    return {
      id: spec.id,
      name: spec.name,
      command: spec.command,
      version: available ? (version ?? "installed") : "not installed",
      installed: available,
      color: spec.color,
      models,
      warnings,
    };
  });

  cachedProviders = providers;
  cacheTimestamp = now;
  return providers;
}

function dedupeModels(models: CliModel[]): CliModel[] {
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = buildModelPickerValue(model);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildModelPickerValue(model: Pick<CliModel, "provider" | "id">): string {
  return `${model.provider}::${model.id}`;
}

export function getApiProviderModels(): CliModel[] {
  return [
    ...getEnvModels("openai-api", process.env.OPENAI_MODELS ?? process.env.OPENAI_MODEL),
    ...getEnvModels("anthropic-api", process.env.ANTHROPIC_MODELS ?? process.env.ANTHROPIC_MODEL),
    ...getEnvModels("openrouter", process.env.OPENROUTER_MODELS ?? process.env.OPENROUTER_MODEL),
  ];
}

function getEnvModels(provider: string, value: string | undefined): CliModel[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((id) => ({ id, label: prettifyId(id), provider, source: "env" }));
}

export function getMockProviderModels(): CliModel[] {
  if (process.env.ENABLE_MOCK_MODEL !== "true") return [];
  return [{ id: "mock-onboarding", label: "Mock Onboarding Runner", provider: "mock-cli", source: "env" }];
}

export function getAllAvailableModels(forceRefresh = false): CliModel[] {
  const cliProviders = detectCliProviders(forceRefresh);
  const cliModels = cliProviders.flatMap((p) => p.models);
  const apiModels = getApiProviderModels();
  const mockModels = getMockProviderModels();
  return [...cliModels, ...apiModels, ...mockModels];
}

export function getCachedAvailableModels(): CliModel[] {
  if (!cachedProviders) return [];
  return [...cachedProviders.flatMap((p) => p.models), ...getApiProviderModels(), ...getMockProviderModels()];
}
