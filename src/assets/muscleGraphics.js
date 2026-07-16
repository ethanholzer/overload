// ═══════════════════════════════════════════════════════════════════
// OVERLOAD — muscle → graphics map
// ═══════════════════════════════════════════════════════════════════
// Each muscle group has one circular photo icon (rendered at 60x60 in
// lists). The per-muscle bodymaps are gone: the logging screen now uses
// a single generic red bodymap, which is simpler and reads better.
//
// NOTE: Icon-Triceps_Temp_.png is a placeholder — the file you sent is
// the biceps image. Drop a real triceps icon in at the same path and
// this map needs no change.

import iconChest     from './icons/Icon-Pecs.png'
import iconBack      from './icons/Icon-Back.png'
import iconBiceps    from './icons/Icon-Biceps.png'
import iconTriceps   from './icons/Icon-Triceps_Temp_.png'
import iconShoulders from './icons/Icon-Shoulders.png'
import iconForearms  from './icons/Icon-Forearms.png'
import iconAbs       from './icons/Icon-Abs.png'
import iconUpperLegs from './icons/Icon-UpperLegs.png'
import iconLowerLegs from './icons/Icon-LowerLegs.png'

import genericBodymap from './GenericBodymap.png'

export const MUSCLE_ICONS = {
  'Chest':      iconChest,
  'Back':       iconBack,
  'Biceps':     iconBiceps,
  'Triceps':    iconTriceps,
  'Shoulders':  iconShoulders,
  'Forearms':   iconForearms,
  'Abs':        iconAbs,
  'Upper Legs': iconUpperLegs,
  'Lower Legs': iconLowerLegs,
}

export function muscleIcon(muscle) {
  return MUSCLE_ICONS[muscle] || null
}

// One bodymap for every exercise now.
export const BODYMAP = genericBodymap
