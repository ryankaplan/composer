import { MelodyEvent, Tick, durationToTicks, TICKS_PER_QUARTER } from "../lead-sheet/types";

/**
 * Convert BPM to seconds per tick.
 * Quarter note duration = 60/bpm seconds
 * 1 tick = (60/bpm) / TICKS_PER_QUARTER seconds
 */
export function secondsPerTick(bpm: number): number {
  return 60 / (bpm * TICKS_PER_QUARTER);
}

/**
 * Convert a caret position (insertion index between events) to tick time.
 * 
 * The caret sits "between" events. For example:
 * - caret=0 means before all events (time=0)
 * - caret=1 means after events[0]
 * - caret=events.length means after all events
 * 
 * We compute the cumulative time by summing durations of all events before the caret.
 */
export function caretToTick(events: MelodyEvent[], caret: number): Tick {
  let currentTick: Tick = 0;

  for (let i = 0; i < caret && i < events.length; i++) {
    const event = events[i];
    if (event) {
      currentTick += durationToTicks(event.duration);
    }
  }

  return currentTick;
}

/**
 * Convert tick time to seconds given a BPM.
 */
export function ticksToSeconds(ticks: Tick, bpm: number): number {
  return ticks * secondsPerTick(bpm);
}

