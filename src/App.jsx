import { useState, useMemo, useRef, useEffect } from 'react'
import './App.css'
import {
  MUSCLE_GROUPS, EQUIPMENT_GROUPS, EQUIPMENT, MONTHS_SHORT,
  detailLine, detailLineSoft,
  FEEL_STOPS, feelKnobLabel, feelToRpe, rpeColor, isFailure, buzz,
  DEFAULT_GOAL_REPS, makeItem, withSlotIds, newSlotId,
  PLAN_MIN_DAYS, PLAN_MAX_DAYS, PLAN_DEFAULT_DAYS,
  planDayIndex, planTodayWorkoutId,
  workoutMuscles, workoutSummaryLine, formatHistoryDate,
  loadState, saveState, freshState, lastSessionSets, exerciseSessions,
} from './data.js'
import { muscleIcon } from './assets/muscleGraphics.js'
import planBodyArt from './assets/plan-body.svg'
import homeGraphic from './assets/HomepageGraphic.png'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Plus, Edit, History, Pause, ArrowRight,
  SmallChevronLeft, SmallChevronRight, SmallChevronUp, SmallChevronDown,
  Share, Close, KebabMenu, Trash, Swap, List, Search, Check,
  AddExercise, Book, Gear,
} from './icons.jsx'

const uid = () => Math.random().toString(36).slice(2, 9)

function MuscleIcon({ muscle, size = 60 }) {
  const src = muscleIcon(muscle)
  if (!src) return null
  return <img className="muscle-icon" src={src} alt="" aria-hidden="true"
    style={{ width: size, height: size }} />
}

function Header({ title, onBack, tone = 'violet', right }) {
  const chev = { violet: '#FFFFFF', cream: '#FFFFFF', red: '#F0573F', white: '#FFFFFF' }[tone]
  return (
    <div className={`hdr hdr-${tone}`}>
      <button className="hdr-back" onClick={onBack} aria-label="Back">
        <ChevronLeft color={chev} />
      </button>
      {title && <h1 className="display hdr-title">{title}</h1>}
      {right}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  SET CELLS — cream, 8px group radius, square 4px badges
// ════════════════════════════════════════════════════════════════════
function SetCell({ set, num, onTap }) {
  const failure = isFailure(set.rpe)
  const tappable = !!onTap
  return (
    <div className={`set-cell ${tappable ? 'tappable' : ''}`}
      onClick={onTap} role={tappable ? 'button' : undefined}>
      <span className={`sc-badge ${set.isWarmup ? 'warmup' : ''}`}>
        {set.isWarmup ? 'W' : num}
      </span>
      <span className="sc-data">
        <span className="sc-wr">{set.weight != null ? `${set.weight} lbs` : 'BW'}</span>
        <span className="sc-x">×</span>
        <span className="sc-wr">{set.reps ?? '—'} reps</span>
      </span>
      {set.rpe != null ? (
        <span className={`sc-tag ${failure ? 'failure' : ''}`}
          style={failure ? undefined : { color: rpeColor(set.rpe) }}>
          {failure ? 'F' : `RPE ${set.rpe}`}
        </span>
      ) : (tappable && <span className="sc-tag add-rpe">+ RPE</span>)}
    </div>
  )
}

function SetGroup({ sets, onTapSet }) {
  let n = 0
  return (
    <div className="set-group">
      {sets.map((s, i) => {
        if (!s.isWarmup) n++
        return <SetCell key={s.id ?? i} set={s} num={n}
          onTap={onTapSet ? () => onTapSet(i) : undefined} />
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  FEEL SLIDER
//  A pill track of ten purple stops. The knob is a white circle that
//  turns violet with an F when it reaches the failure end.
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
      if (isFailure(feelToRpe(latest))) buzz(18)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const pct = value == null ? 0 : value
  const failure = isFailure(feelToRpe(value))

  return (
    <div className={`feel-track ${dragging ? 'dragging' : ''}`} ref={trackRef}
      onPointerDown={onDown} role="slider" aria-label="How did it feel?"
      aria-valuemin={0} aria-valuemax={1} aria-valuenow={pct}>
      <div className="feel-fills">
        {FEEL_STOPS.map((c, i) => (
          <span key={i} className="feel-seg" style={{ background: c }} />
        ))}
      </div>
      {value == null && <span className="feel-prompt">HOW DID IT FEEL?</span>}
      <span className={`feel-knob ${failure ? 'failure' : ''}`}
        style={{ left: `calc(${pct} * (100% - 64px))` }}>
        {value != null && (
          <span className="feel-knob-label">{feelKnobLabel(value)}</span>
        )}
      </span>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  SET WIDGET
// ════════════════════════════════════════════════════════════════════
function StepBtn({ label, small, onClick }) {
  return (
    <button className={`sw-step ${small ? 'small' : ''}`} onClick={onClick}>{label}</button>
  )
}

function SetWidget({ num, isWarmup, lastSet, carryWeight, existing, goalReps, onDone }) {
  const [weight, setWeight] = useState(
    existing ? existing.weight : (carryWeight ?? lastSet?.weight ?? 0))
  const [reps, setReps] = useState(
    existing ? existing.reps : (goalReps ?? lastSet?.reps ?? DEFAULT_GOAL_REPS))
  const [feel, setFeel] = useState(existing ? (existing.feel ?? null) : null)
  // Weight can go negative for assisted movements (assisted pull-ups,
  // assisted dips) where the machine takes load off you. Reps can't.
  const adjWeight = (d) => setWeight(v => parseFloat(((v ?? 0) + d).toFixed(1)))
  const adjReps = (d) => setReps(v => Math.max(0, Math.round((v ?? 0) + d)))

  return (
    <div className="set-widget">
      <span className="sw-header">{isWarmup ? 'WARMUP SET' : `SET ${num}`}</span>

      <div className="sw-fields">
        <div className="sw-group">
          <span className="sw-field-label">WEIGHT</span>
          <div className="sw-row">
            <StepBtn label="−5" onClick={() => adjWeight(-5)} />
            <StepBtn label="−2.5" small onClick={() => adjWeight(-2.5)} />
            <span className="sw-value">
              <input type="number" inputMode="decimal" value={weight ?? ''}
                onChange={e => setWeight(e.target.value === '' ? null : parseFloat(e.target.value))} />
              <span className="sw-unit">lbs</span>
            </span>
            <StepBtn label="+2.5" small onClick={() => adjWeight(2.5)} />
            <StepBtn label="+5" onClick={() => adjWeight(5)} />
          </div>
        </div>

        <div className="sw-group">
          <span className="sw-field-label">REPS</span>
          <div className="sw-row reps">
            <StepBtn label="−1" onClick={() => adjReps(-1)} />
            <span className="sw-value reps">
              <input type="number" inputMode="numeric" value={reps ?? ''}
                onChange={e => setReps(e.target.value === '' ? null : parseInt(e.target.value))} />
            </span>
            <StepBtn label="+1" onClick={() => adjReps(1)} />
          </div>
        </div>
      </div>

      <FeelSlider value={feel} onChange={setFeel} />

      <div className="sw-footer">
        <button className="done-btn" disabled={weight === null || reps === null}
          onClick={() => onDone({ weight, reps, feel, rpe: feelToRpe(feel), isWarmup })}>
          {existing ? 'Save' : 'Done'}
        </button>
      </div>
    </div>
  )
}

// ─── sheets ─────────────────────────────────────────────────────────
function Sheet({ title, titleTone = 'red', children, onClose, footer,
  className = '', pinned = null }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className={`sheet ${className}`} onClick={e => e.stopPropagation()}>
        {/* Handle, title and anything in `pinned` stay put; only the
            body scrolls beneath them. */}
        <div className="sheet-pinned">
          <div className="sheet-handle" />
          {title && <h2 className={`display sheet-title ${titleTone}`}>{title}</h2>}
          {pinned}
        </div>
        <div className="sheet-body">{children}</div>
        {footer}
      </div>
    </div>
  )
}

function LoggingSheet({ setNum, isWarmup, lastSet, carryWeight, existing, goalReps, onDone, onClose }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet set-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        {!isWarmup && !existing && lastSet && (
          <div className="last-time-row">
            <span className="lt-badge">Set {setNum} Last Time</span>
            <span className="lt-data">
              {lastSet.weight} lbs × {lastSet.reps} reps
            </span>
          </div>
        )}
        <SetWidget num={setNum} isWarmup={isWarmup} lastSet={lastSet}
          carryWeight={carryWeight} existing={existing} goalReps={goalReps} onDone={onDone} />
      </div>
    </div>
  )
}

function PauseSheet({ onCancel, onConfirm }) {
  return (
    <Sheet title="Pause the workout?" onClose={onCancel}
      footer={
        <div className="pause-actions">
          <button className="pause-btn ghost" onClick={onCancel}>Nevermind</button>
          <button className="pause-btn confirm" onClick={onConfirm}>Pause Workout</button>
        </div>
      }>
      <p className="pause-copy">
        Are you sure you want to pause your workout and return to the home page?
        You can resume this workout at any time.
      </p>
    </Sheet>
  )
}

function SwapSheet({ muscle, options, onPick, onCreateNew, onClose }) {
  return (
    <Sheet title="Swap this exercise..." onClose={onClose}
      className="swap-sheet"
      footer={<button className="sheet-close" onClick={onClose}>Close</button>}
      pinned={
        <div className="swap-head">
          <MuscleIcon muscle={muscle} size={60} />
          <span className="swap-head-text">
            <span className="list-name">{muscle}</span>
            <span className="list-sub">{options.length} exercise{options.length === 1 ? '' : 's'}</span>
          </span>
        </div>
      }>
      {options.map(ex => (
        <button key={ex.id} className="swap-row" onClick={() => onPick(ex.id)}>
          <span className="swap-row-text">
            <span className="swap-row-name">{ex.name}</span>
            <span className="swap-row-sub">{detailLineSoft(ex.muscle, ex.equipment)}</span>
          </span>
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
    </Sheet>
  )
}

function WorkoutOptionsSheet({ onDelete, onEdit, onClose }) {
  return (
    <Sheet title="Workout Options" titleTone="violet" onClose={onClose}
      footer={<button className="sheet-close" onClick={onClose}>Close</button>}>
      <button className="swap-row" onClick={onDelete}>
        <span className="swap-row-name">Delete this workout</span>
        <Trash color="#111111" />
      </button>
      <button className="swap-row" onClick={onEdit}>
        <span className="swap-row-name">Edit this workout</span>
        <Edit color="#111111" opacity={1} />
      </button>
    </Sheet>
  )
}

function PlanOptionsSheet({ onDelete, onEdit, onClose }) {
  return (
    <Sheet title="Plan Options" titleTone="violet" onClose={onClose}
      footer={<button className="sheet-close" onClick={onClose}>Close</button>}>
      <button className="swap-row" onClick={onEdit}>
        <span className="swap-row-name">Edit this plan</span>
        <Edit color="#111111" opacity={1} />
      </button>
      <button className="swap-row" onClick={onDelete}>
        <span className="swap-row-name">End this plan</span>
        <Trash color="#111111" />
      </button>
    </Sheet>
  )
}

// ─── filter sheets ──────────────────────────────────────────────────
function MuscleFilterSheet({ selected, onToggle, onClear, onApply, resultCount, onClose }) {
  return (
    <Sheet title="Muscle Group" onClose={onClose} className="filter-sheet"
      footer={
        <div className="filter-actions">
          <button className="filter-btn ghost" onClick={onClear}>Clear Filters</button>
          <button className="filter-btn solid" onClick={onApply}>
            Show {resultCount} Result{resultCount === 1 ? '' : 's'}
          </button>
        </div>
      }>
      <span className="filter-label">MUSCLE GROUP</span>
      <div className="filter-grid">
        {MUSCLE_GROUPS.map(m => (
          <button key={m} className={`filter-card ${selected.includes(m) ? 'on' : ''}`}
            onClick={() => onToggle(m)}>
            <MuscleIcon muscle={m} size={60} />
            <span className="filter-card-name">{m}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function EquipmentFilterSheet({ selected, onToggle, onClear, onApply, resultCount, onClose }) {
  return (
    <Sheet title="Equipment" onClose={onClose} className="filter-sheet"
      footer={
        <div className="filter-actions">
          <button className="filter-btn ghost" onClick={onClear}>Clear Filters</button>
          <button className="filter-btn solid" onClick={onApply}>
            Show {resultCount} Result{resultCount === 1 ? '' : 's'}
          </button>
        </div>
      }>
      {EQUIPMENT_GROUPS.map(g => (
        <div key={g.label} className="filter-eq-group">
          <span className="filter-label">{g.label}</span>
          <div className="filter-grid">
            {g.items.map(item => (
              <button key={item} className={`filter-chip ${selected.includes(item) ? 'on' : ''}`}
                onClick={() => onToggle(item)}>{item}</button>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  )
}

// ════════════════════════════════════════════════════════════════════
//  LOGGING SCREEN
// ════════════════════════════════════════════════════════════════════
function LoggingScreen({
  exercise, exIdx, items, sets, doneFlags, lastTime, goalReps,
  onAddSet, onEditSet, onSwap, onCreateSwap, onGo, onNext, onPause,
  onHistory, onPlan, isLastRemaining, swapOptions,
}) {
  const [sheet, setSheet] = useState(null)
  const [pausing, setPausing] = useState(false)
  const [showSwap, setShowSwap] = useState(false)

  const workingSets = sets.filter(s => !s.isWarmup)
  const workingCount = workingSets.length
  const lastForNextSet = lastTime && lastTime[workingCount] ? lastTime[workingCount] : null
  const carryWeight = workingCount > 0 ? workingSets[workingCount - 1].weight : null

  const editSet = (index) => {
    const s = sets[index]
    let n = 0
    for (let i = 0; i <= index; i++) if (!sets[i].isWarmup) n++
    setSheet({ mode: 'edit', isWarmup: s.isWarmup, setNum: n, index, existing: s })
  }

  const anySheet = sheet || pausing || showSwap

  return (
    <div className="log-screen">
      <div className="log-progress">
        <div className="log-title-block">
          <h2 className="log-exercise-name">{exercise.name}</h2>
          <span className="log-detail-line">{detailLine(exercise.muscle, exercise.equipment)}</span>
        </div>

        {/* Details is gone — swap, history, and today's plan are the
            only things you reach for mid-set. */}
        <div className="log-tools">
          <button className="log-btn" onClick={() => setShowSwap(true)} aria-label="Swap exercise">
            <Swap color="#FFFFFF" />
          </button>
          <button className="log-btn" onClick={onHistory} aria-label="Exercise history">
            <History color="#FFFFFF" />
          </button>
          <button className="log-btn" onClick={onPlan} aria-label="Today's plan">
            <List color="#FFFFFF" />
          </button>
        </div>

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
            Warmup Set <Plus color="#FFFFFF" />
          </button>
          <button className="ss-btn solid"
            onClick={() => setSheet({ mode: 'add', isWarmup: false, setNum: workingCount + 1 })}>
            Set {workingCount + 1} <Plus color="#FFFFFF" />
          </button>
        </div>
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
          carryWeight={sheet.isWarmup || sheet.mode === 'edit' ? null : carryWeight}
          existing={sheet.mode === 'edit' ? sheet.existing : null}
          goalReps={sheet.isWarmup ? null : goalReps}
          onDone={(s) => {
            if (sheet.mode === 'edit') onEditSet(sheet.index, s)
            else onAddSet({ id: uid(), ...s })
            setSheet(null)
          }}
          onClose={() => setSheet(null)} />
      )}
      {pausing && <PauseSheet onCancel={() => setPausing(false)} onConfirm={onPause} />}
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
      <Header title={exercise?.name || 'History'} onBack={onBack} tone="red" />
      <div className="hist-scroll">
        {sessions.length === 0 && (
          <p className="hist-empty">
            No sessions logged yet. Finish a workout with this exercise and it'll show up here.
          </p>
        )}
        {sessions.map((s, i) => (
          <div key={i}>
            <div className="hist-date"><span className="row-label">{formatHistoryDate(s.date)}</span></div>
            <div className="hist-sets"><SetGroup sets={s.sets} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  TODAY'S PLAN — session-only edits
// ════════════════════════════════════════════════════════════════════
function TodaysPlan({ workoutName, items, exerciseMap, onGo, onBack, onChange, onAdd,
  ctaLabel, currentIdx = null, eyebrow = "Today's Plan" }) {
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
          <p className="plan-eyebrow">{eyebrow}</p>
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
              <button className="plan-ctl" onClick={() => move(-1)} disabled={sel === 0} aria-label="Move up">
                <SmallChevronUp color="#FFFFFF" />
              </button>
              <button className="plan-ctl" onClick={() => move(1)} disabled={sel === items.length - 1} aria-label="Move down">
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
function StartPage({ plan, workoutsById, exerciseMap, pausedWorkoutId,
  onStartWorkout, onCreatePlan, onStartToday, onResume, onHistory,
  onPlanOptions, onWorkbook, onSettings }) {
  const todayWorkoutId = planTodayWorkoutId(plan)
  const todayWorkout = todayWorkoutId ? workoutsById[todayWorkoutId] : null
  const isPausedToday = todayWorkout && pausedWorkoutId === todayWorkoutId
  const now = new Date()
  const dayIdx = plan ? planDayIndex(plan) : 0

  return (
    <div className="start-screen">
      <div className="start-top">
        <div className="start-toolbar">
          <button className="tool-btn" onClick={onHistory} aria-label="Exercise history">
            <History color="#111111" />
          </button>
          <button className="tool-btn" onClick={onWorkbook} aria-label="Workbook">
            <Book color="#111111" />
          </button>
          <button className="tool-btn" onClick={onSettings} aria-label="Settings">
            <Gear color="#111111" />
          </button>
        </div>

        <div className="overload-stack">
          <span className="ol-back"> OVERLOAD</span>
          <span className="ol-front">OVERLOAD</span>
        </div>

        {/* Nothing scheduled yet — the anatomy graphic fills the space
            instead of leaving a blank page. */}
        {!todayWorkout && !plan && (
          <div className="start-hero">
            <img className="start-hero-img" src={homeGraphic} alt="" aria-hidden="true" />
          </div>
        )}

        {todayWorkout && (
          <div className="start-section">
            <p className="section-label">TODAY'S WORKOUT</p>
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
              </div>
              <button className="wk-cta"
                onClick={() => (isPausedToday ? onResume() : onStartToday(todayWorkoutId))}>
                {isPausedToday ? 'Resume Workout' : 'Start Workout'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom sheet: the active plan, or the two entry points when
          there isn't one yet. */}
      <div className="start-bottom">
        {plan ? (
          <div className="plan-card">
            <div className="plan-card-head">
              <span className="active-badge">ACTIVE</span>
              <button className="wk-kebab" onClick={onPlanOptions} aria-label="Plan options">
                <KebabMenu color="#111111" />
              </button>
            </div>
            <p className="section-label">YOUR WORKOUT PLAN</p>
            <h2 className="plan-card-name">{plan.name}</h2>
            <div className="plan-days">
              {Array.from({ length: plan.days }, (_, i) => (
                <span key={i} className={`plan-day ${plan.slots[i] ? 'on' : 'rest'} ${i === dayIdx ? 'today' : ''}`}>
                  {i + 1}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="start-cta-stack">
            <button className="start-cta ghost" onClick={onStartWorkout}>
              START A WORKOUT <ArrowRight color="#111111" />
            </button>
            <button className="start-cta solid" onClick={onCreatePlan}>
              CREATE A WORKOUT PLAN <ArrowRight />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  SELECT A WORKOUT
//  mode 'start'  → no rest cell, CTA reads START
//  mode 'assign' → rest cell shown, CTA reads SELECT
// ════════════════════════════════════════════════════════════════════
function WorkoutSelection({ workouts, exerciseMap, mode, onPick, onRest, onCreate, onBack, onOptions }) {
  const assigning = mode === 'assign'
  return (
    <div className="sel-screen">
      {/* Compact header: centred title with Create on the right. */}
      <div className="sel-header">
        <button className="hdr-back white" onClick={onBack} aria-label="Back">
          <SmallChevronLeft color="#6C5CE7" />
        </button>
        <span className="sel-title">{assigning ? 'Select a Workout' : 'Start a Workout'}</span>
        <button className="sel-create" onClick={onCreate}>Create</button>
      </div>
      <div className="sel-scroll">
        {assigning && (
          <div className="sel-quick-row">
            <button className="sel-quick rest" onClick={onRest}>
              <span className="sel-quick-name">Rest Day</span>
              <ChevronRight color="#111111" />
            </button>
          </div>
        )}

        {workouts.length > 0 ? (
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
                  <button className="wk-cta small" onClick={() => onPick(w.id)}>
                    {assigning ? 'SELECT' : 'START'}
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="sel-empty">No workouts yet. Create one to get started.</p>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  CREATE A PLAN
// ════════════════════════════════════════════════════════════════════
function CreatePlan({ draft, workoutsById, exerciseMap, onChange, onPickDay, onSave, onCancel }) {
  const named = draft.name.trim().length > 0
  const nameRef = useRef(null)
  const setDays = (n) => {
    const days = Math.min(PLAN_MAX_DAYS, Math.max(PLAN_MIN_DAYS, n))
    const slots = Array.from({ length: days }, (_, i) => draft.slots[i])
    onChange({ ...draft, days, slots })
  }

  return (
    <div className="cp-screen">
      <Header title="Create a Plan" onBack={onCancel} tone="white" />
      <div className="cp-scroll">
        <div className="cp-intro">
          <span className="row-label dark">NEW WORKOUT PLAN</span>
          <p className="cp-blurb">
            Add a name, select your training day split, create and assign the workouts for each day.
          </p>
        </div>

        <div className="cp-name-block">
          <div className="cp-name-row">
            {/* Only steal focus when there's nothing typed yet. Coming
                back to this screen with a name already set shouldn't
                pop the keyboard — tap the pencil for that. */}
            <input ref={nameRef} className="cp-name-input" value={draft.name}
              placeholder="Add a name..." autoFocus={!draft.name}
              onChange={e => onChange({ ...draft, name: e.target.value })} />
            {named && (
              <button className="icon-btn" aria-label="Edit plan name"
                onClick={() => nameRef.current?.focus()}>
                <Edit color="#000000" opacity={0.5} />
              </button>
            )}
          </div>
          {named && <span className="cp-split-line">{draft.days} DAY SPLIT</span>}
        </div>

        <div className="cp-divider" />

        <div className="cp-section">
          <span className="row-label dark">WORKOUT ROTATION</span>
          <div className="cp-days">
            {Array.from({ length: draft.days }, (_, i) => (
              <span key={i} className={`cp-day ${
                draft.slots[i] ? 'on' : draft.slots[i] === null ? 'rest' : 'empty'}`}>{i + 1}</span>
            ))}
          </div>
        </div>

        <div className="cp-section row">
          <span className="cp-stepper-label">WORKOUT DAY SPLIT</span>
          <div className="cp-stepper">
            <button className="cp-step" onClick={() => setDays(draft.days - 1)}
              disabled={draft.days <= PLAN_MIN_DAYS} aria-label="Fewer days">
              <SmallChevronDown color="#111111" />
            </button>
            <span className="cp-step-value">{draft.days}</span>
            <button className="cp-step" onClick={() => setDays(draft.days + 1)}
              disabled={draft.days >= PLAN_MAX_DAYS} aria-label="More days">
              <SmallChevronUp color="#111111" />
            </button>
          </div>
        </div>

        <div className="cp-section">
          <span className="row-label dark">WORKOUT SELECTION ({draft.days} DAYS)</span>
          <div className="cp-slots">
            {draft.slots.map((wid, i) => {
              const w = wid ? workoutsById[wid] : null
              return (
                <button key={i} className="cp-slot" onClick={() => onPickDay(i)}>
                  <span className={`cp-slot-num ${
                    w ? 'on' : wid === null ? 'rest' : 'empty'}`}>{i + 1}</span>
                  <span className="cp-slot-text">
                    <span className={`cp-slot-name ${w || wid === null ? '' : 'placeholder'}`}>
                      {w ? w.name : wid === null ? 'Rest' : 'Choose a workout'}
                    </span>
                    {w && <span className="cp-slot-sub">{workoutSummaryLine(w, exerciseMap)}</span>}
                  </span>
                  <SmallChevronRight color="#111111" />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="cp-footer">
        <button className="cp-btn ghost" onClick={onCancel}>Cancel</button>
        <button className="cp-btn solid" disabled={!named} onClick={onSave}>Save</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  CREATE / EDIT A WORKOUT
// ════════════════════════════════════════════════════════════════════
function Stepper({ label, value, min = 1, max = 60, onChange }) {
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

function CreateWorkout({ draft, exerciseMap, editing, onNameChange, onItemsChange,
  onAddExercise, onSave, onCancel }) {
  const named = draft.name.trim().length > 0
  const nameRef = useRef(null)
  const muscles = workoutMuscles({ items: draft.items }, exerciseMap)
  const patch = (i, p) => onItemsChange(draft.items.map((it, j) => j === i ? { ...it, ...p } : it))
  const removeAt = (i) => onItemsChange(draft.items.filter((_, j) => j !== i))

  return (
    <div className="cw-screen">
      <Header title={editing ? 'Edit Workout' : 'Create a Workout'} onBack={onCancel} tone="cream" />
      <div className="cw-scroll">
        <div className="cw-section">
          <span className="row-label">WORKOUT NAME</span>
          <div className="cw-name-row">
            <input ref={nameRef} className="cw-name-input" value={draft.name}
              placeholder="Add a name..." autoFocus={!draft.name}
              onChange={e => onNameChange(e.target.value)} />
            {draft.name.trim() && (
              <button className="icon-btn" aria-label="Edit workout name"
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
                      <span className="ex-card-detail">{detailLine(ex.muscle, ex.equipment)}</span>
                    </span>
                    <button className="ex-close" aria-label={`Remove ${ex.name}`}
                      onClick={() => removeAt(i)}>
                      <Close color="#111111" />
                    </button>
                  </div>
                  <Stepper label="WORKING SETS" value={it.sets} max={30}
                    onChange={v => patch(i, { sets: v })} />
                  <Stepper label="GOAL REPS" value={it.reps}
                    onChange={v => patch(i, { reps: v })} />
                </div>
              )
            })}
            <button className="add-ex-row" onClick={onAddExercise}>
              ADD AN EXERCISE <Plus color="#111111" />
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
//  ADD EXERCISE — search + muscle/equipment filters
// ════════════════════════════════════════════════════════════════════
function ChooseExercise({ exercises, title = 'Add Exercise', onPick, onCreateNew, onBack }) {
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState({})
  const [muscleFilter, setMuscleFilter] = useState([])
  const [equipFilter, setEquipFilter] = useState([])
  const [sheet, setSheet] = useState(null)          // 'muscle' | 'equipment'
  // Filters inside the sheet are live-previewed, then committed on apply.
  const [draftMuscle, setDraftMuscle] = useState([])
  const [draftEquip, setDraftEquip] = useState([])

  const query = q.trim().toLowerCase()
  const filtering = muscleFilter.length > 0 || equipFilter.length > 0

  const matches = (list, mFil, eFil) => list.filter(e =>
    (mFil.length === 0 || mFil.includes(e.muscle)) &&
    (eFil.length === 0 || eFil.includes(e.equipment)) &&
    (!query || e.name.toLowerCase().includes(query) ||
      e.muscle.toLowerCase().includes(query) || e.equipment.toLowerCase().includes(query)))

  const visible = useMemo(() => matches(exercises, muscleFilter, equipFilter),
    [exercises, muscleFilter, equipFilter, query])
  const previewCount = sheet === 'muscle'
    ? matches(exercises, draftMuscle, equipFilter).length
    : matches(exercises, muscleFilter, draftEquip).length

  const byMuscle = useMemo(() => {
    const m = {}
    for (const ex of visible) (m[ex.muscle] ||= []).push(ex)
    return m
  }, [visible])
  const groupsPresent = MUSCLE_GROUPS.filter(m => byMuscle[m])
  const toggle = (m) => setExpanded(e => ({ ...e, [m]: !e[m] }))
  // A search or an active filter has already narrowed things down, so
  // showing the results collapsed would just add a tap.
  const forceOpen = !!query || filtering

  const openSheet = (which) => {
    setDraftMuscle(muscleFilter); setDraftEquip(equipFilter); setSheet(which)
  }
  const toggleIn = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]

  const Row = ({ ex }) => (
    <button className="ex-row" onClick={() => onPick(ex.id)}>
      <span className="ex-row-text">
        <span className="ex-row-name">{ex.name}</span>
        <span className="ex-row-sub">{detailLineSoft(ex.muscle, ex.equipment)}</span>
      </span>
      <AddExercise color="#111111" />
    </button>
  )

  return (
    <div className="ce-screen">
      <div className="ce-header">
        <button className="hdr-back white" onClick={onBack} aria-label="Back">
          <ChevronLeft color="#F0573F" />
        </button>
        <span className="ce-title">{title}</span>
        <button className="ce-create" onClick={() => onCreateNew(null)}>Create</button>
      </div>

      <div className="ce-searchbar">
        <div className="ce-search">
          <Search color="#737373" size={20} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" />
        </div>
        <div className="ce-filters">
          <button className={`ce-filter ${muscleFilter.length ? 'on' : ''}`}
            onClick={() => muscleFilter.length ? setMuscleFilter([]) : openSheet('muscle')}>
            {muscleFilter.length ? `Muscles (${muscleFilter.length})` : 'All Muscles'}
            {muscleFilter.length ? <Close color="#FFFFFF" /> : <SmallChevronDown color="#111111" />}
          </button>
          <button className={`ce-filter ${equipFilter.length ? 'on' : ''}`}
            onClick={() => equipFilter.length ? setEquipFilter([]) : openSheet('equipment')}>
            {equipFilter.length ? `Equipment (${equipFilter.length})` : 'All equipment'}
            {equipFilter.length ? <Close color="#FFFFFF" /> : <SmallChevronDown color="#111111" />}
          </button>
        </div>
      </div>

      <div className="ce-scroll">
        <div className="ce-label-row">
          <span className="row-label dark">
            {query || filtering ? 'SEARCH RESULTS' : 'YOUR EXERCISES'}
          </span>
        </div>
        {groupsPresent.length === 0 && (
          <p className="ce-empty">Nothing matches those filters. Tap Create to add a new exercise.</p>
        )}
        {groupsPresent.map(muscle => {
          const list = byMuscle[muscle]
          const isOpen = forceOpen || !!expanded[muscle]
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
              {isOpen && (
                <>
                  {list.map(ex => <Row key={ex.id} ex={ex} />)}
                  {/* Create straight into this group — the muscle is
                      already known, so it's pre-filled. */}
                  <button className="ex-add-row" onClick={() => onCreateNew(muscle)}>
                    <span className="ex-add-text">Add a new {muscle.toLowerCase()} exercise...</span>
                    <Plus color="#111111" />
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {sheet === 'muscle' && (
        <MuscleFilterSheet selected={draftMuscle} resultCount={previewCount}
          onToggle={(m) => setDraftMuscle(a => toggleIn(a, m))}
          onClear={() => { setDraftMuscle([]); setMuscleFilter([]); setSheet(null) }}
          onApply={() => { setMuscleFilter(draftMuscle); setSheet(null) }}
          onClose={() => setSheet(null)} />
      )}
      {sheet === 'equipment' && (
        <EquipmentFilterSheet selected={draftEquip} resultCount={previewCount}
          onToggle={(v) => setDraftEquip(a => toggleIn(a, v))}
          onClear={() => { setDraftEquip([]); setEquipFilter([]); setSheet(null) }}
          onApply={() => { setEquipFilter(draftEquip); setSheet(null) }}
          onClose={() => setSheet(null)} />
      )}
    </div>
  )
}

// ─── create an exercise: name + muscle + equipment ──────────────────
function ConfigureExercise({ presetMuscle, onSave, onBack }) {
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState(presetMuscle || null)
  const [equipment, setEquipment] = useState(null)
  const canSave = name.trim().length > 0 && !!muscle && !!equipment

  return (
    <div className="cfg-screen">
      {/* White page, red back button and red League Gothic title. */}
      <div className="cfg-header">
        <button className="cfg-back" onClick={onBack} aria-label="Back">
          <SmallChevronLeft color="#FFFFFF" />
        </button>
        <h1 className="display cfg-title">Create an Exercise</h1>
      </div>

      <div className="cfg-scroll">
        <div className="cfg-intro">
          <span className="cfg-eyebrow">NEW EXERCISE</span>
          <p className="cfg-help">
            Add a name, select the muscle group, and which setup is used for this exercise.
          </p>
          <input className="cfg-name" value={name} placeholder="Add a name..."
            autoFocus onChange={e => setName(e.target.value)} />
        </div>

        <div className="cfg-divider" />

        <div className="cfg-section">
          <span className="cfg-eyebrow">MUSCLE GROUP</span>
          <div className="cfg-grid">
            {MUSCLE_GROUPS.map(m => (
              <button key={m} className={`cfg-muscle ${muscle === m ? 'on' : ''}`}
                onClick={() => setMuscle(m)}>
                <MuscleIcon muscle={m} size={60} />
                <span className="cfg-muscle-name">{m}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="cfg-section">
          <span className="cfg-eyebrow">EQUIPMENT</span>
          <div className="cfg-grid">
            {EQUIPMENT.map(item => (
              <button key={item} className={`cfg-equip ${equipment === item ? 'on' : ''}`}
                onClick={() => setEquipment(item)}>{item}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="cfg-footer">
        <button className="cfg-btn ghost" onClick={onBack}>Cancel</button>
        <button className="cfg-btn solid" disabled={!canSave}
          onClick={() => onSave({ name: name.trim(), muscle, equipment })}>Save</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  WORKOUT COMPLETE
// ════════════════════════════════════════════════════════════════════
function WorkoutComplete({ items, exerciseMap, loggedSets, onAddMore, onDone }) {
  // One entry per SLOT, not per exercise — if you benched at the start
  // and quick-added more bench at the end, those are two sections with
  // their own sets, not one merged pile.
  const worked = items
    .map(it => ({ slotId: it.slotId, ex: exerciseMap[it.exId], sets: loggedSets[it.slotId] || [] }))
    .filter(w => w.ex && w.sets.length > 0)
  const totalSets = worked.reduce(
    (a, w) => a + w.sets.filter(s => !s.isWarmup).length, 0)
  const failures = worked.reduce(
    (a, w) => a + w.sets.filter(s => isFailure(s.rpe)).length, 0)
  const summaryLine = [
    `${worked.length} exercise${worked.length === 1 ? '' : 's'}`,
    `${totalSets} set${totalSets === 1 ? '' : 's'}`,
    ...(failures > 0 ? [`${failures} to failure`] : []),
  ].join(' · ')

  const onShare = async () => {
    const lines = ['OVERLOAD — Workout Complete', summaryLine, '']
    for (const w of worked) {
      lines.push(w.ex.name.toUpperCase())
      let n = 0
      for (const s of w.sets) {
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
          {worked.map(w => (
            <div key={w.slotId} className="done-ex">
              <div className="done-ex-head">
                <span className="done-ex-name">{w.ex.name}</span>
                <span className="done-ex-sub">{detailLine(w.ex.muscle, w.ex.equipment)}</span>
              </div>
              <SetGroup sets={w.sets} />
            </div>
          ))}
        </div>
      </div>
      <div className="done-footer">
        <button className="done-cta" onClick={onDone}>Back to the Homepage</button>
      </div>
    </div>
  )
}

function ComingSoon({ title, onBack }) {
  return (
    <div className="cs-screen">
      <Header title={title} onBack={onBack} tone="violet" />
      <p className="cs-copy">This screen hasn't been designed yet — it's next on the list.</p>
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
  const [plan, setPlan] = useState(initial.plan || null)
  const [history, setHistory] = useState(initial.history || {})
  const [paused, setPaused] = useState(initial.paused || null)

  useEffect(() => {
    saveState({ exercises, workouts, plan, history, paused })
  }, [exercises, workouts, plan, history, paused])

  const exerciseMap = useMemo(() => Object.fromEntries(exercises.map(e => [e.id, e])), [exercises])
  const workoutsById = useMemo(() => Object.fromEntries(workouts.map(w => [w.id, w])), [workouts])

  const [screen, setScreen] = useState('start')
  const [activeWorkoutId, setActiveWorkoutId] = useState(null)
  const [sessionItems, setSessionItems] = useState([])
  const [exIdx, setExIdx] = useState(0)
  const [loggedSets, setLoggedSets] = useState({})

  const [historyExId, setHistoryExId] = useState(null)
  const [historyReturn, setHistoryReturn] = useState('start')

  const [draft, setDraft] = useState({ name: '', items: [] })
  const [editingWorkoutId, setEditingWorkoutId] = useState(null)
  const [planDraft, setPlanDraft] = useState(null)
  const [planSlotIdx, setPlanSlotIdx] = useState(null)
  const [presetMuscle, setPresetMuscle] = useState(null)
  const [optionsWorkoutId, setOptionsWorkoutId] = useState(null)
  const [showPlanOptions, setShowPlanOptions] = useState(false)
  const [pickerMode, setPickerMode] = useState(null)
  const [selectMode, setSelectMode] = useState('start')   // 'start' | 'assign'
  const [quickAddIds, setQuickAddIds] = useState([])
  const [comingSoon, setComingSoon] = useState(null)

  const activeWorkout = activeWorkoutId ? workoutsById[activeWorkoutId] : null
  const doneFlags = sessionItems.map(it => (loggedSets[it.slotId] || []).some(s => !s.isWarmup))

  // ── workout creation / editing ──
  const startCreate = () => {
    setDraft({ name: '', items: [] }); setEditingWorkoutId(null); setScreen('createWorkout')
  }
  const startEdit = (wid) => {
    const w = workoutsById[wid]
    if (!w) return
    setDraft({ name: w.name, items: w.items.map(it => ({ ...it })) })
    setEditingWorkoutId(wid); setOptionsWorkoutId(null); setScreen('createWorkout')
  }
  const saveWorkout = () => {
    let savedId = editingWorkoutId
    if (editingWorkoutId) {
      setWorkouts(prev => prev.map(w => w.id === editingWorkoutId
        ? { ...w, name: draft.name.trim(), items: draft.items } : w))
    } else {
      const nw = { id: uid(), name: draft.name.trim(), items: draft.items, timesCompleted: 0 }
      savedId = nw.id
      setWorkouts(prev => [...prev, nw])
    }
    setEditingWorkoutId(null)
    // Creating a workout from inside plan-building drops it straight
    // into the slot that sent you there.
    if (planDraft && planSlotIdx != null) {
      setPlanDraft(p => ({ ...p, slots: p.slots.map((s, i) => i === planSlotIdx ? savedId : s) }))
      setPlanSlotIdx(null)
      setScreen('createPlan')
    } else {
      setScreen(planDraft ? 'createPlan' : 'selection')
    }
  }
  const deleteWorkout = (wid) => {
    setWorkouts(prev => prev.filter(w => w.id !== wid))
    setPlan(p => p ? { ...p, slots: p.slots.map(s => s === wid ? null : s) } : p)
    setOptionsWorkoutId(null)
  }

  // ── plan ──
  const startCreatePlan = () => {
    setPlanDraft({
      id: uid(), name: '', days: PLAN_DEFAULT_DAYS,
      // undefined = not chosen yet (empty), null = explicit Rest day.
      slots: Array(PLAN_DEFAULT_DAYS).fill(undefined),
    })
    setScreen('createPlan')
  }
  const editPlan = () => {
    if (!plan) return
    setPlanDraft({ ...plan, slots: [...plan.slots] })
    setShowPlanOptions(false)
    setScreen('createPlan')
  }
  const savePlan = () => {
    setPlan({ ...planDraft, name: planDraft.name.trim(), startDate: plan?.startDate || new Date().toISOString() })
    setPlanDraft(null); setScreen('start')
  }
  const pickForSlot = (i) => {
    setPlanSlotIdx(i); setSelectMode('assign'); setScreen('selection')
  }

  // ── exercise picking ──
  const openPicker = (mode) => { setPickerMode(mode); setScreen('chooseExercise') }
  const pickerBack = () => setScreen(
    pickerMode === 'quickAdd' ? 'quickAdd'
      : pickerMode === 'plan' ? 'plan'
      : pickerMode === 'swap' ? 'logging' : 'createWorkout')
  const handlePick = (exId) => {
    if (pickerMode === 'draft') {
      setDraft(d => ({ ...d, items: [...d.items, makeItem(exId)] })); setScreen('createWorkout')
    } else if (pickerMode === 'plan') {
      setSessionItems(prev => [...prev, { ...makeItem(exId), slotId: newSlotId() }]); setScreen('plan')
    } else if (pickerMode === 'quickAdd') {
      setQuickAddIds(prev => [...prev, exId]); setScreen('quickAdd')
    } else if (pickerMode === 'swap') {
      swapCurrent(exId); setScreen('logging')
    }
  }
  const createdExercise = (ex) => {
    const nx = { id: uid(), ...ex }
    setExercises(prev => [...prev, nx])
    setPresetMuscle(null)
    handlePick(nx.id)
  }

  // ── running a workout ──
  const startToday = (wid) => {
    const w = workoutsById[wid]
    if (!w) return
    setActiveWorkoutId(wid)
    setSessionItems(withSlotIds(w.items.map(it => ({ ...it }))))
    setExIdx(0); setLoggedSets({}); setScreen('plan')
  }
  const resumeWorkout = () => {
    if (!paused) return
    setActiveWorkoutId(paused.workoutId)
    setSessionItems(paused.sessionItems || [])
    setExIdx(paused.exIdx || 0)
    setLoggedSets(paused.loggedSets || {})
    setPaused(null); setScreen('logging')
  }
  const addSet = (s) => {
    const it = sessionItems[exIdx]
    if (!it) return
    setLoggedSets(prev => ({ ...prev, [it.slotId]: [...(prev[it.slotId] || []), s] }))
  }
  const editSet = (index, patch) => {
    const it = sessionItems[exIdx]
    if (!it) return
    setLoggedSets(prev => {
      const arr = [...(prev[it.slotId] || [])]
      if (!arr[index]) return prev
      arr[index] = { ...arr[index], ...patch }
      return { ...prev, [it.slotId]: arr }
    })
  }
  const nextExercise = () => {
    for (let i = exIdx + 1; i < sessionItems.length; i++) if (!doneFlags[i]) return setExIdx(i)
    for (let i = 0; i < exIdx; i++) if (!doneFlags[i]) return setExIdx(i)
    setScreen('complete')
  }
  const remainingAfterThis = sessionItems.filter((_, i) => i !== exIdx && !doneFlags[i]).length
  const swapCurrent = (newExId) =>
    setSessionItems(prev => prev.map((it, i) => i === exIdx ? { ...it, exId: newExId } : it))
  const pauseWorkout = () => {
    setPaused({ workoutId: activeWorkoutId, sessionItems, exIdx, loggedSets })
    setActiveWorkoutId(null); setScreen('start')
  }
  const finishWorkout = () => {
    if (activeWorkoutId) {
      setWorkouts(prev => prev.map(w =>
        w.id === activeWorkoutId ? { ...w, timesCompleted: (w.timesCompleted || 0) + 1 } : w))
    }
    const date = new Date().toISOString()
    setHistory(prev => {
      const next = { ...prev }
      // History stays keyed by EXERCISE (that's how you look it up
      // later), so map each session slot back to its exercise.
      for (const it of sessionItems) {
        const sets = loggedSets[it.slotId]
        if (!sets || sets.length === 0) continue
        next[it.exId] = [...(next[it.exId] || []), { date, sets }]
      }
      return next
    })
    setActiveWorkoutId(null); setSessionItems([]); setLoggedSets({}); setScreen('start')
  }
  const commitQuickAdd = () => {
    if (quickAddIds.length === 0) return
    const firstNew = sessionItems.length
    setSessionItems(prev => [...prev, ...quickAddIds.map(id => ({ ...makeItem(id), slotId: newSlotId() }))])
    setQuickAddIds([]); setExIdx(firstNew); setScreen('logging')
  }

  // ── render ──
  const optionsWorkout = optionsWorkoutId ? workoutsById[optionsWorkoutId] : null

  if (screen === 'start') return (
    <>
      <StartPage plan={plan} workoutsById={workoutsById} exerciseMap={exerciseMap}
        pausedWorkoutId={paused?.workoutId ?? null}
        onStartWorkout={() => { setSelectMode('start'); setPlanSlotIdx(null); setScreen('selection') }}
        onCreatePlan={startCreatePlan}
        onStartToday={startToday} onResume={resumeWorkout}
        onHistory={() => { setHistoryReturn('start'); setScreen('historyPicker') }}
        onPlanOptions={() => setShowPlanOptions(true)}
        onWorkbook={() => setComingSoon('Workbook')}
        onSettings={() => setComingSoon('Settings')} />
      {showPlanOptions && (
        <PlanOptionsSheet onEdit={editPlan}
          onDelete={() => { setPlan(null); setShowPlanOptions(false) }}
          onClose={() => setShowPlanOptions(false)} />
      )}
      {comingSoon && (
        <Sheet title={comingSoon} titleTone="violet" onClose={() => setComingSoon(null)}
          footer={<button className="sheet-close" onClick={() => setComingSoon(null)}>Close</button>}>
          <p className="sheet-empty">This screen hasn't been designed yet — it's next on the list.</p>
        </Sheet>
      )}
    </>
  )

  if (screen === 'selection') return (
    <>
      <WorkoutSelection workouts={workouts} exerciseMap={exerciseMap} mode={selectMode}
        onPick={(wid) => {
          if (selectMode === 'assign' && planSlotIdx != null) {
            setPlanDraft(p => ({ ...p, slots: p.slots.map((s, i) => i === planSlotIdx ? wid : s) }))
            setPlanSlotIdx(null); setScreen('createPlan')
          } else {
            startToday(wid)
          }
        }}
        onRest={() => {
          if (planSlotIdx != null) {
            setPlanDraft(p => ({ ...p, slots: p.slots.map((s, i) => i === planSlotIdx ? null : s) }))
            setPlanSlotIdx(null)
          }
          setScreen('createPlan')
        }}
        onCreate={startCreate}
        onBack={() => setScreen(planDraft ? 'createPlan' : 'start')}
        onOptions={setOptionsWorkoutId} />
      {optionsWorkout && (
        <WorkoutOptionsSheet
          onDelete={() => deleteWorkout(optionsWorkout.id)}
          onEdit={() => startEdit(optionsWorkout.id)}
          onClose={() => setOptionsWorkoutId(null)} />
      )}
    </>
  )

  if (screen === 'createPlan' && planDraft) return (
    <CreatePlan draft={planDraft} workoutsById={workoutsById} exerciseMap={exerciseMap}
      onChange={setPlanDraft} onPickDay={pickForSlot} onSave={savePlan}
      onCancel={() => { setPlanDraft(null); setScreen('start') }} />
  )

  if (screen === 'createWorkout') return (
    <CreateWorkout draft={draft} exerciseMap={exerciseMap} editing={!!editingWorkoutId}
      onNameChange={(name) => setDraft(d => ({ ...d, name }))}
      onItemsChange={(items) => setDraft(d => ({ ...d, items }))}
      onAddExercise={() => openPicker('draft')}
      onSave={saveWorkout}
      onCancel={() => {
        setEditingWorkoutId(null)
        setScreen(planDraft ? 'selection' : 'selection')
      }} />
  )

  if (screen === 'chooseExercise') return (
    <ChooseExercise exercises={exercises} onPick={handlePick}
      onCreateNew={(m) => { setPresetMuscle(m); setScreen('configureExercise') }}
      onBack={pickerBack} />
  )

  if (screen === 'historyPicker') return (
    <ChooseExercise exercises={exercises} title="Exercise History"
      onPick={(exId) => { setHistoryExId(exId); setHistoryReturn('historyPicker'); setScreen('history') }}
      onCreateNew={(m) => { setPresetMuscle(m); setScreen('configureExercise') }}
      onBack={() => setScreen('start')} />
  )

  if (screen === 'configureExercise') return (
    <ConfigureExercise presetMuscle={presetMuscle} onSave={createdExercise}
      onBack={() => { setPresetMuscle(null); setScreen('chooseExercise') }} />
  )

  if (screen === 'plan' && activeWorkout) return (
    <TodaysPlan workoutName={activeWorkout.name} items={sessionItems}
      exerciseMap={exerciseMap} onChange={setSessionItems}
      onAdd={() => openPicker('plan')}
      onGo={() => { setExIdx(0); setScreen('logging') }}
      onBack={() => setScreen('start')} />
  )

  if (screen === 'logging' && activeWorkout) {
    const it = sessionItems[exIdx]
    const ex = it ? exerciseMap[it.exId] : null
    if (!ex) return null
    return (
      <LoggingScreen key={ex.id}
        exercise={ex} exIdx={exIdx} items={sessionItems}
        sets={loggedSets[it.slotId] || []} doneFlags={doneFlags}
        goalReps={it.reps} lastTime={lastSessionSets(history, ex.id)}
        isLastRemaining={remainingAfterThis === 0}
        swapOptions={exercises.filter(e => e.muscle === ex.muscle && e.id !== ex.id)}
        onAddSet={addSet} onEditSet={editSet}
        onSwap={swapCurrent} onCreateSwap={() => openPicker('swap')}
        onGo={(i) => { if (i >= 0 && i < sessionItems.length) setExIdx(i) }}
        onNext={nextExercise} onPause={pauseWorkout}
        onHistory={() => { setHistoryExId(ex.id); setHistoryReturn('logging'); setScreen('history') }}
        onPlan={() => setScreen('planDuring')} />
    )
  }

  if (screen === 'planDuring' && activeWorkout) return (
    <TodaysPlan workoutName={activeWorkout.name} items={sessionItems}
      exerciseMap={exerciseMap} onChange={setSessionItems}
      onAdd={() => openPicker('plan')} ctaLabel="Back to Workout" currentIdx={exIdx}
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
    <TodaysPlan workoutName="Quick Add" eyebrow="Extra Exercises"
      items={quickAddIds.map(id => makeItem(id))} exerciseMap={exerciseMap}
      onChange={(items) => setQuickAddIds(items.map(i => i.exId))}
      onAdd={() => openPicker('quickAdd')}
      onGo={commitQuickAdd} onBack={() => setScreen('complete')} />
  )

  if (screen === 'complete' && activeWorkout) return (
    <WorkoutComplete items={sessionItems} exerciseMap={exerciseMap} loggedSets={loggedSets}
      onAddMore={() => { setQuickAddIds([]); setScreen('quickAdd') }}
      onDone={finishWorkout} />
  )

  return null
}
