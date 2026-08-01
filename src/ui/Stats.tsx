import { statsFor } from "../storage/derive";
import type { AppState } from "../storage/model";
import { fmtMoney } from "./format";

export default function Stats({
  state,
  todayKey,
}: {
  state: AppState;
  todayKey: string;
}) {
  const s = statsFor(state, todayKey);
  const { currency } = state.settings;

  return (
    <div className="screen">
      <h1 className="screen-title">Stats</h1>
      <p className="muted">vs your {state.settings.baselinePerDay}/day baseline</p>

      <div className="stat-grid">
        <div className="card stat">
          <div className="stat-num">{s.avoided}</div>
          <div className="muted small">pouches avoided</div>
        </div>
        <div className="card stat">
          <div className="stat-num">{fmtMoney(s.moneySaved, currency)}</div>
          <div className="muted small">saved</div>
        </div>
        <div className="card stat">
          <div className="stat-num">{s.mgAvoided} mg</div>
          <div className="muted small">nicotine avoided</div>
        </div>
        <div className="card stat">
          <div className="stat-num">{s.tinsAvoided.toFixed(1)}</div>
          <div className="muted small">tins avoided</div>
        </div>
      </div>

      <div className="card">
        <h3>Delay tool</h3>
        {s.delayTotal === 0 ? (
          <p className="muted small">No delays tried yet.</p>
        ) : (
          <p>
            Rode out {s.delayResisted} of {s.delayTotal} cravings (
            {Math.round((s.delayResisted / s.delayTotal) * 100)}%)
          </p>
        )}
      </div>

      <div className="card">
        <h3>Triggers</h3>
        {s.triggers.length === 0 ? (
          <p className="muted small">
            No trigger tags yet. Tag a log on the Today screen to see patterns.
          </p>
        ) : (
          <ul className="trigger-list">
            {s.triggers.slice(0, 5).map(([name, count]) => (
              <li key={name}>
                <span>{name}</span>
                <span className="muted">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
