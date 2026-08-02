import { goalBottles, litresFrom } from "../engine/water";

type WaterProps = {
  bottleOz: number;
  goalLitres: number;
  bottlesToday: number;
  onUndo(): void;
};

export default function Water(p: WaterProps) {
  const goal = goalBottles(p.goalLitres, p.bottleOz);
  const remaining = Math.max(0, goal - p.bottlesToday);
  const litres = litresFrom(p.bottlesToday, p.bottleOz);
  const goalMet = p.bottlesToday >= goal;
  const totalPips = Math.max(goal, p.bottlesToday);

  return (
    <div className="screen today">
      <header className="today-head">
        <div className="today-date">Water</div>
        <div className="muted">
          {p.bottleOz} oz bottle · goal {p.goalLitres} L a day, every day
        </div>
      </header>

      <div className="big-remaining">
        <div className="big-num">{remaining}</div>
        <div className="muted">of {goal} bottles left today</div>
      </div>

      <div className="countdown-area">
        <div className="countdown-label">
          {goalMet
            ? `Goal hit — ${litres.toFixed(1)} L down. Anything more is bonus.`
            : `${litres.toFixed(1)} of ${p.goalLitres} L so far`}
        </div>
      </div>

      <div className="pips">
        {Array.from({ length: totalPips }, (_, i) => (
          <span
            key={i}
            className={"pip" + (i < p.bottlesToday ? " water" : "")}
          />
        ))}
      </div>

      {p.bottlesToday > 0 && (
        <div className="undo-area">
          <button className="linklike" onClick={p.onUndo}>
            undo last bottle
          </button>
        </div>
      )}
    </div>
  );
}
