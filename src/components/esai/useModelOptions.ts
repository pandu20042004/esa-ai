"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ModelOption = {
  provider: string;
  id: string;
  label: string;
  description?: string;
  reasoningEfforts?: string[];
  defaultReasoningEffort?: string;
  source?: string;
};

const MODELS_CACHE_KEY = "esai-models-v3";
const SELECTED_MODEL_KEY = "esai-selected-model-v3";

export function buildModelPickerValue(model: Pick<ModelOption, "provider" | "id">): string {
  return `${model.provider}::${model.id}`;
}

export function parseModelPickerValue(value: string): { provider: string; modelId: string } {
  const separatorIndex = value.indexOf("::");
  if (separatorIndex === -1) return { provider: "", modelId: value };
  return {
    provider: value.slice(0, separatorIndex),
    modelId: value.slice(separatorIndex + 2),
  };
}

export function getSelectedModelOption(models: ModelOption[], selectedModel: string): ModelOption | null {
  return models.find((model) => buildModelPickerValue(model) === selectedModel) ?? null;
}

export function getReasoningEffortsForModel(models: ModelOption[], selectedModel: string): string[] {
  return getSelectedModelOption(models, selectedModel)?.reasoningEfforts ?? [];
}

export function isSelectedModelReady(models: ModelOption[], selectedModel: string): boolean {
  return getSelectedModelOption(models, selectedModel) !== null;
}

export function useModelOptions(options?: { refreshOnMount?: boolean }) {
  const [models, setModels] = useState<ModelOption[]>(() => readCachedModels());
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(SELECTED_MODEL_KEY) ?? "";
  });
  const [modelsLoading, setModelsLoading] = useState(models.length === 0);
  const modelsRef = useRef<ModelOption[]>(models);

  useEffect(() => {
    modelsRef.current = models;
  }, [models]);

  const loadModels = useCallback(async (refresh = false) => {
    setModelsLoading(modelsRef.current.length === 0);
    try {
      const response = await fetch(`/api/models${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const json = await response.json();
      const list: ModelOption[] = Array.isArray(json?.data) ? json.data : [];
      setModels(list);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(list));
      }

      setSelectedModel((current) => {
        if (list.length === 0) return "";
        if (current && list.some((model) => buildModelPickerValue(model) === current)) return current;
        const next = buildModelPickerValue(list[0]);
        if (typeof window !== "undefined") window.localStorage.setItem(SELECTED_MODEL_KEY, next);
        return next;
      });
    } catch {
      // Keep cached models when discovery fails.
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModels(Boolean(options?.refreshOnMount));
  }, [loadModels, options?.refreshOnMount]);

  useEffect(() => {
    if (!selectedModel || typeof window === "undefined") return;
    window.localStorage.setItem(SELECTED_MODEL_KEY, selectedModel);
  }, [selectedModel]);

  return {
    models,
    selectedModel,
    setSelectedModel,
    modelsLoading,
    refreshModels: () => loadModels(true),
  };
}

function readCachedModels(): ModelOption[] {
  if (typeof window === "undefined") return [];
  try {
    const cached = window.localStorage.getItem(MODELS_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}
