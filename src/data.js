// ═══════════════════════════════════════════════════════════════════
// OVERLOAD — data model
// ═══════════════════════════════════════════════════════════════════
// Colour semantics: cream = planning, violet = workouts/plans,
// red = exercises.

export const MUSCLE_GROUPS = [
  'Chest', 'Shoulders', 'Biceps', 'Triceps', 'Back',
  'Upper Legs', 'Lower Legs', 'Abs', 'Forearms',
]

// ─── equipment ──────────────────────────────────────────────────────
// Two families, matching the filter sheet in Figma. An exercise picks
// exactly one; it's half of the "CHEST · CABLE" line shown everywhere.
export const EQUIPMENT_GROUPS = [
  { label: 'FREEWEIGHTS', items: ['Bar', 'Dumbbell', 'Plates', 'Bodyweight'] },
  { label: 'MACHINE', items: ['Cable Machine', 'Smith Machine', 'Specialized Machine'] },
]
export const EQUIPMENT = EQUIPMENT_GROUPS.flatMap(g => g.items)

// "CHEST · CABLE" — the line under an exercise name.
export function detailLine(muscle, equipment) {
  return [muscle, equipment].filter(Boolean).join(' · ').toUpperCase()
}
// "Chest • Cable" — sentence-case variant used in list rows.
export function detailLineSoft(muscle, equipment) {
  return [muscle, equipment].filter(Boolean).join(' • ')
}

// ═══════════════════════════════════════════════════════════════════
// THE FEEL SLIDER
// ═══════════════════════════════════════════════════════════════════
// Ten stops ramping from pale lilac to brand violet. The last stop is
// failure — the good end of the scale — and the knob turns into a
// violet circle with an F when it lands there.
export const FEEL_STOPS = [
  '#C8C4E7', '#BEB9E7', '#B4ADE7', '#AAA2E7', '#9F96E7',
  '#958BE7', '#8B7FE7', '#8174E7', '#7768E7', '#6C5CE7',
]
export const FAILURE_VIOLET = '#6C5CE7'

export function feelToRpe(feel) {
  if (feel == null) return null
  return Math.min(10, Math.max(1, Math.round(feel * 9) + 1))
}
export function feelKnobLabel(feel) {
  if (feel == null) return null
  const rpe = feelToRpe(feel)
  return rpe >= 10 ? 'F' : String(rpe)
}
export function isFailure(rpe) { return rpe != null && rpe >= 10 }

// Colour of the RPE pill text — the purple ramp, darkened enough to
// stay readable on the white tag.
export function rpeColor(rpe) {
  if (rpe == null) return '#C2C2C2'
  if (rpe >= 10) return FAILURE_VIOLET
  const readable = [
    '#9B96C4', '#948EC6', '#8D86C8', '#867ECA', '#7F76CC',
    '#786ECE', '#7166D0', '#6A5ED2', '#8174E7',
  ]
  return readable[Math.min(8, Math.max(0, rpe - 1))]
}

// ═══════════════════════════════════════════════════════════════════
// SHAPES
// ═══════════════════════════════════════════════════════════════════
// Exercise: { id, name, muscle, equipment }
// Workout:  { id, name, items: [{ exId, sets, reps }], timesCompleted }
// Plan:     { id, name, days, slots: [workoutId|null], startDate }
//   `slots` is one entry per day of the rotation; null means a rest
//   day. The rotation repeats end-on-end from startDate.

export const DEFAULT_TARGET_SETS = 3
export const DEFAULT_GOAL_REPS = 8
export const PLAN_MIN_DAYS = 1
export const PLAN_MAX_DAYS = 10
export const PLAN_DEFAULT_DAYS = 7

export function makeItem(exId, sets = DEFAULT_TARGET_SETS, reps = DEFAULT_GOAL_REPS) {
  return { exId, sets, reps }
}

// A workout can legitimately contain the same exercise twice (e.g. bench
// early, then more bench at the end). Logged sets are therefore keyed by
// SLOT, not by exercise id — otherwise the second appearance would
// inherit the first one's sets. `slotId` is assigned when a session
// starts and when slots are added mid-workout.
export function withSlotIds(items) {
  return items.map(it => ({ ...it, slotId: it.slotId || newSlotId() }))
}

let slotCounter = 0
export function newSlotId() {
  slotCounter += 1
  return `slot-${Date.now().toString(36)}-${slotCounter}`
}

export const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
export const MONTHS_LONG = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY',
  'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

// ─── plan helpers ───────────────────────────────────────────────────
const DAY_MS = 86400000

// Same calendar day?
export function sameDay(a, b) {
  const x = new Date(a), y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth()
    && x.getDate() === y.getDate()
}

// Build a Sun-first month grid for the month containing `date`. Returns
// rows of 7 cells; leading/trailing blanks are null.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const startDow = first.getDay()               // 0=Sun
  const daysIn = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysIn; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const rows = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

function midnight(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }

// Which slot of the rotation lands on `when`. The plan repeats forever
// from its start date, so this is just a modulo of elapsed days.
export function planDayIndex(plan, when = new Date()) {
  if (!plan || !plan.days) return 0
  const start = plan.startDate ? midnight(plan.startDate) : midnight(when)
  const elapsed = Math.floor((midnight(when) - start) / DAY_MS)
  return ((elapsed % plan.days) + plan.days) % plan.days
}
export function planTodayWorkoutId(plan, when = new Date()) {
  if (!plan) return null
  return plan.slots?.[planDayIndex(plan, when)] ?? null
}

export function workoutMuscles(workout, exerciseMap) {
  const seen = []
  for (const it of workout?.items || []) {
    const ex = exerciseMap[it.exId]
    if (ex && !seen.includes(ex.muscle)) seen.push(ex.muscle)
  }
  return seen
}

// "7 Exercises • Chest, Biceps, Triceps"
export function workoutSummaryLine(workout, exerciseMap) {
  const n = (workout?.items || []).length
  const muscles = workoutMuscles(workout, exerciseMap)
  const count = `${n} Exercise${n === 1 ? '' : 's'}`
  return muscles.length ? `${count} • ${muscles.join(', ')}` : count
}

export function formatHistoryDate(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).toUpperCase()
}

// "6 EXERCISES • 24 SETS • 5 TO FAILURE" — the red summary line under a
// completed session, built from a workoutLog entry.
export function sessionSummaryLine(entry) {
  const exCount = entry.exercises.length
  let sets = 0, failures = 0
  for (const e of entry.exercises) {
    for (const s of e.sets) {
      if (s.isWarmup) continue
      sets += 1
      if (isFailure(s.rpe)) failures += 1
    }
  }
  const parts = [
    `${exCount} EXERCISE${exCount === 1 ? '' : 'S'}`,
    `${sets} SET${sets === 1 ? '' : 'S'}`,
  ]
  if (failures > 0) parts.push(`${failures} TO FAILURE`)
  return parts.join(' • ')
}

// All completed sessions for one workout id, newest first.
export function workoutHistory(log, workoutId) {
  return (log || []).filter(e => e.workoutId === workoutId)
}

// Dashboard stats for the active plan card. Values are derived from the
// workout log and the plan's start date:
//  - streak: completed workouts logged since the plan started
//  - dayNumber / totalDays: elapsed days out of the plan's length
//  - failures: total sets taken to failure across the plan
// (planLength is a placeholder until an end-date setting exists; we use
// the rotation length × a default number of cycles.)
export function planStats(plan, log) {
  if (!plan) return { streak: 0, dayNumber: 0, totalDays: 0, pct: 0, failures: 0 }
  const startMs = plan.startDate ? midnight(plan.startDate) : midnight(new Date())
  const elapsed = Math.max(0, Math.floor((midnight(new Date()) - startMs) / DAY_MS)) + 1
  const totalDays = plan.totalDays || plan.days * 8
  const dayNumber = Math.min(elapsed, totalDays)
  const pct = totalDays > 0 ? Math.round((dayNumber / totalDays) * 100) : 0

  // Sessions logged on or after the plan start, tallied for streak +
  // failure count.
  const since = (log || []).filter(e => midnight(e.date) >= startMs)
  const streak = since.length
  let failures = 0
  for (const e of since) {
    for (const ex of e.exercises) {
      for (const s of ex.sets) if (!s.isWarmup && isFailure(s.rpe)) failures += 1
    }
  }
  return { streak, dayNumber, totalDays, pct, failures }
}

// ═══════════════════════════════════════════════════════════════════
// SEED EXERCISE LIBRARY
// ═══════════════════════════════════════════════════════════════════
// The default exercise library: movements grouped by muscle, each with
// the equipment variations it's commonly performed on. The same movement
// on different equipment is a separate entry, because the loading and the
// progression are genuinely different.
const SEED = {
  'Chest': [
    ['Flat Bench Press', 'Bar'], ['Flat Bench Press', 'Dumbbell'],
    ['Flat Bench Press', 'Smith Machine'], ['Flat Bench Press', 'Specialized Machine'],
    ['Incline Bench Press', 'Bar'], ['Incline Bench Press', 'Dumbbell'],
    ['Incline Bench Press', 'Smith Machine'], ['Incline Bench Press', 'Specialized Machine'],
    ['Chest Fly / Pec Deck', 'Dumbbell'], ['Chest Fly / Pec Deck', 'Cable Machine'],
    ['Chest Fly / Pec Deck', 'Specialized Machine'],
    ['Push-Up', 'Bodyweight'], ['Push-Up', 'Dumbbell'],
    ['Chest Dip', 'Bodyweight'], ['Chest Dip', 'Specialized Machine'],
    ['Decline Bench Press', 'Bar'], ['Decline Bench Press', 'Dumbbell'],
    ['Decline Bench Press', 'Smith Machine'],
  ],
  'Shoulders': [
    ['Overhead Press', 'Bar'], ['Overhead Press', 'Dumbbell'],
    ['Overhead Press', 'Smith Machine'], ['Overhead Press', 'Specialized Machine'],
    ['Lateral Raise', 'Dumbbell'], ['Lateral Raise', 'Cable Machine'],
    ['Lateral Raise', 'Specialized Machine'],
    ['Front Raise', 'Dumbbell'], ['Front Raise', 'Plates'],
    ['Rear Delt Fly / Reverse Pec Deck', 'Dumbbell'],
    ['Rear Delt Fly / Reverse Pec Deck', 'Cable Machine'],
    ['Rear Delt Fly / Reverse Pec Deck', 'Specialized Machine'],
    ['Upright Row', 'Bar'], ['Upright Row', 'Cable Machine'],
    ['Shrugs', 'Bar'], ['Shrugs', 'Dumbbell'], ['Shrugs', 'Specialized Machine'],
  ],
  'Biceps': [
    ['Bicep Curl', 'Bar'], ['Bicep Curl', 'Dumbbell'], ['Bicep Curl', 'Cable Machine'],
    ['Hammer Curl', 'Dumbbell'], ['Hammer Curl', 'Cable Machine'],
    ['Preacher Curl', 'Bar'], ['Preacher Curl', 'Dumbbell'],
    ['Preacher Curl', 'Specialized Machine'],
    ['Concentration Curl', 'Dumbbell'],
    ['Incline Dumbbell Curl', 'Dumbbell'],
    ['Cable Curl', 'Cable Machine'],
  ],
  'Triceps': [
    ['Tricep Pushdown', 'Cable Machine'],
    ['Skull Crusher / Lying Tricep Extension', 'Bar'],
    ['Skull Crusher / Lying Tricep Extension', 'Dumbbell'],
    ['Skull Crusher / Lying Tricep Extension', 'Cable Machine'],
    ['Overhead Tricep Extension', 'Dumbbell'], ['Overhead Tricep Extension', 'Cable Machine'],
    ['Tricep Dip', 'Bodyweight'], ['Tricep Dip', 'Specialized Machine'],
    ['Close-Grip Bench Press', 'Bar'], ['Close-Grip Bench Press', 'Smith Machine'],
    ['Close-Grip Bench Press', 'Dumbbell'],
    ['Tricep Kickback', 'Dumbbell'], ['Tricep Kickback', 'Cable Machine'],
  ],
  'Back': [
    ['Lat Pulldown', 'Cable Machine'],
    ['Pull-Up / Chin-Up', 'Bodyweight'], ['Pull-Up / Chin-Up', 'Specialized Machine'],
    ['Bent-Over Row', 'Bar'], ['Bent-Over Row', 'Dumbbell'],
    ['Bent-Over Row', 'Smith Machine'], ['Bent-Over Row', 'Cable Machine'],
    ['Seated Cable Row', 'Cable Machine'], ['Seated Cable Row', 'Specialized Machine'],
    ['Single-Arm Row', 'Dumbbell'], ['Single-Arm Row', 'Cable Machine'],
    ['Single-Arm Row', 'Specialized Machine'],
    ['T-Bar Row', 'Specialized Machine'], ['T-Bar Row', 'Cable Machine'],
  ],
  'Abs': [
    ['Crunch', 'Bodyweight'], ['Crunch', 'Cable Machine'], ['Crunch', 'Specialized Machine'],
    ['Leg Raise', 'Bodyweight'], ['Leg Raise', 'Dumbbell'], ['Leg Raise', 'Cable Machine'],
    ['Russian Twist', 'Bodyweight'], ['Russian Twist', 'Dumbbell'], ['Russian Twist', 'Plates'],
    ['Plank', 'Bodyweight'], ['Plank', 'Plates'],
    ['Cable Woodchop', 'Cable Machine'],
    ['Ab Wheel Rollout', 'Specialized Machine'],
  ],
  'Upper Legs': [
    ['Squat', 'Bar'], ['Squat', 'Dumbbell'], ['Squat', 'Smith Machine'],
    ['Squat', 'Specialized Machine'], ['Squat', 'Bodyweight'],
    ['Leg Press', 'Specialized Machine'],
    ['Lunge', 'Dumbbell'], ['Lunge', 'Bar'], ['Lunge', 'Bodyweight'],
    ['Leg Extension', 'Specialized Machine'],
    ['Hamstring Curl', 'Specialized Machine'], ['Hamstring Curl', 'Dumbbell'],
    ['Romanian Deadlift (RDL)', 'Bar'], ['Romanian Deadlift (RDL)', 'Dumbbell'],
    ['Romanian Deadlift (RDL)', 'Specialized Machine'],
  ],
  'Lower Legs': [
    ['Standing Calf Raise', 'Specialized Machine'], ['Standing Calf Raise', 'Smith Machine'],
    ['Standing Calf Raise', 'Dumbbell'],
    ['Seated Calf Raise', 'Specialized Machine'],
    ['Donkey Calf Raise', 'Specialized Machine'], ['Donkey Calf Raise', 'Bodyweight'],
    ['Single-Leg Calf Raise', 'Bodyweight'], ['Single-Leg Calf Raise', 'Dumbbell'],
    ['Single-Leg Calf Raise', 'Smith Machine'],
    ['Tibialis Raise', 'Bodyweight'], ['Tibialis Raise', 'Specialized Machine'],
    ["Farmer's Walk (Calf/Ankle Focus)", 'Dumbbell'],
    ["Farmer's Walk (Calf/Ankle Focus)", 'Plates'],
    ["Farmer's Walk (Calf/Ankle Focus)", 'Specialized Machine'],
  ],
  'Forearms': [
    ['Wrist Curl', 'Bar'], ['Wrist Curl', 'Dumbbell'], ['Wrist Curl', 'Cable Machine'],
    ['Reverse Wrist Curl', 'Bar'], ['Reverse Wrist Curl', 'Dumbbell'],
    ['Reverse Wrist Curl', 'Cable Machine'],
    ["Farmer's Walk", 'Dumbbell'], ["Farmer's Walk", 'Plates'],
    ["Farmer's Walk", 'Specialized Machine'],
    ['Plate Pinch', 'Plates'],
    ['Wrist Roller', 'Specialized Machine'],
    ['Reverse Curl', 'Bar'], ['Reverse Curl', 'Dumbbell'], ['Reverse Curl', 'Cable Machine'],
  ],
}

// Stable ids (`seed-chest-3`) so a library exercise keeps its history
// across app updates instead of being re-created with a random id.
export function seedExercises() {
  const out = []
  for (const muscle of MUSCLE_GROUPS) {
    const slug = muscle.toLowerCase().replace(/\s+/g, '-')
    ;(SEED[muscle] || []).forEach(([name, equipment], i) => {
      out.push({ id: `seed-${slug}-${i}`, name, muscle, equipment })
    })
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════
// SEED WORKOUTS — three ready-made workouts every install starts with
// ═══════════════════════════════════════════════════════════════════
// These are library content, not history: they appear in "My Workouts"
// and the selection/plan flows from first launch, before the user has
// done anything. Each exercise is [name, muscle, equipment] using the
// canonical equipment vocabulary (Cable, Smith Machine, Plate, …).
const SEED_WORKOUTS = [
  {
    id: 'seed-wk-shoulders-back', name: 'Shoulders & Back',
    exercises: [
      ['Overhead Press', 'Shoulders', 'Smith Machine'],
      ['Pull-Up / Chin-Up', 'Back', 'Bodyweight'],
      ['Lateral Raise', 'Shoulders', 'Cable Machine'],
      ['Seated Cable Row', 'Back', 'Cable Machine'],
      ['Rear Delt Fly / Reverse Pec Deck', 'Shoulders', 'Cable Machine'],
      ['Lat Pulldown', 'Back', 'Cable Machine'],
    ],
  },
  {
    id: 'seed-wk-chest-arms', name: 'Chest & Arms',
    exercises: [
      ['Incline Bench Press', 'Chest', 'Smith Machine'],
      ['Pull-Up / Chin-Up', 'Back', 'Bodyweight'],
      ['Tricep Pushdown', 'Triceps', 'Cable Machine'],
      ['Chest Fly / Pec Deck', 'Chest', 'Cable Machine'],
      ['Preacher Curl', 'Biceps', 'Bar'],
      ['Tricep Kickback', 'Triceps', 'Cable Machine'],
      ['Bicep Curl', 'Biceps', 'Cable Machine'],
    ],
  },
  {
    id: 'seed-wk-legs-abs', name: 'Legs & Abs',
    exercises: [
      ['Romanian Deadlift (RDL)', 'Upper Legs', 'Bar'],
      ['Leg Extension', 'Upper Legs', 'Specialized Machine'],
      ['Lunge', 'Upper Legs', 'Dumbbell'],
      ['Standing Calf Raise', 'Lower Legs', 'Specialized Machine'],
      ['Crunch', 'Abs', 'Cable Machine'],
    ],
  },
]

// Find an existing library exercise matching name+muscle+equipment, or
// mint a new one. Returns { exercise, created } so the caller can add
// any freshly-minted exercises to the library.
function resolveExercise(existing, name, muscle, equipment) {
  const key = (n, m, e) => `${m}::${n.trim().toLowerCase()}::${e}`
  const found = existing.find(x => key(x.name, x.muscle, x.equipment) === key(name, muscle, equipment))
  if (found) return { exercise: found, created: null }
  const slug = `${muscle}-${name}-${equipment}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const ex = { id: `seed-x-${slug}`, name, muscle, equipment }
  return { exercise: ex, created: ex }
}

// Build the three seed workouts against a library, adding any exercises
// they reference that aren't present yet. Returns { exercises, workouts }
// so the caller ends up with a consistent pair.
export function seedWorkouts(baseExercises) {
  const exercises = [...baseExercises]
  const workouts = SEED_WORKOUTS.map(w => {
    const items = w.exercises.map(([name, muscle, equipment]) => {
      const { exercise, created } = resolveExercise(exercises, name, muscle, equipment)
      if (created) exercises.push(created)
      return makeItem(exercise.id)
    })
    return { id: w.id, name: w.name, items, timesCompleted: 0 }
  })
  return { exercises, workouts }
}


// ═══════════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════════
const KEY_V5 = 'overload:v5'
export function loadState() {
  try {
    const raw = localStorage.getItem(KEY_V5)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        // Keep the seed library present even for older v5 saves.
        if (!parsed.exercises || parsed.exercises.length === 0) {
          parsed.exercises = seedExercises()
        }
        if (!parsed.workoutLog) parsed.workoutLog = []
        // One-time seeding of the three default workouts.
        if (!parsed.seededWorkouts) {
          const seeded = seedWorkouts(parsed.exercises)
          parsed.exercises = seeded.exercises
          const have = new Set((parsed.workouts || []).map(w => w.id))
          parsed.workouts = [...seeded.workouts.filter(w => !have.has(w.id)), ...(parsed.workouts || [])]
          parsed.seededWorkouts = true
        }
        return parsed
      }
    }
    // The v5 library replaced the entire exercise + equipment vocabulary,
    // so pre-v5 saves aren't migrated — a new install starts fresh with
    // the new library and preset workouts.
    return null
  } catch {
    return null
  }
}

export function saveState(state) {
  try { localStorage.setItem(KEY_V5, JSON.stringify(state)) } catch { /* ignore */ }
}

// A new install gets the seed library AND the three seed workouts, so
// "My Workouts" and the selection flows have content immediately.
export function freshState() {
  const seeded = seedWorkouts(seedExercises())
  return {
    exercises: seeded.exercises,
    workouts: seeded.workouts,
    plan: null,
    history: {},
    workoutLog: [],
    paused: null,
    seededWorkouts: true,
  }
}

// Most recent session's working sets for an exercise — used to seed
// set 1's weight with what you lifted for set 1 last time.
export function lastSessionSets(history, exerciseId) {
  const sessions = history?.[exerciseId]
  if (!sessions || sessions.length === 0) return null
  for (let i = sessions.length - 1; i >= 0; i--) {
    const working = (sessions[i].sets || []).filter(x => !x.isWarmup)
    if (working.length) return working
  }
  return null
}

export function exerciseSessions(history, exerciseId) {
  const sessions = history?.[exerciseId]
  if (!sessions || sessions.length === 0) return []
  return [...sessions].reverse()
}

// ═══════════════════════════════════════════════════════════════════
// MOVEMENTS (variation grouping)
// ═══════════════════════════════════════════════════════════════════
// A "movement" is all the exercises that share a name + muscle but use
// different equipment — e.g. Bicep Curl on cable, dumbbell, barbell.
// The search list shows one row per movement to cut down the number of
// options a user scans; tapping opens the variations.
export function movementKey(ex) {
  return `${ex.muscle}::${ex.name.trim().toLowerCase()}`
}

// Group a flat exercise list into movements, preserving first-seen order.
export function groupMovements(exercises) {
  const map = new Map()
  for (const ex of exercises) {
    const k = movementKey(ex)
    if (!map.has(k)) map.set(k, { key: k, name: ex.name, muscle: ex.muscle, variations: [] })
    map.get(k).variations.push(ex)
  }
  return [...map.values()]
}

// How many recorded (working) sets exist for one exercise variation —
// shown as "40 sets on record" in the variations modal.
export function variationSetCount(history, exerciseId) {
  const sessions = history?.[exerciseId]
  if (!sessions) return 0
  return sessions.reduce((n, s) => n + (s.sets || []).filter(x => !x.isWarmup).length, 0)
}

// ═══════════════════════════════════════════════════════════════════
// WORKOUT HISTORY (logbook timeline)
// ═══════════════════════════════════════════════════════════════════
// Completed workouts are recorded as a flat, reverse-chronological log
// so the Workouts logbook can show a timeline. Each entry snapshots the
// exercises and their sets so it stays accurate even if the workout is
// later edited or deleted.
export function recordCompletedWorkout(log, entry) {
  return [entry, ...(log || [])]
}

export function buzz(ms = 18) {
  try { navigator.vibrate?.(ms) } catch { /* unsupported */ }
}
