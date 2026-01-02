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
  root: number; // chroma 0-11
  quality: ChordQuality;
  bass?: number; // optional slash bass chroma 0-11
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

  // Handle slash chords (X/Y): keep X as the chord root/quality, but use Y as the bass note.
  let bass: number | undefined;
  if (symbol.includes("/")) {
    const parts = symbol.split("/");
    const mainPart = parts[0]?.trim();
    const bassSymbol = parts[1]?.trim();
    if (!mainPart) return null;
    if (bassSymbol) {
      const bassMatch = bassSymbol.match(/^([A-G])([#b]?)/);
      if (bassMatch) {
        const bassLetter = bassMatch[1]!;
        const bassAccidental = bassMatch[2] || "";
        let bassChroma = NOTE_MAP[bassLetter];
        if (bassChroma === undefined) return null;
        if (bassAccidental === "#") bassChroma = (bassChroma + 1) % 12;
        if (bassAccidental === "b") bassChroma = (bassChroma + 11) % 12;
        bass = bassChroma;
      }
    }
    symbol = mainPart;
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

  return { root, quality, bass };
}

function parseQuality(str: string): ChordQuality | null {
  const raw = str.trim();
  // Lowercased form is convenient, but note that some shorthands like "M7" would
  // collide with "m7" if we only considered lowercase.
  const s = raw.toLowerCase();

  // Exact matches
  if (s === "") return "major";
  if (s === "m") return "minor";
  if (s === "dim" || s === "o" || s === "°") return "diminished";
  if (s === "aug" || s === "+") return "augmented";
  if (s === "sus2") return "sus2";
  if (s === "sus4") return "sus4";
  if (s === "7") return "7";
  if (s === "7sus4") return "7sus4";
  // Minor 7th must be checked before major-7 shorthands.
  if (s === "min7" || s === "m7") return "m7";
  // Major 7th shorthands:
  // - "Δ7" lowercases to "δ7"
  // - "M7" should be treated as major 7 (but would lowercase to "m7", so check raw)
  if (s === "maj7" || s === "^7" || s === "δ7" || raw === "Δ7" || raw === "M7")
    return "maj7";
  if (s === "m7b5" || s === "ø7" || s === "ø") return "m7b5";

  // Default to major for unrecognized quality
  return "major";
}

/**
 * Generate MIDI notes for a chord in close position.
 * Returns notes in the range around C3-C4.
 */
function voiceChord(
  rootChroma: number,
  quality: ChordQuality,
  bassChroma?: number
): number[] {
  // Keep chord tones out of the mud: put upper voices around C3–C4.
  // (MIDI 48 is C3.)
  const upperRootMidi = 4 * 12 + rootChroma;

  const upperIntervals = getUpperIntervalsForQuality(quality);

  const notes: number[] = [];

  // Optional explicit bass (slash chord): anchor around C2.
  if (bassChroma !== undefined) {
    const bassMidi = 3 * 12 + bassChroma; // C2-ish
    if (bassMidi >= 24 && bassMidi <= 60) {
      notes.push(bassMidi);
    }
  }

  for (let i = 0; i < upperIntervals.length; i++) {
    const n = upperRootMidi + upperIntervals[i]!;
    // Clamp upper chord tones to a comfortable range.
    if (n >= 36 && n <= 84) {
      notes.push(n);
    }
  }

  // If bass duplicates a chord tone class, keep the bass but drop the duplicated upper tone.
  if (bassChroma !== undefined) {
    const seen = new Set<number>();
    const deduped: number[] = [];
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i]!;
      const chroma = ((n % 12) + 12) % 12;
      if (i === 0) {
        // Always keep the first note (bass, if present).
        deduped.push(n);
        seen.add(chroma);
        continue;
      }
      if (seen.has(chroma)) continue;
      deduped.push(n);
      seen.add(chroma);
    }
    return deduped;
  }

  return notes;
}

/**
 * "Upper" chord tones (above the bass) chosen to avoid mud.
 * For 7th chords we use a shell voicing: root + 3rd/4th + 7th (omit 5th).
 */
function getUpperIntervalsForQuality(quality: ChordQuality): number[] {
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
      return [0, 4, 10]; // Shell: Root, M3, m7
    case "maj7":
      return [0, 4, 11]; // Shell: Root, M3, M7
    case "m7":
      return [0, 3, 10]; // Shell: Root, m3, m7
    case "m7b5":
      return [0, 3, 10]; // Shell: Root, m3, m7
    case "7sus4":
      return [0, 5, 10]; // Shell: Root, P4, m7
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
        // Play just the root note around C3
        return [4 * 12 + root];
      }
    }
    // Complete fallback: return empty (silence)
    return [];
  }

  return voiceChord(parsed.root, parsed.quality, parsed.bass);
}
