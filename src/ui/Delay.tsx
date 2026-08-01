import { useEffect, useRef, useState } from "react";
import { fmtClock, fmtCountdown } from "./format";

type DelayProps = {
  minutes: number;
  nextAt: Date | null;
  onResist(): void;
  onUse(): void;
  onCancel(): void;
};

export default function Delay(p: DelayProps) {
  const start = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const remainMs = Math.max(0, p.minutes * 60_000 - (now - start.current));
  const done = remainMs === 0;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{done ? "The wave has crested" : "Not due yet — ride it out?"}</h2>
        {p.nextAt && (
          <p className="muted">Next pouch at {fmtClock(p.nextAt)}</p>
        )}
        <div className="breath">
          <div className="breath-circle" />
        </div>
        <div className="delay-timer">{done ? "0:00" : fmtCountdown(remainMs)}</div>
        <p className="muted small">
          Cravings peak and fade within a few minutes. Breathe with the circle:
          in as it grows, out as it shrinks.
        </p>
        <div className="row">
          <button className="btn good" onClick={p.onResist}>
            I made it
          </button>
          <button className="btn plain" onClick={p.onUse}>
            I need one now
          </button>
        </div>
        <button className="linklike" onClick={p.onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
