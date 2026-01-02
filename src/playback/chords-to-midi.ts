/**
 * Chord symbol → MIDI notes converter
 * Implements MVP parsing + stable voicing per design spec
 */

type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "augmented"
  | "sus2"
  | "sus4"
  | "7"
  | "maj7"
  | "m7"
  | "m7b5"
  | "7sus4";

type ParsedChord = {
  root: number; // MIDI note (0-11, chroma only)
  quality: ChordQuality;
};

const NOTE_MAP: Record<string, number> = {
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
  // Trim whitespace
  symbol = symbol.trim();
  if (!symbol) return null;

  // Handle slash chords (X/Y) - use slash bass as root
  if (symbol.includes("/")) {
    const parts = symbol.split("/");
    const bassSymbol = parts[1]?.trim();
    if (bassSymbol) {
      // Parse just the bass note and use its pitch as the new root
      const bassMatch = bassSymbol.match(/^([A-G])([#b]?)/);
      if (bassMatch) {
        const bassLetter = bassMatch[1]!;
        const bassAccidental = bassMatch[2] || "";
        let bassChroma = NOTE_MAP[bassLetter];
        if (bassChroma === undefined) return null;

        if (bassAccidental === "#") bassChroma = (bassChroma + 1) % 12;
        if (bassAccidental === "b") bassChroma = (bassChroma + 11) % 12;

        // Now parse the chord quality from the main part
        const mainPart = parts[0]?.trim();
        if (!mainPart) return null;
        
        const mainMatch = mainPart.match(/^([A-G])([#b]?)(.*)$/);
        if (!mainMatch) return null;
        
        const qualityStr = mainMatch[3] || "";
        const quality = parseQuality(qualityStr);
        if (!quality) return null;

        // Build chord with bass as root
        return {
          root: bassChroma,
          quality,
        };
      }
    }
  }

  // Parse root note (letter + optional accidental)
  const match = symbol.match(/^([A-G])([#b]?)(.*)$/);
  if (!match) return null;

  const letter = match[1]!;
  const accidental = match[2] || "";
  const qualityStr = match[3] || "";

  let root = NOTE_MAP[letter];
  if (root === undefined) return null;

  // Apply accidental
  if (accidental === "#") root = (root + 1) % 12;
  if (accidental === "b") root = (root + 11) % 12;

  // Parse quality
  const quality = parseQuality(qualityStr);
  if (!quality) return null;

  return { root, quality };
}

function parseQuality(str: string): ChordQuality | null {
  // Normalize case for easier matching
  const s = str.toLowerCase();

  // Exact matches
  if (s === "") return "major";
  if (s === "m") return "minor";
  if (s === "dim" || s === "o" || s === "°") return "diminished";
  if (s === "aug" || s === "+") return "augmented";
  if (s === "sus2") return "sus2";
  if (s === "sus4") return "sus4";
  if (s === "7") return "7";
  if (s === "maj7" || s === "m7" || s === "^7" || s === "Δ7") return "maj7";
  if (s === "min7" || s === "m7") return "m7";
  if (s === "m7b5" || s === "ø7" || s === "ø") return "m7b5";
  if (s === "7sus4") return "7sus4";

  // Default to major for unrecognized quality
  return "major";
}

/**
 * Generate MIDI notes for a chord in close position.
 * Returns notes in the range around C3-C4.
 */
function voiceChord(root: number, quality: ChordQuality): number[] {
  // Default octave: root around C3 (MIDI 48)
  const baseOctave = 3;
  const rootMidi = baseOctave * 12 + root;

  const intervals = getIntervals(quality);
  const notes = intervals.map((interval) => rootMidi + interval);

  // Clamp to reasonable range (don't go below MIDI 36 or above MIDI 84)
  return notes.filter((n) => n >= 36 && n <= 84);
}

function getIntervals(quality: ChordQuality): number[] {
  switch (quality) {
    case "major":
      return [0, 4, 7]; // Root, M3, P5
    case "minor":
      return [0, 3, 7]; // Root, m3, P5
    case "diminished":
      return [0, 3, 6]; // Root, m3, d5
    case "augmented":
      return [0, 4, 8]; // Root, M3, A5
    case "sus2":
      return [0, 2, 7]; // Root, M2, P5
    case "sus4":
      return [0, 5, 7]; // Root, P4, P5
    case "7":
      return [0, 4, 7, 10]; // Root, M3, P5, m7
    case "maj7":
      return [0, 4, 7, 11]; // Root, M3, P5, M7
    case "m7":
      return [0, 3, 7, 10]; // Root, m3, P5, m7
    case "m7b5":
      return [0, 3, 6, 10]; // Root, m3, d5, m7 (half-diminished)
    case "7sus4":
      return [0, 5, 7, 10]; // Root, P4, P5, m7
    default:
      return [0, 4, 7]; // Default to major triad
  }
}

/**
 * Convert a chord symbol to MIDI notes.
 * Returns an array of MIDI note numbers, or an empty array if parsing fails.
 */
export function chordSymbolToMidi(symbol: string): number[] {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) {
    // Fallback: try to parse just the root and play it as a single note
    const rootOnly = symbol.match(/^([A-G])([#b]?)/);
    if (rootOnly) {
      const letter = rootOnly[1]!;
      const accidental = rootOnly[2] || "";
      let root = NOTE_MAP[letter];
      if (root !== undefined) {
        if (accidental === "#") root = (root + 1) % 12;
        if (accidental === "b") root = (root + 11) % 12;
        // Play just the root note in octave 3
        return [3 * 12 + root];
      }
    }
    // Complete fallback: return empty (silence)
    return [];
  }

  return voiceChord(parsed.root, parsed.quality);
}

