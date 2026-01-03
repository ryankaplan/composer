// Core types for the lead-sheet editor

// Time units: 1 unit = 1/16 note
export type Unit = number;

export type Duration = "1/4" | "1/8" | "1/16";

export type TimeSignature = {
  beatsPerBar: 3 | 4;
  beatUnit: 4;
};

// Key signature (major keys only)
export type KeySignature =
  | "C"
  | "G"
  | "D"
  | "A"
  | "E"
  | "B"
  | "F#"
  | "C#"
  | "F"
  | "Bb"
  | "Eb"
  | "Ab"
  | "Db"
  | "Gb"
  | "Cb";

// List of all supported key signatures in circle-of-fifths order
export const KEY_SIGNATURES: KeySignature[] = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "C#",
  "F",
  "Bb",
  "Eb",
  "Ab",
  "Db",
  "Gb",
  "Cb",
];

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
      tieToNext?: true;
    }
  | { kind: "rest"; id: string; duration: Duration };

// Indices into the melody event sequence.
export type Selection = {
  anchorIdx: number;
  headIdx: number;
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
// Uses crypto.randomUUID() for globally unique, persistence-safe IDs
export function generateEventId(): string {
  return crypto.randomUUID();
}

// Convert MIDI note number to pitch with preferred spelling
export function midiToPitch(
  midi: number,
  preferAccidental: "sharp" | "flat" | "natural" = "sharp"
): Pitch {
  const octave = Math.floor(midi / 12);
  const chroma = midi % 12;

  // Map chroma to letter + accidental
  // Natural notes: C=0, D=2, E=4, F=5, G=7, A=9, B=11
  // Black keys: C#/Db=1, D#/Eb=3, F#/Gb=6, G#/Ab=8, A#/Bb=10
  const naturalNotes: Record<number, PitchLetter> = {
    0: "C",
    2: "D",
    4: "E",
    5: "F",
    7: "G",
    9: "A",
    11: "B",
  };

  if (naturalNotes[chroma]) {
    return {
      letter: naturalNotes[chroma]!,
      accidental: null,
      octave,
    };
  }

  // Black keys - choose spelling based on preference
  if (preferAccidental === "flat") {
    const flatSpellings: Record<
      number,
      { letter: PitchLetter; acc: Accidental }
    > = {
      1: { letter: "D", acc: "b" },
      3: { letter: "E", acc: "b" },
      6: { letter: "G", acc: "b" },
      8: { letter: "A", acc: "b" },
      10: { letter: "B", acc: "b" },
    };
    const spelling = flatSpellings[chroma]!;
    return { letter: spelling.letter, accidental: spelling.acc, octave };
  } else {
    // Default to sharp
    const sharpSpellings: Record<
      number,
      { letter: PitchLetter; acc: Accidental }
    > = {
      1: { letter: "C", acc: "#" },
      3: { letter: "D", acc: "#" },
      6: { letter: "F", acc: "#" },
      8: { letter: "G", acc: "#" },
      10: { letter: "A", acc: "#" },
    };
    const spelling = sharpSpellings[chroma]!;
    return { letter: spelling.letter, accidental: spelling.acc, octave };
  }
}

// Transpose a pitch by a number of semitones
export function transposePitch(pitch: Pitch, semitones: number): Pitch {
  const currentMidi = pitchToMidi(pitch);
  const newMidi = currentMidi + semitones;

  // Prefer the same accidental type if the original had one
  const preferAccidental = pitch.accidental === "b" ? "flat" : "sharp";

  return midiToPitch(newMidi, preferAccidental);
}

// ==================== CHORD TRACK ====================

// A chord region spans time [start, end) with non-overlapping invariant
export type ChordRegion = {
  id: string;
  start: Unit; // inclusive, in 1/16 units
  end: Unit; // exclusive, must be > start
  text: string; // raw chord text (e.g. "CMaj7", "Dm7b5")
};

// Chord track with non-overlapping regions sorted by start
export type ChordTrack = {
  regions: ChordRegion[];
};
