// Core types for the lead-sheet editor

export type Duration = "1/4" | "1/8" | "1/16";

export type TimeSignature = {
  beatsPerBar: 3 | 4;
  beatUnit: 4;
};

export type PitchLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type Accidental = "#" | "b" | null;

// TODO(ryan): don't like redundancy between midi and letter
export type Pitch = {
  midi: number;
  letter: PitchLetter;
  accidental: Accidental;
};

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
