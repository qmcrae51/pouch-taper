import { buildPlanFor } from "../engine/curve";
import { DEFAULT_SETTINGS } from "../engine/defaults";
import type { AppState } from "./model";

export const STORAGE_KEY = "pouch-taper-v1";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function uid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}

export function defaultState(): AppState {
  const settings = { ...DEFAULT_SETTINGS };
  return {
    version: 1,
    settings,
    plan: buildPlanFor(settings),
    logs: [],
    delays: [],
    slips: [],
    waterLogs: [],
    meta: { backfilled: {}, backfillSkipped: [], pastPhases: [] },
  };
}

function looksLikeState(x: unknown): x is AppState {
  if (typeof x !== "object" || x === null) return false;
  const s = x as Record<string, unknown>;
  return (
    s.version === 1 &&
    typeof s.settings === "object" &&
    s.settings !== null &&
    typeof (s.settings as Record<string, unknown>).quitDate === "string" &&
    Array.isArray(s.plan) &&
    Array.isArray(s.logs) &&
    Array.isArray(s.delays) &&
    Array.isArray(s.slips)
  );
}

/** Fill in any fields added since the backup/save was written. */
function withDefaults(parsed: AppState): AppState {
  const base = defaultState();
  return {
    ...base,
    ...parsed,
    settings: {
      ...base.settings,
      ...parsed.settings,
      water: { ...base.settings.water, ...(parsed.settings.water ?? {}) },
    },
    meta: { ...base.meta, ...(parsed.meta ?? {}) },
  };
}

export function loadState(storage: StorageLike): AppState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    if (!looksLikeState(parsed)) return defaultState();
    return withDefaults(parsed);
  } catch {
    return defaultState();
  }
}

export function saveState(storage: StorageLike, state: AppState): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearState(storage: StorageLike): void {
  storage.removeItem(STORAGE_KEY);
}

export function exportJSON(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  if (!looksLikeState(parsed)) {
    throw new Error("That file is not a Pouch Taper backup.");
  }
  return withDefaults(parsed);
}
