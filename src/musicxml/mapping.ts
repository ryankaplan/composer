// Shared mapping utilities between MusicXML and internal types

import {
  KeySignature,
  Pitch,
  PitchLetter,
  Accidental,
  Duration,
  NoteValue,
  TICKS_PER_QUARTER,
  TimeSignature,
  durationToTicks,
} from "../lead-sheet/types";

// ==================== KEY SIGNATURE MAPPING ====================

// Map MusicXML <fifths> to KeySignature
const FIFTHS_TO_KEY: Record<number, KeySignature> = {
  0: "C",
  1: "G",
  2: "D",
  3: "A",
  4: "E",
  5: "B",
  6: "F#",
  7: "C#",
  "-1": "F",
  "-2": "Bb",
  "-3": "Eb",
  "-4": "Ab",
  "-5": "Db",
  "-6": "Gb",
  "-7": "Cb",
};

const KEY_TO_FIFTHS: Record<KeySignature, number> = {
  C: 0,
  G: 1,
  D: 2,
  A: 3,
  E: 4,
  B: 5,
  "F#": 6,
  "C#": 7,
  F: -1,
  Bb: -2,
  Eb: -3,
  Ab: -4,
  Db: -5,
  Gb: -6,
  Cb: -7,
};

export function fifthsToKeySignature(fifths: number): KeySignature | null {
  return FIFTHS_TO_KEY[fifths] || null;
}

export function keySignatureToFifths(key: KeySignature): number {
  return KEY_TO_FIFTHS[key];
}

// ==================== PITCH MAPPING ====================

export function pitchToMusicXML(pitch: Pitch): {
  step: string;
  alter: number;
  octave: number;
} {
  let alter = 0;
  if (pitch.accidental === "#") {
    alter = 1;
  } else if (pitch.accidental === "b") {
    alter = -1;
  }

  return {
    step: pitch.letter,
    alter,
    octave: pitch.octave,
  };
}

export function musicXMLToPitch(
  step: string,
  alter: number,
  octave: number
): Pitch | null {
  const letter = step.toUpperCase() as PitchLetter;
  if (!["A", "B", "C", "D", "E", "F", "G"].includes(letter)) {
    return null;
  }

  let accidental: Accidental = null;
  if (alter === 1) {
    accidental = "#";
  } else if (alter === -1) {
    accidental = "b";
  } else if (alter !== 0) {
    return null; // unsupported alteration
  }

  return { letter, accidental, octave };
}

// ==================== DURATION MAPPING ====================

// Map base note value to MusicXML <type>
const NOTE_VALUE_TO_TYPE: Record<NoteValue, string> = {
  "1/1": "whole",
  "1/2": "half",
  "1/4": "quarter",
  "1/8": "eighth",
  "1/16": "16th",
};

const TYPE_TO_NOTE_VALUE: Record<string, NoteValue> = {
  whole: "1/1",
  half: "1/2",
  quarter: "1/4",
  eighth: "1/8",
  "16th": "1/16",
};

export function durationToMusicXMLType(duration: Duration): {
  type: string;
  dots: number;
  ticks: number;
} {
  const type = NOTE_VALUE_TO_TYPE[duration.base];
  const ticks = durationToTicks(duration);
  return { type, dots: duration.dots, ticks };
}

export function musicXMLTypeToDuration(
  type: string,
  dots: number
): Duration | null {
  const base = TYPE_TO_NOTE_VALUE[type];
  if (!base) {
    return null;
  }

  if (dots < 0 || dots > 2) {
    return null;
  }

  return { base, dots: dots as 0 | 1 | 2 };
}

// Map ticks to Duration by trying all combinations
export function ticksToDuration(ticks: number): Duration | null {
  const bases: NoteValue[] = ["1/1", "1/2", "1/4", "1/8", "1/16"];
  const dotCounts: (0 | 1 | 2)[] = [0, 1, 2];

  for (const base of bases) {
    for (const dots of dotCounts) {
      const duration: Duration = { base, dots };
      if (durationToTicks(duration) === ticks) {
        return duration;
      }
    }
  }

  return null;
}

// ==================== CHORD/HARMONY MAPPING ====================

// Map MusicXML kind to chord suffix
const KIND_TO_SUFFIX: Record<string, string> = {
  major: "",
  minor: "m",
  augmented: "aug",
  diminished: "dim",
  dominant: "7",
  "major-seventh": "maj7",
  "minor-seventh": "m7",
  "diminished-seventh": "dim7",
  "augmented-seventh": "aug7",
  "half-diminished": "m7b5",
  "major-minor": "m(maj7)",
  "major-sixth": "6",
  "minor-sixth": "m6",
  "dominant-ninth": "9",
  "major-ninth": "maj9",
  "minor-ninth": "m9",
  "dominant-11th": "11",
  "major-11th": "maj11",
  "minor-11th": "m11",
  "dominant-13th": "13",
  "major-13th": "maj13",
  "minor-13th": "m13",
  "suspended-second": "sus2",
  "suspended-fourth": "sus4",
  "Neapolitan": "N",
  Italian: "It",
  French: "Fr",
  German: "Ger",
  pedal: "ped",
  power: "5",
  Tristan: "Tris",
};

const SUFFIX_TO_KIND: Record<string, string> = {
  "": "major",
  m: "minor",
  aug: "augmented",
  "+": "augmented",
  dim: "diminished",
  o: "diminished",
  "7": "dominant",
  maj7: "major-seventh",
  M7: "major-seventh",
  m7: "minor-seventh",
  dim7: "diminished-seventh",
  "aug7": "augmented-seventh",
  "+7": "augmented-seventh",
  m7b5: "half-diminished",
  ø7: "half-diminished",
  "6": "major-sixth",
  m6: "minor-sixth",
  "9": "dominant-ninth",
  maj9: "major-ninth",
  M9: "major-ninth",
  m9: "minor-ninth",
  "11": "dominant-11th",
  maj11: "major-11th",
  m11: "minor-11th",
  "13": "dominant-13th",
  maj13: "major-13th",
  m13: "minor-13th",
  sus2: "suspended-second",
  sus4: "suspended-fourth",
  "7sus4": "suspended-fourth", // approximate
};

// Parse a chord symbol string into components
export function parseChordSymbol(symbol: string): {
  root: string;
  rootAlter: number;
  kind: string;
  kindText: string;
  bass?: string;
  bassAlter?: number;
} | null {
  const trimmed = symbol.trim();
  if (!trimmed) return null;

  // Match slash chord (e.g., "C/E")
  const slashMatch = trimmed.match(/^([A-G][#b]?)(.+?)\/([A-G][#b]?)$/);
  if (slashMatch) {
    const [, rootPart, suffix, bassPart] = slashMatch;
    const rootInfo = parseRootPart(rootPart!);
    const bassInfo = parseRootPart(bassPart!);
    if (!rootInfo || !bassInfo) return null;

    const kind = SUFFIX_TO_KIND[suffix!.trim()] || "major";
    return {
      root: rootInfo.root,
      rootAlter: rootInfo.alter,
      kind,
      kindText: suffix!.trim() || "",
      bass: bassInfo.root,
      bassAlter: bassInfo.alter,
    };
  }

  // Match regular chord (e.g., "Cmaj7", "Am")
  const match = trimmed.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return null;

  const [, rootPart, suffix] = match;
  const rootInfo = parseRootPart(rootPart!);
  if (!rootInfo) return null;

  const kind = SUFFIX_TO_KIND[suffix!.trim()] || "major";
  return {
    root: rootInfo.root,
    rootAlter: rootInfo.alter,
    kind,
    kindText: suffix!.trim() || "",
  };
}

function parseRootPart(rootPart: string): { root: string; alter: number } | null {
  if (rootPart.length === 0) return null;
  const root = rootPart[0]!.toUpperCase();
  if (!["A", "B", "C", "D", "E", "F", "G"].includes(root)) return null;

  let alter = 0;
  if (rootPart.length > 1) {
    if (rootPart[1] === "#") {
      alter = 1;
    } else if (rootPart[1] === "b") {
      alter = -1;
    }
  }

  return { root, alter };
}

// Format chord components into a symbol string
export function formatChordSymbol(
  rootStep: string,
  rootAlter: number,
  kind: string,
  kindText: string | null,
  bassStep?: string,
  bassAlter?: number
): string {
  let result = rootStep;
  if (rootAlter === 1) {
    result += "#";
  } else if (rootAlter === -1) {
    result += "b";
  }

  // Use kindText if provided, otherwise map kind to suffix
  if (kindText) {
    result += kindText;
  } else {
    const suffix = KIND_TO_SUFFIX[kind];
    if (suffix !== undefined) {
      result += suffix;
    }
  }

  // Add slash bass if present
  if (bassStep) {
    result += "/";
    result += bassStep;
    if (bassAlter === 1) {
      result += "#";
    } else if (bassAlter === -1) {
      result += "b";
    }
  }

  return result;
}

// ==================== TIME SIGNATURE VALIDATION ====================

export function isValidTimeSignature(
  beats: number,
  beatType: number
): TimeSignature | null {
  if (beatType !== 4) return null;
  if (beats !== 3 && beats !== 4) return null;
  return { beatsPerBar: beats as 3 | 4, beatUnit: 4 };
}

