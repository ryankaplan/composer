import {
  MelodyEvent,
  Tick,
  durationToTicks,
  pitchToMidi,
  ChordTrack,
} from "../lead-sheet/types";
import { chordSymbolToMidi } from "./chords-to-midi";

export type MelodyPlaybackEvent = {
  kind: "note" | "rest";
  startTick: Tick;
  durationTicks: Tick;
  midi?: number;
};

export type ChordPlaybackEvent = {
  startTick: Tick;
  durationTicks: Tick;
  midiNotes: number[];
};

export type PlaybackIR = {
  melodyEvents: MelodyPlaybackEvent[];
  chordEvents: ChordPlaybackEvent[];
  endTick: Tick;
};

/**
 * Build a playback IR from a document snapshot.
 * Filters events to only include those starting at or after the caret tick.
 * Merges tied notes into single sustained notes.
 */
export function buildPlaybackIR(
  events: MelodyEvent[],
  caretTick: Tick,
  documentEndTick: Tick,
  chordTrack?: ChordTrack
): PlaybackIR {
  const melodyEvents: MelodyPlaybackEvent[] = [];
  let currentTick: Tick = 0;

  // Build melody events with tie merging
  let i = 0;
  while (i < events.length) {
    const event = events[i]!;
    const eventDuration = durationToTicks(event.duration);

    // Only include events that start at or after the caret
    if (currentTick >= caretTick) {
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
            totalDuration += durationToTicks(nextEvent.duration);
            j++;
          } else {
            break;
          }
        }

        melodyEvents.push({
          kind: "note",
          startTick: currentTick,
          durationTicks: totalDuration,
          midi,
        });

        // Skip the tied notes we just merged
        currentTick += totalDuration;
        i = j;
        continue;
      } else if (event.kind === "rest") {
        melodyEvents.push({
          kind: "rest",
          startTick: currentTick,
          durationTicks: eventDuration,
        });
      }
    }

    currentTick += eventDuration;
    i++;
  }

  // Build chord events
  const chordEvents: ChordPlaybackEvent[] = [];
  if (chordTrack) {
    for (const region of chordTrack.regions) {
      // Only include chords that start at or after the caret
      if (region.start >= caretTick) {
        const midiNotes = chordSymbolToMidi(region.text);
        if (midiNotes.length > 0) {
          chordEvents.push({
            startTick: region.start,
            durationTicks: region.end - region.start,
            midiNotes,
          });
        }
      }
    }
  }

  return {
    melodyEvents,
    chordEvents,
    endTick: documentEndTick,
  };
}
