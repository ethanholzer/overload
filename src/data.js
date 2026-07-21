// ═══════════════════════════════════════════════════════════════════
// OVERLOAD — data model
// ═══════════════════════════════════════════════════════════════════
// Colour semantics used throughout the app:
//   cream  → planning        (calendar, workout creation)
//   violet → workouts        (workout cards, Today's Plan)
//   red    → exercises       (exercise cards, exercise selection, logging)

export const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Biceps', 'Triceps', 'Shoulders', 'Forearms',
  'Abs', 'Upper Legs', 'Lower Legs',
]

// ─── exercise defaults ──────────────────────────────────────────────
// Set when the exercise is created, and overridable per-session from
// the logging screen's Details button.
export const LATERALITY = ['Bilateral', 'Unilateral']
export const SETUPS = ['Machine', 'Freeweight', 'Cables']

export const LATERALITY_BLURB = {
  Bilateral: 'Two-limbed movement: Working both sides at the same time.',
  Unilateral: 'Single-limbed movement: Working one side at a time.',
}

// The red line shown under an exercise name, e.g. "CABLES • BILATERAL".
export function detailLine(setup, laterality) {
  return [setup, laterality].filter(Boolean).join(' • ').toUpperCase()
}

// ═══════════════════════════════════════════════════════════════════
// THE FEEL SLIDER
// ═══════════════════════════════════════════════════════════════════
// Ten stops, sampled from the Figma slider component: a ramp of purple
// shades from pale lilac up to brand violet. The final stop is failure
// — in this app that's the GOOD end of the scale, so it lands on the
// brand's own colour and is drawn as a distinct circle.
export const FEEL_STOPS = [
  '#C8C4E7', '#BEB9E7', '#B4ADE7', '#AAA2E7', '#9F96E7',
  '#958BE7', '#8B7FE7', '#8174E7', '#7768E7', '#6C5CE7',
]

export const FAILURE_VIOLET = '#6C5CE7'

export function feelZone(feel) {
  if (feel == null) return null
  return Math.min(FEEL_STOPS.length - 1, Math.floor(feel * FEEL_STOPS.length))
}

// The slider is continuous, but what gets logged is an RPE 1–10 where
// 10 means failure.
export function feelToRpe(feel) {
  if (feel == null) return null
  return Math.min(10, Math.max(1, Math.round(feel * 9) + 1))
}

// Label shown ON the knob while sliding.
export function feelKnobLabel(feel) {
  if (feel == null) return null
  const rpe = feelToRpe(feel)
  return rpe >= 10 ? 'FAILURE!' : `RPE ${rpe}`
}

export function isFailure(rpe) {
  return rpe != null && rpe >= 10
}

// Colour of the RPE tag on a logged set cell. Failure gets brand violet;
// the rest ramp through the purple scale but darkened enough to stay
// readable on a white pill.
export function rpeColor(rpe) {
  if (rpe == null) return '#C2C2C2'
  if (rpe >= 10) return FAILURE_VIOLET
  const readable = [
    '#9B96C4', '#948EC6', '#8D86C8', '#867ECA', '#7F76CC',
    '#786ECE', '#7166D0', '#6A5ED2', '#6356D4',
  ]
  return readable[Math.min(8, Math.max(0, rpe - 1))]
}

// ═══════════════════════════════════════════════════════════════════
// SHAPES
// ═══════════════════════════════════════════════════════════════════
// Exercise: { id, name, muscle, notes, laterality, setup }
// Workout:  { id, name, items: [{ exId, sets, reps }], timesCompleted }
//   `items` replaced the old flat `exerciseIds` so each exercise can
//   carry its own target set count and goal rep count. The goal reps
//   pre-fill the set widget during the workout to cut down on taps.

export const DEFAULT_TARGET_SETS = 3
export const DEFAULT_GOAL_REPS = 8

export function makeItem(exId, sets = DEFAULT_TARGET_SETS, reps = DEFAULT_GOAL_REPS) {
  return { exId, sets, reps }
}

export const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
export const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function workoutMuscles(workout, exerciseMap) {
  const seen = []
  for (const it of workout.items || []) {
    const ex = exerciseMap[it.exId]
    if (ex && !seen.includes(ex.muscle)) seen.push(ex.muscle)
  }
  return seen
}

export function musclesSummary(muscles) {
  if (muscles.length === 0) return ''
  if (muscles.length === 1) return muscles[0]
  if (muscles.length === 2) return `${muscles[0]} and ${muscles[1]}`
  return muscles.slice(0, -1).join(', ') + ' and ' + muscles[muscles.length - 1]
}

// "3 EXERCISES • CHEST, BACK" — the red summary under a workout name.
export function workoutSummaryLine(workout, exerciseMap) {
  const n = (workout.items || []).length
  const muscles = workoutMuscles(workout, exerciseMap)
  const count = `${n} EXERCISE${n === 1 ? '' : 'S'}`
  return muscles.length ? `${count} • ${muscles.join(', ').toUpperCase()}` : count
}

export function formatHistoryDate(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).toUpperCase()
}

// ═══════════════════════════════════════════════════════════════════
// PERSISTENCE
// ═══════════════════════════════════════════════════════════════════
const KEY_V3 = 'overload:v3'
const KEY_V2 = 'overload:v2'
const KEY_V1 = 'overload:v1'

// v2 stored exercises without defaults and workouts as flat id lists.
function migrateV2(old) {
  return {
    exercises: (old.exercises || []).map(e => ({
      id: e.id,
      name: e.name,
      muscle: e.muscle,
      notes: e.notes || '',
      laterality: e.laterality || 'Bilateral',
      setup: e.setup || 'Machine',
    })),
    workouts: (old.workouts || []).map(w => ({
      id: w.id,
      name: w.name,
      items: w.items || (w.exerciseIds || []).map(id => makeItem(id)),
      timesCompleted: w.timesCompleted || 0,
    })),
    week: old.week || {},
    history: old.history || {},
    paused: null,   // in-flight v2 sessions can't be replayed against the new shape
  }
}

function migrateV1(old) {
  const remap = { 'Legs - Front': 'Upper Legs', 'Legs - Rear': 'Lower Legs', 'Legs - Back': 'Lower Legs' }
  return migrateV2({
    ...old,
    exercises: (old.exercises || []).map(e => ({ ...e, muscle: remap[e.muscle] || e.muscle })),
  })
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY_V3)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    }
    const v2 = localStorage.getItem(KEY_V2)
    if (v2) {
      const migrated = migrateV2(JSON.parse(v2))
      saveState(migrated)
      return migrated
    }
    const v1 = localStorage.getItem(KEY_V1)
    if (v1) {
      const migrated = migrateV1(JSON.parse(v1))
      saveState(migrated)
      return migrated
    }
    return null
  } catch {
    return null
  }
}

export function saveState(state) {
  try { localStorage.setItem(KEY_V3, JSON.stringify(state)) } catch { /* ignore */ }
}

// A brand-new install starts completely empty — no exercises, no
// workouts, nothing on the calendar.
export function freshState() {
  return { exercises: [], workouts: [], week: {}, history: {}, paused: null }
}

// Most recent session's working sets for an exercise, matching the
// laterality in play — a bilateral curl and a unilateral curl are
// different lifts, so the suggested weight has to compare like with like.
export function lastSessionSets(history, exerciseId, laterality) {
  const sessions = history?.[exerciseId]
  if (!sessions || sessions.length === 0) return null
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i]
    if (s.laterality && s.laterality !== laterality) continue
    const working = (s.sets || []).filter(x => !x.isWarmup)
    if (working.length) return working
  }
  return null
}

export function exerciseSessions(history, exerciseId) {
  const sessions = history?.[exerciseId]
  if (!sessions || sessions.length === 0) return []
  return [...sessions].reverse()
}

// ─── haptics ────────────────────────────────────────────────────────
// A short buzz when the user releases the slider on FAILURE. Android
// Chrome honours navigator.vibrate; iOS Safari ignores it silently,
// which is fine — it's a bonus, never load-bearing.
export function buzz(ms = 18) {
  try { navigator.vibrate?.(ms) } catch { /* not supported */ }
}
