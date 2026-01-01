import { CHORD_DICTIONARY } from "./chord-dictionary";

// Match chords based on user input
// Returns an array of matching chord symbols, with prefix matches first
export function matchChords(input: string, maxResults: number = 10): string[] {
  if (!input || input.trim() === "") {
    return [];
  }

  const normalizedInput = input.toLowerCase().trim();
  const prefixMatches: string[] = [];
  const containsMatches: string[] = [];

  // Use for-loop as per user preference
  for (let i = 0; i < CHORD_DICTIONARY.length; i++) {
    const chord = CHORD_DICTIONARY[i];
    if (!chord) continue;

    const normalizedChord = chord.toLowerCase();

    // Prefix match (highest priority)
    if (normalizedChord.startsWith(normalizedInput)) {
      prefixMatches.push(chord);
      if (prefixMatches.length >= maxResults) {
        return prefixMatches;
      }
    }
    // Contains match (lower priority)
    else if (normalizedChord.includes(normalizedInput)) {
      containsMatches.push(chord);
    }
  }

  // Combine results: prefix matches first, then contains matches
  const combined: string[] = [];
  for (let i = 0; i < prefixMatches.length && combined.length < maxResults; i++) {
    const match = prefixMatches[i];
    if (match) {
      combined.push(match);
    }
  }
  for (let i = 0; i < containsMatches.length && combined.length < maxResults; i++) {
    const match = containsMatches[i];
    if (match) {
      combined.push(match);
    }
  }

  return combined;
}

