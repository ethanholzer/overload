import { useState, useMemo, useRef, useEffect } from 'react'
import './App.css'
import {
  MUSCLE_GROUPS, DAYS_SHORT, MONTHS_SHORT,
  LATERALITY, SETUPS, LATERALITY_BLURB, detailLine,
  FEEL_STOPS, feelKnobLabel, feelToRpe, rpeColor, isFailure, buzz,
  DEFAULT_TARGET_SETS, DEFAULT_GOAL_REPS, makeItem,
  workoutMuscles, musclesSummary, workoutSummaryLine, formatHistoryDate,
  loadState, saveState, freshState, lastSessionSets, exerciseSessions,
} from './data.js'
import { muscleIcon, BODYMAP } from './assets/muscleGraphics.js'
import planBodyArt from './assets/plan-body.svg'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Plus, Edit, History, Pause, Resume, ArrowRight,
  SmallChevronLeft, SmallChevronRight, SmallChevronUp, SmallChevronDown,
  Share, Close, KebabMenu, Trash, Gear, Swap, List, Search, Check,
} from './icons.jsx'

// ─── helpers ────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9)
const todayIdx = () => new Date().getDay()

function MuscleIcon({ muscle, size = 60 }) {
  const src = muscleIcon(muscle)
  if (!src) return null
  return <img className="muscle-icon" src={src} alt="" aria-hidden="true"
    style={{ width: size, height: size }} />
}

function Header({ title, onBack, tone = 'violet' }) {
  // tone drives both the back-button fill and the title colour, which is
  // how the cream/violet/red semantics read at a glance.
  const chev = { violet: '#FFFFFF', cream: '#FFFFFF', red: '#F0573F', plain: '#FFFFFF' }[tone]
  return (
    <div className={`hdr hdr-${tone}`}>
      <button className="hdr-back" onClick={onBack} aria-label="Back">
        <ChevronLeft color={chev} />
      </button>
      {title && <h1 className="display hdr-title">{title}</h1>}
    </div>
  )
}

// A number stepper: [−] [value] [+], used for target sets and goal reps.
function Stepper({ label, value, min = 1, max = 30, onChange }) {
  return (
    <div className="stepper-row">
      <span className="stepper-label">{label}</span>
      <div className="stepper">
        <button className="stepper-btn" aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}>
          <SmallChevronDown color="#111111" />
        </button>
        <span className="stepper-value">{value}</span>
        <button className="stepper-btn" aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}>
          <SmallChevronUp color="#111111" />
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  SET CELL
// ════════════════════════════════════════════════════════════════════
function SetCell({ set, num, onTap }) {
  const failure = isFailure(set.rpe)
  const tappable = !!onTap
  return (
    <div className={`set-cell ${set.isWarmup ? 'warmup' : ''} ${tappable ? 'tappable' : ''}`}
      onClick={onTap} role={tappable ? 'button' : undefined}>
      <span className="sc-badge">{set.isWarmup ? 'W' : num}</span>
      <span className="sc-data">
        <span className="sc-wr">{set.weight != null ? `${set.weight} lbs` : 'BW'}</span>
        <span className="sc-x">×</span>
        <span className="sc-wr">{set.reps ?? '—'} reps</span>
      </span>
      {set.rpe != null ? (
        failure
          ? <span className="sc-rpe failure" title="Failure">F</span>
          : <span className="sc-rpe" style={{ color: rpeColor(set.rpe) }}>RPE {set.rpe}</span>
      ) : (
        tappable && <span className="sc-rpe add-rpe">+ RPE</span>
      )}
    </div>
  )
}

function SetGroup({ sets, onTapSet }) {
  let n = 0
  return (
    <div className="set-group">
      {sets.map((s, i) => {
        if (!s.isWarmup) n++
        return <SetCell key={s.id} set={s} num={n}
          onTap={onTapSet ? () => onTapSet(i) : undefined} />
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  FEEL SLIDER — purple ramp, failure circle at the end
//  Continuous (never snaps). The rating rides on the white knob. On
//  release at the failure end the phone gives a short buzz.
// ════════════════════════════════════════════════════════════════════
function FeelSlider({ value, onChange }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const posFrom = (clientX) => {
    const el = trackRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    const half = 32
    const usable = r.width - 64
    const x = Math.min(r.width - half, Math.max(half, clientX - r.left))
    return usable <= 0 ? 0 : (x - half) / usable
  }

  const onDown = (e) => {
    e.preventDefault()
    setDragging(true)
    let latest = posFrom(e.clientX)
    onChange(latest)
    const move = (ev) => { latest = posFrom(ev.clientX); onChange(latest) }
    const up = () => {
      setDragging(false)
      // Reward the user for going all the way: a subtle buzz on release.
      if (isFailure(feelToRpe(latest))) buzz(18)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const pct = value == null ? 0 : value
  const failure = isFailure(feelToRpe(value))
  const knobLabel = feelKnobLabel(value)

  return (
    <div className={`feel-track ${dragging ? 'dragging' : ''}`} ref={trackRef}
      onPointerDown={onDown} role="slider" aria-label="How did it feel?"
      aria-valuemin={0} aria-valuemax={1} aria-valuenow={pct}>
      {FEEL_STOPS.map((c, i) => (
        <span key={i} className="feel-seg" style={{ background: c }} />
      ))}
      {value == null && <span className="feel-prompt">HOW DID IT FEEL?</span>}
      <span className={`feel-knob ${failure ? 'failure' : ''}`}
        style={{ left: `calc(${pct} * (100% - 64px))` }}>
        {knobLabel && (
          <span className={`feel-knob-label ${failure ? 'failure' : ''}`}>{knobLabel}</span>
        )}
      </span>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  SET WIDGET — goal reps pre-fill so logging is a couple of taps
// ════════════════════════════════════════════════════════════════════
function SetWidget({ num, isWarmup, lastSet, existing, goalReps, onDone }) {
  const [weight, setWeight] = useState(
    existing ? existing.weight : (lastSet?.weight ?? null))
  // Reps start at the goal for this exercise — that's the whole point of
  // setting a goal during workout creation.
  const [reps, setReps] = useState(
    existing ? existing.reps
      : (isWarmup ? null : (lastSet?.reps ?? goalReps ?? null)))
  const [feel, setFeel] = useState(existing ? (existing.feel ?? null) : null)
  const adj = (setter, d) => setter(v => parseFloat(Math.max(0, (v ?? 0) + d).toFixed(1)))
  const editing = !!existing

  return (
    <div className="set-widget">
      <span className="sw-label">{isWarmup ? 'WARMUP SET' : `SET ${num}`}</span>

      <div className="sw-group">
        <span className="sw-field-label">WEIGHT</span>
        <div className="sw-controls">
          <button className="nc-btn wide" onClick={() => adj(setWeight, -5)}>−5</button>
          <button className="nc-btn" onClick={() => adj(setWeight, -2.5)}>−2.5</button>
          <span className="nc-value">
            <input type="number" inputMode="decimal" value={weight ?? ''} placeholder="0"
              onChange={e => setWeight(e.target.value === '' ? null : parseFloat(e.target.value))} />
            <span className="nc-unit">lbs</span>
          </span>
          <button className="nc-btn" onClick={() => adj(setWeight, 2.5)}>+2.5</button>
          <button className="nc-btn wide" onClick={() => adj(setWeight, 5)}>+5</button>
        </div>
      </div>

      <div className="sw-group">
        <span className="sw-field-label">REPS</span>
        <div className="sw-controls reps">
          <button className="nc-btn wide" onClick={() => adj(setReps, -1)}>−1</button>
          <span className="nc-value reps">
            <input type="number" inputMode="numeric" value={reps ?? ''} placeholder="0"
              onChange={e => setReps(e.target.value === '' ? null : parseInt(e.target.value))} />
          </span>
          <button className="nc-btn wide" onClick={() => adj(setReps, 1)}>+1</button>
        </div>
      </div>

      <div className="sw-feel"><FeelSlider value={feel} onChange={setFeel} /></div>

      <div className="sw-footer">
        <button className="done-btn" disabled={weight === null || reps === null}
          onClick={() => onDone({ weight, reps, feel, rpe: feelToRpe(feel), isWarmup })}>
          {editing ? 'Save' : 'Done'}
        </button>
      </div>
    </div>
  )
}

function Sheet({ title, titleTone = 'red', children, onClose, closeLabel = 'Close' }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="log-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        {title && <h2 className={`display sheet-title ${titleTone}`}>{title}</h2>}
        {children}
        <div className="sheet-footer">
          <button className="sheet-close" onClick={onClose}>{closeLabel}</button>
        </div>
      </div>
    </div>
  )
}

function LoggingSheet({ setNum, isWarmup, lastSet, existing, goalReps, onDone, onClose }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="log-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        {!isWarmup && !existing && lastSet && (
          <div className="last-time-row">
            <span className="lt-badge">Set {setNum} Last Time</span>
            <span className="lt-data">
              <span className="sc-wr">{lastSet.weight} lbs</span>
              <span className="sc-x">×</span>
              <span className="sc-wr">{lastSet.reps} reps</span>
            </span>
            {lastSet.rpe != null && (
              <span className="sc-rpe" style={{ color: rpeColor(lastSet.rpe) }}>RPE {lastSet.rpe}</span>
            )}
          </div>
        )}
        <SetWidget num={setNum} isWarmup={isWarmup} lastSet={lastSet}
          existing={existing} goalReps={goalReps} onDone={onDone} />
      </div>
    </div>
  )
}

function PauseSheet({ onCancel, onConfirm }) {
  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="log-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className="display sheet-title red">Pause the workout?</h2>
        <p className="pause-copy">
          Are you sure you want to pause your workout and return to the home page?
          You can resume this workout at any time.
        </p>
        <div className="pause-actions">
          <button className="pause-btn ghost" onClick={onCancel}>Nevermind</button>
          <button className="pause-btn confirm" onClick={onConfirm}>Pause Workout</button>
        </div>
      </div>
    </div>
  )
}

// ─── exercise details (laterality + setup), per session ─────────────
function DetailsSheet({ laterality, setup, onChange, onClose }) {
  const Row = ({ selected, title, blurb, onClick }) => (
    <button className="opt-row" onClick={onClick}>
      <span className="opt-text">
        <span className="opt-title">{title}</span>
        {blurb && <span className="opt-blurb">{blurb}</span>}
      </span>
      <span className={`opt-check ${selected ? 'on' : ''}`}>
        {selected && <Check color="#FFFFFF" size={18} />}
      </span>
    </button>
  )
  return (
    <Sheet title="Exercise Details" onClose={onClose}>
      <div className="opt-group">
        <span className="opt-label">ONE SIDED OR BOTH SIDES?</span>
        {LATERALITY.map(l => (
          <Row key={l} selected={laterality === l} title={l} blurb={LATERALITY_BLURB[l]}
            onClick={() => onChange({ laterality: l, setup })} />
        ))}
      </div>
      <div className="opt-group">
        <span className="opt-label">SETUP</span>
        {SETUPS.map(s => (
          <Row key={s} selected={setup === s} title={s}
            onClick={() => onChange({ laterality, setup: s })} />
        ))}
      </div>
    </Sheet>
  )
}

// ─── swap the current exercise for another in the same muscle group ──
function SwapSheet({ muscle, options, onPick, onCreateNew, onClose }) {
  return (
    <Sheet title="Swap this exercise..." onClose={onClose}>
      <div className="swap-head">
        <MuscleIcon muscle={muscle} size={60} />
        <span className="swap-head-text">
          <span className="list-name">{muscle}</span>
          <span className="list-sub">{options.length} exercise{options.length === 1 ? '' : 's'}</span>
        </span>
      </div>
      <div className="opt-group">
        {options.map(ex => (
          <button key={ex.id} className="swap-row" onClick={() => onPick(ex.id)}>
            <span className="swap-row-name">{ex.name}</span>
            <SmallChevronRight color="#111111" />
          </button>
        ))}
        {options.length === 0 && (
          <p className="sheet-empty">No other {muscle.toLowerCase()} exercises yet.</p>
        )}
        <button className="swap-row add" onClick={onCreateNew}>
          <span className="swap-row-name">Add a new exercise...</span>
          <Plus color="#111111" />
        </button>
      </div>
    </Sheet>
  )
}

// ─── per-workout options from the kebab menu ────────────────────────
function WorkoutOptionsSheet({ onDelete, onEdit, onClose }) {
  return (
    <Sheet title="Workout Options" titleTone="violet" onClose={onClose}>
      <div className="opt-group">
        <button className="swap-row" onClick={onDelete}>
          <span className="swap-row-name">Delete this workout</span>
          <Trash color="#111111" />
        </button>
        <button className="swap-row" onClick={onEdit}>
          <span className="swap-row-name">Edit this workout</span>
          <Edit color="#111111" opacity={1} />
        </button>
      </div>
    </Sheet>
  )
}

// ════════════════════════════════════════════════════════════════════
//  EXERCISE LOGGING SCREEN
// ════════════════════════════════════════════════════════════════════
function LoggingScreen({
  exercise, exIdx, items, exerciseMap, sets, doneFlags, details, lastTime, goalReps,
  onAddSet, onEditSet, onSetDetails, onSwap, onCreateSwap, onGo, onNext, onPause,
  onHistory, onPlan, isLastRemaining, swapOptions,
}) {
  const [sheet, setSheet] = useState(null)     // add / edit a set
  const [pausing, setPausing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showSwap, setShowSwap] = useState(false)

  const workingCount = sets.filter(s => !s.isWarmup).length
  const lastForNextSet = lastTime && lastTime[workingCount] ? lastTime[workingCount] : null

  const editSet = (index) => {
    const s = sets[index]
    let n = 0
    for (let i = 0; i <= index; i++) if (!sets[i].isWarmup) n++
    setSheet({ mode: 'edit', isWarmup: s.isWarmup, setNum: n, index, existing: s })
  }

  const anySheet = sheet || pausing || showDetails || showSwap

  return (
    <div className="log-screen">
      <div className="log-progress">
        <div className="log-title-block">
          <h2 className="display log-exercise-name">{exercise.name}</h2>
          <span className="log-detail-line">{detailLine(details.setup, details.laterality)}</span>
        </div>

        <div className="log-tools">
          <button className="log-btn wide" onClick={() => setShowDetails(true)}>
            Details <Gear color="#FFFFFF" />
          </button>
          <button className="log-btn" onClick={() => setShowSwap(true)} aria-label="Swap exercise">
            <Swap color="#FFFFFF" />
          </button>
          <button className="log-btn" onClick={onPlan} aria-label="Today's plan">
            <List color="#FFFFFF" />
          </button>
          <button className="log-btn" onClick={onHistory} aria-label="Exercise history">
            <History color="#FFFFFF" />
          </button>
        </div>

        {/* done = white, current = solid ink, skipped/pending = faded */}
        <div className="log-pips">
          {items.map((_, i) => (
            <span key={i} className={`log-pip ${
              i === exIdx ? 'current' : doneFlags[i] ? 'done' : 'pending'}`} />
          ))}
        </div>

        <div className="log-nav">
          <span className="log-exercise-count">Exercise {exIdx + 1} of {items.length}</span>
          <div className="log-nav-btns">
            <button className="log-round" onClick={() => onGo(exIdx - 1)}
              disabled={exIdx === 0} aria-label="Previous exercise">
              <SmallChevronLeft color="#FFFFFF" />
            </button>
            <button className="log-round" onClick={() => setPausing(true)} aria-label="Pause workout">
              <Pause color="#FFFFFF" />
            </button>
            <button className="log-round" onClick={() => onGo(exIdx + 1)}
              disabled={exIdx === items.length - 1} aria-label="Next exercise">
              <SmallChevronRight color="#FFFFFF" />
            </button>
          </div>
        </div>
      </div>

      <div className="log-body">
        {sets.length > 0 && <SetGroup sets={sets} onTapSet={editSet} />}

        <div className="log-buttons">
          <button className="ss-btn outline"
            onClick={() => setSheet({ mode: 'add', isWarmup: true, setNum: 0 })}>
            Warmup Set
          </button>
          <button className="ss-btn solid"
            onClick={() => setSheet({ mode: 'add', isWarmup: false, setNum: workingCount + 1 })}>
            Set {workingCount + 1}
          </button>
        </div>

        <img className="log-bodymap" src={BODYMAP} alt="" aria-hidden="true" />
      </div>

      {workingCount > 0 && !anySheet && (
        <div className="next-bar">
          <button className="next-btn" onClick={onNext}>
            {isLastRemaining ? 'Finish Workout' : 'Next Exercise'} <ArrowRight />
          </button>
        </div>
      )}

      {sheet && (
        <LoggingSheet
          setNum={sheet.setNum} isWarmup={sheet.isWarmup}
          lastSet={sheet.isWarmup ? null : lastForNextSet}
          existing={sheet.mode === 'edit' ? sheet.existing : null}
          goalReps={goalReps}
          onDone={(s) => {
            if (sheet.mode === 'edit') onEditSet(sheet.index, s)
            else onAddSet({ id: uid(), ...s })
            setSheet(null)
          }}
          onClose={() => setSheet(null)} />
      )}

      {pausing && <PauseSheet onCancel={() => setPausing(false)} onConfirm={onPause} />}

      {showDetails && (
        <DetailsSheet laterality={details.laterality} setup={details.setup}
          onChange={onSetDetails} onClose={() => setShowDetails(false)} />
      )}

      {showSwap && (
        <SwapSheet muscle={exercise.muscle} options={swapOptions}
          onPick={(id) => { onSwap(id); setShowSwap(false) }}
          onCreateNew={() => { setShowSwap(false); onCreateSwap() }}
          onClose={() => setShowSwap(false)} />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  EXERCISE HISTORY
// ════════════════════════════════════════════════════════════════════
function ExerciseHistory({ exercise, sessions, onBack }) {
  return (
    <div className="hist-screen">
      <Header title={exercise.name} onBack={onBack} tone="red" />
      <div className="hist-scroll">
        {sessions.length === 0 && (
          <p className="hist-empty">
            No sessions logged yet. Finish a workout with this exercise and it'll show up here.
          </p>
        )}
        {sessions.map((s, i) => (
          <div key={i}>
            <div className="hist-date">
              <span className="row-label">
                {formatHistoryDate(s.date)}{s.laterality ? ` · ${s.laterality}` : ''}
              </span>
            </div>
            <div className="hist-sets"><SetGroup sets={s.sets} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  TODAY'S PLAN — editable, but only for today
//  Tapping a row selects it (white highlight) and reveals reorder /
//  remove controls. Changes here never touch the saved workout.
// ════════════════════════════════════════════════════════════════════
function TodaysPlan({ workoutName, items, exerciseMap, onGo, onBack, onChange, onAdd,
  ctaLabel, currentIdx = null }) {
  const [sel, setSel] = useState(null)

  const move = (dir) => {
    if (sel == null) return
    const j = sel + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[sel], next[j]] = [next[j], next[sel]]
    onChange(next)
    setSel(j)
  }
  const remove = () => {
    if (sel == null) return
    onChange(items.filter((_, i) => i !== sel))
    setSel(null)
  }

  return (
    <div className="plan-screen">
      <img className="plan-body-art" src={planBodyArt} alt="" aria-hidden="true" />

      <div className={`plan-content ${sel != null ? 'with-controls' : ''}`}>
        <button className="plan-back" onClick={onBack} aria-label="Back">
          <ChevronLeft color="#6C5CE7" />
        </button>
        <div className="plan-head">
          <p className="plan-eyebrow">Today's Plan</p>
          <h1 className="display plan-title">{workoutName}</h1>
        </div>

        <div className="plan-list">
          {items.map((it, i) => {
            const ex = exerciseMap[it.exId]
            if (!ex) return null
            return (
              <div className="plan-row" key={`${it.exId}-${i}`}>
                <span className={`plan-num ${sel === i ? 'sel' : ''} ${currentIdx === i ? 'current' : ''}`}>
                  {i + 1}
                </span>
                <button className={`plan-pill ${sel === i ? 'sel' : ''}`}
                  onClick={() => setSel(sel === i ? null : i)}>
                  <span className="plan-pill-name">{ex.name}</span>
                </button>
              </div>
            )
          })}
          <div className="plan-row">
            <span className="plan-num">{items.length + 1}</span>
            <button className="plan-pill add" onClick={onAdd}>
              <span className="plan-pill-name">Add an exercise</span>
              <Plus color="#FFFFFF" />
            </button>
          </div>
        </div>
      </div>

      <div className="plan-footer">
        {sel != null && (
          <div className="plan-controls">
            <span className="plan-controls-label">Edit exercise position</span>
            <div className="plan-controls-btns">
              <button className="plan-ctl" onClick={() => move(-1)}
                disabled={sel === 0} aria-label="Move up">
                <SmallChevronUp color="#FFFFFF" />
              </button>
              <button className="plan-ctl" onClick={() => move(1)}
                disabled={sel === items.length - 1} aria-label="Move down">
                <SmallChevronDown color="#FFFFFF" />
              </button>
              <button className="plan-ctl" onClick={remove} aria-label="Remove from today">
                <Trash color="#FFFFFF" />
              </button>
            </div>
          </div>
        )}
        <button className="plan-go" disabled={items.length === 0} onClick={onGo}>
          {ctaLabel || "Let's Go"} <ArrowRight />
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  START PAGE
// ════════════════════════════════════════════════════════════════════
function StartPage({ week, workoutsById, exerciseMap, pausedWorkoutId,
  onTapDay, onStartToday, onResume, onHistory, onWorkoutOptions }) {
  const today = todayIdx()
  const todayWorkoutId = week[today]
  const todayWorkout = todayWorkoutId ? workoutsById[todayWorkoutId] : null
  const isPausedToday = todayWorkout && pausedWorkoutId === todayWorkoutId
  const order = [1, 2, 3, 4, 5, 6, 0]
  const now = new Date()

  return (
    <div className="start-screen">
      <div className="start-toolbar">
        <button className="history-btn" onClick={onHistory}>
          History <History color="#111111" />
        </button>
      </div>

      <div className="start-head">
        <p className="start-eyebrow">Time for some</p>
        <div className="overload-stack">
          <span className="ol-back"> OVERLOAD</span>
          <span className="ol-front">OVERLOAD</span>
        </div>
      </div>

      {/* Today's workout gets pulled out of the calendar and given its
          own card, so the thing you're most likely to want is first. */}
      {todayWorkout && (
        <div className="start-section">
          <p className="section-label">Today's Plan</p>
          <div className="wk-card">
            <div className="wk-card-top">
              <span className="cal-chip">
                <span className="cal-chip-month">{MONTHS_SHORT[now.getMonth()]}</span>
                <span className="cal-chip-day">{now.getDate()}</span>
              </span>
              <span className="wk-card-text">
                <span className="wk-card-name">{todayWorkout.name}</span>
                <span className="wk-badge">
                  {todayWorkout.items.length} EXERCISE{todayWorkout.items.length === 1 ? '' : 'S'}
                </span>
              </span>
              <button className="wk-kebab" aria-label="Workout options"
                onClick={() => onWorkoutOptions(todayWorkout.id)}>
                <KebabMenu color="#111111" />
              </button>
            </div>
            <button className="wk-cta"
              onClick={() => (isPausedToday ? onResume() : onStartToday(todayWorkoutId))}>
              {isPausedToday ? 'Resume Workout' : 'Start Workout'}
            </button>
          </div>
        </div>
      )}

      <div className="start-section">
        <p className="section-label">Your Workout Plan</p>
        <div className="cal-grid">
          {order.map(d => {
            const wid = week[d]
            const wk = wid ? workoutsById[wid] : null
            const isToday = d === today
            const isRest = wid === null
            const isUnset = wid === undefined
            return (
              <button key={d}
                className={`cal-cell ${isToday ? 'today' : ''} ${wk ? 'filled' : ''} ${isUnset || isRest ? 'empty' : ''}`}
                onClick={() => onTapDay(d)}>
                <span className="cal-day-row">
                  <span className="cal-day">{DAYS_SHORT[d]}</span>
                  {isToday && <span className="cal-pip" />}
                </span>
                <span className={`cal-label ${isUnset || isRest ? 'small' : ''}`}>
                  {isUnset ? 'ADD A WORKOUT' : isRest ? 'REST' : wk.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  CHOOSE A WORKOUT — violet header, workout cards with violet shadow
// ════════════════════════════════════════════════════════════════════
function WorkoutSelection({ workouts, exerciseMap, onPick, onRest, onCreate, onBack, onOptions }) {
  return (
    <div className="sel-screen">
      <Header title="Choose a Workout" onBack={onBack} tone="violet" />

      <div className="sel-scroll">
        <div className="sel-quick-row">
          <button className="sel-quick rest" onClick={onRest}>
            <span className="sel-quick-name">Rest Day</span>
            <ChevronRight color="#111111" />
          </button>
          <button className="sel-quick create" onClick={onCreate}>
            <span className="sel-quick-name">Create a workout</span>
            <Plus color="#6C5CE7" />
          </button>
        </div>

        {workouts.length > 0 && (
          <>
            <div className="sel-label">
              <span className="row-label">
                YOUR WORKOUT LIST ({workouts.length} WORKOUT{workouts.length === 1 ? '' : 'S'})
              </span>
            </div>
            <div className="sel-list">
              {workouts.map(w => (
                <div key={w.id} className="wk-card">
                  <div className="wk-card-top">
                    <span className="wk-card-text">
                      <span className="wk-card-name">{w.name}</span>
                      <span className="wk-badge">
                        {w.items.length} EXERCISE{w.items.length === 1 ? '' : 'S'}
                      </span>
                    </span>
                    <button className="wk-kebab" aria-label="Workout options"
                      onClick={() => onOptions(w.id)}>
                      <KebabMenu color="#111111" />
                    </button>
                  </div>
                  <button className="wk-cta small" onClick={() => onPick(w.id)}>Select</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  CREATE / EDIT A WORKOUT
//  Each exercise is a card with a red shadow, an X to remove it, and
//  steppers for target sets and goal reps.
// ════════════════════════════════════════════════════════════════════
function CreateWorkout({ draft, exerciseMap, editing, onNameChange, onItemsChange,
  onAddExercise, onSave, onCancel, onBack }) {
  const named = draft.name.trim().length > 0
  const nameRef = useRef(null)
  const muscles = workoutMuscles({ items: draft.items }, exerciseMap)

  const patch = (i, p) => onItemsChange(draft.items.map((it, j) => j === i ? { ...it, ...p } : it))
  const removeAt = (i) => onItemsChange(draft.items.filter((_, j) => j !== i))

  return (
    <div className="cw-screen">
      <Header title={editing ? 'Edit Workout' : 'Create a Workout'} onBack={onBack} tone="cream" />

      <div className="cw-scroll">
        <div className="cw-section">
          <span className="row-label">WORKOUT NAME</span>
          <div className="cw-name-row">
            <input ref={nameRef} className="cw-name-input" value={draft.name}
              placeholder="Add a name..." autoFocus
              onChange={e => onNameChange(e.target.value)} />
            {named && (
              <button className="icon-btn" aria-label="Edit name"
                onClick={() => nameRef.current?.focus()}>
                <Edit color="#000000" opacity={0.5} />
              </button>
            )}
          </div>
          {draft.items.length > 0 && (
            <span className="cw-summary">
              {draft.items.length} EXERCISE{draft.items.length === 1 ? '' : 'S'}
              {muscles.length ? ` • ${muscles.join(', ').toUpperCase()}` : ''}
            </span>
          )}
        </div>

        <div className="cw-section">
          <span className="row-label">EXERCISE LIST</span>
          <div className="cw-ex-list">
            {draft.items.map((it, i) => {
              const ex = exerciseMap[it.exId]
              if (!ex) return null
              return (
                <div className="ex-card" key={`${it.exId}-${i}`}>
                  <div className="ex-card-top">
                    <span className="ex-num">{i + 1}</span>
                    <span className="ex-card-text">
                      <span className="ex-card-name">{ex.name}</span>
                      <span className="ex-card-detail">{detailLine(ex.setup, ex.laterality)}</span>
                    </span>
                    <button className="ex-close" aria-label={`Remove ${ex.name}`}
                      onClick={() => removeAt(i)}>
                      <Close color="#111111" />
                    </button>
                  </div>
                  <Stepper label="WORKING SETS" value={it.sets}
                    onChange={v => patch(i, { sets: v })} />
                  <Stepper label="GOAL REPS" value={it.reps} max={60}
                    onChange={v => patch(i, { reps: v })} />
                </div>
              )
            })}
            <button className="add-ex-row" onClick={onAddExercise}>
              ADD AN EXERCISE
              <span className="add-ex-plus"><Plus color="#111111" /></span>
            </button>
          </div>
        </div>
      </div>

      <div className="cw-footer">
        <button className="cw-btn ghost" onClick={onCancel}>Cancel</button>
        <button className="cw-btn solid" disabled={!named || draft.items.length === 0}
          onClick={onSave}>Save</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  CHOOSE AN EXERCISE — red header, search + create, no badges
// ════════════════════════════════════════════════════════════════════
function ChooseExercise({ exercises, title = 'Choose an Exercise', onPick, onCreateNew, onBack }) {
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState({})
  const query = q.trim().toLowerCase()

  const byMuscle = useMemo(() => {
    const m = {}
    for (const ex of exercises) (m[ex.muscle] ||= []).push(ex)
    return m
  }, [exercises])

  const matches = useMemo(() =>
    query ? exercises.filter(e => e.name.toLowerCase().includes(query)) : null,
  [exercises, query])

  const groupsPresent = MUSCLE_GROUPS.filter(m => byMuscle[m])
  const toggle = (m) => setExpanded(e => ({ ...e, [m]: !e[m] }))

  return (
    <div className="ce-screen">
      <Header title={title} onBack={onBack} tone="red" />

      <div className="ce-searchbar">
        <div className="ce-search">
          <Search color="#737373" size={20} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" />
        </div>
        <button className="ce-add" onClick={onCreateNew} aria-label="Create a new exercise">
          <Plus color="#F0573F" />
        </button>
      </div>

      <div className="ce-scroll">
        {matches ? (
          <>
            <div className="ce-label-row">
              <span className="row-label">
                {matches.length} RESULT{matches.length === 1 ? '' : 'S'}
              </span>
            </div>
            {matches.map(ex => (
              <button key={ex.id} className="ce-row" onClick={() => onPick(ex.id)}>
                <span className="ce-row-text">
                  <span className="ce-row-name">{ex.name}</span>
                  <span className="ce-row-sub">{ex.muscle}</span>
                </span>
                <SmallChevronRight color="#111111" />
              </button>
            ))}
            {matches.length === 0 && (
              <p className="ce-empty">No exercises match "{q}". Tap + to create one.</p>
            )}
          </>
        ) : groupsPresent.length > 0 ? (
          <>
            <div className="ce-label-row"><span className="row-label">YOUR EXERCISES</span></div>
            {groupsPresent.map(muscle => {
              const list = byMuscle[muscle]
              const isOpen = !!expanded[muscle]
              return (
                <div key={muscle}>
                  <button className="ce-group-row" onClick={() => toggle(muscle)} aria-expanded={isOpen}>
                    <MuscleIcon muscle={muscle} size={60} />
                    <span className="ce-group-text">
                      <span className="list-name">{muscle}</span>
                      <span className="list-sub">{list.length} exercise{list.length === 1 ? '' : 's'}</span>
                    </span>
                    {isOpen ? <ChevronUp color="#111111" /> : <ChevronDown color="#111111" />}
                  </button>
                  {isOpen && list.map(ex => (
                    <button key={ex.id} className="ce-row" onClick={() => onPick(ex.id)}>
                      <span className="ce-row-text">
                        <span className="ce-row-name">{ex.name}</span>
                        <span className="ce-row-sub">{detailLine(ex.setup, ex.laterality)}</span>
                      </span>
                      <SmallChevronRight color="#111111" />
                    </button>
                  ))}
                </div>
              )
            })}
          </>
        ) : (
          <p className="ce-empty">No exercises yet. Tap + to create your first one.</p>
        )}
      </div>
    </div>
  )
}

// ─── create an exercise: muscle group ───────────────────────────────
function ChooseMuscle({ onPick, onBack }) {
  return (
    <div className="cm-screen">
      <Header title="Create an Exercise" onBack={onBack} tone="red" />
      <div className="cm-label"><span className="row-label">CHOOSE A MUSCLE GROUP</span></div>
      <div className="cm-list">
        {MUSCLE_GROUPS.map(m => (
          <button key={m} className="cm-card" onClick={() => onPick(m)}>
            <MuscleIcon muscle={m} size={60} />
            <span className="cm-name">{m}</span>
            <ChevronRight color="#111111" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── create an exercise: name, notes, and defaults ──────────────────
function ConfigureExercise({ muscle, onSave, onBack }) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [laterality, setLaterality] = useState('Bilateral')
  const [setup, setSetup] = useState('Machine')
  const nameRef = useRef(null)
  const canSave = name.trim().length > 0

  const Chip = ({ on, children, onClick }) => (
    <button className={`chip ${on ? 'on' : ''}`} onClick={onClick}>{children}</button>
  )

  return (
    <div className="cfg-screen">
      <Header title="Create an Exercise" onBack={onBack} tone="plain" />

      <div className="cfg-scroll">
        <div className="cfg-section">
          <span className="row-label on-red">NEW {muscle.toUpperCase()} EXERCISE</span>
          <div className="cfg-name-row">
            <input ref={nameRef} className="cfg-name" value={name}
              placeholder="Add a name..." autoFocus
              onChange={e => setName(e.target.value)} />
            {canSave && (
              <button className="icon-btn" aria-label="Edit name"
                onClick={() => nameRef.current?.focus()}>
                <Edit color="#FFFFFF" opacity={0.6} />
              </button>
            )}
          </div>
          {/* Mirrors the red detail line used everywhere else. */}
          <span className="cfg-detail">{detailLine(setup, laterality)}</span>
        </div>

        <div className="cfg-section">
          <span className="row-label on-red">ONE SIDED OR BOTH SIDES?</span>
          <div className="chip-row">
            {LATERALITY.map(l => (
              <Chip key={l} on={laterality === l} onClick={() => setLaterality(l)}>{l}</Chip>
            ))}
          </div>
        </div>

        <div className="cfg-section">
          <span className="row-label on-red">SETUP</span>
          <div className="chip-row">
            {SETUPS.map(s => (
              <Chip key={s} on={setup === s} onClick={() => setSetup(s)}>{s}</Chip>
            ))}
          </div>
        </div>

        <div className="cfg-section">
          <span className="row-label on-red">NOTES</span>
          <textarea className="cfg-notes" value={notes} rows={4}
            placeholder="Add a note..." onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="cfg-footer">
        <button className="cfg-btn ghost" onClick={onBack}>Cancel</button>
        <button className="cfg-btn solid" disabled={!canSave}
          onClick={() => onSave({
            name: name.trim(), muscle, notes: notes.trim(), laterality, setup,
          })}>Save</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  WORKOUT COMPLETE
// ════════════════════════════════════════════════════════════════════
function WorkoutComplete({ items, exerciseMap, loggedSets, detailsFor, onAddMore, onDone }) {
  const worked = items.map(it => exerciseMap[it.exId]).filter(Boolean)
    .filter(ex => (loggedSets[ex.id] || []).length > 0)

  const totalSets = worked.reduce(
    (a, ex) => a + (loggedSets[ex.id] || []).filter(s => !s.isWarmup).length, 0)
  const failures = worked.reduce(
    (a, ex) => a + (loggedSets[ex.id] || []).filter(s => isFailure(s.rpe)).length, 0)

  const summaryLine = [
    `${worked.length} exercise${worked.length === 1 ? '' : 's'}`,
    `${totalSets} set${totalSets === 1 ? '' : 's'}`,
    ...(failures > 0 ? [`${failures} to failure`] : []),
  ].join(' · ')

  const onShare = async () => {
    const lines = ['💪 OVERLOAD — Workout Complete', summaryLine, '']
    for (const ex of worked) {
      lines.push(ex.name.toUpperCase())
      let n = 0
      for (const s of loggedSets[ex.id] || []) {
        const tag = s.isWarmup ? 'W' : (isFailure(s.rpe) ? 'Failure' : `RPE ${s.rpe ?? '—'}`)
        const label = s.isWarmup ? 'Warmup' : `Set ${++n}`
        lines.push(`  ${label}: ${s.weight != null ? `${s.weight} lbs` : 'BW'} × ${s.reps ?? '—'} reps  (${tag})`)
      }
      lines.push('')
    }
    const text = lines.join('\n').trim()
    try {
      if (navigator.share) await navigator.share({ title: 'Overload — Workout Complete', text })
      else if (navigator.clipboard) await navigator.clipboard.writeText(text)
    } catch { /* dismissed */ }
  }

  return (
    <div className="done-screen">
      <div className="done-scroll">
        <div className="done-head">
          <div className="done-head-text">
            <h1 className="display done-title">Workout Complete</h1>
            <p className="done-meta">{summaryLine}</p>
          </div>
          <div className="done-actions">
            <button className="done-add" onClick={onAddMore}>
              Add More Exercises <Plus color="#111111" />
            </button>
            <button className="done-share" onClick={onShare} aria-label="Share summary">
              <Share color="#111111" />
            </button>
          </div>
        </div>

        <div className="done-list">
          {worked.map(ex => {
            const d = detailsFor(ex.id)
            return (
              <div key={ex.id} className="done-ex">
                <div className="done-ex-head">
                  <span className="done-ex-name">{ex.name}</span>
                  <span className="done-ex-sub">{detailLine(d.setup, d.laterality)}</span>
                </div>
                <SetGroup sets={loggedSets[ex.id] || []} />
              </div>
            )
          })}
        </div>
      </div>

      <div className="done-footer">
        <button className="done-cta" onClick={onDone}>Back to the Homepage</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  APP
// ════════════════════════════════════════════════════════════════════
export default function App() {
  const initial = useMemo(() => loadState() || freshState(), [])

  const [exercises, setExercises] = useState(initial.exercises)
  const [workouts, setWorkouts] = useState(initial.workouts)
  const [week, setWeek] = useState(initial.week)
  const [history, setHistory] = useState(initial.history || {})
  const [paused, setPaused] = useState(initial.paused || null)

  useEffect(() => {
    saveState({ exercises, workouts, week, history, paused })
  }, [exercises, workouts, week, history, paused])

  const exerciseMap = useMemo(() => Object.fromEntries(exercises.map(e => [e.id, e])), [exercises])
  const workoutsById = useMemo(() => Object.fromEntries(workouts.map(w => [w.id, w])), [workouts])

  const [screen, setScreen] = useState('start')
  const [selDay, setSelDay] = useState(null)
  const [activeWorkoutId, setActiveWorkoutId] = useState(null)

  // The plan for TODAY — a copy of the workout's items. Editing it in
  // Today's Plan changes only this session, never the saved workout.
  const [sessionItems, setSessionItems] = useState([])
  const [exIdx, setExIdx] = useState(0)
  const [loggedSets, setLoggedSets] = useState({})
  // Per-session overrides of each exercise's default laterality/setup.
  const [sessionDetails, setSessionDetails] = useState({})

  const [historyExId, setHistoryExId] = useState(null)
  const [historyReturn, setHistoryReturn] = useState('start')

  const [draft, setDraft] = useState({ name: '', items: [] })
  const [editingWorkoutId, setEditingWorkoutId] = useState(null)
  const [pendingMuscle, setPendingMuscle] = useState(null)
  const [optionsWorkoutId, setOptionsWorkoutId] = useState(null)
  // Where the exercise picker should return to, and what to do with the pick.
  const [pickerMode, setPickerMode] = useState(null)
  const [quickAddIds, setQuickAddIds] = useState([])

  const activeWorkout = activeWorkoutId ? workoutsById[activeWorkoutId] : null
  const activeExercises = sessionItems.map(it => exerciseMap[it.exId]).filter(Boolean)
  const doneFlags = sessionItems.map(it =>
    (loggedSets[it.exId] || []).some(s => !s.isWarmup))

  const detailsFor = (exId) => {
    const ex = exerciseMap[exId]
    return sessionDetails[exId] || {
      laterality: ex?.laterality || 'Bilateral',
      setup: ex?.setup || 'Machine',
    }
  }

  // ── calendar / selection ──
  const tapDay = (d) => { setSelDay(d); setScreen('selection') }
  const pickWorkout = (wid) => {
    if (selDay != null) setWeek(w => ({ ...w, [selDay]: wid }))
    setScreen('start')
  }
  const pickRest = () => {
    if (selDay != null) setWeek(w => ({ ...w, [selDay]: null }))
    setScreen('start')
  }

  // ── workout creation / editing ──
  const startCreate = () => {
    setDraft({ name: '', items: [] }); setEditingWorkoutId(null); setScreen('createWorkout')
  }
  const startEdit = (wid) => {
    const w = workoutsById[wid]
    if (!w) return
    setDraft({ name: w.name, items: w.items.map(it => ({ ...it })) })
    setEditingWorkoutId(wid)
    setOptionsWorkoutId(null)
    setScreen('createWorkout')
  }
  const saveWorkout = () => {
    if (editingWorkoutId) {
      setWorkouts(prev => prev.map(w => w.id === editingWorkoutId
        ? { ...w, name: draft.name.trim(), items: draft.items } : w))
    } else {
      const nw = { id: uid(), name: draft.name.trim(), items: draft.items, timesCompleted: 0 }
      setWorkouts(prev => [...prev, nw])
      if (selDay != null) setWeek(w => ({ ...w, [selDay]: nw.id }))
    }
    setEditingWorkoutId(null)
    setScreen(selDay != null && !editingWorkoutId ? 'start' : 'selection')
  }
  const deleteWorkout = (wid) => {
    setWorkouts(prev => prev.filter(w => w.id !== wid))
    setWeek(prev => {
      const next = { ...prev }
      for (const k of Object.keys(next)) if (next[k] === wid) delete next[k]
      return next
    })
    setOptionsWorkoutId(null)
  }

  // ── exercise picking (shared picker, different destinations) ──
  const openPicker = (mode) => { setPickerMode(mode); setScreen('chooseExercise') }
  const pickerBack = () => {
    setScreen(pickerMode === 'quickAdd' ? 'quickAdd'
      : pickerMode === 'plan' ? 'plan'
      : pickerMode === 'swap' ? 'logging' : 'createWorkout')
  }
  const handlePick = (exId) => {
    if (pickerMode === 'draft') {
      setDraft(d => ({ ...d, items: [...d.items, makeItem(exId)] }))
      setScreen('createWorkout')
    } else if (pickerMode === 'plan') {
      setSessionItems(prev => [...prev, makeItem(exId)])
      setScreen('plan')
    } else if (pickerMode === 'quickAdd') {
      setQuickAddIds(prev => [...prev, exId])
      setScreen('quickAdd')
    } else if (pickerMode === 'swap') {
      swapCurrent(exId)
      setScreen('logging')
    }
  }
  const createdExercise = (ex) => {
    const nx = { id: uid(), ...ex }
    setExercises(prev => [...prev, nx])
    handlePick(nx.id)
  }

  // ── running a workout ──
  const startToday = (wid) => {
    const w = workoutsById[wid]
    if (!w) return
    setActiveWorkoutId(wid)
    setSessionItems(w.items.map(it => ({ ...it })))
    setExIdx(0); setLoggedSets({}); setSessionDetails({})
    setScreen('plan')
  }
  const beginWorkout = () => { setExIdx(0); setScreen('logging') }

  const resumeWorkout = () => {
    if (!paused) return
    setActiveWorkoutId(paused.workoutId)
    setSessionItems(paused.sessionItems || [])
    setExIdx(paused.exIdx || 0)
    setLoggedSets(paused.loggedSets || {})
    setSessionDetails(paused.sessionDetails || {})
    setPaused(null)
    setScreen('logging')
  }

  const addSet = (s) => {
    const it = sessionItems[exIdx]
    if (!it) return
    setLoggedSets(prev => ({ ...prev, [it.exId]: [...(prev[it.exId] || []), s] }))
  }
  const editSet = (index, patch) => {
    const it = sessionItems[exIdx]
    if (!it) return
    setLoggedSets(prev => {
      const arr = [...(prev[it.exId] || [])]
      if (!arr[index]) return prev
      arr[index] = { ...arr[index], ...patch }
      return { ...prev, [it.exId]: arr }
    })
  }

  const goToExercise = (i) => {
    if (i < 0 || i >= sessionItems.length) return
    setExIdx(i)
  }

  // Hunt forward for the next unfinished exercise, then wrap to pick up
  // anything skipped. The workout only ends when nothing is left.
  const nextExercise = () => {
    for (let i = exIdx + 1; i < sessionItems.length; i++) if (!doneFlags[i]) return setExIdx(i)
    for (let i = 0; i < exIdx; i++) if (!doneFlags[i]) return setExIdx(i)
    setScreen('complete')
  }
  const remainingAfterThis = sessionItems.filter((_, i) => i !== exIdx && !doneFlags[i]).length

  const swapCurrent = (newExId) => {
    setSessionItems(prev => prev.map((it, i) =>
      i === exIdx ? { ...it, exId: newExId } : it))
  }

  const pauseWorkout = () => {
    setPaused({ workoutId: activeWorkoutId, sessionItems, exIdx, loggedSets, sessionDetails })
    setActiveWorkoutId(null)
    setScreen('start')
  }

  const finishWorkout = () => {
    if (activeWorkoutId) {
      setWorkouts(prev => prev.map(w =>
        w.id === activeWorkoutId ? { ...w, timesCompleted: (w.timesCompleted || 0) + 1 } : w))
    }
    const date = new Date().toISOString()
    setHistory(prev => {
      const next = { ...prev }
      for (const [exId, sets] of Object.entries(loggedSets)) {
        if (!sets || sets.length === 0) continue
        next[exId] = [...(next[exId] || []), {
          date, laterality: detailsFor(exId).laterality, setup: detailsFor(exId).setup, sets,
        }]
      }
      return next
    })
    setActiveWorkoutId(null); setSessionItems([]); setLoggedSets({}); setSessionDetails({})
    setScreen('start')
  }

  // ── quick add ──
  const startQuickAdd = () => { setQuickAddIds([]); setScreen('quickAdd') }
  const commitQuickAdd = () => {
    if (quickAddIds.length === 0) return
    const firstNew = sessionItems.length
    setSessionItems(prev => [...prev, ...quickAddIds.map(id => makeItem(id))])
    setQuickAddIds([])
    setExIdx(firstNew)
    setScreen('logging')
  }

  const openHistoryFromLogging = () => {
    const it = sessionItems[exIdx]
    if (!it) return
    setHistoryExId(it.exId); setHistoryReturn('logging'); setScreen('history')
  }

  // ── render ──
  const optionsWorkout = optionsWorkoutId ? workoutsById[optionsWorkoutId] : null

  if (screen === 'start') return (
    <>
      <StartPage week={week} workoutsById={workoutsById} exerciseMap={exerciseMap}
        pausedWorkoutId={paused?.workoutId ?? null}
        onTapDay={tapDay} onStartToday={startToday} onResume={resumeWorkout}
        onHistory={() => { setHistoryReturn('start'); setScreen('historyPicker') }}
        onWorkoutOptions={setOptionsWorkoutId} />
      {optionsWorkout && (
        <WorkoutOptionsSheet
          onDelete={() => deleteWorkout(optionsWorkout.id)}
          onEdit={() => startEdit(optionsWorkout.id)}
          onClose={() => setOptionsWorkoutId(null)} />
      )}
    </>
  )

  if (screen === 'selection') return (
    <>
      <WorkoutSelection workouts={workouts} exerciseMap={exerciseMap}
        onPick={pickWorkout} onRest={pickRest} onCreate={startCreate}
        onBack={() => setScreen('start')} onOptions={setOptionsWorkoutId} />
      {optionsWorkout && (
        <WorkoutOptionsSheet
          onDelete={() => deleteWorkout(optionsWorkout.id)}
          onEdit={() => startEdit(optionsWorkout.id)}
          onClose={() => setOptionsWorkoutId(null)} />
      )}
    </>
  )

  if (screen === 'createWorkout') return (
    <CreateWorkout draft={draft} exerciseMap={exerciseMap} editing={!!editingWorkoutId}
      onNameChange={(name) => setDraft(d => ({ ...d, name }))}
      onItemsChange={(items) => setDraft(d => ({ ...d, items }))}
      onAddExercise={() => openPicker('draft')}
      onSave={saveWorkout}
      onCancel={() => { setEditingWorkoutId(null); setScreen('selection') }}
      onBack={() => { setEditingWorkoutId(null); setScreen('selection') }} />
  )

  if (screen === 'chooseExercise') return (
    <ChooseExercise exercises={exercises} onPick={handlePick}
      onCreateNew={() => setScreen('chooseMuscle')} onBack={pickerBack} />
  )

  if (screen === 'historyPicker') return (
    <ChooseExercise exercises={exercises} title="Exercise History"
      onPick={(exId) => { setHistoryExId(exId); setHistoryReturn('historyPicker'); setScreen('history') }}
      onCreateNew={() => setScreen('chooseMuscle')}
      onBack={() => setScreen('start')} />
  )

  if (screen === 'chooseMuscle') return (
    <ChooseMuscle onPick={(m) => { setPendingMuscle(m); setScreen('configureExercise') }}
      onBack={() => setScreen('chooseExercise')} />
  )

  if (screen === 'configureExercise') return (
    <ConfigureExercise muscle={pendingMuscle} onSave={createdExercise}
      onBack={() => setScreen('chooseExercise')} />
  )

  if (screen === 'plan' && activeWorkout) return (
    <TodaysPlan workoutName={activeWorkout.name} items={sessionItems}
      exerciseMap={exerciseMap} onChange={setSessionItems}
      onAdd={() => openPicker('plan')}
      onGo={beginWorkout} onBack={() => setScreen('start')} />
  )

  if (screen === 'logging' && activeWorkout) {
    const it = sessionItems[exIdx]
    const ex = it ? exerciseMap[it.exId] : null
    if (!ex) return null
    const d = detailsFor(ex.id)
    const swapOptions = exercises.filter(e => e.muscle === ex.muscle && e.id !== ex.id)
    return (
      <LoggingScreen
        key={ex.id}
        exercise={ex} exIdx={exIdx} items={sessionItems} exerciseMap={exerciseMap}
        sets={loggedSets[ex.id] || []} doneFlags={doneFlags} details={d}
        goalReps={it.reps}
        lastTime={lastSessionSets(history, ex.id, d.laterality)}
        isLastRemaining={remainingAfterThis === 0}
        swapOptions={swapOptions}
        onAddSet={addSet} onEditSet={editSet}
        onSetDetails={(patch) => setSessionDetails(prev => ({ ...prev, [ex.id]: patch }))}
        onSwap={swapCurrent}
        onCreateSwap={() => openPicker('swap')}
        onGo={goToExercise} onNext={nextExercise} onPause={pauseWorkout}
        onHistory={openHistoryFromLogging}
        onPlan={() => setScreen('planDuring')} />
    )
  }

  // Today's Plan reached from inside the workout — same screen, but the
  // CTA returns you to lifting instead of starting.
  if (screen === 'planDuring' && activeWorkout) return (
    <TodaysPlan workoutName={activeWorkout.name} items={sessionItems}
      exerciseMap={exerciseMap} onChange={setSessionItems}
      onAdd={() => openPicker('plan')}
      ctaLabel="Back to Workout" currentIdx={exIdx}
      onGo={() => {
        if (exIdx >= sessionItems.length) setExIdx(Math.max(0, sessionItems.length - 1))
        setScreen('logging')
      }}
      onBack={() => setScreen('logging')} />
  )

  if (screen === 'history' && historyExId) return (
    <ExerciseHistory exercise={exerciseMap[historyExId]}
      sessions={exerciseSessions(history, historyExId)}
      onBack={() => setScreen(historyReturn)} />
  )

  if (screen === 'quickAdd' && activeWorkout) return (
    <TodaysPlan workoutName="Quick Add" items={quickAddIds.map(id => makeItem(id))}
      exerciseMap={exerciseMap}
      onChange={(items) => setQuickAddIds(items.map(i => i.exId))}
      onAdd={() => openPicker('quickAdd')}
      onGo={commitQuickAdd} onBack={() => setScreen('complete')} />
  )

  if (screen === 'complete' && activeWorkout) return (
    <WorkoutComplete items={sessionItems} exerciseMap={exerciseMap}
      loggedSets={loggedSets} detailsFor={detailsFor}
      onAddMore={startQuickAdd} onDone={finishWorkout} />
  )

  return null
}
