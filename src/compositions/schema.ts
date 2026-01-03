// Versioned schema for persisted compositions
// This module defines the stable, serialized format that lives in IndexedDB.
// Keep types here separate from runtime application types to allow evolution.

// ==================== SCHEMA VERSION 1 ====================

// Duplicate core types to avoid coupling to application types

export type PersistedTimeSignatureV1 = {
  beatsPerBar: 3 | 4;
  beatUnit: 4;
};

export type PersistedKeySignatureV1 =
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

export type PersistedDurationV1 = {
  base: "1/1" | "1/2" | "1/4" | "1/8" | "1/16";
  dots: 0 | 1 | 2;
};

export type PersistedPitchV1 = {
  letter: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  accidental: "#" | "b" | null;
  octave: number;
};

export type PersistedMelodyEventV1 =
  | {
      kind: "note";
      id: string;
      duration: PersistedDurationV1;
      pitch: PersistedPitchV1;
      tieToNext?: true;
    }
  | {
      kind: "rest";
      id: string;
      duration: PersistedDurationV1;
    };

export type PersistedChordRegionV1 = {
  id: string;
  start: number; // Tick
  end: number; // Tick
  text: string;
};

export type PersistedChordTrackV1 = {
  regions: PersistedChordRegionV1[];
};

export type PersistedLeadSheetV1 = {
  timeSignature: PersistedTimeSignatureV1;
  keySignature: PersistedKeySignatureV1;
  explicitEndTick: number; // Tick
  events: PersistedMelodyEventV1[];
  chords: PersistedChordTrackV1;
};

export type PersistedCompositionV1 = {
  id: string;
  title: string;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  leadSheet: PersistedLeadSheetV1;
};

export type PersistedMetaV1 = {
  schemaVersion: 1;
  lastOpenedCompositionId: string | null;
};

// ==================== VALIDATION ====================

// Defensive runtime validation to ensure persisted data matches expected shape
export function validatePersistedCompositionV1(
  x: unknown
): PersistedCompositionV1 | null {
  if (typeof x !== "object" || x === null) return null;

  const obj = x as Record<string, unknown>;

  if (typeof obj.id !== "string") return null;
  if (typeof obj.title !== "string") return null;
  if (typeof obj.createdAt !== "number") return null;
  if (typeof obj.updatedAt !== "number") return null;

  const leadSheet = obj.leadSheet;
  if (typeof leadSheet !== "object" || leadSheet === null) return null;

  const ls = leadSheet as Record<string, unknown>;

  // Validate timeSignature
  if (typeof ls.timeSignature !== "object" || ls.timeSignature === null)
    return null;
  const ts = ls.timeSignature as Record<string, unknown>;
  if (
    typeof ts.beatsPerBar !== "number" ||
    (ts.beatsPerBar !== 3 && ts.beatsPerBar !== 4)
  )
    return null;
  if (ts.beatUnit !== 4) return null;

  // Validate keySignature
  if (typeof ls.keySignature !== "string") return null;

  // Validate explicitEndTick
  if (typeof ls.explicitEndTick !== "number") return null;

  // Validate events array
  if (!Array.isArray(ls.events)) return null;

  // Validate chords
  if (typeof ls.chords !== "object" || ls.chords === null) return null;
  const chords = ls.chords as Record<string, unknown>;
  if (!Array.isArray(chords.regions)) return null;

  // If all basic checks pass, cast and return
  return obj as PersistedCompositionV1;
}

export function validatePersistedMetaV1(x: unknown): PersistedMetaV1 | null {
  if (typeof x !== "object" || x === null) return null;

  const obj = x as Record<string, unknown>;

  if (obj.schemaVersion !== 1) return null;
  if (
    obj.lastOpenedCompositionId !== null &&
    typeof obj.lastOpenedCompositionId !== "string"
  )
    return null;

  return obj as PersistedMetaV1;
}

// ==================== CUTE DEFAULT TITLES ====================

const CUTE_TITLES = [
  "Untitled Bop",
  "New Track (Don't Panic)",
  "Something Beautiful",
  "Bridge to Somewhere",
  "Accidental Hit Single",
  "Snack Track",
  "Notes I Found in the Couch",
  "Just One More Take",
  "Humming Into the Void",
  "Untitled Groove",
  "Somehow a Single",
  "Probably a Banger",
  "Sunny Side Up",
  "High-Key Happy",
  "Melodic Joy",
  "Harmonic Ham",
];

export function generateCuteTitle(): string {
  return CUTE_TITLES[Math.floor(Math.random() * CUTE_TITLES.length)]!;
}
