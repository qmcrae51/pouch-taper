import { useRef, useState } from "react";
import { buildPlanFor } from "../engine/curve";
import { addDays, daysBetween } from "../engine/dates";
import { NEW_PHASE_DEFAULTS } from "../engine/defaults";
import { supplyPlan } from "../engine/supply";
import type { Settings as SettingsType } from "../engine/types";
import {
  adjustedPlanFor,
  applyRecompute,
  previewRecompute,
  startNewPhase,
  type NewPhase,
  type RecomputePreview,
} from "../storage/derive";
import type { AppState } from "../storage/model";
import { clearState, defaultState, exportJSON, importJSON } from "../storage/store";
import { fmtDateShort } from "./format";

type Props = {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  todayKey: string;
};

function parseAnchors(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t));
}

function cloneSettings(s: SettingsType): SettingsType {
  return {
    ...s,
    travelMode: { ...s.travelMode },
    anchors: { one: [...s.anchors.one], two: [...s.anchors.two] },
    water: { ...s.water },
    milestones: s.milestones?.map((m) => ({ ...m })),
    medication: {
      ...s.medication,
      steps: s.medication.steps.map((step) => ({ ...step })),
    },
  };
}

/** The new plan described by the "Start a new plan" form. */
function newPhaseFrom(
  startDate: string,
  baseline: number,
  weeks: number,
  halveByWeek: number,
): NewPhase {
  return {
    startDate,
    quitDate: addDays(startDate, Math.round(weeks * 7)),
    baselinePerDay: baseline,
    milestones:
      halveByWeek > 0 ? [{ dayIndex: halveByWeek * 7 - 1, fraction: 0.5 }] : [],
  };
}

export default function Settings({ state, setState, todayKey }: Props) {
  const s = state.settings;
  const [draft, setDraft] = useState<SettingsType>(() => cloneSettings(s));
  const [msg, setMsg] = useState<string | null>(null);
  const [phaseStart, setPhaseStart] = useState(todayKey);
  const [phaseBaseline, setPhaseBaseline] = useState(
    NEW_PHASE_DEFAULTS.baselinePerDay,
  );
  const [phaseWeeks, setPhaseWeeks] = useState(NEW_PHASE_DEFAULTS.weeks);
  const [phaseHalveBy, setPhaseHalveBy] = useState(
    (NEW_PHASE_DEFAULTS.milestones[0].dayIndex + 1) / 7,
  );
  const [confirmPhase, setConfirmPhase] = useState(false);
  const [preview, setPreview] = useState<RecomputePreview | null>(null);
  const [previewQuit, setPreviewQuit] = useState<string>(s.quitDate);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [supplyFrom, setSupplyFrom] = useState(s.travelMode.from ?? todayKey);
  const [supplyTo, setSupplyTo] = useState(s.travelMode.to ?? s.quitDate);

  function set<K extends keyof SettingsType>(key: K, value: SettingsType[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setMed(patch: Partial<SettingsType["medication"]>) {
    setDraft((d) => ({ ...d, medication: { ...d.medication, ...patch } }));
  }

  function setStep(
    i: number,
    patch: Partial<SettingsType["medication"]["steps"][number]>,
  ) {
    setDraft((d) => ({
      ...d,
      medication: {
        ...d.medication,
        steps: d.medication.steps.map((step, j) =>
          j === i ? { ...step, ...patch } : step,
        ),
      },
    }));
  }

  function save() {
    if (daysBetween(draft.startDate, draft.quitDate) < 1) {
      setMsg("Quit date must be after the start date.");
      return;
    }
    const curveChanged =
      draft.baselinePerDay !== s.baselinePerDay ||
      draft.startDate !== s.startDate ||
      draft.quitDate !== s.quitDate;
    setState((st) => ({
      ...st,
      settings: draft,
      plan: curveChanged
        ? [
            ...st.plan.filter((d) => d.date < draft.startDate),
            ...buildPlanFor(draft),
          ]
        : st.plan,
    }));
    setMsg(curveChanged ? "Saved — the curve was rebuilt." : "Saved.");
  }

  const phase = newPhaseFrom(phaseStart, phaseBaseline, phaseWeeks, phaseHalveBy);
  let phasePreview: string | null = null;
  try {
    const p = buildPlanFor({ ...phase, milestones: phase.milestones });
    const total = p.reduce((sum, d) => sum + d.plannedAllowance, 0);
    const halfway = phase.milestones[0]
      ? p[phase.milestones[0].dayIndex]
      : undefined;
    const lastDay = p[p.length - 2];
    phasePreview =
      `${p[0].plannedAllowance}/day` +
      (halfway ? ` → ${halfway.plannedAllowance} by ${fmtDateShort(halfway.date)}` : "") +
      ` → ${lastDay.plannedAllowance} on ${fmtDateShort(lastDay.date)}` +
      ` → 0 from ${fmtDateShort(phase.quitDate)}. ${total} pouches in all.`;
  } catch {
    phasePreview = null;
  }

  function applyNewPhase() {
    const next = startNewPhase(state, phase);
    setState(next);
    setDraft(cloneSettings(next.settings));
    setConfirmPhase(false);
    setMsg(`New plan started. Zero day is ${fmtDateShort(phase.quitDate)}.`);
  }

  function startRecompute(quitDate = s.quitDate) {
    setPreviewQuit(quitDate);
    const p = previewRecompute(state, todayKey, quitDate);
    setPreview(p);
    if (!p) setMsg("No taper runway left before the quit date.");
  }

  function applyPreview() {
    const next = applyRecompute(state, todayKey, previewQuit);
    if (next) {
      setState(next);
      setDraft((d) => ({ ...d, quitDate: previewQuit }));
      setMsg("Plan recomputed from your recent average.");
    }
    setPreview(null);
  }

  function doExport() {
    const blob = new Blob([exportJSON(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pouch-taper-backup-${todayKey}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function doImport(file: File) {
    file
      .text()
      .then((text) => {
        const imported = importJSON(text);
        setState(imported);
        setDraft(cloneSettings(imported.settings));
        setMsg("Backup restored.");
      })
      .catch((e: Error) => setMsg(e.message));
  }

  function resetAll() {
    clearState(localStorage);
    const fresh = defaultState();
    setState(fresh);
    setDraft(cloneSettings(fresh.settings));
    setConfirmReset(false);
    setMsg("All data erased.");
  }

  const supply = supplyPlan(
    adjustedPlanFor(state),
    supplyFrom,
    supplyTo,
    s.pouchesPerTin,
  );

  const num = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return (
    <div className="screen settings">
      <h1 className="screen-title">Settings</h1>
      {msg && <div className="banner neutral">{msg}</div>}

      <div className="card">
        <h3>Product</h3>
        <label>
          Name
          <input
            value={draft.productName}
            onChange={(e) => set("productName", e.target.value)}
          />
        </label>
        <label>
          mg per pouch
          <input
            type="number"
            inputMode="decimal"
            value={draft.mgPerPouch}
            onChange={(e) => set("mgPerPouch", num(e.target.value, draft.mgPerPouch))}
          />
        </label>
        <label>
          Pouches per tin
          <input
            type="number"
            inputMode="numeric"
            value={draft.pouchesPerTin}
            onChange={(e) =>
              set("pouchesPerTin", num(e.target.value, draft.pouchesPerTin))
            }
          />
        </label>
        <label>
          Cost per tin
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={draft.costPerTin}
            onChange={(e) => set("costPerTin", num(e.target.value, draft.costPerTin))}
          />
        </label>
        <label>
          Currency
          <input
            value={draft.currency}
            onChange={(e) => set("currency", e.target.value.toUpperCase())}
          />
        </label>
      </div>

      <div className="card">
        <h3>Start a new plan</h3>
        <p className="muted small">
          Begins a fresh taper. Your current plan and all history are kept.
        </p>
        <label>
          Start date
          <input
            type="date"
            value={phaseStart}
            onChange={(e) => setPhaseStart(e.target.value || todayKey)}
          />
        </label>
        <label>
          Pouches/day now
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={phaseBaseline}
            onChange={(e) =>
              setPhaseBaseline(Math.max(1, num(e.target.value, phaseBaseline)))
            }
          />
        </label>
        <label>
          Weeks until zero
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={phaseWeeks}
            onChange={(e) =>
              setPhaseWeeks(Math.max(1, num(e.target.value, phaseWeeks)))
            }
          />
        </label>
        <label>
          Halve by end of week (0 = off)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={phaseHalveBy}
            onChange={(e) =>
              setPhaseHalveBy(Math.max(0, num(e.target.value, phaseHalveBy)))
            }
          />
        </label>
        {phasePreview && <p className="small">{phasePreview}</p>}
        {!confirmPhase ? (
          <button
            className="btn"
            disabled={!phasePreview}
            onClick={() => setConfirmPhase(true)}
          >
            Start new plan
          </button>
        ) : (
          <div className="row">
            <button className="btn good" onClick={applyNewPhase}>
              Yes, start it
            </button>
            <button className="btn plain" onClick={() => setConfirmPhase(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Plan</h3>
        <label>
          Baseline pouches/day
          <input
            type="number"
            inputMode="numeric"
            value={draft.baselinePerDay}
            onChange={(e) =>
              set("baselinePerDay", num(e.target.value, draft.baselinePerDay))
            }
          />
        </label>
        <label>
          Start date
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </label>
        <label>
          Quit date (first zero day)
          <input
            type="date"
            value={draft.quitDate}
            onChange={(e) => set("quitDate", e.target.value)}
          />
        </label>
        <p className="muted small">
          Changing these rebuilds the curve. The quit date only moves when you
          move it here.
        </p>
      </div>

      <div className="card">
        <h3>Day &amp; schedule</h3>
        <label>
          Day rollover hour
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={12}
            value={draft.dayRolloverHour}
            onChange={(e) =>
              set(
                "dayRolloverHour",
                Math.min(12, Math.max(0, num(e.target.value, draft.dayRolloverHour))),
              )
            }
          />
        </label>
        <label>
          Wake time
          <input
            type="time"
            value={draft.wakeTime}
            onChange={(e) => set("wakeTime", e.target.value)}
          />
        </label>
        <label>
          Sleep time
          <input
            type="time"
            value={draft.sleepTime}
            onChange={(e) => set("sleepTime", e.target.value)}
          />
        </label>
        <label>
          Delay timer (minutes)
          <input
            type="number"
            inputMode="numeric"
            value={draft.delayMinutes}
            onChange={(e) =>
              set("delayMinutes", num(e.target.value, draft.delayMinutes))
            }
          />
        </label>
        <label>
          Anchor time at 1/day
          <input
            value={draft.anchors.one.join(", ")}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                anchors: { ...d.anchors, one: parseAnchors(e.target.value) },
              }))
            }
          />
        </label>
        <label>
          Anchor times at 2/day
          <input
            value={draft.anchors.two.join(", ")}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                anchors: { ...d.anchors, two: parseAnchors(e.target.value) },
              }))
            }
          />
        </label>
        <label>
          Timezone
          <input
            value={draft.timezone}
            onChange={(e) => set("timezone", e.target.value)}
          />
        </label>
        <p className="muted small">
          Times follow your device clock wherever you are.
        </p>
      </div>

      <div className="card">
        <h3>Water</h3>
        <label>
          Bottle size (oz)
          <input
            type="number"
            inputMode="decimal"
            value={draft.water.bottleOz}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                water: {
                  ...d.water,
                  bottleOz: num(e.target.value, d.water.bottleOz),
                },
              }))
            }
          />
        </label>
        <label>
          Daily goal (litres)
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={draft.water.goalLitres}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                water: {
                  ...d.water,
                  goalLitres: num(e.target.value, d.water.goalLitres),
                },
              }))
            }
          />
        </label>
        <p className="muted small">
          Same goal every day — no end date, no taper.
        </p>
      </div>

      <div className="card">
        <h3>Medication</h3>
        <label className="toggle-row">
          Show on Today
          <input
            type="checkbox"
            checked={draft.medication.enabled}
            onChange={(e) => setMed({ enabled: e.target.checked })}
          />
        </label>
        <label>
          Name
          <input
            value={draft.medication.name}
            onChange={(e) => setMed({ name: e.target.value })}
          />
        </label>
        <label>
          Day 1
          <input
            type="date"
            value={draft.medication.startDate}
            onChange={(e) =>
              setMed({ startDate: e.target.value || draft.medication.startDate })
            }
          />
        </label>
        <label>
          Course length (days)
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={draft.medication.totalDays}
            onChange={(e) =>
              setMed({
                totalDays: Math.max(1, num(e.target.value, draft.medication.totalDays)),
              })
            }
          />
        </label>
        {draft.medication.steps.map((step, i) => (
          <div key={i} className="dose-step">
            <div className="muted small">Step {i + 1}</div>
            <label>
              From day
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={step.fromDay}
                onChange={(e) =>
                  setStep(i, { fromDay: Math.max(1, num(e.target.value, step.fromDay)) })
                }
              />
            </label>
            <label>
              mg per dose
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                value={step.mg}
                onChange={(e) => setStep(i, { mg: num(e.target.value, step.mg) })}
              />
            </label>
            <label>
              Times a day
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={step.timesPerDay}
                onChange={(e) =>
                  setStep(i, {
                    timesPerDay: Math.max(1, num(e.target.value, step.timesPerDay)),
                  })
                }
              />
            </label>
          </div>
        ))}
        <p className="muted small">
          Shows today's dose from your schedule. Ends after day{" "}
          {draft.medication.totalDays}.
        </p>
      </div>

      <div className="card">
        <h3>Travel Mode</h3>
        <label className="toggle-row">
          Enabled
          <input
            type="checkbox"
            checked={draft.travelMode.active}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                travelMode: { ...d.travelMode, active: e.target.checked },
              }))
            }
          />
        </label>
        <label>
          From
          <input
            type="date"
            value={draft.travelMode.from ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                travelMode: { ...d.travelMode, from: e.target.value || undefined },
              }))
            }
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={draft.travelMode.to ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                travelMode: { ...d.travelMode, to: e.target.value || undefined },
              }))
            }
          />
        </label>
        <p className="muted small">
          Keeps the daily cap, drops the schedule. Interval timing resumes the
          day after it ends.
        </p>
      </div>

      <div className="card">
        <h3>Supply planner</h3>
        <label>
          From
          <input
            type="date"
            value={supplyFrom}
            onChange={(e) => setSupplyFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={supplyTo}
            onChange={(e) => setSupplyTo(e.target.value)}
          />
        </label>
        <div className="supply-result">
          <div className="supply-pack">
            Pack {supply.withBuffer} pouches
          </div>
          <p className="muted small">
            {supply.pouches} planned + 25% buffer. That's{" "}
            {supply.tinsPlanned === 1
              ? "one tin for the plan"
              : `${supply.tinsPlanned} tins for the plan`}
            {supply.tinsWithBuffer > supply.tinsPlanned &&
              ` — bring ${supply.tinsWithBuffer} to cover the buffer`}
            . Running out mid-trip means an unplanned cold-turkey; pack the
            buffer.
          </p>
        </div>
      </div>

      <div className="card">
        <h3>Recompute plan</h3>
        <p className="muted small">
          Rebuilds the curve from today using your trailing 7-day average. The
          quit date stays put.
        </p>
        {!preview ? (
          <button className="btn" onClick={() => startRecompute()}>
            Recompute plan
          </button>
        ) : (
          <div className="recompute-preview">
            <p>
              New baseline {preview.newBaseline.toFixed(1)}/day over{" "}
              {preview.taperDays} days ({preview.dailyRatePct.toFixed(1)}%/day
              reduction), quitting {fmtDateShort(previewQuit)}.
            </p>
            {preview.tooSteep && (
              <p className="banner warn">
                That's steeper than 15% a day — the remaining runway is very
                compressed. You can push the quit date out instead:
              </p>
            )}
            <div className="row wrap">
              {preview.tooSteep && (
                <>
                  <button
                    className="btn small"
                    onClick={() => startRecompute(addDays(s.quitDate, 7))}
                  >
                    +1 week
                  </button>
                  <button
                    className="btn small"
                    onClick={() => startRecompute(addDays(s.quitDate, 14))}
                  >
                    +2 weeks
                  </button>
                </>
              )}
              <button className="btn small good" onClick={applyPreview}>
                Apply
              </button>
              <button className="btn small plain" onClick={() => setPreview(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Backup</h3>
        <div className="row">
          <button className="btn" onClick={doExport}>
            Export JSON
          </button>
          <button className="btn plain" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = "";
          }}
        />
      </div>

      <div className="save-bar">
        <button className="btn good wide" onClick={save}>
          Save settings
        </button>
      </div>

      <div className="card danger-zone">
        <h3>Reset</h3>
        {!confirmReset ? (
          <button className="btn danger" onClick={() => setConfirmReset(true)}>
            Reset all data
          </button>
        ) : (
          <div className="row">
            <button className="btn danger" onClick={resetAll}>
              Erase everything
            </button>
            <button className="btn plain" onClick={() => setConfirmReset(false)}>
              Keep my data
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
