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
 * Convert a tick offset to seconds from the start of the performance,
 * accounting for swing if enabled.
 */
export function tickOffsetToSeconds(
  tickOffset: Tick,
  bpm: number,
  swingEnabled: boolean,
  swingRatio: number
): number {
  const secondsPerQuarter = 60 / bpm;
  const quarterIndex = Math.floor(tickOffset / TICKS_PER_QUARTER);
  const tickInQuarter = tickOffset % TICKS_PER_QUARTER;
  const baseSeconds = quarterIndex * secondsPerQuarter;

  if (!swingEnabled) {
    return baseSeconds + (tickInQuarter / TICKS_PER_QUARTER) * secondsPerQuarter;
  }

  // Swing logic: first 48 ticks (eighth note) take swingRatio of the quarter duration
  if (tickInQuarter < TICKS_PER_QUARTER / 2) {
    const progressInEighth = tickInQuarter / (TICKS_PER_QUARTER / 2);
    return baseSeconds + progressInEighth * (swingRatio * secondsPerQuarter);
  } else {
    const progressInEighth =
      (tickInQuarter - TICKS_PER_QUARTER / 2) / (TICKS_PER_QUARTER / 2);
    return (
      baseSeconds +
      swingRatio * secondsPerQuarter +
      progressInEighth * ((1 - swingRatio) * secondsPerQuarter)
    );
  }
}

/**
 * Convert seconds from the start of the performance to a tick offset,
 * accounting for swing if enabled.
 */
export function secondsToTickOffset(
  seconds: number,
  bpm: number,
  swingEnabled: boolean,
  swingRatio: number
): number {
  const secondsPerQuarter = 60 / bpm;
  const quarterIndex = Math.floor(seconds / secondsPerQuarter);
  const secondsInQuarter = seconds % secondsPerQuarter;
  const baseTicks = quarterIndex * TICKS_PER_QUARTER;

  if (!swingEnabled) {
    return baseTicks + (secondsInQuarter / secondsPerQuarter) * TICKS_PER_QUARTER;
  }

  const firstEighthSeconds = swingRatio * secondsPerQuarter;
  if (secondsInQuarter < firstEighthSeconds) {
    const progressInEighth = secondsInQuarter / firstEighthSeconds;
    return baseTicks + progressInEighth * (TICKS_PER_QUARTER / 2);
  } else {
    const secondEighthSeconds = secondsPerQuarter - firstEighthSeconds;
    const progressInEighth =
      (secondsInQuarter - firstEighthSeconds) / secondEighthSeconds;
    return baseTicks + TICKS_PER_QUARTER / 2 + progressInEighth * (TICKS_PER_QUARTER / 2);
  }
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

