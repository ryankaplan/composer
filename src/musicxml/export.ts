// Export Document to MusicXML format

import { Document } from "../lead-sheet/Document";
import {
  MelodyEvent,
  TimeSignature,
  KeySignature,
  Pitch,
  getBarCapacity,
  durationToTicks,
  Tick,
  ChordRegion,
} from "../lead-sheet/types";
import {
  keySignatureToFifths,
  pitchToMusicXML,
  durationToMusicXMLType,
  parseChordSymbol,
} from "./mapping";

// Virtual event for export (may be split from original events)
type ExportEvent = {
  kind: "note" | "rest";
  pitch?: Pitch;
  durationTicks: number;
  tieStart?: boolean; // start of a tie
  tieStop?: boolean; // end of a tie
};

// Measure with export events and chords
type ExportMeasure = {
  number: number;
  events: ExportEvent[];
  chords: Array<{ offset: Tick; text: string }>;
};

/**
 * Export a Document to MusicXML string.
 */
export function exportDocumentToMusicXML(
  doc: Document,
  title?: string
): string {
  const timeSignature = doc.timeSignature.get();
  const keySignature = doc.keySignature.get();
  const events = doc.events.get();
  const chordTrack = doc.chords.get();
  const documentEndTick = doc.documentEndTick.get();

  // Build virtual measure structure with split events
  const measures = buildExportMeasures(
    events,
    timeSignature,
    chordTrack.regions,
    documentEndTick
  );

  // Generate XML
  return generateMusicXML(
    measures,
    timeSignature,
    keySignature,
    title || "Untitled"
  );
}

/**
 * Build measures with events split at bar boundaries.
 */
function buildExportMeasures(
  events: MelodyEvent[],
  timeSignature: TimeSignature,
  chordRegions: ChordRegion[],
  documentEndTick: Tick
): ExportMeasure[] {
  const barCapacity = getBarCapacity(timeSignature);
  const measureCount = Math.ceil(documentEndTick / barCapacity);
  const measures: ExportMeasure[] = [];

  // Initialize measures
  for (let i = 0; i < measureCount; i++) {
    measures.push({
      number: i + 1,
      events: [],
      chords: [],
    });
  }

  // Process melody events
  let currentTick: Tick = 0;
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    const eventTicks = durationToTicks(event.duration);
    const endTick = currentTick + eventTicks;

    // Split event across measure boundaries if needed
    splitEventAcrossMeasures(
      event,
      currentTick,
      endTick,
      barCapacity,
      measures
    );

    currentTick = endTick;
  }

  // Process chord regions
  for (let i = 0; i < chordRegions.length; i++) {
    const region = chordRegions[i]!;
    const measureIndex = Math.floor(region.start / barCapacity);
    const measureStartTick = measureIndex * barCapacity;
    const offset = region.start - measureStartTick;

    if (measureIndex < measures.length) {
      measures[measureIndex]!.chords.push({
        offset,
        text: region.text,
      });
    }
  }

  return measures;
}

/**
 * Split an event across measure boundaries and add to measures.
 */
function splitEventAcrossMeasures(
  event: MelodyEvent,
  startTick: Tick,
  endTick: Tick,
  barCapacity: number,
  measures: ExportMeasure[]
): void {
  let currentTick = startTick;
  let isFirstSegment = true;

  while (currentTick < endTick) {
    const measureIndex = Math.floor(currentTick / barCapacity);
    const measureStartTick = measureIndex * barCapacity;
    const measureEndTick = measureStartTick + barCapacity;
    const remainingInMeasure = measureEndTick - currentTick;
    const remainingInEvent = endTick - currentTick;
    const segmentTicks = Math.min(remainingInMeasure, remainingInEvent);

    const exportEvent: ExportEvent = {
      kind: event.kind,
      durationTicks: segmentTicks,
    };

    if (event.kind === "note") {
      exportEvent.pitch = event.pitch;

      // Handle ties for split notes
      const isLastSegment = currentTick + segmentTicks >= endTick;
      const needsSplit = !isFirstSegment || !isLastSegment;

      if (needsSplit) {
        if (isFirstSegment) {
          exportEvent.tieStart = true;
        } else if (isLastSegment) {
          exportEvent.tieStop = true;
        } else {
          exportEvent.tieStart = true;
          exportEvent.tieStop = true;
        }
      }

      // Also handle original tieToNext
      if (event.tieToNext && isLastSegment) {
        exportEvent.tieStart = true;
      }
    }

    if (measureIndex < measures.length) {
      measures[measureIndex]!.events.push(exportEvent);
    }

    currentTick += segmentTicks;
    isFirstSegment = false;
  }
}

/**
 * Generate MusicXML string from measures.
 */
function generateMusicXML(
  measures: ExportMeasure[],
  timeSignature: TimeSignature,
  keySignature: KeySignature,
  title: string
): string {
  const lines: string[] = [];

  // XML declaration and DOCTYPE
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">'
  );

  // Root element
  lines.push('<score-partwise version="3.1">');

  // Work title
  lines.push("  <work>");
  lines.push(`    <work-title>${escapeXML(title)}</work-title>`);
  lines.push("  </work>");

  // Part list
  lines.push("  <part-list>");
  lines.push('    <score-part id="P1">');
  lines.push("      <part-name>Lead Sheet</part-name>");
  lines.push("    </score-part>");
  lines.push("  </part-list>");

  // Part
  lines.push('  <part id="P1">');

  // Measures
  for (let i = 0; i < measures.length; i++) {
    const measure = measures[i]!;
    const isFirstMeasure = i === 0;
    generateMeasure(
      lines,
      measure,
      timeSignature,
      keySignature,
      isFirstMeasure
    );
  }

  lines.push("  </part>");
  lines.push("</score-partwise>");

  return lines.join("\n");
}

/**
 * Generate a single measure.
 */
function generateMeasure(
  lines: string[],
  measure: ExportMeasure,
  timeSignature: TimeSignature,
  keySignature: KeySignature,
  isFirstMeasure: boolean
): void {
  lines.push(`    <measure number="${measure.number}">`);

  // Attributes (first measure only)
  if (isFirstMeasure) {
    lines.push("      <attributes>");
    lines.push("        <divisions>96</divisions>");

    // Key
    const fifths = keySignatureToFifths(keySignature);
    lines.push("        <key>");
    lines.push(`          <fifths>${fifths}</fifths>`);
    lines.push("        </key>");

    // Time
    lines.push("        <time>");
    lines.push(`          <beats>${timeSignature.beatsPerBar}</beats>`);
    lines.push(`          <beat-type>${timeSignature.beatUnit}</beat-type>`);
    lines.push("        </time>");

    // Clef (treble)
    lines.push("        <clef>");
    lines.push("          <sign>G</sign>");
    lines.push("          <line>2</line>");
    lines.push("        </clef>");

    lines.push("      </attributes>");
  }

  // Chords and notes (interleaved by position)
  let currentOffset: Tick = 0;
  let chordIndex = 0;

  for (let i = 0; i < measure.events.length; i++) {
    const event = measure.events[i]!;

    // Emit any chords that occur before or at this event
    while (chordIndex < measure.chords.length) {
      const chord = measure.chords[chordIndex]!;
      if (chord.offset <= currentOffset) {
        generateHarmony(lines, chord.text);
        chordIndex++;
      } else {
        break;
      }
    }

    // Emit the note/rest
    if (event.kind === "note" && event.pitch) {
      generateNote(lines, event.pitch, event.durationTicks, event);
    } else {
      generateRest(lines, event.durationTicks);
    }

    currentOffset += event.durationTicks;
  }

  // Emit any remaining chords
  while (chordIndex < measure.chords.length) {
    const chord = measure.chords[chordIndex]!;
    generateHarmony(lines, chord.text);
    chordIndex++;
  }

  lines.push("    </measure>");
}

/**
 * Generate a note element.
 */
function generateNote(
  lines: string[],
  pitch: Pitch,
  durationTicks: number,
  event: ExportEvent
): void {
  const { step, alter, octave } = pitchToMusicXML(pitch);

  lines.push("      <note>");

  // Pitch
  lines.push("        <pitch>");
  lines.push(`          <step>${step}</step>`);
  if (alter !== 0) {
    lines.push(`          <alter>${alter}</alter>`);
  }
  lines.push(`          <octave>${octave}</octave>`);
  lines.push("        </pitch>");

  // Duration
  lines.push(`        <duration>${durationTicks}</duration>`);

  // Tie elements
  if (event.tieStart && event.tieStop) {
    lines.push('        <tie type="stop"/>');
    lines.push('        <tie type="start"/>');
  } else if (event.tieStart) {
    lines.push('        <tie type="start"/>');
  } else if (event.tieStop) {
    lines.push('        <tie type="stop"/>');
  }

  // Type and dots (best effort from ticks)
  const typeInfo = findBestType(durationTicks);
  if (typeInfo) {
    lines.push(`        <type>${typeInfo.type}</type>`);
    for (let i = 0; i < typeInfo.dots; i++) {
      lines.push("        <dot/>");
    }
  }

  // Notations (tied elements)
  if (event.tieStart || event.tieStop) {
    lines.push("        <notations>");
    if (event.tieStart && event.tieStop) {
      lines.push('          <tied type="stop"/>');
      lines.push('          <tied type="start"/>');
    } else if (event.tieStart) {
      lines.push('          <tied type="start"/>');
    } else if (event.tieStop) {
      lines.push('          <tied type="stop"/>');
    }
    lines.push("        </notations>");
  }

  lines.push("      </note>");
}

/**
 * Generate a rest element.
 */
function generateRest(lines: string[], durationTicks: number): void {
  lines.push("      <note>");
  lines.push("        <rest/>");
  lines.push(`        <duration>${durationTicks}</duration>`);

  const typeInfo = findBestType(durationTicks);
  if (typeInfo) {
    lines.push(`        <type>${typeInfo.type}</type>`);
    for (let i = 0; i < typeInfo.dots; i++) {
      lines.push("        <dot/>");
    }
  }

  lines.push("      </note>");
}

/**
 * Generate a harmony element.
 */
function generateHarmony(lines: string[], chordText: string): void {
  const parsed = parseChordSymbol(chordText);
  if (!parsed) {
    // Fallback: emit as simple text
    lines.push("      <harmony>");
    lines.push("        <root>");
    lines.push("          <root-step>C</root-step>");
    lines.push("        </root>");
    lines.push("        <kind text=\"" + escapeXML(chordText) + '">none</kind>');
    lines.push("      </harmony>");
    return;
  }

  lines.push("      <harmony>");

  // Root
  lines.push("        <root>");
  lines.push(`          <root-step>${parsed.root}</root-step>`);
  if (parsed.rootAlter !== 0) {
    lines.push(`          <root-alter>${parsed.rootAlter}</root-alter>`);
  }
  lines.push("        </root>");

  // Kind
  const kindText = parsed.kindText || "";
  lines.push(
    `        <kind text="${escapeXML(kindText)}">${parsed.kind}</kind>`
  );

  // Bass (if present)
  if (parsed.bass) {
    lines.push("        <bass>");
    lines.push(`          <bass-step>${parsed.bass}</bass-step>`);
    if (parsed.bassAlter !== undefined && parsed.bassAlter !== 0) {
      lines.push(`          <bass-alter>${parsed.bassAlter}</bass-alter>`);
    }
    lines.push("        </bass>");
  }

  lines.push("      </harmony>");
}

/**
 * Find best MusicXML type for a tick count.
 */
function findBestType(ticks: number): { type: string; dots: number } | null {
  // Try to find exact match with dots
  const candidates = [
    { base: 384, type: "whole", dots: 0 },
    { base: 576, type: "whole", dots: 1 },
    { base: 672, type: "whole", dots: 2 },
    { base: 192, type: "half", dots: 0 },
    { base: 288, type: "half", dots: 1 },
    { base: 336, type: "half", dots: 2 },
    { base: 96, type: "quarter", dots: 0 },
    { base: 144, type: "quarter", dots: 1 },
    { base: 168, type: "quarter", dots: 2 },
    { base: 48, type: "eighth", dots: 0 },
    { base: 72, type: "eighth", dots: 1 },
    { base: 84, type: "eighth", dots: 2 },
    { base: 24, type: "16th", dots: 0 },
    { base: 36, type: "16th", dots: 1 },
    { base: 42, type: "16th", dots: 2 },
  ];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]!;
    if (candidate.base === ticks) {
      return { type: candidate.type, dots: candidate.dots };
    }
  }

  // Fallback: quarter note (no dots)
  return { type: "quarter", dots: 0 };
}

/**
 * Escape special XML characters.
 */
function escapeXML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

