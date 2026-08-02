import { useEffect, useRef, useState } from "react";
import { shouldOfferRecompute } from "./engine/adjust";
import { addDays, dateKeyFor, daysBetween } from "./engine/dates";
import { plateauBannerDue } from "./engine/plateau";
import { buildDaySchedule, nextAllowedMinute } from "./engine/schedule";
import type { PouchLog } from "./engine/types";
import {
  adjustedPlanFor,
  applyRecompute,
  missingDays,
  previewRecompute,
  usedByDateFrom,
} from "./storage/derive";
import type { AppState } from "./storage/model";
import { loadState, saveState, uid } from "./storage/store";
import Backfill from "./ui/Backfill";
import Delay from "./ui/Delay";
import History from "./ui/History";
import PostQuit from "./ui/PostQuit";
import Settings from "./ui/Settings";
import Stats from "./ui/Stats";
import Today from "./ui/Today";
import Water from "./ui/Water";

type Tab = "today" | "water" | "history" | "stats" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "water", label: "Water" },
  { id: "history", label: "History" },
  { id: "stats", label: "Stats" },
  { id: "settings", label: "Settings" },
];

function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState(localStorage));
  useEffect(() => {
    saveState(localStorage, state);
  }, [state]);

  const now = useNow();
  const s = state.settings;
  const todayKey = dateKeyFor(now, s.dayRolloverHour);
  const postQuit = todayKey >= s.quitDate;
  const notStarted = todayKey < s.startDate;

  const [tab, setTab] = useState<Tab>("today");
  const [delayOpen, setDelayOpen] = useState(false);
  const [lastLogId, setLastLogId] = useState<string | null>(null);
  const tagTimer = useRef<number>();

  const adjusted = adjustedPlanFor(state);
  const used = usedByDateFrom(state.logs, state.meta.backfilled);
  const todayPlan = adjusted.find((d) => d.date === todayKey);
  const allowance = todayPlan?.adjustedAllowance ?? 0;

  const travel = s.travelMode;
  const travelActive =
    travel.active &&
    (!travel.from || todayKey >= travel.from) &&
    (!travel.to || todayKey <= travel.to);

  const logsToday = state.logs
    .filter((l) => l.dateKey === todayKey)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const usedToday = logsToday.length;

  const [ty, tm, td] = todayKey.split("-").map(Number);
  const dayStartMs = new Date(ty, tm - 1, td).getTime();
  const anchors =
    allowance === 1 ? s.anchors.one : allowance === 2 ? s.anchors.two : undefined;
  const sched = buildDaySchedule(allowance, s.wakeTime, s.sleepTime, anchors);
  const logMinutes = logsToday.map(
    (l) => (Date.parse(l.timestamp) - dayStartMs) / 60000,
  );
  const nextMin = nextAllowedMinute(sched, logMinutes, allowance, travelActive);
  const capReached = nextMin === null;
  const nextAt = nextMin === null ? null : new Date(dayStartMs + nextMin * 60000);
  const earlyNow =
    !travelActive && nextAt !== null && now.getTime() < nextAt.getTime();

  const dayIndex = daysBetween(s.startDate, todayKey);
  const taperDays = daysBetween(s.startDate, s.quitDate);
  const daysToZero = Math.max(0, daysBetween(todayKey, s.quitDate));
  const overBy = Math.max(0, usedToday - allowance);

  const snoozed =
    !!state.meta.underPromptSnoozedUntil &&
    todayKey < state.meta.underPromptSnoozedUntil;
  const underDue =
    !postQuit && !notStarted && !snoozed &&
    shouldOfferRecompute(adjusted, used, todayKey);
  const earlierQuit = addDays(s.quitDate, -7);
  const earlierPreview = underDue
    ? previewRecompute(state, todayKey, earlierQuit)
    : null;

  const plateauDue = !postQuit && plateauBannerDue(adjusted, used, todayKey);
  useEffect(() => {
    if (!plateauDue) return;
    const last = state.meta.plateauShownAt
      ? Date.parse(state.meta.plateauShownAt)
      : 0;
    // Re-trigger at most once a week: one banner, no nagging.
    if (Date.now() - last > 7 * 86_400_000) {
      setState((st) => ({
        ...st,
        meta: { ...st.meta, plateauShownAt: new Date().toISOString() },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateauDue]);
  const plateauVisible =
    !!state.meta.plateauShownAt &&
    now.getTime() - Date.parse(state.meta.plateauShownAt) < 86_400_000;

  const backfillDate = postQuit ? undefined : missingDays(state, todayKey)[0];

  const waterToday = state.waterLogs.filter(
    (l) => l.dateKey === todayKey,
  ).length;

  function addWater() {
    const t = new Date();
    setState((st) => ({
      ...st,
      waterLogs: [
        ...st.waterLogs,
        {
          id: uid(),
          timestamp: t.toISOString(),
          dateKey: dateKeyFor(t, s.dayRolloverHour),
        },
      ],
    }));
  }

  function undoPouch() {
    setState((st) => {
      let idx = -1;
      for (let i = st.logs.length - 1; i >= 0; i--) {
        if (st.logs[i].dateKey === todayKey) {
          idx = i;
          break;
        }
      }
      if (idx === -1) return st;
      if (st.logs[idx].id === lastLogId) setLastLogId(null);
      return { ...st, logs: st.logs.filter((_, i) => i !== idx) };
    });
  }

  function undoWater() {
    setState((st) => {
      let idx = -1;
      for (let i = st.waterLogs.length - 1; i >= 0; i--) {
        if (st.waterLogs[i].dateKey === todayKey) {
          idx = i;
          break;
        }
      }
      if (idx === -1) return st;
      return {
        ...st,
        waterLogs: st.waterLogs.filter((_, i) => i !== idx),
      };
    });
  }

  function addLog(early: boolean) {
    const t = new Date();
    const log: PouchLog = {
      id: uid(),
      timestamp: t.toISOString(),
      dateKey: dateKeyFor(t, s.dayRolloverHour),
      early,
    };
    setState((st) => ({ ...st, logs: [...st.logs, log] }));
    setLastLogId(log.id);
    window.clearTimeout(tagTimer.current);
    tagTimer.current = window.setTimeout(() => setLastLogId(null), 12_000);
  }

  function addDelay(outcome: "resisted" | "used") {
    setState((st) => ({
      ...st,
      delays: [
        ...st.delays,
        { id: uid(), timestamp: new Date().toISOString(), outcome },
      ],
    }));
  }

  function onLogTap() {
    if (earlyNow) {
      setDelayOpen(true);
      return;
    }
    addLog(false);
  }

  function tagLast(patch: Partial<PouchLog>) {
    if (!lastLogId) return;
    setState((st) => ({
      ...st,
      logs: st.logs.map((l) => (l.id === lastLogId ? { ...l, ...patch } : l)),
    }));
  }

  function snoozeUnder() {
    setState((st) => ({
      ...st,
      meta: { ...st.meta, underPromptSnoozedUntil: addDays(todayKey, 3) },
    }));
  }

  function recompute(quitDate?: string) {
    const next = applyRecompute(state, todayKey, quitDate ?? s.quitDate);
    if (next) setState(next);
    snoozeUnder();
  }

  return (
    <div className="app">
      <main className="content">
        {tab === "today" &&
          (postQuit ? (
            <PostQuit state={state} setState={setState} todayKey={todayKey} />
          ) : (
            <Today
              todayKey={todayKey}
              now={now}
              notStarted={notStarted}
              startDate={s.startDate}
              quitDate={s.quitDate}
              allowance={allowance}
              usedToday={usedToday}
              travelActive={travelActive}
              capReached={capReached}
              nextAt={nextAt}
              dayIndex={dayIndex}
              taperDays={taperDays}
              daysToZero={daysToZero}
              overBy={overBy}
              plateauVisible={plateauVisible}
              underDue={underDue}
              earlierQuitOk={!!earlierPreview && !earlierPreview.tooSteep}
              lastLogId={lastLogId}
              onTagLast={tagLast}
              onDismissTag={() => setLastLogId(null)}
              onUndo={undoPouch}
              onFasterCurve={() => recompute()}
              onEarlierQuit={() => recompute(earlierQuit)}
              onSnoozeUnder={snoozeUnder}
            />
          ))}
        {tab === "water" && (
          <Water
            bottleOz={s.water.bottleOz}
            goalLitres={s.water.goalLitres}
            bottlesToday={waterToday}
            onUndo={undoWater}
          />
        )}
        {tab === "history" && <History state={state} todayKey={todayKey} />}
        {tab === "stats" && <Stats state={state} todayKey={todayKey} />}
        {tab === "settings" && (
          <Settings state={state} setState={setState} todayKey={todayKey} />
        )}
      </main>

      {tab === "today" && !postQuit && !notStarted && (
        <div className="primary-area">
          <button className="log-btn" onClick={onLogTap}>
            Log a pouch
          </button>
        </div>
      )}

      {tab === "water" && (
        <div className="primary-area">
          <button className="log-btn water" onClick={addWater}>
            Log a bottle
          </button>
        </div>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={"tab" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {delayOpen && (
        <Delay
          minutes={s.delayMinutes}
          nextAt={nextAt}
          onResist={() => {
            addDelay("resisted");
            setDelayOpen(false);
          }}
          onUse={() => {
            addDelay("used");
            addLog(true);
            setDelayOpen(false);
          }}
          onCancel={() => setDelayOpen(false)}
        />
      )}

      {backfillDate && !delayOpen && (
        <Backfill
          date={backfillDate}
          onSave={(n) =>
            setState((st) => ({
              ...st,
              meta: {
                ...st.meta,
                backfilled: { ...st.meta.backfilled, [backfillDate]: n },
              },
            }))
          }
          onSkip={() =>
            setState((st) => ({
              ...st,
              meta: {
                ...st.meta,
                backfillSkipped: [...st.meta.backfillSkipped, backfillDate],
              },
            }))
          }
        />
      )}
    </div>
  );
}
