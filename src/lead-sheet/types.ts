// Core types for the lead-sheet editor

export type Duration = "1/4" | "1/8" | "1/16";

export type TimeSignature = {
  beatsPerBar: 3 | 4;
  beatUnit: 4;
};

export type PitchLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type Accidental = "#" | "b" | null;

export type Pitch = {
  letter: PitchLetter;
  accidental: Accidental;
  octave: number;
};

// MIDI note numbers for pitch letters (C=0, D=2, E=4, F=5, G=7, A=9, B=11)
const PITCH_LETTER_TO_CHROMA: Record<PitchLetter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

// Convert pitch to MIDI note number
export function pitchToMidi(pitch: Pitch): number {
  let midi = pitch.octave * 12 + PITCH_LETTER_TO_CHROMA[pitch.letter];
  if (pitch.accidental === "#") {
    midi += 1;
  } else if (pitch.accidental === "b") {
    midi -= 1;
  }
  return midi;
}

export type MelodyEvent =
  | {
      kind: "note";
      id: string;
      duration: Duration;
      pitch: Pitch;
      chord?: string;
    }
  | { kind: "rest"; id: string; duration: Duration }
  | { kind: "chordAnchor"; id: string; chord: string };

export type Selection = {
  anchor: number;
  focus: number;
} | null;

export type MeasureStatus = "ok" | "under" | "over";

export type Measure = {
  index: number;
  startEventIdx: number;
  endEventIdx: number; // exclusive
  filledUnits: number;
  capacityUnits: number;
  status: MeasureStatus;
};

// Helper to convert duration to units (quarter = 4, eighth = 2, sixteenth = 1)
export function durationToUnits(duration: Duration): number {
  switch (duration) {
    case "1/4":
      return 4;
    case "1/8":
      return 2;
    case "1/16":
      return 1;
  }
}

// Helper to get bar capacity in units
export function getBarCapacity(timeSignature: TimeSignature): number {
  return timeSignature.beatsPerBar * 4; // quarter note = 4 units
}

// Helper to generate unique IDs for events
let nextEventId = 1;
export function generateEventId(): string {
  return `event-${nextEventId++}`;
}
