import { describe, expect, it } from "vitest";
import {
  applyRecompute,
  missingDays,
  postQuitSummary,
  previewRecompute,
  startNewPhase,
  statsFor,
  streakAtOrUnder,
  taperBaselineFor,
  usedByDateFrom,
  zeroCountdownFrom,
} from "./derive";
import type { AppState } from "./model";
import {
  STORAGE_KEY,
  defaultState,
  exportJSON,
  importJSON,
  loadState,
  saveState,
  uid,
  type StorageLike,
} from "./store";

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
}

function populatedState(): AppState {
  const state = defaultState();
  state.logs.push(
    {
      id: uid(),
      timestamp: "2026-08-01T14:00:00.000Z",
      dateKey: "2026-08-01",
      early: false,
      craving: 3,
      trigger: "coffee",
      note: "first one",
    },
    {
      id: uid(),
      timestamp: "2026-08-01T18:00:00.000Z",
      dateKey: "2026-08-01",
      early: true,
    },
  );
  state.delays.push({
    id: uid(),
    timestamp: "2026-08-01T17:55:00.000Z",
    outcome: "used",
  });
  state.slips.push({ id: uid(), timestamp: "2026-09-12T15:00:00.000Z" });
  state.waterLogs.push({
    id: uid(),
    timestamp: "2026-08-01T15:00:00.000Z",
    dateKey: "2026-08-01",
  });
  state.meta.backfilled["2026-08-02"] = 7;
  state.meta.backfillSkipped.push("2026-08-03");
  state.meta.plateauShownAt = "2026-08-31T12:00:00.000Z";
  return state;
}

describe("persistence", () => {
  it("export then import round-trips all state losslessly", () => {
    const state = populatedState();
    expect(importJSON(exportJSON(state))).toEqual(state);
  });

  it("save then load round-trips through storage", () => {
    const storage = memoryStorage();
    const state = populatedState();
    saveState(storage, state);
    expect(loadState(storage)).toEqual(state);
  });

  it("rejects files that are not a backup", () => {
    expect(() => importJSON("not json at all")).toThrow(/valid JSON/);
    expect(() => importJSON('{"some":"other file"}')).toThrow(/backup/);
  });

  it("falls back to defaults on corrupt storage", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "{broken");
    expect(loadState(storage)).toEqual(defaultState());
  });

  it("seeds the default plan on first load", () => {
    const state = loadState(memoryStorage());
    expect(state.plan).toHaveLength(42);
    expect(state.plan[0]).toMatchObject({ date: "2026-08-01", plannedAllowance: 10 });
  });
});

describe("derived usage", () => {
  it("counts logs per dateKey and uses backfill only for unlogged days", () => {
    const state = populatedState();
    const used = usedByDateFrom(state.logs, {
      "2026-08-01": 5, // ignored: the day has real logs
      "2026-08-02": 7,
      "2026-08-04": 0,
    });
    expect(used["2026-08-01"]).toBe(2);
    expect(used["2026-08-02"]).toBe(7);
    expect(used["2026-08-04"]).toBe(0);
  });

  it("treats unlogged, unskipped past days as missing", () => {
    const state = populatedState();
    // Aug 1 logged, Aug 2 backfilled, Aug 3 skipped, Aug 4 missing.
    expect(missingDays(state, "2026-08-05")).toEqual(["2026-08-04"]);
  });

  it("computes the at-or-under streak ending yesterday", () => {
    const state = defaultState();
    state.meta.backfilled = {
      "2026-08-01": 10,
      "2026-08-02": 9,
      "2026-08-03": 12, // over allowance 9: breaks the streak
      // Aug 3's excess of 3 is repaid here: allowances drop to 7 and 7.
      "2026-08-04": 7,
      "2026-08-05": 6,
    };
    expect(streakAtOrUnder(state, "2026-08-06")).toBe(2);
  });
});

describe("recompute action", () => {
  it("keeps the quit date fixed and preserves history", () => {
    const state = defaultState();
    for (let d = 3; d <= 9; d++) {
      state.meta.backfilled[`2026-08-0${d}`] = 6;
    }
    const next = applyRecompute(state, "2026-08-10");
    expect(next).not.toBeNull();
    expect(next!.settings.quitDate).toBe("2026-09-11");
    // History before today is untouched.
    expect(next!.plan.find((d) => d.date === "2026-08-05")).toEqual(
      state.plan.find((d) => d.date === "2026-08-05"),
    );
    // New curve starts from the trailing average (6/day) today.
    expect(next!.plan.find((d) => d.date === "2026-08-10")!.plannedAllowance).toBe(6);
    expect(next!.plan.at(-1)).toMatchObject({ date: "2026-09-11", plannedAllowance: 0 });
    // Day indices stay relative to the original start date.
    expect(next!.plan.find((d) => d.date === "2026-08-10")!.dayIndex).toBe(9);
  });

  it("flags a too-steep recompute instead of applying silently", () => {
    const state = defaultState();
    for (let d = 1; d <= 7; d++) {
      state.meta.backfilled[`2026-09-0${d}`] = 12;
    }
    const preview = previewRecompute(state, "2026-09-08");
    expect(preview!.tooSteep).toBe(true);
    // Moving the quit date out two weeks relaxes it.
    const relaxed = previewRecompute(state, "2026-09-08", "2026-09-25");
    expect(relaxed!.tooSteep).toBe(false);
  });

  it("returns null when there is no runway left", () => {
    const state = defaultState();
    expect(applyRecompute(state, "2026-09-11")).toBeNull();
  });
});

describe("starting a new plan", () => {
  const NEW_PHASE = {
    startDate: "2026-11-06",
    quitDate: "2027-01-01",
    baselinePerDay: 8,
    milestones: [{ dayIndex: 27, fraction: 0.5 }],
  };

  // Like the phone today: a finished Aug-Sep taper, then post-quit slips.
  function afterFirstTaper(): AppState {
    const state = defaultState();
    state.meta.backfilled = { "2026-08-01": 10, "2026-08-02": 9 };
    state.slips.push(
      { id: uid(), timestamp: "2026-09-20T15:00:00.000Z" },
      { id: uid(), timestamp: "2026-10-15T15:00:00.000Z" },
    );
    return state;
  }

  it("archives the old plan and keeps its plan days", () => {
    const next = startNewPhase(afterFirstTaper(), NEW_PHASE);
    expect(next.meta.pastPhases).toEqual([
      { startDate: "2026-08-01", quitDate: "2026-09-11", baselinePerDay: 10 },
    ]);
    expect(next.plan.find((d) => d.date === "2026-08-01")!.plannedAllowance).toBe(10);
    expect(next.plan.find((d) => d.date === "2026-09-11")!.plannedAllowance).toBe(0);
    expect(next.plan.find((d) => d.date === "2026-11-06")!.plannedAllowance).toBe(8);
    expect(next.plan.find((d) => d.date === "2026-12-03")!.plannedAllowance).toBe(4);
    expect(next.plan.at(-1)).toMatchObject({ date: "2027-01-01", plannedAllowance: 0 });
    expect(next.plan.some((d) => d.date === "2026-10-01")).toBe(false);
    expect(next.settings).toMatchObject(NEW_PHASE);
  });

  it("keeps all logs and slips", () => {
    const before = afterFirstTaper();
    const next = startNewPhase(before, NEW_PHASE);
    expect(next.slips).toEqual(before.slips);
    expect(next.logs).toEqual(before.logs);
    expect(next.meta.backfilled).toEqual(before.meta.backfilled);
  });

  it("does not ask to backfill the gap between plans", () => {
    const next = startNewPhase(afterFirstTaper(), NEW_PHASE);
    expect(missingDays(next, "2026-11-06")).toEqual([]);
  });

  it("uses each plan's own baseline for savings and skips the gap", () => {
    const next = startNewPhase(afterFirstTaper(), NEW_PHASE);
    expect(taperBaselineFor(next, "2026-08-01")).toBe(10);
    expect(taperBaselineFor(next, "2026-10-01")).toBeUndefined();
    expect(taperBaselineFor(next, "2026-11-06")).toBe(8);
    next.meta.backfilled["2026-11-06"] = 6;
    // Aug 1: 10-10=0, Aug 2: 10-9=1, Nov 6: 8-6=2. Nothing for Sep 11 - Nov 5.
    expect(statsFor(next, "2026-11-07").avoided).toBe(3);
  });

  it("ignores slips from before the current quit date", () => {
    const next = startNewPhase(afterFirstTaper(), NEW_PHASE);
    next.slips.push({ id: uid(), timestamp: "2027-01-05T15:00:00.000Z" });
    const sum = postQuitSummary(next, "2027-01-10");
    expect(sum.daysSinceQuit).toBe(10);
    expect(sum.totalSlips).toBe(1);
    expect(sum.daysClean).toBe(9);
  });

  it("starts the days-to-zero countdown when the new plan first reaches 2", () => {
    const next = startNewPhase(afterFirstTaper(), NEW_PHASE);
    expect(zeroCountdownFrom(next)).toBe("2026-12-13");
    // Same rule gives the original plan's day 25 (Aug 26).
    expect(zeroCountdownFrom(defaultState())).toBe("2026-08-26");
  });

  it("round-trips through export and import", () => {
    const next = startNewPhase(afterFirstTaper(), NEW_PHASE);
    expect(importJSON(exportJSON(next))).toEqual(next);
  });

  it("loads saved data from before plans had phases or milestones", () => {
    const old = defaultState() as unknown as {
      meta: Record<string, unknown>;
      settings: Record<string, unknown>;
    };
    delete old.meta.pastPhases;
    delete old.settings.milestones;
    const loaded = importJSON(JSON.stringify(old));
    expect(loaded.meta.pastPhases).toEqual([]);
    expect(loaded.settings.milestones).toBeUndefined();
    expect(postQuitSummary(loaded, "2026-09-12").daysClean).toBe(2);
  });
});
