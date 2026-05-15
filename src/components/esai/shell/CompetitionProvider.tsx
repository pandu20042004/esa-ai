"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError, fetchCompetitions, fetchFiles } from "@/lib/esai/api";
import { selectInitialCompetition } from "@/lib/esai/competition-selection";
import type { Competition, CompetitionFile } from "@/types/esai";

const SELECTED_COMPETITION_KEY = "esai-selected-competition-id";

type CompetitionContextValue = {
  competitions: Competition[];
  selectedCompetition: Competition | null;
  dataLoading: boolean;
  filesByCompetition: Record<string, CompetitionFile[]>;
  selectCompetition: (competition: Competition) => void;
  upsertCompetition: (competition: Competition) => void;
  removeCompetition: (id: string) => void;
  rememberCompetitionFiles: (competitionId: string, files: CompetitionFile[]) => void;
  reloadCompetitions: () => Promise<void>;
};

const CompetitionContext = createContext<CompetitionContextValue | null>(null);

function groupFilesByCompetition(files: CompetitionFile[], competitions: Competition[]) {
  const grouped: Record<string, CompetitionFile[]> = {};
  for (const competition of competitions) grouped[competition.id] = [];
  for (const file of files) {
    if (!file.competitionId) continue;
    grouped[file.competitionId] = [...(grouped[file.competitionId] ?? []), file];
  }
  return grouped;
}

function redirectToErrorPage(err: unknown) {
  if (typeof window === "undefined") return;
  const apiError = err as Partial<ApiError>;
  const message = encodeURIComponent(apiError.message ?? "Failed to load dashboard");
  const correlationId = encodeURIComponent(apiError.correlationId ?? "");
  window.location.href = `/error-page?source=dashboard&message=${message}&correlationId=${correlationId}&returnTo=/dashboard`;
}

export function CompetitionProvider({ children }: { children: ReactNode }) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [filesByCompetition, setFilesByCompetition] = useState<Record<string, CompetitionFile[]>>({});

  const rememberCompetitionFiles = useCallback((competitionId: string, files: CompetitionFile[]) => {
    setFilesByCompetition((current) => ({ ...current, [competitionId]: files }));
  }, []);

  const selectCompetition = useCallback((competition: Competition) => {
    setSelectedCompetition(competition);
    window.localStorage.setItem(SELECTED_COMPETITION_KEY, competition.id);
  }, []);

  const upsertCompetition = useCallback((competition: Competition) => {
    setCompetitions((items) => {
      const exists = items.some((item) => item.id === competition.id);
      return exists
        ? items.map((item) => (item.id === competition.id ? { ...item, ...competition } : item))
        : [competition, ...items];
    });
    setSelectedCompetition((current) =>
      current?.id === competition.id ? { ...current, ...competition } : current,
    );
  }, []);

  const removeCompetition = useCallback((id: string) => {
    setCompetitions((items) => items.filter((competition) => competition.id !== id));
    setFilesByCompetition((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setSelectedCompetition((current) => {
      if (current?.id !== id) return current;
      window.localStorage.removeItem(SELECTED_COMPETITION_KEY);
      return null;
    });
  }, []);

  const reloadCompetitions = useCallback(async () => {
    setDataLoading(true);
    try {
      const [list, files] = await Promise.all([fetchCompetitions(), fetchFiles()]);
      setCompetitions(list);
      setFilesByCompetition(groupFilesByCompetition(files, list));
      setSelectedCompetition(selectInitialCompetition(list, window.localStorage.getItem(SELECTED_COMPETITION_KEY)));
    } catch (err) {
      redirectToErrorPage(err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitialCompetitions() {
      try {
        const [list, files] = await Promise.all([fetchCompetitions(), fetchFiles()]);
        if (!active) return;
        setCompetitions(list);
        setFilesByCompetition(groupFilesByCompetition(files, list));
        setSelectedCompetition(selectInitialCompetition(list, window.localStorage.getItem(SELECTED_COMPETITION_KEY)));
      } catch (err) {
        if (active) redirectToErrorPage(err);
      } finally {
        if (active) setDataLoading(false);
      }
    }

    void loadInitialCompetitions();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      competitions,
      selectedCompetition,
      dataLoading,
      filesByCompetition,
      selectCompetition,
      upsertCompetition,
      removeCompetition,
      rememberCompetitionFiles,
      reloadCompetitions,
    }),
    [
      competitions,
      dataLoading,
      filesByCompetition,
      reloadCompetitions,
      rememberCompetitionFiles,
      removeCompetition,
      selectCompetition,
      selectedCompetition,
      upsertCompetition,
    ],
  );

  return <CompetitionContext.Provider value={value}>{children}</CompetitionContext.Provider>;
}

export function useCompetitionsContext() {
  const value = useContext(CompetitionContext);
  if (!value) throw new Error("useCompetitionsContext must be used inside CompetitionProvider");
  return value;
}
