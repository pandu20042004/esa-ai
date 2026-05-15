import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSearchBudget, type SearchBudget, type SearchMode } from "@/lib/esai/search-budget";
import type { RunEventEmitter } from "@/lib/server/run-events";
import type { StageId } from "@/types/esai";

type SearchInputFile = {
  fileName: string;
  fileRole: string;
  contentText: string | null;
};

export type RunSearchInput = {
  runId: string;
  userId: string;
  competitionId: string | null;
  stageId: string;
  userMessage: string;
  inputFiles: SearchInputFile[];
  searchMode?: SearchMode;
};

export type SearchSource = {
  provider: "brave" | "openalex" | "crossref" | "arxiv" | "semantic_scholar";
  capturedFrom: "app_search";
  query: string;
  url: string;
  title?: string;
  domain?: string;
  snippet?: string;
  extractedText?: string;
  metadata?: Record<string, unknown>;
};

type ProviderResult = Omit<SearchSource, "capturedFrom">;

const SEARCH_TIMEOUT_MS = 9000;

export async function collectRunSearchSources(
  supabase: SupabaseClient,
  emitter: RunEventEmitter,
  input: RunSearchInput,
): Promise<SearchSource[]> {
  const stageId = input.stageId as StageId;
  const budget = getSearchBudget(stageId, input.searchMode ?? "balanced");
  if (budget.webHardLimit <= 0 && budget.scholarlyHardLimit <= 0) return [];

  await emitter.emit("activity", {
    kind: "thinking",
    label: `Preparing ${budget.mode} search plan`,
  });

  const queries = buildSearchQueries(input, budget);
  const sources: SearchSource[] = [];

  if (budget.webSoftLimit > 0) {
    if (process.env.BRAVE_SEARCH_API_KEY) {
      const webQueries = queries.web.slice(0, budget.webSoftLimit);
      for (const query of webQueries) {
        await emitter.emit("activity", { kind: "searching", label: `Searching Brave: ${query}` });
        const results = await safeProviderSearch(() => searchBrave(query, 5));
        sources.push(...results.map((result) => ({ ...result, capturedFrom: "app_search" as const })));
      }
    } else {
      await emitter.emit("activity", {
        kind: "tool",
        label: "Brave web search skipped: BRAVE_SEARCH_API_KEY is not set",
        tool: "brave",
      });
    }
  }

  if (budget.scholarlySoftLimit > 0) {
    const scholarlyQueries = queries.scholarly.slice(0, scholarlyQueryCount(budget));
    for (const query of scholarlyQueries) {
      await emitter.emit("activity", { kind: "searching", label: `Searching OpenAlex: ${query}` });
      sources.push(...(await safeProviderSearch(() => searchOpenAlex(query, 4))).map(withCapturedFrom));

      await emitter.emit("activity", { kind: "searching", label: `Searching Crossref: ${query}` });
      sources.push(...(await safeProviderSearch(() => searchCrossref(query, 4))).map(withCapturedFrom));

      await emitter.emit("activity", { kind: "searching", label: `Searching arXiv: ${query}` });
      sources.push(...(await safeProviderSearch(() => searchArxiv(query, 3))).map(withCapturedFrom));

      if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
        await emitter.emit("activity", { kind: "searching", label: `Searching Semantic Scholar: ${query}` });
        sources.push(...(await safeProviderSearch(() => searchSemanticScholar(query, 4))).map(withCapturedFrom));
      }
    }
  }

  const deduped = dedupeSources(sources).slice(0, budget.webHardLimit + budget.scholarlyHardLimit);
  await persistRunSources(supabase, input, deduped);
  for (const source of deduped.slice(0, 10)) {
    await emitter.emit("activity", {
      kind: "searching",
      label: source.title ? `Found: ${source.title}` : `Found source from ${source.provider}`,
      url: source.url,
      domain: source.domain ?? domainFromUrl(source.url),
    });
  }
  return deduped;
}

export function formatSearchContext(sources: SearchSource[]): string {
  if (sources.length === 0) {
    return [
      "## Verified search context",
      "No app-owned search sources were collected for this run. Do not claim that the ESAI web-search layer found sources.",
    ].join("\n");
  }

  const lines = [
    "## Verified search context",
    "The ESAI backend collected these sources before model generation. Use them when relevant, cite URLs in saved outputs, and do not invent sources beyond this list unless the provider web-search tool returns additional URLs.",
    "",
  ];
  for (const [index, source] of sources.slice(0, 40).entries()) {
    lines.push(`${index + 1}. [${source.provider}] ${source.title || source.domain || source.url}`);
    lines.push(`   URL: ${source.url}`);
    lines.push(`   Query: ${source.query}`);
    if (source.snippet) lines.push(`   Snippet: ${source.snippet.slice(0, 500)}`);
  }
  return lines.join("\n");
}

function withCapturedFrom(result: ProviderResult): SearchSource {
  return { ...result, capturedFrom: "app_search" };
}

function scholarlyQueryCount(budget: SearchBudget): number {
  if (budget.mode === "fast") return Math.min(2, Math.max(1, Math.ceil(budget.scholarlySoftLimit / 10)));
  if (budget.mode === "deep") return Math.min(6, Math.max(1, Math.ceil(budget.scholarlySoftLimit / 20)));
  return Math.min(4, Math.max(1, Math.ceil(budget.scholarlySoftLimit / 10)));
}

function buildSearchQueries(input: RunSearchInput, budget: SearchBudget): { web: string[]; scholarly: string[] } {
  const text = [
    input.userMessage,
    ...input.inputFiles.map((file) => `${file.fileName}\n${file.contentText ?? ""}`),
  ].join("\n").slice(0, 12000);
  const phrases = extractSignalPhrases(text);
  const topic = phrases[0] ?? "Indonesia youth sustainable innovation essay competition";
  const secondary = phrases.slice(1, 5);
  const webModifiers = [
    "Indonesia 2026 tren",
    "inovasi mahasiswa Indonesia",
    "solusi berkelanjutan Indonesia",
    "kompetisi esai Indonesia",
    "kebijakan Indonesia terbaru",
    "studi kasus Indonesia",
    "startup sosial Indonesia",
    "teknologi tepat guna Indonesia",
    "tantangan global Indonesia pemuda",
    "dampak sosial ekonomi Indonesia",
  ];
  const scholarlyModifiers = [
    "Indonesia journal",
    "systematic review",
    "case study Indonesia",
    "sustainability innovation",
    "youth innovation",
    "technology adoption Indonesia",
  ];

  const web = unique([
    ...secondary.map((phrase) => `${phrase} Indonesia 2026`),
    ...webModifiers.map((modifier) => `${topic} ${modifier}`),
  ]).slice(0, Math.max(budget.webHardLimit, budget.webSoftLimit, 1));
  const scholarly = unique([
    topic,
    ...secondary,
    ...scholarlyModifiers.map((modifier) => `${topic} ${modifier}`),
  ]).slice(0, Math.max(scholarlyQueryCount(budget), 1));
  return { web, scholarly };
}

function extractSignalPhrases(text: string): string[] {
  const cleaned = text
    .replace(/[`*_#>()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const candidates: string[] = [];
  const patterns = [
    /\btema(?:\s+utama)?\s*[:\-]\s*([^.;\n]{12,180})/gi,
    /\btheme\s*[:\-]\s*([^.;\n]{12,180})/gi,
    /\bsubtema\s*[:\-]\s*([^.;\n]{8,160})/gi,
    /\bsub-theme[s]?\s*[:\-]\s*([^.;\n]{8,160})/gi,
  ];
  for (const pattern of patterns) {
    for (const match of cleaned.matchAll(pattern)) {
      candidates.push(...String(match[1] ?? "").split(/[;,/|]/g));
    }
  }
  if (candidates.length === 0) {
    candidates.push(...cleaned.split(/[.!?]/g).filter((part) => part.length >= 24).slice(0, 4));
  }
  return unique(
    candidates
      .map((candidate) => candidate.trim())
      .filter((candidate) => candidate.length >= 8 && candidate.length <= 140),
  ).slice(0, 8);
}

async function searchBrave(query: string, count: number): Promise<ProviderResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.min(count, 10)));
  url.searchParams.set("country", "id");
  url.searchParams.set("search_lang", "en");
  const json = await fetchJson<Record<string, unknown>>(url, {
    headers: {
      accept: "application/json",
      "x-subscription-token": process.env.BRAVE_SEARCH_API_KEY ?? "",
    },
  });
  const rows = ((json.web as { results?: unknown[] } | undefined)?.results ?? []) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    provider: "brave" as const,
    query,
    url: String(row.url ?? ""),
    title: typeof row.title === "string" ? stripHtml(row.title) : undefined,
    domain: typeof row.url === "string" ? domainFromUrl(row.url) : undefined,
    snippet: typeof row.description === "string" ? stripHtml(row.description) : undefined,
    metadata: { age: row.age },
  })).filter((row) => row.url);
}

async function searchOpenAlex(query: string, count: number): Promise<ProviderResult[]> {
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", query);
  url.searchParams.set("per-page", String(Math.min(count, 25)));
  if (process.env.OPENALEX_API_KEY) url.searchParams.set("api_key", process.env.OPENALEX_API_KEY);
  if (process.env.OPENALEX_MAILTO || process.env.CROSSREF_MAILTO) {
    url.searchParams.set("mailto", process.env.OPENALEX_MAILTO ?? process.env.CROSSREF_MAILTO ?? "");
  }
  const json = await fetchJson<{ results?: Array<Record<string, unknown>> }>(url, {
    headers: { "User-Agent": searchUserAgent() },
  });
  return (json.results ?? []).map((row) => {
    const primary = row.primary_location as Record<string, unknown> | undefined;
    const landing = primary?.landing_page_url;
    const doi = typeof row.doi === "string" ? row.doi : "";
    const urlValue = typeof landing === "string" ? landing : doi || `https://openalex.org/${String(row.id ?? "")}`;
    return {
      provider: "openalex" as const,
      query,
      url: urlValue,
      title: typeof row.title === "string" ? row.title : undefined,
      domain: domainFromUrl(urlValue),
      snippet: typeof row.abstract_inverted_index === "object" && row.abstract_inverted_index
        ? abstractFromInvertedIndex(row.abstract_inverted_index as Record<string, number[]>)
        : undefined,
      metadata: { publication_year: row.publication_year, cited_by_count: row.cited_by_count },
    };
  }).filter((row) => row.url);
}

async function searchCrossref(query: string, count: number): Promise<ProviderResult[]> {
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query", query);
  url.searchParams.set("rows", String(Math.min(count, 20)));
  if (process.env.CROSSREF_MAILTO) url.searchParams.set("mailto", process.env.CROSSREF_MAILTO);
  const json = await fetchJson<{ message?: { items?: Array<Record<string, unknown>> } }>(url, {
    headers: { "User-Agent": process.env.CROSSREF_USER_AGENT ?? searchUserAgent() },
  });
  return (json.message?.items ?? []).map((row) => {
    const titles = row.title as string[] | undefined;
    const doi = typeof row.DOI === "string" ? row.DOI : "";
    const urlValue = typeof row.URL === "string" ? row.URL : doi ? `https://doi.org/${doi}` : "";
    return {
      provider: "crossref" as const,
      query,
      url: urlValue,
      title: titles?.[0],
      domain: urlValue ? domainFromUrl(urlValue) : undefined,
      snippet: typeof row.abstract === "string" ? stripHtml(row.abstract) : undefined,
      metadata: { doi, published: row.published, score: row.score },
    };
  }).filter((row) => row.url);
}

async function searchArxiv(query: string, count: number): Promise<ProviderResult[]> {
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("search_query", `all:${query}`);
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", String(Math.min(count, 10)));
  const xml = await fetchText(url, {
    headers: { "User-Agent": process.env.ARXIV_USER_AGENT ?? searchUserAgent() },
  });
  return parseArxivEntries(xml).map((entry) => ({
    provider: "arxiv" as const,
    query,
    url: entry.url,
    title: entry.title,
    domain: domainFromUrl(entry.url),
    snippet: entry.summary,
    metadata: { published: entry.published },
  }));
}

async function searchSemanticScholar(query: string, count: number): Promise<ProviderResult[]> {
  const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(Math.min(count, 10)));
  url.searchParams.set("fields", "title,abstract,url,year,citationCount,externalIds");
  const json = await fetchJson<{ data?: Array<Record<string, unknown>> }>(url, {
    headers: { "x-api-key": process.env.SEMANTIC_SCHOLAR_API_KEY ?? "" },
  });
  return (json.data ?? []).map((row) => {
    const externalIds = row.externalIds as Record<string, unknown> | undefined;
    const doi = typeof externalIds?.DOI === "string" ? externalIds.DOI : "";
    const urlValue = typeof row.url === "string" ? row.url : doi ? `https://doi.org/${doi}` : "";
    return {
      provider: "semantic_scholar" as const,
      query,
      url: urlValue,
      title: typeof row.title === "string" ? row.title : undefined,
      domain: urlValue ? domainFromUrl(urlValue) : undefined,
      snippet: typeof row.abstract === "string" ? row.abstract : undefined,
      metadata: { year: row.year, citationCount: row.citationCount, doi },
    };
  }).filter((row) => row.url);
}

async function persistRunSources(
  supabase: SupabaseClient,
  input: RunSearchInput,
  sources: SearchSource[],
): Promise<void> {
  if (sources.length === 0) return;
  const rows = sources.map((source) => ({
    user_id: input.userId,
    run_id: input.runId,
    competition_id: input.competitionId,
    stage_id: input.stageId,
    query: source.query,
    url: source.url,
    title: source.title ?? null,
    domain: source.domain ?? domainFromUrl(source.url),
    snippet: source.snippet ?? null,
    extracted_text: source.extractedText ?? null,
    provider: source.provider,
    captured_from: source.capturedFrom,
    metadata: source.metadata ?? {},
  }));
  const { error } = await supabase.from("run_sources").insert(rows);
  if (error) {
    console.error("[run-search] run_sources insert failed", error.message);
  }
}

async function safeProviderSearch(fn: () => Promise<ProviderResult[]>): Promise<ProviderResult[]> {
  try {
    return await fn();
  } catch (error) {
    console.error("[run-search] provider failed", (error as Error).message);
    return [];
  }
}

async function fetchJson<T>(url: URL, init: RequestInit = {}): Promise<T> {
  const text = await fetchText(url, init);
  return JSON.parse(text) as T;
}

async function fetchText(url: URL, init: RequestInit = {}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`${url.hostname} ${res.status}: ${(await res.text()).slice(0, 240)}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseArxivEntries(xml: string): Array<{ title: string; url: string; summary?: string; published?: string }> {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.map((entry) => ({
    title: decodeXml(firstXml(entry, "title") ?? ""),
    url: decodeXml(firstXml(entry, "id") ?? ""),
    summary: decodeXml(firstXml(entry, "summary") ?? "").replace(/\s+/g, " ").trim(),
    published: decodeXml(firstXml(entry, "published") ?? ""),
  })).filter((entry) => entry.url);
}

function firstXml(xml: string, tag: string): string | undefined {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]?.trim();
}

function abstractFromInvertedIndex(index: Record<string, number[]>): string {
  const words: Array<{ word: string; pos: number }> = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) words.push({ word, pos });
  }
  return words.sort((a, b) => a.pos - b.pos).map((item) => item.word).join(" ").slice(0, 700);
}

function dedupeSources(sources: SearchSource[]): SearchSource[] {
  const seen = new Set<string>();
  const out: SearchSource[] = [];
  for (const source of sources) {
    const key = normalizeUrlKey(source.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

function normalizeUrlKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function searchUserAgent(): string {
  return process.env.SEARCH_USER_AGENT
    ?? process.env.ARXIV_USER_AGENT
    ?? process.env.CROSSREF_USER_AGENT
    ?? "ESAI.ai/0.1 (mailto:unknown@example.com)";
}

function stripHtml(input: string): string {
  return decodeXml(input.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function decodeXml(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
