// ═══════════════════════════════════════════════════════════════════
// OVERLOAD — data model
// ═══════════════════════════════════════════════════════════════════

// Muscle groups — order + labels taken verbatim from the Figma
// "Choose a muscle group" frame (201:4084). Legs are now split
// Upper / Lower rather than Front / Rear, and Abs sits before them.
export const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Biceps', 'Triceps', 'Shoulders', 'Forearms',
  'Abs', 'Upper Legs', 'Lower Legs',
]

// Laterality is now a property of the SESSION, not the exercise —
// it's toggled on the fly from the logging screen's progress bar.
export const LATERALITY = ['Bilateral', 'Unilateral']

// ═══════════════════════════════════════════════════════════════════
// THE FEEL SLIDER
// ═══════════════════════════════════════════════════════════════════
// Ten colour stops, sampled exactly from the Figma slider component
// (brown → cream → green → violet, left to right). The slider moves
// CONTINUOUSLY (no snapping). Note the final stop is BRAND VIOLET, not
// green: in this app hitting failure is a GOOD thing — the muscle was
// worked to its limit — so it gets the brand's most positive colour,
// clearly set apart from the greens below it.
export const FEEL_STOPS = [
  '#AC7758', '#C29E89', '#DDC8BC', '#E8DBD1', '#F2EBE2',
  '#E2EBCD', '#CCE5AE', '#B2E089', '#86D375', '#6C5CE7',
]

export const FAILURE_VIOLET = '#6C5CE7'

// feel is stored 0..1 (continuous). Zone = which of the 10 stops the
// knob centre is over.
export function feelZone(feel) {
  if (feel == null) return null
  return Math.min(FEEL_STOPS.length - 1, Math.floor(feel * FEEL_STOPS.length))
}

// The set cell carries a numeric RPE derived from the continuous feel
// value — the slider is smooth, but what gets logged is an RPE 1–10,
// where 10 is failure.
export function feelToRpe(feel) {
  if (feel == null) return null
  return Math.min(10, Math.max(1, Math.round(feel * 9) + 1))
}

// The label shown ON THE KNOB as the user slides. "HOW DID IT FEEL?"
// lives on the empty track; once dragging begins the knob shows the
// rating: RPE 1–9, then FAILURE! at the top of the range.
export function feelKnobLabel(feel) {
  if (feel == null) return null
  const rpe = feelToRpe(feel)
  return rpe >= 10 ? 'FAILURE!' : `RPE ${rpe}`
}

// Is this rating "failure" (the top of the scale)?
export function isFailure(rpe) {
  return rpe != null && rpe >= 10
}

// The colour of the set-cell RPE tag text. Failure is violet — the
// same positive brand colour as the top of the slider. The pale middle
// of the ramp is unreadable on a white pill, so those fall back to grey.
export function rpeColor(rpe) {
  if (rpe == null) return '#C2C2C2'
  if (rpe >= 10) return FAILURE_VIOLET
  const readable = [
    '#AC7758', '#B98A6B', '#8A8A8A', '#8A8A8A', '#8A8A8A',
    '#8A8A8A', '#7CB05A', '#63BE5C', '#4FC06A',
  ]
  return readable[Math.min(8, Math.max(0, rpe - 1))]
}

// ─── Starter exercise library ───────────────────────────────────────
// An exercise is now just { id, name, muscle, notes }. Equipment type,
// laterality and attachment are gone — laterality moved to the logging
// screen toggle, the rest was needless complexity.
export const SEED_EXERCISES = [
  { id: 'ex_chest_fly',     name: 'Seated Cable Chest Fly', muscle: 'Chest', notes: '' },
  { id: 'ex_flat_bench',    name: 'Flat Bench Press',       muscle: 'Chest', notes: '' },
  { id: 'ex_incline_bench', name: 'Incline Bench Press',    muscle: 'Chest', notes: '' },
  { id: 'ex_pushups',       name: 'Push Ups',               muscle: 'Chest', notes: '' },

  { id: 'ex_pullups',      name: 'Pull Ups',      muscle: 'Back', notes: '' },
  { id: 'ex_lat_pulldown', name: 'Lat Pulldown',  muscle: 'Back', notes: '' },
  { id: 'ex_seated_row',   name: 'Seated Row',    muscle: 'Back', notes: '' },
  { id: 'ex_bent_row',     name: 'Bent Over Row', muscle: 'Back', notes: '' },

  { id: 'ex_preacher',   name: 'Preacher Curl',    muscle: 'Biceps', notes: '' },
  { id: 'ex_bajan_curl', name: 'Bajan Cable Curl', muscle: 'Biceps', notes: '' },

  { id: 'ex_tricep_kick', name: 'Tricep Kickbacks', muscle: 'Triceps', notes: '' },
  { id: 'ex_tricep_pull', name: 'Tricep Pulldown',  muscle: 'Triceps', notes: '' },

  { id: 'ex_shoulder_press', name: 'Shoulder Press', muscle: 'Shoulders', notes: '' },
  { id: 'ex_lateral_raise',  name: 'Lateral Raise',  muscle: 'Shoulders', notes: '' },

  { id: 'ex_wrist_curl',   name: 'Wrist Curl',   muscle: 'Forearms', notes: '' },
  { id: 'ex_farmers_walk', name: "Farmer's Walk", muscle: 'Forearms', notes: '' },

  { id: 'ex_hanging_raise', name: 'Hanging Leg Raise', muscle: 'Abs', notes: '' },
  { id: 'ex_cable_crunch',  name: 'Cable Crunch',      muscle: 'Abs', notes: '' },

  { id: 'ex_squat',     name: 'Squat',             muscle: 'Upper Legs', notes: '' },
  { id: 'ex_leg_press', name: 'Leg Press',         muscle: 'Upper Legs', notes: '' },
  { id: 'ex_rdl',       name: 'Romanian Deadlift', muscle: 'Upper Legs', notes: '' },

  { id: 'ex_calf_raise',  name: 'Standing Calf Raise', muscle: 'Lower Legs', notes: '' },
  { id: 'ex_seated_calf', name: 'Seated Calf Raise',   muscle: 'Lower Legs', notes: '' },
]

export const SEED_WORKOUTS = []
export const SEED_WEEK = {}

export function workoutMuscles(workout, exerciseMap) {
  const seen = []
  for (const id of workout.exerciseIds) {
    const ex = exerciseMap[id]
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

export const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

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
// {
//   exercises: [{ id, name, muscle, notes }],
//   workouts:  [{ id, name, exerciseIds, timesCompleted }],
//   week:      { [dayIdx]: workoutId | null },
//   history:   { [exerciseId]: [{ date, laterality, sets }] },  // newest last
//   paused:    { workoutId, exIdx, loggedSets, laterality } | null
// }

const KEY_V2 = 'overload:v2'
const KEY_V1 = 'overload:v1'

// Old saves used Legs - Front / Legs - Rear and carried equipment fields.
function migrateV1(old) {
  const remap = { 'Legs - Front': 'Upper Legs', 'Legs - Rear': 'Lower Legs', 'Legs - Back': 'Lower Legs' }
  return {
    exercises: (old.exercises || []).map(e => ({
      id: e.id,
      name: e.name,
      muscle: remap[e.muscle] || e.muscle,
      notes: e.notes || '',
    })),
    workouts: old.workouts || [],
    week: old.week || {},
    history: old.history || {},
    paused: null,   // an in-flight v1 session can't be replayed against the new shape
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY_V2)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    }
    const legacy = localStorage.getItem(KEY_V1)
    if (legacy) {
      const migrated = migrateV1(JSON.parse(legacy))
      saveState(migrated)
      return migrated
    }
    return null
  } catch {
    return null
  }
}

export function saveState(state) {
  try { localStorage.setItem(KEY_V2, JSON.stringify(state)) } catch { /* ignore */ }
}

// A brand-new install starts completely empty: no exercises, no
// workouts, nothing on the calendar. The user builds their own library
// from scratch. (SEED_EXERCISES is kept only as an internal reference /
// for any future "load starter pack" feature — it is intentionally not
// used here.)
export function freshState() {
  return {
    exercises: [],
    workouts: [],
    week: {},
    history: {},
    paused: null,
  }
}

// Most recent session's working sets for an exercise, MATCHING the
// laterality currently selected — a bilateral curl and a unilateral
// curl are different lifts, so "Set N Last Time" has to compare like
// with like or the suggested weight is meaningless.
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

// All sessions for an exercise, newest FIRST.
export function exerciseSessions(history, exerciseId) {
  const sessions = history?.[exerciseId]
  if (!sessions || sessions.length === 0) return []
  return [...sessions].reverse()
}
