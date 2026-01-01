import {
  MelodyEvent,
  TimeSignature,
  Measure,
  MeasureStatus,
  durationToUnits,
  getBarCapacity,
  pitchToMidi,
  Unit,
} from "./types";

// Compute measures from a flat event list and time signature
export function computeMeasures(
  events: MelodyEvent[],
  timeSignature: TimeSignature
): Measure[] {
  const measures: Measure[] = [];
  const capacityUnits = getBarCapacity(timeSignature);

  let currentMeasureStartIdx = 0;
  let currentFilledUnits = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;

    const eventUnits = durationToUnits(event.duration);

    // Check if adding this event would exceed capacity
    if (currentFilledUnits + eventUnits > capacityUnits) {
      // Close current measure (it's overfull)
      measures.push({
        index: measures.length,
        startEventIdx: currentMeasureStartIdx,
        endEventIdx: i,
        filledUnits: currentFilledUnits,
        capacityUnits,
        status:
          currentFilledUnits < capacityUnits
            ? "under"
            : currentFilledUnits > capacityUnits
            ? "over"
            : "ok",
      });

      // Start new measure with this event
      currentMeasureStartIdx = i;
      currentFilledUnits = eventUnits;
    } else {
      currentFilledUnits += eventUnits;

      // If we've exactly filled the measure, close it and start a new one
      if (currentFilledUnits === capacityUnits) {
        measures.push({
          index: measures.length,
          startEventIdx: currentMeasureStartIdx,
          endEventIdx: i + 1,
          filledUnits: currentFilledUnits,
          capacityUnits,
          status: "ok",
        });

        // Start new measure
        currentMeasureStartIdx = i + 1;
        currentFilledUnits = 0;
      }
    }
  }

  // Close the final measure if there are any remaining events
  if (currentMeasureStartIdx < events.length || currentFilledUnits > 0) {
    const status: MeasureStatus =
      currentFilledUnits === capacityUnits
        ? "ok"
        : currentFilledUnits < capacityUnits
        ? "under"
        : "over";

    measures.push({
      index: measures.length,
      startEventIdx: currentMeasureStartIdx,
      endEventIdx: events.length,
      filledUnits: currentFilledUnits,
      capacityUnits,
      status,
    });
  }

  // If there are no events, create one empty measure
  if (measures.length === 0) {
    measures.push({
      index: 0,
      startEventIdx: 0,
      endEventIdx: 0,
      filledUnits: 0,
      capacityUnits,
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

// Compute the start time (in units) for each melody event
// Returns an array where eventStartUnits[i] is the start time of events[i]
export function computeEventStartUnits(events: MelodyEvent[]): Unit[] {
  const startUnits: Unit[] = [];
  let currentUnit: Unit = 0;

  for (const event of events) {
    startUnits.push(currentUnit);

    const eventUnits = durationToUnits(event.duration);
    currentUnit += eventUnits;
  }

  return startUnits;
}

// Compute the end time (in units) of the melody track
export function computeMelodyEndUnit(events: MelodyEvent[]): Unit {
  let currentUnit: Unit = 0;

  for (const event of events) {
    const eventUnits = durationToUnits(event.duration);
    currentUnit += eventUnits;
  }

  return currentUnit;
}

// Pad measures with empty measures until they cover the target end unit
export function padMeasuresToEndUnit(
  melodyMeasures: Measure[],
  targetEndUnit: Unit,
  timeSignature: TimeSignature,
  eventCount: number
): Measure[] {
  const capacityUnits = getBarCapacity(timeSignature);
  const targetMeasureCount = Math.ceil(targetEndUnit / capacityUnits);

  // If we already have enough measures, return as is
  if (melodyMeasures.length >= targetMeasureCount) {
    return melodyMeasures;
  }

  // Create padded measures
  const paddedMeasures = [...melodyMeasures];

  for (let i = melodyMeasures.length; i < targetMeasureCount; i++) {
    paddedMeasures.push({
      index: i,
      startEventIdx: eventCount,
      endEventIdx: eventCount,
      filledUnits: 0,
      capacityUnits,
      status: "under",
    });
  }

  return paddedMeasures;
}
