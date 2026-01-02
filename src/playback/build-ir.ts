import { MelodyEvent, Unit, durationToUnits, pitchToMidi, ChordTrack } from "../lead-sheet/types";
import { chordSymbolToMidi } from "./chords-to-midi";

export type MelodyPlaybackEvent = {
  kind: "note" | "rest";
  startUnit: Unit;
  durationUnits: Unit;
  midi?: number;
};

export type ChordPlaybackEvent = {
  startUnit: Unit;
  durationUnits: Unit;
  midiNotes: number[];
};

export type PlaybackIR = {
  melodyEvents: MelodyPlaybackEvent[];
  chordEvents: ChordPlaybackEvent[];
  endUnit: Unit;
};

/**
 * Build a playback IR from a document snapshot.
 * Filters events to only include those starting at or after the caret unit.
 * Merges tied notes into single sustained notes.
 */
export function buildPlaybackIR(
  events: MelodyEvent[],
  caretUnit: Unit,
  documentEndUnit: Unit,
  chordTrack?: ChordTrack
): PlaybackIR {
  const melodyEvents: MelodyPlaybackEvent[] = [];
  let currentUnit: Unit = 0;

  // Build melody events with tie merging
  let i = 0;
  while (i < events.length) {
    const event = events[i]!;
    const eventDuration = durationToUnits(event.duration);

    // Only include events that start at or after the caret
    if (currentUnit >= caretUnit) {
      if (event.kind === "note") {
        // Check if this note starts a tie chain
        let totalDuration = eventDuration;
        let midi = pitchToMidi(event.pitch);
        let j = i + 1;

        // Merge tied notes with the same MIDI
        while (j < events.length) {
          const prevEvent = events[j - 1];
          const nextEvent = events[j];

          if (
            prevEvent &&
            prevEvent.kind === "note" &&
            prevEvent.tieToNext &&
            nextEvent &&
            nextEvent.kind === "note" &&
            pitchToMidi(nextEvent.pitch) === midi
          ) {
            totalDuration += durationToUnits(nextEvent.duration);
            j++;
          } else {
            break;
          }
        }

        melodyEvents.push({
          kind: "note",
          startUnit: currentUnit,
          durationUnits: totalDuration,
          midi,
        });

        // Skip the tied notes we just merged
        currentUnit += totalDuration;
        i = j;
        continue;
      } else if (event.kind === "rest") {
        melodyEvents.push({
          kind: "rest",
          startUnit: currentUnit,
          durationUnits: eventDuration,
        });
      }
    }

    currentUnit += eventDuration;
    i++;
  }

  // Build chord events
  const chordEvents: ChordPlaybackEvent[] = [];
  if (chordTrack) {
    for (const region of chordTrack.regions) {
      // Only include chords that start at or after the caret
      if (region.start >= caretUnit) {
        const midiNotes = chordSymbolToMidi(region.text);
        if (midiNotes.length > 0) {
          chordEvents.push({
            startUnit: region.start,
            durationUnits: region.end - region.start,
            midiNotes,
          });
        }
      }
    }
  }

  return {
    melodyEvents,
    chordEvents,
    endUnit: documentEndUnit,
  };
}

