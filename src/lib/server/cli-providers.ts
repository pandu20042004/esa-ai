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
};

export type CliModel = {
  id: string;
  label: string;
  provider: string;
};

type ProviderSpec = {
  id: string;
  name: string;
  command: string;
  color: string;
  versionFlag: string;
  defaultModels: CliModel[];
  detectModels?: () => CliModel[];
};

const KNOWN_PROVIDERS: ProviderSpec[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    command: "claude",
    color: "#e8956d",
    versionFlag: "--version",
    defaultModels: [
      { id: "claude-opus-4", label: "Claude Opus 4", provider: "claude-code" },
      { id: "claude-sonnet-4", label: "Claude Sonnet 4", provider: "claude-code" },
    ],
    detectModels: detectClaudeModels,
  },
  {
    id: "codex-cli",
    name: "Codex CLI",
    command: "codex",
    color: "#10b981",
    versionFlag: "--version",
    defaultModels: [
      { id: "o3", label: "o3", provider: "codex-cli" },
      { id: "o4-mini", label: "o4-mini", provider: "codex-cli" },
      { id: "gpt-4.1", label: "GPT-4.1", provider: "codex-cli" },
    ],
    detectModels: detectCodexModels,
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    command: "gemini",
    color: "#6366f1",
    versionFlag: "--version",
    defaultModels: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini-cli" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini-cli" },
    ],
    detectModels: detectGeminiModels,
  },
  {
    id: "devin",
    name: "Devin for Terminal",
    command: "devin",
    color: "#6b7280",
    versionFlag: "--version",
    defaultModels: [{ id: "devin-default", label: "Devin Default", provider: "devin" }],
  },
  {
    id: "opencode",
    name: "OpenCode",
    command: "opencode",
    color: "#10b981",
    versionFlag: "--version",
    defaultModels: [{ id: "opencode-default", label: "OpenCode Default", provider: "opencode" }],
  },
  {
    id: "hermes",
    name: "Hermes",
    command: "hermes",
    color: "#8b5cf6",
    versionFlag: "--version",
    defaultModels: [{ id: "hermes-default", label: "Hermes Default", provider: "hermes" }],
  },
];

function detectVersion(command: string, flag: string): string | null {
  try {
    const output = execSync(`${command} ${flag}`, {
      timeout: 5000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const firstLine = output.split("\n")[0]?.trim() ?? "";
    return firstLine.slice(0, 80) || command;
  } catch {
    return null;
  }
}

function isCommandAvailable(command: string): boolean {
  try {
    const whereCmd = process.platform === "win32" ? "where" : "which";
    execSync(`${whereCmd} ${command}`, {
      timeout: 3000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

// --- Per-provider model detection ----------------------------------------------------

function detectClaudeModels(): CliModel[] {
  const models = new Map<string, string>();
  // ~/.claude.json sometimes carries a `models` list; if available, use it.
  const configPath = path.join(homedir(), ".claude.json");
  if (existsSync(configPath)) {
    try {
      const json = JSON.parse(readFileSync(configPath, "utf8"));
      const list = extractClaudeModelsFromConfig(json);
      for (const m of list) models.set(m.id, m.label);
    } catch {
      // fall through
    }
  }
  // Fall back to `claude --help` and scrape recognizable `-m` / `--model` options.
  try {
    const help = execSync("claude --help", { timeout: 4000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    const matches = help.match(/\b(claude-[a-z0-9.\-]+)\b/gi) ?? [];
    for (const m of matches) models.set(m.toLowerCase(), prettifyId(m));
  } catch {
    // ignore
  }
  return Array.from(models.entries()).map(([id, label]) => ({ id, label, provider: "claude-code" }));
}

function extractClaudeModelsFromConfig(json: unknown): CliModel[] {
  const out: CliModel[] = [];
  const seen = new Set<string>();
  function visit(value: unknown) {
    if (!value) return;
    if (typeof value === "string" && value.startsWith("claude-") && !seen.has(value)) {
      seen.add(value);
      out.push({ id: value, label: prettifyId(value), provider: "claude-code" });
      return;
    }
    if (Array.isArray(value)) {
      for (const v of value) visit(v);
      return;
    }
    if (typeof value === "object") {
      for (const v of Object.values(value as Record<string, unknown>)) visit(v);
    }
  }
  visit(json);
  return out;
}

function detectCodexModels(): CliModel[] {
  const results = new Map<string, string>();
  // Try `codex models list` or `codex models` — commands vary by version.
  for (const cmd of ["codex models list", "codex models"]) {
    try {
      const out = execSync(cmd, { timeout: 4000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
      for (const raw of out.split(/\r?\n/)) {
        const id = raw.trim().split(/\s+/)[0];
        if (!id) continue;
        if (/^(NAME|MODEL|ID|---)/i.test(id)) continue;
        if (!/^[a-z0-9][a-z0-9._\-\/]*$/i.test(id)) continue;
        results.set(id, prettifyId(id));
      }
      if (results.size) break;
    } catch {
      // try next form
    }
  }
  return Array.from(results.entries()).map(([id, label]) => ({ id, label, provider: "codex-cli" }));
}

function detectGeminiModels(): CliModel[] {
  const results = new Map<string, string>();
  for (const cmd of ["gemini models list", "gemini models"]) {
    try {
      const out = execSync(cmd, { timeout: 4000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
      for (const raw of out.split(/\r?\n/)) {
        const id = raw.trim().split(/\s+/)[0];
        if (!id) continue;
        if (/^(NAME|MODEL|ID|---)/i.test(id)) continue;
        if (!/^gemini-[a-z0-9._\-]+/i.test(id)) continue;
        results.set(id, prettifyId(id));
      }
      if (results.size) break;
    } catch {
      // ignore
    }
  }
  return Array.from(results.entries()).map(([id, label]) => ({ id, label, provider: "gemini-cli" }));
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

    let models: CliModel[] = [];
    if (available) {
      try {
        const detected = spec.detectModels?.() ?? [];
        models = detected.length > 0 ? detected : spec.defaultModels;
      } catch {
        models = spec.defaultModels;
      }
    }

    return {
      id: spec.id,
      name: spec.name,
      command: spec.command,
      version: available ? (version ?? "installed") : "not installed",
      installed: available,
      color: spec.color,
      models,
    };
  });

  cachedProviders = providers;
  cacheTimestamp = now;
  return providers;
}

export function getApiProviderModels(): CliModel[] {
  const models: CliModel[] = [];

  if (process.env.OPENAI_API_KEY) {
    models.push(
      { id: "gpt-4.1", label: "GPT-4.1", provider: "openai-api" },
      { id: "o3", label: "o3", provider: "openai-api" },
      { id: "o4-mini", label: "o4-mini", provider: "openai-api" },
    );
  }

  if (process.env.ANTHROPIC_API_KEY) {
    models.push(
      { id: "claude-opus-4", label: "Claude Opus 4", provider: "anthropic-api" },
      { id: "claude-sonnet-4", label: "Claude Sonnet 4", provider: "anthropic-api" },
    );
  }

  if (process.env.OPENROUTER_API_KEY) {
    models.push(
      { id: "openrouter/auto", label: "OpenRouter Auto", provider: "openrouter" },
      { id: "anthropic/claude-opus-4", label: "Claude Opus 4 via OpenRouter", provider: "openrouter" },
      { id: "openai/o3", label: "o3 via OpenRouter", provider: "openrouter" },
      { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro via OpenRouter", provider: "openrouter" },
    );
  }

  return models;
}

/**
 * A deterministic fake provider used for local smoke tests and CI. Exposed only when
 * `ENABLE_MOCK_MODEL=true` is set; keeps dev unblocked when no CLI or API key is available.
 */
export function getMockProviderModels(): CliModel[] {
  if (process.env.ENABLE_MOCK_MODEL !== "true") return [];
  return [{ id: "mock-onboarding", label: "Mock Onboarding Runner", provider: "mock-cli" }];
}

export function getAllAvailableModels(): CliModel[] {
  const cliProviders = detectCliProviders();
  const cliModels = cliProviders.flatMap((p) => p.models);
  const apiModels = getApiProviderModels();
  const mockModels = getMockProviderModels();
  return [...cliModels, ...apiModels, ...mockModels];
}
