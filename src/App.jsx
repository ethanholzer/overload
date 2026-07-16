import { useState, useMemo, useRef, useEffect } from 'react'
import './App.css'
import {
  MUSCLE_GROUPS, DAYS_SHORT,
  FEEL_STOPS, FAILURE_VIOLET, feelKnobLabel, feelToRpe, rpeColor, isFailure,
  workoutMuscles, musclesSummary, formatHistoryDate,
  loadState, saveState, freshState, lastSessionSets, exerciseSessions,
} from './data.js'
import { muscleIcon, BODYMAP } from './assets/muscleGraphics.js'
import planBodyArt from './assets/plan-body.svg'
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Plus, Edit, History, Pause, Resume, ArrowRight, QuestionMark,
  Unilateral, Bilateral, SmallChevronLeft, SmallChevronRight, Share,
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


function Header({ title, onBack, tone = 'violet', className = '' }) {
  const chevron = { violet: '#6C5CE7', cream: '#F4EFE6', coral: '#F0573F', ink: '#FFFFFF' }[tone]
  const titleTone = { violet: 'cream', cream: 'mustard', coral: 'white', ink: 'ink' }[tone]
  return (
    <div className={`hdr ${className}`}>
      <button className={`hdr-back on-${tone}`} onClick={onBack} aria-label="Back">
        <ChevronLeft color={chevron} />
      </button>
      {title && <h1 className={`display hdr-title ${titleTone}`}>{title}</h1>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  SET CELL — shared by the logging screen and Exercise History
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
        // No RPE logged — invite the tap that fixes it.
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
//  FEEL SLIDER — 341x64, ten colour stops, CONTINUOUS (never snaps).
//  The label rides on the track and reports whichever zone the centre
//  of the knob currently sits over.
// ════════════════════════════════════════════════════════════════════
function FeelSlider({ value, onChange }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const setFromClientX = (clientX) => {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const half = 32           // the knob is 64px, so its centre travels inset by 32
    const usable = r.width - 64
    const x = Math.min(r.width - half, Math.max(half, clientX - r.left))
    onChange(usable <= 0 ? 0 : (x - half) / usable)
  }

  const onDown = (e) => {
    e.preventDefault()
    setDragging(true)
    setFromClientX(e.clientX)
    const move = (ev) => setFromClientX(ev.clientX)
    const up = () => {
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const pct = value == null ? 0 : value
  const rpe = feelToRpe(value)
  const failure = isFailure(rpe)
  // The rating rides on the knob. Only when untouched does the track
  // show the prompt.
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
//  SET WIDGET
// ════════════════════════════════════════════════════════════════════
function SetWidget({ num, isWarmup, lastSet, existing, onDone }) {
  // In edit mode `existing` carries the previously-logged values.
  const [weight, setWeight] = useState(
    existing ? existing.weight : (lastSet?.weight ?? null))
  const [reps, setReps] = useState(
    existing ? existing.reps : (isWarmup ? null : (lastSet?.reps ?? null)))
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

      <div className="sw-feel">
        <FeelSlider value={feel} onChange={setFeel} />
      </div>

      <div className="sw-footer">
        <button className="done-btn" disabled={weight === null || reps === null}
          onClick={() => onDone({ weight, reps, feel, rpe: feelToRpe(feel), isWarmup })}>
          {editing ? 'Save' : 'Done'}
        </button>
      </div>
    </div>
  )
}

function LoggingSheet({ setNum, isWarmup, lastSet, existing, onDone, onClose }) {
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
          existing={existing} onDone={onDone} />
      </div>
    </div>
  )
}

function PauseSheet({ onCancel, onConfirm }) {
  return (
    <div className="sheet-overlay" onClick={onCancel}>
      <div className="log-sheet pause-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2 className="display pause-title">Pause the workout?</h2>
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

// ════════════════════════════════════════════════════════════════════
//  EXERCISE LOGGING SCREEN
//  Progress bar: name → [laterality toggle | history] → pips →
//  count + [prev | pause | next]. Everything below sits on a darker
//  coral panel for visual chunking.
// ════════════════════════════════════════════════════════════════════
function LoggingScreen({
  exercise, exIdx, exercises, sets, doneFlags, laterality, lastTime,
  onAddSet, onEditSet, onToggleLaterality, onGo, onNext, onPause, onHistory, isLastRemaining,
}) {
  // sheet = { mode: 'add'|'edit', isWarmup, setNum, index?, existing? }
  const [sheet, setSheet] = useState(null)
  const [pausing, setPausing] = useState(false)

  const workingCount = sets.filter(s => !s.isWarmup).length
  const lastForNextSet = lastTime && lastTime[workingCount] ? lastTime[workingCount] : null

  // Tapping a logged set opens the sheet pre-filled so it can be edited
  // — the common case is adding an RPE the user forgot on the way past.
  const editSet = (index) => {
    const s = sets[index]
    // Which working-set number is this (for the sheet's title)?
    let n = 0
    for (let i = 0; i <= index; i++) if (!sets[i].isWarmup) n++
    setSheet({ mode: 'edit', isWarmup: s.isWarmup, setNum: n, index, existing: s })
  }

  return (
    <div className="log-screen">
      {/* Fixed header — stays put while the dark area scrolls under it. */}
      <div className="log-progress">
        <h2 className="display log-exercise-name">{exercise.name}</h2>

        <div className="log-tools">
          <button className="lat-btn" onClick={onToggleLaterality}>
            {laterality}
            {laterality === 'Unilateral' ? <Unilateral /> : <Bilateral />}
          </button>
          <button className="log-sq" onClick={onHistory} aria-label="Exercise history">
            <History color="#FFFFFF" />
          </button>
        </div>

        {/* A skipped, unfinished exercise stays dark — only completed
            ones and the current one get a white fill. */}
        <div className="log-pips">
          {exercises.map((_, i) => (
            <span key={i}
              className={`log-pip ${(doneFlags[i] || i === exIdx) ? 'done' : 'pending'}`} />
          ))}
        </div>

        <div className="log-nav">
          <span className="log-exercise-count">
            Exercise {exIdx + 1} of {exercises.length}
          </span>
          <div className="log-nav-btns">
            <button className="log-round" onClick={() => onGo(exIdx - 1)}
              disabled={exIdx === 0} aria-label="Previous exercise">
              <SmallChevronLeft color="#FFFFFF" />
            </button>
            <button className="log-round" onClick={() => setPausing(true)} aria-label="Pause workout">
              <Pause color="#FFFFFF" />
            </button>
            <button className="log-round" onClick={() => onGo(exIdx + 1)}
              disabled={exIdx === exercises.length - 1} aria-label="Next exercise">
              <SmallChevronRight color="#FFFFFF" />
            </button>
          </div>
        </div>
      </div>

      {/* Only this dark area scrolls, and only when the content needs it. */}
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

      {workingCount > 0 && !sheet && !pausing && (
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
          onDone={(s) => {
            if (sheet.mode === 'edit') onEditSet(sheet.index, s)
            else onAddSet({ id: uid(), ...s })
            setSheet(null)
          }}
          onClose={() => setSheet(null)} />
      )}

      {pausing && <PauseSheet onCancel={() => setPausing(false)} onConfirm={onPause} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  EXERCISE HISTORY
// ════════════════════════════════════════════════════════════════════
function ExerciseHistory({ exercise, sessions, onBack }) {
  return (
    <div className="hist-screen">
      <div className="hdr">
        <button className="hdr-back on-ink" onClick={onBack} aria-label="Back">
          <ChevronLeft color="#FFFFFF" />
        </button>
      </div>
      <div className="hist-head">
        <span className="row-label on-cream">Exercise History</span>
        <h1 className="display hist-title">{exercise.name}</h1>
      </div>
      <div className="hist-divider" />
      <div className="hist-scroll">
        {sessions.length === 0 && (
          <p className="hist-empty">
            No sessions logged yet. Finish a workout with this exercise and it'll show up here.
          </p>
        )}
        {sessions.map((s, i) => (
          <div key={i}>
            <div className="hist-date">
              <span className="row-label on-cream">
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
//  TODAY'S PLAN — pills are coral fill + 2px white outline, no graphic
// ════════════════════════════════════════════════════════════════════
function TodaysPlan({ workout, exercises, onGo, onBack }) {
  return (
    <div className="plan-screen">
      <img className="plan-body-art" src={planBodyArt} alt="" aria-hidden="true" />

      <div className="plan-content">
        <button className="plan-back" onClick={onBack} aria-label="Back">
          <ChevronLeft color="#6C5CE7" />
        </button>
        <div className="plan-head">
          <p className="plan-eyebrow">Today's Plan</p>
          <h1 className="display plan-title">{workout.name}</h1>
        </div>
        <div className="plan-list">
          {exercises.map((ex, i) => (
            <div className="plan-row" key={ex.id}>
              <span className="plan-num">{i + 1}</span>
              <span className="plan-pill">
                <span className="plan-pill-name">{ex.name}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="plan-footer">
        <p className="plan-meta">
          {workout.timesCompleted === 0
            ? 'First time doing this workout'
            : `Workout completed ${workout.timesCompleted} time${workout.timesCompleted === 1 ? '' : 's'}`}
        </p>
        <button className="plan-go" onClick={onGo}>Let's Go <ArrowRight /></button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  START PAGE
// ════════════════════════════════════════════════════════════════════
function StartPage({ week, workoutsById, pausedWorkoutId, onTapDay, onStartToday, onResume, onHistory }) {
  const today = todayIdx()
  const todayWorkoutId = week[today]
  const hasToday = todayWorkoutId != null
  const isPausedToday = hasToday && pausedWorkoutId === todayWorkoutId
  const order = [1, 2, 3, 4, 5, 6, 0]

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

      <div className="cal-grid">
        {order.map(d => {
          const wid = week[d]
          const wk = wid ? workoutsById[wid] : null
          const isToday = d === today
          const isRest = wid === null
          const isUnset = wid === undefined
          const showResume = isToday && isPausedToday
          return (
            <button key={d} className={`cal-cell ${isToday ? 'today' : ''} ${!isUnset ? 'filled' : ''}`}
              onClick={() => onTapDay(d)}>
              <span className="cal-day-row">
                <span className="cal-day">{DAYS_SHORT[d]}</span>
                {isToday && (showResume ? <Resume color="#F5B82E" /> : <span className="cal-pip" />)}
              </span>
              <span className={`cal-label ${isUnset || isRest ? 'small' : ''}`}>
                {isUnset ? 'ADD A WORKOUT' : isRest ? 'REST' : wk.name}
              </span>
            </button>
          )
        })}
      </div>

      {hasToday && (
        <button className="start-cta"
          onClick={() => (isPausedToday ? onResume() : onStartToday(todayWorkoutId))}>
          {isPausedToday ? "Resume Today's Workout" : "Start Today's Workout"}
        </button>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  CHOOSE A WORKOUT — violet is now confined to the top zone; the list
//  below is a flat cream panel of full-bleed cells, not floating cards.
// ════════════════════════════════════════════════════════════════════
function WorkoutSelection({ workouts, exerciseMap, onPick, onRest, onCreate, onBack }) {
  return (
    <div className="sel-screen">
      <div className="sel-top-zone">
        <Header title="Choose a Workout" onBack={onBack} tone="violet" />
        <div className="sel-quick-row">
          <button className="sel-quick rest" onClick={onRest}>
            <span className="sel-quick-name">Rest Day</span>
            <ChevronRight color="#F4EFE6" />
          </button>
          <button className="sel-quick create" onClick={onCreate}>
            <span className="sel-quick-name">Create a workout</span>
            <Plus color="#FFFFFF" />
          </button>
        </div>
      </div>

      <div className="sel-panel">
        {workouts.length > 0 && (
          <div className="sel-panel-label">
            <span className="row-label on-panel">Your Workout List</span>
          </div>
        )}
        {workouts.map(w => {
          const muscles = workoutMuscles(w, exerciseMap)
          return (
            <button key={w.id} className="sel-cell" onClick={() => onPick(w.id)}>
              <span className="sel-cell-info">
                <span className="list-name">{w.name}</span>
                <span className="list-sub">
                  {w.exerciseIds.length} Exercise{w.exerciseIds.length === 1 ? '' : 's'} • {musclesSummary(muscles)}
                </span>
              </span>
              <ChevronRight color="#000000" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  CREATE A WORKOUT
// ════════════════════════════════════════════════════════════════════
function CreateWorkout({ draft, exerciseMap, onNameChange, onAddExercise, onSave, onBack }) {
  const named = draft.name.trim().length > 0
  const nameRef = useRef(null)
  return (
    <div className="cw-screen">
      <div className="cw-scroll">
        <Header title="Create a Workout" onBack={onBack} tone="cream" />

        <div className="cw-section">
          <span className="row-label on-cream">Workout Name</span>
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
        </div>

        <div className="cw-section">
          <span className="row-label on-cream">Exercise List</span>
          <div className="cw-ex-list">
            {draft.exerciseIds.map((id, i) => {
              const ex = exerciseMap[id]
              if (!ex) return null
              return (
                <div className="cw-ex-card" key={`${id}-${i}`}>
                  <span className="cw-ex-name">{ex.name}</span>
                </div>
              )
            })}
            <button className="dashed-row" onClick={onAddExercise}>
              <span className="dashed-row-name">Add an Exercise</span>
              <Plus color="#BDBDBD" />
            </button>
          </div>
        </div>
      </div>

      {named && draft.exerciseIds.length > 0 && (
        <div className="cw-footer">
          <button className="cw-save" onClick={onSave}>Save Workout</button>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  CHOOSE AN EXERCISE
// ════════════════════════════════════════════════════════════════════
function ChooseExercise({ exercises, mode = 'pick', onPick, onCreateNew, onBack }) {
  const byMuscle = useMemo(() => {
    const m = {}
    for (const ex of exercises) (m[ex.muscle] ||= []).push(ex)
    return m
  }, [exercises])
  const groupsPresent = MUSCLE_GROUPS.filter(m => byMuscle[m])
  const [expanded, setExpanded] = useState({})
  const toggle = (m) => setExpanded(e => ({ ...e, [m]: !e[m] }))

  return (
    <div className="ce-screen">
      <Header title={mode === 'history' ? 'Exercise History' : 'Choose an Exercise'}
        onBack={onBack} tone="violet" className="ce-header" />

      <div className="ce-panel">
        {mode === 'pick' && (
          <div className="ce-add-wrap">
            <button className="dashed-row" onClick={onCreateNew}>
              <span className="dashed-row-name">Create a new exercise</span>
              <Plus color="#BDBDBD" />
            </button>
          </div>
        )}

        {groupsPresent.length > 0 && (
          <>
            <div className="ce-label-row">
              <span className="row-label on-white">Your Exercises</span>
            </div>
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
                    {isOpen ? <ChevronUp color="#000000" /> : <ChevronDown color="#000000" />}
                  </button>
                  {isOpen && list.map(ex => (
                    <button key={ex.id} className="ce-row" onClick={() => onPick(ex.id)}>
                      <span className="ce-badge"><QuestionMark color="#FFFFFF" /></span>
                      <span className="ce-row-name">{ex.name}</span>
                      <ArrowRight color="#000000" />
                    </button>
                  ))}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  CREATE AN EXERCISE — step 1: muscle group
// ════════════════════════════════════════════════════════════════════
function ChooseMuscle({ onPick, onBack }) {
  return (
    <div className="cm-screen">
      <Header title="Create an Exercise" onBack={onBack} tone="cream" />
      <div className="cm-label">
        <span className="row-label on-white">Choose a Muscle Group</span>
      </div>
      <div className="cm-list">
        {MUSCLE_GROUPS.map(m => (
          <button key={m} className="cm-card" onClick={() => onPick(m)}>
            <MuscleIcon muscle={m} size={60} />
            <span className="cm-name">{m}</span>
            <ChevronRight color="#000000" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  CREATE AN EXERCISE — step 2: name it, note it, done.
//  No equipment type, no laterality, no attachment. Laterality is now
//  chosen on the fly from the logging screen.
// ════════════════════════════════════════════════════════════════════
function ConfigureExercise({ muscle, onSave, onClose, onBack }) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const nameRef = useRef(null)
  const canSave = name.trim().length > 0

  return (
    <div className="cfg-screen">
      <Header title="Create an Exercise" onBack={onBack} tone="coral" />

      <div className="cfg-section">
        <span className="row-label on-coral">New {muscle} Exercise</span>
        <div className="cfg-name-row">
          <input ref={nameRef} className="cfg-name" value={name}
            placeholder="Add a name..." autoFocus
            onChange={e => setName(e.target.value)} />
          {canSave && (
            <button className="icon-btn" aria-label="Edit name"
              onClick={() => nameRef.current?.focus()}>
              <Edit color="#FFFFFF" opacity={0.5} />
            </button>
          )}
        </div>
      </div>

      <div className="cfg-section">
        <span className="row-label on-coral">Notes</span>
        <textarea className="cfg-notes" value={notes} rows={5}
          placeholder="Add a note..." onChange={e => setNotes(e.target.value)} />
      </div>

      <div className="cfg-footer">
        <button className="cfg-close" onClick={onClose}>Close</button>
        <button className="cfg-save" disabled={!canSave}
          onClick={() => onSave({ name: name.trim(), muscle, notes: notes.trim() })}>
          Save
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
//  WORKOUT COMPLETE (mustard)
//  Summary of everything logged, grouped by exercise with collapsed set
//  cells. Two header actions: add more exercises (for when there's gas
//  left in the tank) and share the summary via the native share sheet.
// ════════════════════════════════════════════════════════════════════
function WorkoutComplete({ exercises, loggedSets, laterality, onAddMore, onDone }) {
  // Only exercises that actually have sets belong on the summary.
  const worked = exercises.filter(ex => (loggedSets[ex.id] || []).length > 0)

  const totalSets = worked.reduce(
    (a, ex) => a + (loggedSets[ex.id] || []).filter(s => !s.isWarmup).length, 0)
  const failures = worked.reduce(
    (a, ex) => a + (loggedSets[ex.id] || []).filter(s => isFailure(s.rpe)).length, 0)

  const summaryLine = [
    `${worked.length} exercise${worked.length === 1 ? '' : 's'}`,
    `${totalSets} set${totalSets === 1 ? '' : 's'}`,
    ...(failures > 0 ? [`${failures} to failure`] : []),
  ].join(' · ')

  const buildShareText = () => {
    const lines = ['💪 OVERLOAD — Workout Complete', summaryLine, '']
    for (const ex of worked) {
      lines.push(ex.name.toUpperCase())
      const sets = loggedSets[ex.id] || []
      let n = 0
      for (const s of sets) {
        const tag = s.isWarmup ? 'W' : (isFailure(s.rpe) ? 'Failure' : `RPE ${s.rpe ?? '—'}`)
        const label = s.isWarmup ? 'Warmup' : `Set ${++n}`
        const wr = `${s.weight != null ? `${s.weight} lbs` : 'BW'} × ${s.reps ?? '—'} reps`
        lines.push(`  ${label}: ${wr}  (${tag})`)
      }
      lines.push('')
    }
    return lines.join('\n').trim()
  }

  const onShare = async () => {
    const text = buildShareText()
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Overload — Workout Complete', text })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
      }
    } catch { /* user dismissed the share sheet — nothing to do */ }
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
            const sets = loggedSets[ex.id] || []
            return (
              <div key={ex.id} className="done-ex">
                <div className="done-ex-head">
                  <span className="done-ex-name">{ex.name}</span>
                  <span className="done-ex-sub">{laterality?.toUpperCase() || 'BILATERAL'}</span>
                </div>
                <SetGroup sets={sets} />
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
//  QUICK ADD (violet) — review the extra exercises before diving back
//  into logging. Mirrors Today's Plan: numbered coral pills, plus a
//  dashed row to keep adding. "Let's Go" commits the lineup.
// ════════════════════════════════════════════════════════════════════
function QuickAdd({ ids, exerciseMap, onAddAnother, onGo, onBack }) {
  const items = ids.map(id => exerciseMap[id]).filter(Boolean)
  return (
    <div className="plan-screen">
      <img className="plan-body-art" src={planBodyArt} alt="" aria-hidden="true" />

      <div className="plan-content">
        <button className="plan-back" onClick={onBack} aria-label="Back">
          <ChevronLeft color="#6C5CE7" />
        </button>
        <div className="plan-head">
          <p className="plan-eyebrow">Extra Exercises</p>
          <h1 className="display plan-title">Quick Add</h1>
        </div>

        <div className="plan-list">
          {items.map((ex, i) => (
            <div className="plan-row" key={`${ex.id}-${i}`}>
              <span className="plan-num">{i + 1}</span>
              <span className="plan-pill">
                <span className="plan-pill-name">{ex.name}</span>
              </span>
            </div>
          ))}
          <div className="plan-row">
            <span className="plan-num">{items.length + 1}</span>
            <button className="plan-pill add" onClick={onAddAnother}>
              <span className="plan-pill-name">Add an exercise</span>
              <Plus color="#FFFFFF" />
            </button>
          </div>
        </div>
      </div>

      <div className="plan-footer">
        <button className="plan-go" disabled={items.length === 0} onClick={onGo}>
          Let's Go <ArrowRight />
        </button>
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
  const [workouts, setWorkouts]   = useState(initial.workouts)
  const [week, setWeek]           = useState(initial.week)
  const [history, setHistory]     = useState(initial.history || {})
  const [paused, setPaused]       = useState(initial.paused || null)

  useEffect(() => {
    saveState({ exercises, workouts, week, history, paused })
  }, [exercises, workouts, week, history, paused])

  const exerciseMap  = useMemo(() => Object.fromEntries(exercises.map(e => [e.id, e])), [exercises])
  const workoutsById = useMemo(() => Object.fromEntries(workouts.map(w => [w.id, w])), [workouts])

  const [screen, setScreen] = useState('start')
  const [selDay, setSelDay] = useState(null)
  const [activeWorkoutId, setActiveWorkoutId] = useState(null)
  const [exIdx, setExIdx] = useState(0)

  // One source of truth for the in-flight workout: exerciseId → sets[].
  // Because nothing is held inside the logging screen, jumping between
  // exercises never loses work — which is what makes skipping safe.
  const [loggedSets, setLoggedSets] = useState({})
  const [laterality, setLaterality] = useState('Bilateral')

  const [historyExId, setHistoryExId] = useState(null)
  const [historyReturn, setHistoryReturn] = useState('start')

  const [draft, setDraft] = useState({ name: '', exerciseIds: [] })
  const [pendingMuscle, setPendingMuscle] = useState(null)

  // Exercises added mid-session via "Add More Exercises" on the complete
  // screen. Kept separate so the saved workout template isn't mutated —
  // they only live for this session.
  const [extraExerciseIds, setExtraExerciseIds] = useState([])
  // Exercises staged on the Quick Add screen, not yet committed.
  const [quickAddIds, setQuickAddIds] = useState([])

  const activeWorkout = activeWorkoutId ? workoutsById[activeWorkoutId] : null
  const activeExercises = activeWorkout
    ? [...activeWorkout.exerciseIds, ...extraExerciseIds]
        .map(id => exerciseMap[id]).filter(Boolean)
    : []

  // An exercise is "done" once it has at least one working set.
  const doneFlags = activeExercises.map(ex =>
    (loggedSets[ex.id] || []).some(s => !s.isWarmup))

  const tapDay = (d) => { setSelDay(d); setScreen('selection') }
  const startToday = (wid) => { setActiveWorkoutId(wid); setScreen('plan') }

  const resumeWorkout = () => {
    if (!paused) return
    setActiveWorkoutId(paused.workoutId)
    setExIdx(paused.exIdx)
    setLoggedSets(paused.loggedSets || {})
    setLaterality(paused.laterality || 'Bilateral')
    setExtraExerciseIds([])
    setPaused(null)
    setScreen('logging')
  }

  const pickWorkout = (wid) => {
    if (selDay != null) setWeek(w => ({ ...w, [selDay]: wid }))
    setScreen('start')
  }
  const pickRest = () => {
    if (selDay != null) setWeek(w => ({ ...w, [selDay]: null }))
    setScreen('start')
  }
  const startCreate = () => { setDraft({ name: '', exerciseIds: [] }); setScreen('createWorkout') }

  const saveWorkout = () => {
    const newW = {
      id: uid(), name: draft.name.trim(),
      exerciseIds: draft.exerciseIds, timesCompleted: 0,
    }
    setWorkouts(prev => [...prev, newW])
    if (selDay != null) setWeek(w => ({ ...w, [selDay]: newW.id }))
    setScreen('start')
  }
  const addExerciseToWorkout = (exId) => {
    setDraft(d => ({ ...d, exerciseIds: [...d.exerciseIds, exId] }))
    setScreen('createWorkout')
  }
  const createNewExercise = (ex) => {
    const newEx = { id: uid(), ...ex }
    setExercises(prev => [...prev, newEx])
    setDraft(d => ({ ...d, exerciseIds: [...d.exerciseIds, newEx.id] }))
    setScreen('createWorkout')
  }

  const beginWorkout = () => {
    setExIdx(0); setLoggedSets({}); setLaterality('Bilateral')
    setExtraExerciseIds([]); setScreen('logging')
  }

  // "Add More Exercises" from the complete screen opens the Quick Add
  // review screen. Picks are staged in quickAddIds until the user
  // commits with "Let's Go", at which point they join the session and
  // logging resumes at the first of them.
  const startQuickAdd = () => { setQuickAddIds([]); setScreen('quickAdd') }

  const quickAddPick = (exId) => {
    setQuickAddIds(prev => [...prev, exId])
    setScreen('quickAdd')
  }
  const quickAddNewExercise = (ex) => {
    const newEx = { id: uid(), ...ex }
    setExercises(prev => [...prev, newEx])
    setQuickAddIds(prev => [...prev, newEx.id])
    setScreen('quickAdd')
  }
  const commitQuickAdd = () => {
    if (quickAddIds.length === 0) return
    const firstNewIdx = activeExercises.length  // where the new block begins
    setExtraExerciseIds(prev => [...prev, ...quickAddIds])
    setQuickAddIds([])
    setExIdx(firstNewIdx)
    setScreen('logging')
  }

  const addSet = (s) => {
    const ex = activeExercises[exIdx]
    setLoggedSets(prev => ({ ...prev, [ex.id]: [...(prev[ex.id] || []), s] }))
  }

  // Replace an existing set in place (edit flow), keeping its id.
  const editSet = (index, patch) => {
    const ex = activeExercises[exIdx]
    setLoggedSets(prev => {
      const arr = [...(prev[ex.id] || [])]
      if (!arr[index]) return prev
      arr[index] = { ...arr[index], ...patch }
      return { ...prev, [ex.id]: arr }
    })
  }

  const goToExercise = (i) => {
    if (i < 0 || i >= activeExercises.length) return
    setExIdx(i)
  }

  // "Next Exercise" respects skipping: hunt forward for the next
  // unfinished exercise, then wrap around to pick up anything skipped
  // earlier. The workout only ends when nothing is left.
  const nextExercise = () => {
    for (let i = exIdx + 1; i < activeExercises.length; i++) {
      if (!doneFlags[i]) return setExIdx(i)
    }
    for (let i = 0; i < exIdx; i++) {
      if (!doneFlags[i]) return setExIdx(i)
    }
    setScreen('complete')
  }

  const remainingAfterThis = activeExercises
    .filter((_, i) => i !== exIdx && !doneFlags[i]).length

  const pauseWorkout = () => {
    setPaused({ workoutId: activeWorkoutId, exIdx, loggedSets, laterality })
    setActiveWorkoutId(null)
    setScreen('start')
  }

  const finishWorkout = () => {
    if (activeWorkoutId) {
      setWorkouts(prev => prev.map(w =>
        w.id === activeWorkoutId ? { ...w, timesCompleted: w.timesCompleted + 1 } : w))
    }
    const date = new Date().toISOString()
    setHistory(prev => {
      const next = { ...prev }
      for (const [exId, sets] of Object.entries(loggedSets)) {
        if (!sets || sets.length === 0) continue
        next[exId] = [...(next[exId] || []), { date, laterality, sets }]
      }
      return next
    })
    setExtraExerciseIds([])
    setActiveWorkoutId(null)
    setScreen('start')
  }

  const openHistoryFromLogging = () => {
    setHistoryExId(activeExercises[exIdx].id)
    setHistoryReturn('logging')
    setScreen('history')
  }
  const pickHistoryExercise = (exId) => {
    setHistoryExId(exId)
    setHistoryReturn('historyPicker')
    setScreen('history')
  }

  // ── render ──
  if (screen === 'start') return (
    <StartPage week={week} workoutsById={workoutsById}
      pausedWorkoutId={paused?.workoutId ?? null}
      onTapDay={tapDay} onStartToday={startToday}
      onResume={resumeWorkout} onHistory={() => setScreen('historyPicker')} />
  )

  if (screen === 'selection') return (
    <WorkoutSelection workouts={workouts} exerciseMap={exerciseMap}
      onPick={pickWorkout} onRest={pickRest} onCreate={startCreate}
      onBack={() => setScreen('start')} />
  )

  if (screen === 'createWorkout') return (
    <CreateWorkout draft={draft} exerciseMap={exerciseMap}
      onNameChange={(name) => setDraft(d => ({ ...d, name }))}
      onAddExercise={() => setScreen('chooseExercise')}
      onSave={saveWorkout} onBack={() => setScreen('selection')} />
  )

  if (screen === 'chooseExercise') return (
    <ChooseExercise exercises={exercises} mode="pick"
      onPick={addExerciseToWorkout}
      onCreateNew={() => setScreen('chooseMuscle')}
      onBack={() => setScreen('createWorkout')} />
  )

  if (screen === 'historyPicker') return (
    <ChooseExercise exercises={exercises} mode="history"
      onPick={pickHistoryExercise} onBack={() => setScreen('start')} />
  )

  if (screen === 'chooseMuscle') return (
    <ChooseMuscle onPick={(m) => { setPendingMuscle(m); setScreen('configureExercise') }}
      onBack={() => setScreen('chooseExercise')} />
  )

  if (screen === 'configureExercise') return (
    <ConfigureExercise muscle={pendingMuscle} onSave={createNewExercise}
      onClose={() => setScreen('chooseExercise')}
      onBack={() => setScreen('chooseMuscle')} />
  )

  if (screen === 'plan' && activeWorkout) return (
    <TodaysPlan workout={activeWorkout} exercises={activeExercises}
      onGo={beginWorkout} onBack={() => setScreen('start')} />
  )

  if (screen === 'logging' && activeWorkout) {
    const ex = activeExercises[exIdx]
    if (!ex) return null
    return (
      <LoggingScreen
        key={ex.id + laterality}
        exercise={ex} exIdx={exIdx} exercises={activeExercises}
        sets={loggedSets[ex.id] || []}
        doneFlags={doneFlags} laterality={laterality}
        lastTime={lastSessionSets(history, ex.id, laterality)}
        isLastRemaining={remainingAfterThis === 0}
        onAddSet={addSet}
        onEditSet={editSet}
        onToggleLaterality={() =>
          setLaterality(l => (l === 'Bilateral' ? 'Unilateral' : 'Bilateral'))}
        onGo={goToExercise}
        onNext={nextExercise}
        onPause={pauseWorkout}
        onHistory={openHistoryFromLogging}
      />
    )
  }

  if (screen === 'history' && historyExId) return (
    <ExerciseHistory exercise={exerciseMap[historyExId]}
      sessions={exerciseSessions(history, historyExId)}
      onBack={() => setScreen(historyReturn)} />
  )

  if (screen === 'quickAdd' && activeWorkout) return (
    <QuickAdd ids={quickAddIds} exerciseMap={exerciseMap}
      onAddAnother={() => setScreen('quickAddPicker')}
      onGo={commitQuickAdd}
      onBack={() => setScreen('complete')} />
  )

  if (screen === 'quickAddPicker') return (
    <ChooseExercise exercises={exercises} mode="pick"
      onPick={quickAddPick}
      onCreateNew={() => setScreen('quickAddMuscle')}
      onBack={() => setScreen('quickAdd')} />
  )

  if (screen === 'quickAddMuscle') return (
    <ChooseMuscle onPick={(m) => { setPendingMuscle(m); setScreen('quickAddConfigure') }}
      onBack={() => setScreen('quickAddPicker')} />
  )

  if (screen === 'quickAddConfigure') return (
    <ConfigureExercise muscle={pendingMuscle}
      onSave={quickAddNewExercise}
      onClose={() => setScreen('quickAddPicker')}
      onBack={() => setScreen('quickAddMuscle')} />
  )

  if (screen === 'complete' && activeWorkout) return (
    <WorkoutComplete exercises={activeExercises}
      loggedSets={loggedSets} laterality={laterality}
      onAddMore={startQuickAdd}
      onDone={finishWorkout} />
  )

  return null
}
