import { useState } from "react";
import {
  adjustedPlanFor,
  streakAtOrUnder,
  usedByDateFrom,
} from "../storage/derive";
import type { AppState } from "../storage/model";
import { fmtClock, fmtDateFull, fmtDateShort } from "./format";

const BAR_W = 7;
const BAR_GAP = 3;
const CHART_H = 130;

export default function History({
  state,
  todayKey,
}: {
  state: AppState;
  todayKey: string;
}) {
  const plan = adjustedPlanFor(state);
  const used = usedByDateFrom(state.logs, state.meta.backfilled);
  const streak = streakAtOrUnder(state, todayKey);
  const [sel, setSel] = useState<string | null>(null);

  const maxV = Math.max(
    1,
    ...plan.map((d) => Math.max(d.adjustedAllowance, used[d.date] ?? 0)),
  );
  const h = (v: number) => (v / maxV) * (CHART_H - 10);
  const width = plan.length * (BAR_W + BAR_GAP);

  const selDay = sel ? plan.find((d) => d.date === sel) : undefined;
  const selLogs = sel
    ? state.logs
        .filter((l) => l.dateKey === sel)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    : [];
  const selBackfilled = sel !== null ? state.meta.backfilled[sel] : undefined;

  return (
    <div className="screen">
      <h1 className="screen-title">History</h1>
      <p className="muted">
        {streak > 0
          ? `${streak} ${streak === 1 ? "day" : "days"} at or under allowance`
          : "Tap a bar for that day's detail"}
      </p>

      <div className="chart-scroll">
        <svg
          width={width}
          height={CHART_H + 18}
          role="img"
          aria-label="Actual vs planned pouches per day"
        >
          {plan.map((d, i) => {
            const x = i * (BAR_W + BAR_GAP);
            const u = used[d.date];
            const over = u !== undefined && u > d.adjustedAllowance;
            return (
              <g key={d.date} onClick={() => setSel(d.date)}>
                {/* tap target */}
                <rect
                  x={x - BAR_GAP / 2}
                  y={0}
                  width={BAR_W + BAR_GAP}
                  height={CHART_H + 18}
                  fill="transparent"
                />
                <rect
                  className="bar-target"
                  x={x}
                  y={CHART_H - h(d.adjustedAllowance)}
                  width={BAR_W}
                  height={h(d.adjustedAllowance)}
                  rx={1.5}
                />
                {u !== undefined && u > 0 && (
                  <rect
                    className={over ? "bar-over" : "bar-actual"}
                    x={x}
                    y={CHART_H - h(u)}
                    width={BAR_W}
                    height={h(u)}
                    rx={1.5}
                  />
                )}
                {(d.date === todayKey || d.date === sel) && (
                  <rect
                    className={d.date === sel ? "bar-sel" : "bar-today"}
                    x={x - 1}
                    y={2}
                    width={BAR_W + 2}
                    height={CHART_H - 1}
                    rx={2}
                    fill="none"
                  />
                )}
                {d.date.endsWith("-01") && (
                  <text className="axis-label" x={x} y={CHART_H + 14}>
                    {fmtDateShort(d.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="legend">
        <span className="legend-item">
          <span className="swatch target" /> target
        </span>
        <span className="legend-item">
          <span className="swatch actual" /> actual
        </span>
        <span className="legend-item">
          <span className="swatch over" /> over
        </span>
      </div>

      {selDay && (
        <div className="card">
          <h3>{fmtDateFull(selDay.date)}</h3>
          <p className="muted small">
            Target {selDay.adjustedAllowance}
            {selDay.adjustedAllowance !== selDay.plannedAllowance &&
              ` (planned ${selDay.plannedAllowance})`}
            {" · used "}
            {used[selDay.date] ?? "—"}
          </p>
          {selBackfilled !== undefined && selLogs.length === 0 && (
            <p className="muted small">Backfilled: {selBackfilled}</p>
          )}
          {selLogs.length > 0 && (
            <ul className="log-list">
              {selLogs.map((l) => (
                <li key={l.id}>
                  {fmtClock(new Date(l.timestamp))}
                  {l.early && <span className="tag early">early</span>}
                  {l.craving && (
                    <span className="tag">craving {l.craving}</span>
                  )}
                  {l.trigger && <span className="tag">{l.trigger}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
