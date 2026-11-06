import type {
  DelayEvent,
  Phase,
  PlanDay,
  PouchLog,
  Settings,
  WaterLog,
} from "../engine/types";

export type Slip = { id: string; timestamp: string };

export type Meta = {
  /** User-entered counts for days that had no logs (0 = confirmed none). */
  backfilled: Record<string, number>;
  /** Dates the user chose not to backfill; don't ask again. */
  backfillSkipped: string[];
  /** When the plateau banner was last triggered (visible for 24h from then). */
  plateauShownAt?: string;
  /** Date until which the under-target recompute prompt is snoozed. */
  underPromptSnoozedUntil?: string;
  /** Earlier tapers, oldest first. The current one lives in settings. */
  pastPhases: Phase[];
};

export type AppState = {
  version: 1;
  settings: Settings;
  plan: PlanDay[];
  logs: PouchLog[];
  delays: DelayEvent[];
  slips: Slip[];
  waterLogs: WaterLog[];
  meta: Meta;
};
