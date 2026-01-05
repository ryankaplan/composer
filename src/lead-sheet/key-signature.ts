import { KeySignature, PitchLetter, Accidental } from "./types";

// Map each key signature to the accidental for each pitch letter
// This defines the diatonic spelling for each major key
const KEY_SIGNATURE_MAP: Record<
  KeySignature,
  Record<PitchLetter, Accidental>
> = {
  // Natural keys
  C: {
    C: null,
    D: null,
    E: null,
    F: null,
    G: null,
    A: null,
    B: null,
  },

  // Sharp keys (circle of 5ths ascending)
  G: {
    C: null,
    D: null,
    E: null,
    F: "#",
    G: null,
    A: null,
    B: null,
  },
  D: {
    C: "#",
    D: null,
    E: null,
    F: "#",
    G: null,
    A: null,
    B: null,
  },
  A: {
    C: "#",
    D: null,
    E: null,
    F: "#",
    G: "#",
    A: null,
    B: null,
  },
  E: {
    C: "#",
    D: "#",
    E: null,
    F: "#",
    G: "#",
    A: null,
    B: null,
  },
  B: {
    C: "#",
    D: "#",
    E: null,
    F: "#",
    G: "#",
    A: "#",
    B: null,
  },
  "F#": {
    C: "#",
    D: "#",
    E: "#",
    F: "#",
    G: "#",
    A: "#",
    B: null,
  },
  "C#": {
    C: "#",
    D: "#",
    E: "#",
    F: "#",
    G: "#",
    A: "#",
    B: "#",
  },

  // Flat keys (circle of 5ths descending)
  F: {
    C: null,
    D: null,
    E: null,
    F: null,
    G: null,
    A: null,
    B: "b",
  },
  Bb: {
    C: null,
    D: null,
    E: "b",
    F: null,
    G: null,
    A: null,
    B: "b",
  },
  Eb: {
    C: null,
    D: null,
    E: "b",
    F: null,
    G: null,
    A: "b",
    B: "b",
  },
  Ab: {
    C: null,
    D: "b",
    E: "b",
    F: null,
    G: null,
    A: "b",
    B: "b",
  },
  Db: {
    C: null,
    D: "b",
    E: "b",
    F: null,
    G: "b",
    A: "b",
    B: "b",
  },
  Gb: {
    C: "b",
    D: "b",
    E: "b",
    F: null,
    G: "b",
    A: "b",
    B: "b",
  },
  Cb: {
    C: "b",
    D: "b",
    E: "b",
    F: "b",
    G: "b",
    A: "b",
    B: "b",
  },
};

/**
 * Get the diatonic accidental for a given pitch letter in a given key.
 * Returns the accidental that would appear in the key signature (or null for natural).
 *
 * Example: In D major, getDiatonicAccidental("D", "C") returns "#" (C# is in D major)
 * Example: In F major, getDiatonicAccidental("F", "B") returns "b" (Bb is in F major)
 */
export function getDiatonicAccidental(
  keySignature: KeySignature,
  letter: PitchLetter
): Accidental {
  return KEY_SIGNATURE_MAP[keySignature][letter];
}



