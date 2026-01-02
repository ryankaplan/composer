import { CHORD_DICTIONARY } from "./chord-dictionary";
import { KeySignature } from "./types";
import { isDiatonicChordSymbol } from "./diatonic-chords";

// Match chords based on user input
// Returns an array of matching chord symbols, with diatonic chords ranked first
export function matchChords(
  input: string,
  keySignature: KeySignature,
  maxResults: number = 10
): string[] {
  if (!input || input.trim() === "") {
    return [];
  }

  const normalizedInput = input.toLowerCase().trim();
  const prefixDiatonic: string[] = [];
  const prefixNonDiatonic: string[] = [];
  const containsDiatonic: string[] = [];
  const containsNonDiatonic: string[] = [];

  // Use for-loop as per user preference
  for (let i = 0; i < CHORD_DICTIONARY.length; i++) {
    const chord = CHORD_DICTIONARY[i];
    if (!chord) continue;

    const normalizedChord = chord.toLowerCase();
    const isDiatonic = isDiatonicChordSymbol(chord, keySignature);

    // Prefix match (highest priority)
    if (normalizedChord.startsWith(normalizedInput)) {
      if (isDiatonic) {
        prefixDiatonic.push(chord);
      } else {
        prefixNonDiatonic.push(chord);
      }
    }
    // Contains match (lower priority)
    else if (normalizedChord.includes(normalizedInput)) {
      if (isDiatonic) {
        containsDiatonic.push(chord);
      } else {
        containsNonDiatonic.push(chord);
      }
    }
  }

  // Combine results: diatonic prefix, non-diatonic prefix, diatonic contains, non-diatonic contains
  const combined: string[] = [];

  // Add prefix diatonic
  for (
    let i = 0;
    i < prefixDiatonic.length && combined.length < maxResults;
    i++
  ) {
    const match = prefixDiatonic[i];
    if (match) {
      combined.push(match);
    }
  }

  // Add prefix non-diatonic
  for (
    let i = 0;
    i < prefixNonDiatonic.length && combined.length < maxResults;
    i++
  ) {
    const match = prefixNonDiatonic[i];
    if (match) {
      combined.push(match);
    }
  }

  // Add contains diatonic
  for (
    let i = 0;
    i < containsDiatonic.length && combined.length < maxResults;
    i++
  ) {
    const match = containsDiatonic[i];
    if (match) {
      combined.push(match);
    }
  }

  // Add contains non-diatonic
  for (
    let i = 0;
    i < containsNonDiatonic.length && combined.length < maxResults;
    i++
  ) {
    const match = containsNonDiatonic[i];
    if (match) {
      combined.push(match);
    }
  }

  return combined;
}
