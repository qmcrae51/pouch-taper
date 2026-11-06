import { formatDose, type DoseToday } from "../engine/medication";

type DoseCardProps = {
  name: string;
  dose: DoseToday;
  takenSlots: Set<number>;
  onToggle(slot: number): void;
};

function slotLabels(timesPerDay: number): string[] {
  if (timesPerDay === 1) return ["Today's dose"];
  if (timesPerDay === 2) return ["Morning", "Evening"];
  return Array.from({ length: timesPerDay }, (_, i) => `Dose ${i + 1}`);
}

export default function DoseCard({ name, dose, takenSlots, onToggle }: DoseCardProps) {
  return (
    <div className="card dose-card">
      <div className="dose-head">
        <span className="dose-name">{name}</span>
        <span className="muted small">
          Day {dose.dayNumber} of {dose.totalDays}
        </span>
      </div>
      <div className="dose-amount">{formatDose(dose.mg, dose.timesPerDay)} today</div>
      <div className="chip-row">
        {slotLabels(dose.timesPerDay).map((label, slot) => {
          const taken = takenSlots.has(slot);
          return (
            <button
              key={slot}
              className={"chip dose-chip" + (taken ? " taken" : "")}
              aria-pressed={taken}
              onClick={() => onToggle(slot)}
            >
              {taken ? `✓ ${label}` : label}
            </button>
          );
        })}
      </div>
      {dose.nextChange && (
        <div className="muted small dose-note">
          From tomorrow: {formatDose(dose.nextChange.mg, dose.nextChange.timesPerDay)} a
          day
        </div>
      )}
      {dose.lastDay && (
        <div className="muted small dose-note">Last day of the course</div>
      )}
    </div>
  );
}
