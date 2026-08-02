import type { PouchLog } from "../engine/types";
import { fmtClock, fmtCountdown, fmtDateFull, fmtDateShort } from "./format";

const TRIGGERS = ["coffee", "driving", "stress", "boredom", "after meal"];
const COUNTDOWN_FROM_DAY = 25;

type TodayProps = {
  todayKey: string;
  now: Date;
  notStarted: boolean;
  startDate: string;
  quitDate: string;
  allowance: number;
  usedToday: number;
  travelActive: boolean;
  capReached: boolean;
  nextAt: Date | null;
  dayIndex: number;
  taperDays: number;
  daysToZero: number;
  overBy: number;
  plateauVisible: boolean;
  underDue: boolean;
  earlierQuitOk: boolean;
  lastLogId: string | null;
  onTagLast(patch: Partial<PouchLog>): void;
  onDismissTag(): void;
  onUndo(): void;
  onFasterCurve(): void;
  onEarlierQuit(): void;
  onSnoozeUnder(): void;
};

function Pips({ allowance, used }: { allowance: number; used: number }) {
  const total = Math.max(allowance, used);
  return (
    <div className="pips">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={
            "pip" + (i < used ? (i < allowance ? " filled" : " over") : "")
          }
        />
      ))}
    </div>
  );
}

export default function Today(p: TodayProps) {
  if (p.notStarted) {
    return (
      <div className="screen">
        <h1 className="screen-title">Pouch Taper</h1>
        <p className="muted">
          Your taper starts on {fmtDateFull(p.startDate)}. Zero day is{" "}
          {fmtDateShort(p.quitDate)}.
        </p>
      </div>
    );
  }

  const remaining = Math.max(0, p.allowance - p.usedToday);
  const waiting = p.nextAt !== null && p.now.getTime() < p.nextAt.getTime();

  return (
    <div className="screen today">
      <header className="today-head">
        <div className="today-date">{fmtDateFull(p.todayKey)}</div>
        <div className="muted">
          Day {p.dayIndex + 1} of {p.taperDays} · quit day{" "}
          {fmtDateShort(p.quitDate)}
        </div>
      </header>

      {p.dayIndex >= COUNTDOWN_FROM_DAY && (
        <div className="zero-countdown">
          {p.daysToZero} {p.daysToZero === 1 ? "day" : "days"} to zero —{" "}
          {fmtDateShort(p.quitDate)}
        </div>
      )}

      {p.plateauVisible && (
        <div className="banner warn">
          This is the plateau: five straight days holding at {p.allowance || 2}
          /day. Controlled isn't the finish line — zero is{" "}
          {fmtDateShort(p.quitDate)}, {p.daysToZero} days out.
        </div>
      )}

      {p.overBy > 0 && (
        <div className="banner neutral">
          Over by {p.overBy}. Here's the adjusted plan.
        </div>
      )}

      {p.underDue && (
        <div className="card under-card">
          <p>
            You're running ahead. Recompute a faster curve, or pull your quit
            date earlier?
          </p>
          <div className="row">
            <button className="btn small" onClick={p.onFasterCurve}>
              Faster curve
            </button>
            {p.earlierQuitOk && (
              <button className="btn small" onClick={p.onEarlierQuit}>
                Quit 1 week earlier
              </button>
            )}
            <button className="btn small plain" onClick={p.onSnoozeUnder}>
              Not now
            </button>
          </div>
        </div>
      )}

      <div className="big-remaining">
        <div className="big-num">{remaining}</div>
        <div className="muted">of {p.allowance} left today</div>
      </div>

      {p.travelActive ? (
        <div className="countdown-area">
          <div className="travel-chip">Travel Mode</div>
          <div className="countdown-label">
            {remaining} of {p.allowance} left today — take them when you need
            them.
          </div>
        </div>
      ) : (
        <div className="countdown-area">
          {p.capReached ? (
            <div className="countdown-label">
              Done for today. Tomorrow's allowance starts fresh.
            </div>
          ) : waiting ? (
            <>
              <div className="countdown">
                {fmtCountdown(p.nextAt!.getTime() - p.now.getTime())}
              </div>
              <div className="countdown-label">
                next pouch at {fmtClock(p.nextAt!)}
              </div>
            </>
          ) : (
            <div className="countdown ready">Available now</div>
          )}
        </div>
      )}

      <Pips allowance={p.allowance} used={p.usedToday} />

      {p.usedToday > 0 && (
        <div className="undo-area">
          <button className="linklike" onClick={p.onUndo}>
            undo last pouch
          </button>
        </div>
      )}

      {p.lastLogId && (
        <div className="card tag-card">
          <div className="tag-head">
            <span className="muted small">Logged. Optional: how strong, and why?</span>
            <button className="linklike" onClick={p.onDismissTag}>
              skip
            </button>
          </div>
          <div className="chip-row">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                className="chip"
                onClick={() => {
                  p.onTagLast({ craving: n });
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="chip-row">
            {TRIGGERS.map((t) => (
              <button
                key={t}
                className="chip"
                onClick={() => {
                  p.onTagLast({ trigger: t });
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
