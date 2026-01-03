// Import MusicXML format to PersistedLeadSheetV1

import {
  PersistedLeadSheetV1,
  PersistedMelodyEventV1,
  PersistedChordRegionV1,
  PersistedTimeSignatureV1,
  PersistedKeySignatureV1,
} from "../compositions/schema";
import {
  TICKS_PER_QUARTER,
  generateEventId,
  getBarCapacity,
  Tick,
} from "../lead-sheet/types";
import {
  fifthsToKeySignature,
  musicXMLToPitch,
  ticksToDuration,
  isValidTimeSignature,
  formatChordSymbol,
} from "./mapping";

/**
 * Import MusicXML string to a lead sheet.
 * Returns title and lead sheet data, or throws an error if import fails.
 */
export function importMusicXMLToLeadSheet(xml: string): {
  title: string;
  leadSheet: PersistedLeadSheetV1;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");

  // Check for parse errors
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("Invalid XML: " + parserError.textContent);
  }

  // Validate root element
  const root = doc.documentElement;
  if (root.tagName !== "score-partwise") {
    throw new Error(
      "Unsupported MusicXML format: expected score-partwise, got " +
        root.tagName
    );
  }

  // Extract title
  const titleElement = doc.querySelector("work work-title");
  const title = titleElement?.textContent?.trim() || "Imported";

  // Get the first part
  const parts = doc.querySelectorAll("part");
  if (parts.length === 0) {
    throw new Error("No parts found in MusicXML");
  }
  if (parts.length > 1) {
    console.warn("Multiple parts found, importing only the first part");
  }
  const part = parts[0]!;

  // Parse musical context and events
  const context = new ImportContext();
  const events: PersistedMelodyEventV1[] = [];
  const harmonies: Array<{ tick: Tick; text: string }> = [];

  const measures = part.querySelectorAll("measure");
  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i]!;
    parseMeasure(measure, context, events, harmonies);
  }

  // Convert harmonies to chord regions
  const chordRegions = harmoniesToRegions(
    harmonies,
    context.currentTick,
    context.timeSignature
  );

  const leadSheet: PersistedLeadSheetV1 = {
    timeSignature: context.timeSignature,
    keySignature: context.keySignature,
    explicitEndTick: context.currentTick || TICKS_PER_QUARTER * 4,
    events,
    chords: {
      regions: chordRegions,
    },
  };

  return { title, leadSheet };
}

/**
 * Import context (musical state that persists across measures).
 */
class ImportContext {
  divisions: number = 96; // Default divisions per quarter note
  timeSignature: PersistedTimeSignatureV1 = { beatsPerBar: 4, beatUnit: 4 };
  keySignature: PersistedKeySignatureV1 = "C";
  currentTick: Tick = 0;
}

/**
 * Parse a single measure.
 */
function parseMeasure(
  measure: Element,
  context: ImportContext,
  events: PersistedMelodyEventV1[],
  harmonies: Array<{ tick: Tick; text: string }>
): void {
  const measureStartTick = context.currentTick;

  // Check for backup (indicates multiple voices - not supported)
  const backup = measure.querySelector("backup");
  if (backup) {
    throw new Error(
      "Multiple voices (backup elements) are not supported in this import"
    );
  }

  // Process children in order
  const children = measure.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;

    if (child.tagName === "attributes") {
      parseAttributes(child, context);
    } else if (child.tagName === "note") {
      parseNote(child, context, events);
    } else if (child.tagName === "harmony") {
      parseHarmony(child, context, harmonies);
    } else if (child.tagName === "forward") {
      // Forward advances time without a note/rest
      const duration = parseInt(
        child.querySelector("duration")?.textContent || "0"
      );
      const ticks = convertDurationToTicks(duration, context.divisions);
      context.currentTick += ticks;
    }
  }
}

/**
 * Parse attributes element (divisions, key, time, etc).
 */
function parseAttributes(attributes: Element, context: ImportContext): void {
  // Divisions
  const divisionsElement = attributes.querySelector("divisions");
  if (divisionsElement) {
    const divisions = parseInt(divisionsElement.textContent || "96");
    if (divisions > 0) {
      context.divisions = divisions;
    }
  }

  // Key signature
  const keyElement = attributes.querySelector("key");
  if (keyElement) {
    const fifthsText = keyElement.querySelector("fifths")?.textContent;
    if (fifthsText) {
      const fifths = parseInt(fifthsText);
      const key = fifthsToKeySignature(fifths);
      if (key) {
        context.keySignature = key;
      }
    }
  }

  // Time signature
  const timeElement = attributes.querySelector("time");
  if (timeElement) {
    const beatsText = timeElement.querySelector("beats")?.textContent;
    const beatTypeText = timeElement.querySelector("beat-type")?.textContent;
    if (beatsText && beatTypeText) {
      const beats = parseInt(beatsText);
      const beatType = parseInt(beatTypeText);
      const validTime = isValidTimeSignature(beats, beatType);
      if (validTime) {
        context.timeSignature = validTime;
      } else {
        throw new Error(
          `Unsupported time signature: ${beats}/${beatType} (only 3/4 and 4/4 are supported)`
        );
      }
    }
  }
}

/**
 * Parse a note element.
 */
function parseNote(
  note: Element,
  context: ImportContext,
  events: PersistedMelodyEventV1[]
): void {
  // Get duration
  const durationText = note.querySelector("duration")?.textContent;
  if (!durationText) {
    throw new Error("Note missing duration");
  }
  const durationValue = parseInt(durationText);
  const ticks = convertDurationToTicks(durationValue, context.divisions);

  // Map ticks to our Duration type
  const duration = ticksToDuration(ticks);
  if (!duration) {
    throw new Error(
      `Unsupported note duration: ${ticks} ticks (only whole, half, quarter, eighth, 16th notes with 0-2 dots are supported)`
    );
  }

  // Check if it's a chord note (chord element present)
  const isChordNote = note.querySelector("chord") !== null;
  if (isChordNote) {
    throw new Error(
      "Chords (multiple simultaneous pitches) are not supported in this import - only monophonic melodies"
    );
  }

  // Check if it's a rest
  const isRest = note.querySelector("rest") !== null;

  if (isRest) {
    // Rest
    events.push({
      kind: "rest",
      id: generateEventId(),
      duration,
    });
  } else {
    // Note with pitch
    const pitchElement = note.querySelector("pitch");
    if (!pitchElement) {
      throw new Error("Note missing pitch");
    }

    const stepText = pitchElement.querySelector("step")?.textContent;
    const alterText = pitchElement.querySelector("alter")?.textContent;
    const octaveText = pitchElement.querySelector("octave")?.textContent;

    if (!stepText || !octaveText) {
      throw new Error("Note pitch missing step or octave");
    }

    const alter = alterText ? parseInt(alterText) : 0;
    const octave = parseInt(octaveText);

    const pitch = musicXMLToPitch(stepText, alter, octave);
    if (!pitch) {
      throw new Error(
        `Invalid pitch: ${stepText}${alter !== 0 ? alter : ""}${octave}`
      );
    }

    // Check for tie start
    const tieStart = note.querySelector('tie[type="start"]') !== null;

    const noteEvent: PersistedMelodyEventV1 = {
      kind: "note",
      id: generateEventId(),
      duration,
      pitch,
    };

    if (tieStart) {
      noteEvent.tieToNext = true;
    }

    events.push(noteEvent);
  }

  // Advance time
  context.currentTick += ticks;
}

/**
 * Parse a harmony element.
 */
function parseHarmony(
  harmony: Element,
  context: ImportContext,
  harmonies: Array<{ tick: Tick; text: string }>
): void {
  const tick = context.currentTick;

  // Extract root
  const rootElement = harmony.querySelector("root");
  if (!rootElement) {
    return; // No root, skip
  }

  const rootStep = rootElement.querySelector("root-step")?.textContent?.trim();
  if (!rootStep) {
    return;
  }

  const rootAlterText = rootElement.querySelector("root-alter")?.textContent;
  const rootAlter = rootAlterText ? parseInt(rootAlterText) : 0;

  // Extract kind
  const kindElement = harmony.querySelector("kind");
  if (!kindElement) {
    return;
  }

  const kind = kindElement.textContent?.trim() || "major";
  const kindText = kindElement.getAttribute("text") || null;

  // Extract bass (optional)
  const bassElement = harmony.querySelector("bass");
  let bassStep: string | undefined;
  let bassAlter: number | undefined;
  if (bassElement) {
    bassStep = bassElement.querySelector("bass-step")?.textContent?.trim();
    const bassAlterText = bassElement.querySelector("bass-alter")?.textContent;
    bassAlter = bassAlterText ? parseInt(bassAlterText) : 0;
  }

  // Format as chord symbol
  const chordText = formatChordSymbol(
    rootStep,
    rootAlter,
    kind,
    kindText,
    bassStep,
    bassAlter
  );

  harmonies.push({ tick, text: chordText });
}

/**
 * Convert MusicXML duration to ticks.
 */
function convertDurationToTicks(duration: number, divisions: number): number {
  // MusicXML duration is in units of divisions per quarter note
  // Our ticks are also per quarter note (TICKS_PER_QUARTER = 96)
  return Math.round((duration * TICKS_PER_QUARTER) / divisions);
}

/**
 * Convert point harmonies to chord regions.
 */
function harmoniesToRegions(
  harmonies: Array<{ tick: Tick; text: string }>,
  endTick: Tick,
  timeSignature: PersistedTimeSignatureV1
): PersistedChordRegionV1[] {
  if (harmonies.length === 0) {
    return [];
  }

  const regions: PersistedChordRegionV1[] = [];
  const barCapacity = getBarCapacity(timeSignature);

  for (let i = 0; i < harmonies.length; i++) {
    const harmony = harmonies[i]!;
    const nextHarmony = harmonies[i + 1];

    // Start at harmony tick
    const start = harmony.tick;

    // End at next harmony, or end of current measure, or document end
    let end: Tick;
    if (nextHarmony) {
      end = nextHarmony.tick;
    } else {
      // Last harmony: extend to end of its measure
      const measureIndex = Math.floor(start / barCapacity);
      const measureEnd = (measureIndex + 1) * barCapacity;
      end = Math.min(measureEnd, endTick);
    }

    if (end > start) {
      regions.push({
        id: generateEventId(),
        start,
        end,
        text: harmony.text,
      });
    }
  }

  return regions;
}
