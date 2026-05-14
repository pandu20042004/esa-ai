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
      { id: "opus", label: "Claude Opus (alias)", provider: "claude-code" },
      { id: "sonnet", label: "Claude Sonnet (alias)", provider: "claude-code" },
      { id: "haiku", label: "Claude Haiku (alias)", provider: "claude-code" },
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
      { id: "gpt-5.1-codex", label: "GPT-5.1 Codex", provider: "codex-cli" },
      { id: "gpt-5.1", label: "GPT-5.1", provider: "codex-cli" },
      { id: "gpt-5", label: "GPT-5", provider: "codex-cli" },
      { id: "o3", label: "o3", provider: "codex-cli" },
      { id: "o4-mini", label: "o4-mini", provider: "codex-cli" },
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
      { id: "gemini-3-pro", label: "Gemini 3 Pro", provider: "gemini-cli" },
      { id: "gemini-3-flash", label: "Gemini 3 Flash", provider: "gemini-cli" },
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

const CLAUDE_KNOWN_ALIASES: Array<{ id: string; label: string }> = [
  { id: "opus", label: "Claude Opus (alias)" },
  { id: "sonnet", label: "Claude Sonnet (alias)" },
  { id: "haiku", label: "Claude Haiku (alias)" },
  { id: "opus[1m]", label: "Claude Opus · 1M context" },
  { id: "sonnet[1m]", label: "Claude Sonnet · 1M context" },
];

const CLAUDE_FULL_MODEL_REGEX = /\bclaude-(?:opus|sonnet|haiku)(?:-\d+(?:-\d+)?)?\b/gi;

function detectClaudeModels(): CliModel[] {
  const out = new Map<string, string>();

  // Always include the common aliases so users can pick one even if we can't scrape anything.
  for (const alias of CLAUDE_KNOWN_ALIASES) {
    out.set(alias.id, alias.label);
  }

  // ~/.claude/settings.json `model` field is the currently configured model. Surface it first.
  const settingsPath = path.join(homedir(), ".claude", "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const json = JSON.parse(readFileSync(settingsPath, "utf8"));
      const m = typeof (json as { model?: unknown }).model === "string" ? (json as { model: string }).model : null;
      if (m) out.set(m, labelForClaudeId(m) + " · configured");
    } catch {
      // ignore
    }
  }

  // Scan `claude --help` ONLY for strings that look like `claude-<family>-<nn>` — avoid sweeping up
  // plugin names or section headings that contain the word "claude".
  try {
    const help = execSync("claude --help", { timeout: 4000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    const matches = help.match(CLAUDE_FULL_MODEL_REGEX) ?? [];
    for (const m of matches) {
      const id = m.toLowerCase();
      if (!out.has(id)) out.set(id, labelForClaudeId(id));
    }
  } catch {
    // ignore
  }

  return Array.from(out.entries()).map(([id, label]) => ({ id, label, provider: "claude-code" }));
}

function labelForClaudeId(id: string): string {
  if (id === "opus" || id === "sonnet" || id === "haiku") return `Claude ${id.charAt(0).toUpperCase()}${id.slice(1)} (alias)`;
  if (id.startsWith("opus[") || id.startsWith("sonnet[")) return `Claude ${id}`;
  if (id.startsWith("claude-")) {
    return id
      .replace(/^claude-/, "Claude ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bOpus\b/, "Opus")
      .replace(/\bSonnet\b/, "Sonnet")
      .replace(/\bHaiku\b/, "Haiku");
  }
  return id;
}

function detectCodexModels(): CliModel[] {
  // Codex doesn't have a `models list` subcommand. The known interactive picker exposes these ids.
  // We also surface the user's configured `model` from ~/.codex/config.toml first.
  const out = new Map<string, string>();

  const baseIds: Array<{ id: string; label: string }> = [
    { id: "gpt-5.5", label: "GPT-5.5" },
    { id: "gpt-5.4", label: "GPT-5.4" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini" },
    { id: "gpt-5.3-codex", label: "GPT-5.3-codex" },
    { id: "gpt-5.2", label: "GPT-5.2" },
  ];
  for (const m of baseIds) out.set(m.id, m.label);

  const configPath = path.join(homedir(), ".codex", "config.toml");
  if (existsSync(configPath)) {
    try {
      const text = readFileSync(configPath, "utf8");
      // Match the first top-level `model = "..."` line (TOML) outside any [table] section.
      const match = text.match(/^\s*model\s*=\s*"([^"]+)"/m);
      if (match?.[1]) {
        const id = match[1];
        out.set(id, `${out.get(id) ?? id} · configured`);
      }
    } catch {
      // ignore
    }
  }

  return Array.from(out.entries()).map(([id, label]) => ({ id, label, provider: "codex-cli" }));
}

function detectGeminiModels(): CliModel[] {
  const out = new Map<string, string>();
  for (const cmd of ["gemini models list", "gemini models"]) {
    try {
      const raw = execSync(cmd, { timeout: 4000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
      for (const rawLine of raw.split(/\r?\n/)) {
        const id = rawLine.trim().split(/\s+/)[0];
        if (!id) continue;
        if (/^(NAME|MODEL|ID|---)/i.test(id)) continue;
        if (!/^gemini-[a-z0-9._\-]+/i.test(id)) continue;
        out.set(id, prettifyId(id));
      }
      if (out.size) break;
    } catch {
      // ignore
    }
  }
  return Array.from(out.entries()).map(([id, label]) => ({ id, label, provider: "gemini-cli" }));
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
