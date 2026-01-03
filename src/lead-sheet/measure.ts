import {
  MelodyEvent,
  TimeSignature,
  Measure,
  MeasureStatus,
  durationToTicks,
  getBarCapacity,
  pitchToMidi,
  Tick,
} from "./types";

// Compute measures from a flat event list and time signature
export function computeMeasures(
  events: MelodyEvent[],
  timeSignature: TimeSignature
): Measure[] {
  const measures: Measure[] = [];
  const capacityTicks = getBarCapacity(timeSignature);

  let currentMeasureStartIdx = 0;
  let currentFilledTicks = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;

    const eventTicks = durationToTicks(event.duration);

    // Check if adding this event would exceed capacity
    if (currentFilledTicks + eventTicks > capacityTicks) {
      // Close current measure (it's overfull)
      measures.push({
        index: measures.length,
        startEventIdx: currentMeasureStartIdx,
        endEventIdx: i,
        filledTicks: currentFilledTicks,
        capacityTicks,
        status:
          currentFilledTicks < capacityTicks
            ? "under"
            : currentFilledTicks > capacityTicks
            ? "over"
            : "ok",
      });

      // Start new measure with this event
      currentMeasureStartIdx = i;
      currentFilledTicks = eventTicks;
    } else {
      currentFilledTicks += eventTicks;

      // If we've exactly filled the measure, close it and start a new one
      if (currentFilledTicks === capacityTicks) {
        measures.push({
          index: measures.length,
          startEventIdx: currentMeasureStartIdx,
          endEventIdx: i + 1,
          filledTicks: currentFilledTicks,
          capacityTicks,
          status: "ok",
        });

        // Start new measure
        currentMeasureStartIdx = i + 1;
        currentFilledTicks = 0;
      }
    }
  }

  // Close the final measure if there are any remaining events
  if (currentMeasureStartIdx < events.length || currentFilledTicks > 0) {
    const status: MeasureStatus =
      currentFilledTicks === capacityTicks
        ? "ok"
        : currentFilledTicks < capacityTicks
        ? "under"
        : "over";

    measures.push({
      index: measures.length,
      startEventIdx: currentMeasureStartIdx,
      endEventIdx: events.length,
      filledTicks: currentFilledTicks,
      capacityTicks,
      status,
    });
  }

  // If there are no events, create one empty measure
  if (measures.length === 0) {
    measures.push({
      index: 0,
      startEventIdx: 0,
      endEventIdx: 0,
      filledTicks: 0,
      capacityTicks,
      status: "under",
    });
  }

  return measures;
}

// Normalize selection to start/end range
export function normalizeSelection(
  selection: { anchorIdx: number; headIdx: number } | null
): { start: number; end: number } | null {
  if (!selection) {
    return null;
  }
  return {
    start: Math.min(selection.anchorIdx, selection.headIdx),
    end: Math.max(selection.anchorIdx, selection.headIdx),
  };
}

// Find the MIDI note of the previous note at or before the caret
export function findPrevNoteMidi(
  events: MelodyEvent[],
  caret: number
): number | null {
  for (let i = caret - 1; i >= 0; i--) {
    const event = events[i];
    if (event && event.kind === "note") {
      return pitchToMidi(event.pitch);
    }
  }
  return null;
}

// Compute the start time (in ticks) for each melody event
// Returns an array where eventStartTicks[i] is the start time of events[i]
export function computeEventStartTicks(events: MelodyEvent[]): Tick[] {
  const startTicks: Tick[] = [];
  let currentTick: Tick = 0;

  for (const event of events) {
    startTicks.push(currentTick);

    const eventTicks = durationToTicks(event.duration);
    currentTick += eventTicks;
  }

  return startTicks;
}

// Compute the end time (in ticks) of the melody track
export function computeMelodyEndTick(events: MelodyEvent[]): Tick {
  let currentTick: Tick = 0;

  for (const event of events) {
    const eventTicks = durationToTicks(event.duration);
    currentTick += eventTicks;
  }

  return currentTick;
}

// Pad measures with empty measures until they cover the target end tick
export function padMeasuresToEndTick(
  melodyMeasures: Measure[],
  targetEndTick: Tick,
  timeSignature: TimeSignature,
  eventCount: number
): Measure[] {
  const capacityTicks = getBarCapacity(timeSignature);
  const targetMeasureCount = Math.ceil(targetEndTick / capacityTicks);

  if (melodyMeasures.length >= targetMeasureCount) {
    return melodyMeasures;
  }

  const paddedMeasures = [...melodyMeasures];

  for (let i = melodyMeasures.length; i < targetMeasureCount; i++) {
    paddedMeasures.push({
      index: i,
      startEventIdx: eventCount,
      endEventIdx: eventCount,
      filledTicks: 0,
      capacityTicks,
      status: "under",
    });
  }

  return paddedMeasures;
}
