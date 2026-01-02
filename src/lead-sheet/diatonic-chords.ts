import { KeySignature } from "./types";

// Simplified chord quality categories for diatonic classification
type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "maj7"
  | "7"
  | "m7"
  | "m7b5"
  | "other";

// Parse a chord symbol to extract root letter, accidental, and quality
type ParsedChord = {
  rootLetter: string; // A-G
  rootAccidental: "#" | "b" | null;
  quality: ChordQuality;
};

// Map note letter to chroma (0-11)
const NOTE_CHROMA: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Parse a chord symbol into root + quality.
 * Returns null if parsing fails.
 */
function parseChordSymbol(symbol: string): ParsedChord | null {
  const trimmed = symbol.trim();
  if (!trimmed) return null;

  // Strip slash bass (e.g., "D/F#" → "D")
  let mainPart = trimmed;
  if (trimmed.includes("/")) {
    const parts = trimmed.split("/");
    mainPart = parts[0]?.trim() || "";
  }

  // Parse root note (letter + optional accidental)
  const match = mainPart.match(/^([A-G])([#b]?)(.*)$/);
  if (!match) return null;

  const rootLetter = match[1]!;
  const rootAccidental = (match[2] || null) as "#" | "b" | null;
  const qualityStr = match[3] || "";

  const quality = parseQuality(qualityStr);

  return { rootLetter, rootAccidental, quality };
}

/**
 * Parse quality string into normalized category.
 */
function parseQuality(str: string): ChordQuality {
  const raw = str.trim();
  const s = raw.toLowerCase();

  // Major
  if (s === "" || s === "maj") return "major";

  // Minor
  if (s === "m" || s === "min") return "minor";

  // Diminished
  if (s === "dim" || s === "o" || s === "°") return "diminished";

  // Augmented
  if (s === "aug" || s === "+") return "augmented";

  // Major 7th
  if (s === "maj7" || s === "^7" || s === "δ7" || raw === "Δ7" || raw === "M7")
    return "maj7";

  // Dominant 7th
  if (s === "7") return "7";

  // Minor 7th
  if (s === "m7" || s === "min7") return "m7";

  // Half-diminished (m7b5)
  if (s === "m7b5" || s === "ø7" || s === "ø") return "m7b5";

  // Everything else is "other" (sus2, sus4, add9, 9, 11, 13, etc.)
  return "other";
}

/**
 * Get the chromatic root of the key signature (0-11).
 */
function getKeyChroma(keySignature: KeySignature): number {
  // Extract the root letter (first character)
  const rootLetter = keySignature[0]!;
  let chroma = NOTE_CHROMA[rootLetter];
  if (chroma === undefined) return 0; // Fallback to C

  // Apply accidental if present
  if (keySignature.includes("#")) {
    chroma = (chroma + 1) % 12;
  } else if (keySignature.includes("b")) {
    chroma = (chroma + 11) % 12;
  }

  return chroma;
}

/**
 * Get the chromatic root of a parsed chord (0-11).
 */
function getChordChroma(parsed: ParsedChord): number {
  let chroma = NOTE_CHROMA[parsed.rootLetter];
  if (chroma === undefined) return 0;

  if (parsed.rootAccidental === "#") {
    chroma = (chroma + 1) % 12;
  } else if (parsed.rootAccidental === "b") {
    chroma = (chroma + 11) % 12;
  }

  return chroma;
}

/**
 * Compute the scale degree (0-6) of a chord root relative to the key.
 * Returns null if the chord root is not in the major scale.
 */
function getScaleDegree(chordChroma: number, keyChroma: number): number | null {
  // Major scale intervals (in semitones from root): 0, 2, 4, 5, 7, 9, 11
  const majorScaleIntervals = [0, 2, 4, 5, 7, 9, 11];

  const interval = (chordChroma - keyChroma + 12) % 12;
  const degreeIndex = majorScaleIntervals.indexOf(interval);

  return degreeIndex === -1 ? null : degreeIndex;
}

/**
 * Check if a chord symbol is diatonic to the given key signature.
 * Uses the "romanNumeralBasic" rule: only the 7 diatonic triads + their common 7ths are diatonic.
 *
 * - I: major, maj7
 * - ii: minor, m7
 * - iii: minor, m7
 * - IV: major, maj7
 * - V: major, 7 (dominant)
 * - vi: minor, m7
 * - vii°: diminished, m7b5
 */
export function isDiatonicChordSymbol(
  symbol: string,
  keySignature: KeySignature
): boolean {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return false;

  const keyChroma = getKeyChroma(keySignature);
  const chordChroma = getChordChroma(parsed);
  const degree = getScaleDegree(chordChroma, keyChroma);

  // If the chord root is not in the major scale, it's non-diatonic
  if (degree === null) return false;

  // Check if the quality matches the expected diatonic quality for this degree
  const quality = parsed.quality;

  switch (degree) {
    case 0: // I
      return quality === "major" || quality === "maj7";
    case 1: // ii
      return quality === "minor" || quality === "m7";
    case 2: // iii
      return quality === "minor" || quality === "m7";
    case 3: // IV
      return quality === "major" || quality === "maj7";
    case 4: // V
      return quality === "major" || quality === "7";
    case 5: // vi
      return quality === "minor" || quality === "m7";
    case 6: // vii°
      return quality === "diminished" || quality === "m7b5";
    default:
      return false;
  }
}
