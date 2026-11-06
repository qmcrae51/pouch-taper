import { useState } from "react";
import { postQuitSummary, statsFor } from "../storage/derive";
import type { AppState } from "../storage/model";
import { uid } from "../storage/store";
import { fmtDateShort, fmtMoney } from "./format";

export default function PostQuit({
  state,
  setState,
  todayKey,
  doseCard,
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  todayKey: string;
  doseCard?: React.ReactNode;
}) {
  const sum = postQuitSummary(state, todayKey);
  const stats = statsFor(state, todayKey);
  const [justSlipped, setJustSlipped] = useState(false);

  function slipped() {
    setState((st) => ({
      ...st,
      slips: [...st.slips, { id: uid(), timestamp: new Date().toISOString() }],
    }));
    setJustSlipped(true);
    window.setTimeout(() => setJustSlipped(false), 6000);
  }

  return (
    <div className="screen today">
      <header className="today-head">
        <div className="today-date">
          Quit {fmtDateShort(state.settings.quitDate)}
        </div>
        <div className="muted">You're on the other side.</div>
      </header>

      {doseCard}

      <div className="big-remaining">
        <div className="big-num">{sum.daysClean}</div>
        <div className="muted">
          {sum.daysClean === 1 ? "day" : "days"} clean of {sum.daysSinceQuit}
        </div>
      </div>

      <div className="stat-grid">
        <div className="card stat">
          <div className="stat-num">{fmtMoney(stats.moneySaved, state.settings.currency)}</div>
          <div className="muted small">saved vs baseline</div>
        </div>
        <div className="card stat">
          <div className="stat-num">{sum.totalSlips}</div>
          <div className="muted small">total slips</div>
        </div>
      </div>

      {justSlipped && (
        <div className="banner neutral">
          Logged. A slip is a data point, not a reset.
        </div>
      )}

      <div className="slip-area">
        <button className="btn plain" onClick={slipped}>
          I slipped
        </button>
      </div>
    </div>
  );
}
