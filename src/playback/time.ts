import { MelodyEvent, Unit, durationToUnits } from "../lead-sheet/types";

/**
 * Convert BPM to seconds per unit.
 * 1 unit = 1/16 note
 * Quarter note duration = 60/bpm seconds
 * 1/16 note duration = (60/bpm) / 4 = 60/(bpm*4) seconds
 */
export function secondsPerUnit(bpm: number): number {
  return 60 / (bpm * 4);
}

/**
 * Convert a caret position (insertion index between events) to unit time.
 * 
 * The caret sits "between" events. For example:
 * - caret=0 means before all events (time=0)
 * - caret=1 means after events[0]
 * - caret=events.length means after all events
 * 
 * We compute the cumulative time by summing durations of all events before the caret.
 */
export function caretToUnit(events: MelodyEvent[], caret: number): Unit {
  let currentUnit: Unit = 0;

  for (let i = 0; i < caret && i < events.length; i++) {
    const event = events[i];
    if (event) {
      currentUnit += durationToUnits(event.duration);
    }
  }

  return currentUnit;
}

/**
 * Convert unit time to seconds given a BPM.
 */
export function unitsToSeconds(units: Unit, bpm: number): number {
  return units * secondsPerUnit(bpm);
}

