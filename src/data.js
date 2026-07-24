// ═══════════════════════════════════════════════════════════════════
// OVERLOAD — data model
// ═══════════════════════════════════════════════════════════════════
// Colour semantics: cream = planning, violet = workouts/plans,
// red = exercises.

export const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Biceps', 'Triceps', 'Shoulders', 'Forearms',
  'Abs', 'Upper Legs', 'Lower Legs',
]

// ─── equipment ──────────────────────────────────────────────────────
// Two families, matching the filter sheet in Figma. An exercise picks
// exactly one; it's half of the "CHEST · CABLE" line shown everywhere.
export const EQUIPMENT_GROUPS = [
  { label: 'FREEWEIGHTS', items: ['Barbell', 'Dumbbell', 'Plate', 'Other'] },
  { label: 'MACHINE', items: ['Cable', 'Smith Machine', 'Specialized'] },
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

// ═══════════════════════════════════════════════════════════════════
// SEED EXERCISE LIBRARY
// ═══════════════════════════════════════════════════════════════════
// Ten popular movements per muscle group so a new user can build a
// workout immediately instead of typing a library from scratch. The
// same movement at different equipment is a separate entry, because
// the loading and the progression are genuinely different.
const SEED = {
  'Chest': [
    ['Flat Bench Press', 'Barbell'], ['Flat Bench Press', 'Dumbbell'],
    ['Flat Bench Press', 'Smith Machine'], ['Incline Bench Press', 'Barbell'],
    ['Incline Bench Press', 'Dumbbell'], ['Incline Bench Press', 'Smith Machine'],
    ['Pec Deck', 'Specialized'], ['Chest Fly', 'Cable'],
    ['Chest Press', 'Specialized'], ['Push Up', 'Other'],
  ],
  'Back': [
    ['Bent Over Row', 'Barbell'], ['Bent Over Row', 'Dumbbell'],
    ['Lat Pulldown', 'Cable'], ['Seated Cable Row', 'Cable'],
    ['Pull Up', 'Other'], ['Chin Up', 'Other'],
    ['T-Bar Row', 'Barbell'], ['Single Arm Row', 'Dumbbell'],
    ['Straight Arm Pulldown', 'Cable'], ['Deadlift', 'Barbell'],
  ],
  'Biceps': [
    ['Bicep Curl', 'Dumbbell'], ['Bicep Curl', 'Barbell'],
    ['Bicep Curl', 'Cable'], ['Preacher Curl', 'Dumbbell'],
    ['Preacher Curl', 'Barbell'], ['Preacher Curl', 'Specialized'],
    ['Bajan Cable Curl', 'Cable'], ['Hammer Curl', 'Dumbbell'],
    ['Incline Curl', 'Dumbbell'], ['Concentration Curl', 'Dumbbell'],
  ],
  'Triceps': [
    ['Tricep Pushdown', 'Cable'], ['Rope Pushdown', 'Cable'],
    ['Skull Crusher', 'Barbell'], ['Skull Crusher', 'Dumbbell'],
    ['Overhead Extension', 'Dumbbell'], ['Overhead Extension', 'Cable'],
    ['Close Grip Bench Press', 'Barbell'], ['Tricep Kickback', 'Dumbbell'],
    ['Dip', 'Other'], ['Tricep Extension', 'Specialized'],
  ],
  'Shoulders': [
    ['Overhead Press', 'Barbell'], ['Overhead Press', 'Dumbbell'],
    ['Overhead Press', 'Smith Machine'], ['Lateral Raise', 'Dumbbell'],
    ['Lateral Raise', 'Cable'], ['Front Raise', 'Dumbbell'],
    ['Rear Delt Fly', 'Dumbbell'], ['Rear Delt Fly', 'Specialized'],
    ['Upright Row', 'Barbell'], ['Face Pull', 'Cable'],
  ],
  'Forearms': [
    ['Wrist Curl', 'Barbell'], ['Wrist Curl', 'Dumbbell'],
    ['Reverse Wrist Curl', 'Barbell'], ['Reverse Wrist Curl', 'Dumbbell'],
    ['Reverse Curl', 'Barbell'], ['Reverse Curl', 'Cable'],
    ["Farmer's Carry", 'Dumbbell'], ['Plate Pinch', 'Plate'],
    ['Wrist Roller', 'Other'], ['Behind Back Wrist Curl', 'Barbell'],
  ],
  'Abs': [
    ['Cable Crunch', 'Cable'], ['Hanging Leg Raise', 'Other'],
    ['Plank', 'Other'], ['Crunch', 'Other'],
    ['Russian Twist', 'Plate'], ['Decline Sit Up', 'Other'],
    ['Ab Rollout', 'Other'], ['Weighted Sit Up', 'Plate'],
    ['Leg Raise', 'Other'], ['Ab Crunch Machine', 'Specialized'],
  ],
  'Upper Legs': [
    ['Back Squat', 'Barbell'], ['Front Squat', 'Barbell'],
    ['Squat', 'Smith Machine'], ['Leg Press', 'Specialized'],
    ['Romanian Deadlift', 'Barbell'], ['Romanian Deadlift', 'Dumbbell'],
    ['Leg Extension', 'Specialized'], ['Leg Curl', 'Specialized'],
    ['Bulgarian Split Squat', 'Dumbbell'], ['Walking Lunge', 'Dumbbell'],
  ],
  'Lower Legs': [
    ['Standing Calf Raise', 'Specialized'], ['Standing Calf Raise', 'Smith Machine'],
    ['Seated Calf Raise', 'Specialized'], ['Seated Calf Raise', 'Plate'],
    ['Calf Raise', 'Dumbbell'], ['Calf Raise', 'Barbell'],
    ['Leg Press Calf Raise', 'Specialized'], ['Single Leg Calf Raise', 'Other'],
    ['Donkey Calf Raise', 'Other'], ['Tibialis Raise', 'Other'],
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
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════════
const KEY_V4 = 'overload:v4'
const KEY_V3 = 'overload:v3'
const KEY_V2 = 'overload:v2'

// v3 exercises carried laterality + setup; v4 replaces both with a
// single `equipment` value and drops the per-session details override.
const SETUP_TO_EQUIPMENT = {
  'Machine': 'Specialized', 'Freeweight': 'Dumbbell', 'Cables': 'Cable',
}

function migrateV3(old) {
  const seeds = seedExercises()
  const seedIds = new Set(seeds.map(s => s.id))
  const carried = (old.exercises || []).map(e => ({
    id: e.id,
    name: e.name,
    muscle: e.muscle,
    equipment: e.equipment || SETUP_TO_EQUIPMENT[e.setup] || 'Other',
  })).filter(e => !seedIds.has(e.id))
  return {
    exercises: [...seeds, ...carried],
    workouts: (old.workouts || []).map(w => ({
      id: w.id, name: w.name,
      items: w.items || (w.exerciseIds || []).map(id => makeItem(id)),
      timesCompleted: w.timesCompleted || 0,
    })),
    // The old fixed Sun–Sat `week` map has no equivalent in the new
    // rotation-based plan, so plans start empty and the user builds one.
    plan: null,
    history: old.history || {},
    paused: null,
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY_V4)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        // Make sure the seed library is present even for older v4 saves.
        if (!parsed.exercises || parsed.exercises.length === 0) {
          parsed.exercises = seedExercises()
        }
        return parsed
      }
    }
    for (const key of [KEY_V3, KEY_V2]) {
      const older = localStorage.getItem(key)
      if (older) {
        const migrated = migrateV3(JSON.parse(older))
        saveState(migrated)
        return migrated
      }
    }
    return null
  } catch {
    return null
  }
}

export function saveState(state) {
  try { localStorage.setItem(KEY_V4, JSON.stringify(state)) } catch { /* ignore */ }
}

// A new install gets the seed library but no workouts and no plan.
export function freshState() {
  return {
    exercises: seedExercises(),
    workouts: [],
    plan: null,
    history: {},
    paused: null,
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

// A short buzz when the slider is released on failure. Android honours
// this; iOS Safari ignores it silently, which is fine — it's a bonus.
export function buzz(ms = 18) {
  try { navigator.vibrate?.(ms) } catch { /* unsupported */ }
}
