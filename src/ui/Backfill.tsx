import { useState } from "react";
import { fmtDateFull } from "./format";

type BackfillProps = {
  date: string;
  onSave(n: number): void;
  onSkip(): void;
};

export default function Backfill(p: BackfillProps) {
  const [n, setN] = useState(0);

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Missed a day</h2>
        <p className="muted">Did you use any pouches on {fmtDateFull(p.date)}?</p>
        <div className="stepper">
          <button
            className="btn plain step-btn"
            onClick={() => setN((v) => Math.max(0, v - 1))}
          >
            −
          </button>
          <div className="step-value">{n}</div>
          <button
            className="btn plain step-btn"
            onClick={() => setN((v) => Math.min(40, v + 1))}
          >
            +
          </button>
        </div>
        <div className="row">
          <button className="btn good" onClick={() => p.onSave(n)}>
            {n === 0 ? "None that day" : `Save ${n}`}
          </button>
          <button className="btn plain" onClick={p.onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
