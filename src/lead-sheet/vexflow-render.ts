import {
  Renderer,
  Stave,
  StaveNote,
  Formatter,
  Voice,
  Accidental as VexAccidental,
  BarlineType,
  ChordSymbol,
  StaveTie,
} from "vexflow/bravura";
import {
  MelodyEvent,
  Measure,
  TimeSignature,
  Accidental,
  pitchToMidi,
  ChordTrack,
  Unit,
  getBarCapacity,
} from "./types";

export type RenderOptions = {
  container: HTMLElement;
  events: MelodyEvent[];
  measures: Measure[];
  timeSignature: TimeSignature;
  caret: number;
  selection: { start: number; end: number } | null;
  width: number;
  height: number;
  showCaret: boolean;
  chordTrack: ChordTrack;
  eventStartUnits: Unit[];
  documentEndUnit: Unit;
};

// Convert duration to VexFlow duration string
function durationToVexFlow(duration: "1/4" | "1/8" | "1/16"): string {
  switch (duration) {
    case "1/4":
      return "q"; // quarter
    case "1/8":
      return "8"; // eighth
    case "1/16":
      return "16"; // sixteenth
  }
}

// Convert pitch to VexFlow key string (e.g., "c/4", "d#/5")
function pitchToVexFlowKey(
  letter: string,
  octave: number,
  accidental: Accidental
): string {
  const vexLetter = letter.toLowerCase();

  // Don't include accidental in the key string - we'll add it separately
  return `${vexLetter}/${octave}`;
}

// System layout configuration
const STAVE_HEIGHT = 120;
const STAVE_MARGIN = 10;
const MEASURE_WIDTH = 200;
const SYSTEM_PADDING_X = 20;
const INTER_MEASURE_GAP = 0;

export function renderLeadSheet(options: RenderOptions) {
  const {
    container,
    events,
    measures,
    timeSignature,
    width,
    height,
    caret,
    selection,
    showCaret,
    chordTrack,
    eventStartUnits,
    documentEndUnit,
  } = options;

  // Clear container
  container.innerHTML = "";

  // Create VexFlow renderer
  const renderer = new Renderer(
    container as HTMLDivElement,
    Renderer.Backends.SVG
  );
  renderer.resize(width, height);
  const context = renderer.getContext();

  // VexFlow renders many glyphs (noteheads, clefs, time signatures) as SVG `<text>`.
  // Some app-level CSS resets (e.g. from UI libraries) may apply `font-family` to `text`
  // and override SVG presentation attributes. Force an inline style on the generated `<svg>`
  // so Bravura/Academico wins in the cascade.
  const svgEl = container.querySelector("svg");
  if (svgEl) {
    (svgEl as SVGSVGElement).style.fontFamily = "Bravura, Academico";
  }

  const measureMetadata = renderMeasures(
    context,
    svgEl,
    events,
    measures,
    timeSignature,
    width,
    height,
    caret,
    selection,
    showCaret
  );

  // Render chord regions overlay
  if (svgEl) {
    renderChordRegions(
      svgEl,
      chordTrack,
      timeSignature,
      measureMetadata,
      documentEndUnit
    );
  }
}

// Bounding box for a rendered note/rest
type NoteBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Metadata about rendered measures for chord overlay
type MeasureMetadata = {
  measureIndex: number;
  systemIndex: number;
  x: number; // left edge of measure
  y: number; // top of staff
  width: number;
  noteStartX: number; // where notes start (after clef/time sig)
  staffTop: number;
  staffBottom: number;
};

function renderMeasures(
  context: any,
  svgEl: Element | null,
  events: MelodyEvent[],
  measures: Measure[],
  timeSignature: TimeSignature,
  width: number,
  height: number,
  caret: number,
  selection: { start: number; end: number } | null,
  showCaret: boolean
): MeasureMetadata[] {
  // Map global event index to its bounding box after rendering
  const eventBBoxes = new Map<number, NoteBBox>();
  // Map global event index to rendered StaveNote for tie rendering
  const eventToStaveNote = new Map<number, StaveNote>();
  // Track ties to render after all notes are drawn
  const tiesToRender: Array<{ fromIdx: number; toIdx: number }> = [];
  // Map global event index to system index and staff metrics
  const eventToSystemIdx = new Map<number, number>();
  const eventToStaff = new Map<number, { top: number; bottom: number }>();
  // Capture first system staff for empty-doc caret fallback
  let firstSystemStaff: {
    top: number;
    bottom: number;
    noteStartX: number;
  } | null = null;
  // Calculate how many measures fit per system
  const availableWidth = Math.max(0, width - SYSTEM_PADDING_X * 2);
  const measuresPerSystem = Math.max(
    1,
    Math.floor(availableWidth / (MEASURE_WIDTH + INTER_MEASURE_GAP))
  );

  // Collect measure metadata for chord overlay
  const measureMetadata: MeasureMetadata[] = [];

  let yOffset = STAVE_MARGIN;

  // Group measures into systems
  for (
    let systemIdx = 0;
    systemIdx * measuresPerSystem < measures.length;
    systemIdx++
  ) {
    const systemMeasures = measures.slice(
      systemIdx * measuresPerSystem,
      (systemIdx + 1) * measuresPerSystem
    );

    let xOffset = SYSTEM_PADDING_X;

    // Render each measure in this system
    for (let i = 0; i < systemMeasures.length; i++) {
      const measure = systemMeasures[i];
      if (!measure) continue;

      const isFirstMeasureInSystem = i === 0;
      const isFirstMeasureOverall = measure.index === 0;

      // Get events for this measure
      const measureEvents = events.slice(
        measure.startEventIdx,
        measure.endEventIdx
      );

      // Create stave
      const stave = new Stave(xOffset, yOffset, MEASURE_WIDTH);

      // Add clef and time signature to first measure of each system
      if (isFirstMeasureInSystem) {
        stave.addClef("treble");
      }
      if (isFirstMeasureOverall) {
        stave.addTimeSignature(
          `${timeSignature.beatsPerBar}/${timeSignature.beatUnit}`
        );
      }

      // Visually connect measures within a system by butting staves together and
      // suppressing the redundant left barline on subsequent measures. The end
      // barline of the previous measure becomes the boundary barline.
      if (!isFirstMeasureInSystem) {
        stave.setBegBarType(BarlineType.NONE);
      }

      stave.setContext(context).draw();

      // Capture staff metrics for this measure
      const staffTop = stave.getYForLine(0);
      const staffBottom = stave.getYForLine(4);
      const staffMetrics = { top: staffTop, bottom: staffBottom };

      // Capture first system staff for empty-doc caret fallback
      if (firstSystemStaff === null) {
        firstSystemStaff = {
          top: staffTop,
          bottom: staffBottom,
          noteStartX: stave.getNoteStartX(),
        };
      }

      // Collect measure metadata for chord overlay
      measureMetadata.push({
        measureIndex: measure.index,
        systemIndex: systemIdx,
        x: xOffset,
        y: yOffset,
        width: MEASURE_WIDTH,
        noteStartX: stave.getNoteStartX(),
        staffTop,
        staffBottom,
      });

      // Convert events to VexFlow notes and track event indices
      const vexNotes: StaveNote[] = [];
      const noteToEventIdx: Map<StaveNote, number> = new Map();
      const chordAnchors: Array<{ globalIdx: number; chord: string }> = [];

      for (let localIdx = 0; localIdx < measureEvents.length; localIdx++) {
        const event = measureEvents[localIdx];
        if (!event) continue;
        const globalIdx = measure.startEventIdx + localIdx;

        if (event.kind === "note") {
          const vexDuration = durationToVexFlow(event.duration);
          const vexKey = pitchToVexFlowKey(
            event.pitch.letter,
            event.pitch.octave,
            event.pitch.accidental
          );

          const note = new StaveNote({
            keys: [vexKey],
            duration: vexDuration,
            clef: "treble",
          });

          // Add accidental if present
          if (event.pitch.accidental === "#") {
            note.addModifier(new VexAccidental("#"), 0);
          } else if (event.pitch.accidental === "b") {
            note.addModifier(new VexAccidental("b"), 0);
          }

          // Add chord symbol above note if present
          if (event.chord) {
            const chordSymbol = new ChordSymbol()
              .addText(event.chord)
              .setFont("Arial", 12);
            note.addModifier(chordSymbol, 0);
          }

          vexNotes.push(note);
          noteToEventIdx.set(note, globalIdx);
          eventToStaveNote.set(globalIdx, note);
        } else if (event.kind === "rest") {
          const vexDuration = durationToVexFlow(event.duration);
          const rest = new StaveNote({
            keys: ["b/4"],
            duration: `${vexDuration}r`, // 'r' suffix for rest
            clef: "treble",
          });
          vexNotes.push(rest);
          noteToEventIdx.set(rest, globalIdx);
          eventToStaveNote.set(globalIdx, rest);
        } else if (event.kind === "chordAnchor") {
          // Chord anchors don't render as notes, but we need to render their chord text
          chordAnchors.push({ globalIdx, chord: event.chord });
        }
      }

      // Only render notes if there are any
      if (vexNotes.length > 0) {
        try {
          // Create voice and format notes
          const voice = new Voice({
            numBeats: timeSignature.beatsPerBar,
            beatValue: timeSignature.beatUnit,
          });
          voice.setStrict(false); // Allow measures to be under/over
          voice.addTickables(vexNotes);

          const formatter = new Formatter();
          formatter.joinVoices([voice]);
          const rightPadding = 10;
          const formatWidth =
            xOffset + MEASURE_WIDTH - stave.getNoteStartX() - rightPadding;
          formatter.format([voice], Math.max(0, formatWidth));

          // Draw the voice
          voice.draw(context, stave);

          // After drawing, capture bounding boxes and check for ties
          for (const note of vexNotes) {
            const eventIdx = noteToEventIdx.get(note);
            if (eventIdx === undefined) continue;

            const bbox = note.getBoundingBox();
            if (bbox) {
              eventBBoxes.set(eventIdx, {
                x: bbox.x,
                y: bbox.y,
                width: bbox.w,
                height: bbox.h,
              });
            }

            // Record system index and staff metrics for this event
            eventToSystemIdx.set(eventIdx, systemIdx);
            eventToStaff.set(eventIdx, staffMetrics);

            // Check if this event has a tie
            const event = events[eventIdx];
            if (event && event.kind === "note" && event.tieToNext) {
              // Find next note (skip non-notes)
              let nextNoteIdx = null;
              for (let j = eventIdx + 1; j < events.length; j++) {
                const nextEvent = events[j];
                if (nextEvent && nextEvent.kind === "note") {
                  nextNoteIdx = j;
                  break;
                }
              }

              // Validate tie: same MIDI
              if (nextNoteIdx !== null) {
                const nextNote = events[nextNoteIdx];
                if (nextNote && nextNote.kind === "note") {
                  const currentMidi = pitchToMidi(event.pitch);
                  const nextMidi = pitchToMidi(nextNote.pitch);
                  if (currentMidi === nextMidi) {
                    tiesToRender.push({
                      fromIdx: eventIdx,
                      toIdx: nextNoteIdx,
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Error rendering measure notes:", error);
        }
      }

      // Render standalone chord anchors (chords without notes)
      if (chordAnchors.length > 0 && svgEl) {
        renderChordAnchors(
          svgEl,
          chordAnchors,
          stave,
          eventBBoxes,
          systemIdx,
          staffMetrics,
          eventToSystemIdx,
          eventToStaff
        );
      }

      xOffset += MEASURE_WIDTH + INTER_MEASURE_GAP;
    }

    yOffset += STAVE_HEIGHT + STAVE_MARGIN;
  }

  // Render ties
  renderTies(context, tiesToRender, eventToStaveNote);

  // Render selection + caret overlays and hitboxes
  if (svgEl) {
    renderOverlays(
      svgEl,
      eventBBoxes,
      caret,
      selection,
      showCaret,
      events.length,
      eventToSystemIdx,
      eventToStaff,
      firstSystemStaff
    );
  }

  return measureMetadata;
}

// Render ties between notes
function renderTies(
  context: any,
  tiesToRender: Array<{ fromIdx: number; toIdx: number }>,
  eventToStaveNote: Map<number, StaveNote>
) {
  for (const tie of tiesToRender) {
    const fromNote = eventToStaveNote.get(tie.fromIdx);
    const toNote = eventToStaveNote.get(tie.toIdx);

    if (fromNote && toNote) {
      try {
        const staveTie = new StaveTie({
          firstNote: fromNote,
          lastNote: toNote,
          firstIndexes: [0],
          lastIndexes: [0],
        });
        staveTie.setContext(context).draw();
      } catch (error) {
        console.error("Error rendering tie:", error);
      }
    }
  }
}

// Render standalone chord anchors as text on the staff
function renderChordAnchors(
  svgEl: Element,
  chordAnchors: Array<{ globalIdx: number; chord: string }>,
  stave: Stave,
  eventBBoxes: Map<number, NoteBBox>,
  systemIdx: number,
  staffMetrics: { top: number; bottom: number },
  eventToSystemIdx: Map<number, number>,
  eventToStaff: Map<number, { top: number; bottom: number }>
) {
  const NS = "http://www.w3.org/2000/svg";

  for (const anchor of chordAnchors) {
    // Position chord anchor to match VexFlow's chord symbol style
    // Place it at the staff's note area, above the staff like regular chord symbols
    const x = stave.getNoteStartX();
    const y = stave.getYForLine(0) - 30; // Above the staff, matching ChordSymbol position

    const text = document.createElementNS(NS, "text");
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y));
    text.setAttribute("font-family", "Arial, sans-serif");
    text.setAttribute("font-size", "12");
    text.setAttribute("font-weight", "normal"); // Regular weight like ChordSymbol
    text.setAttribute("fill", "black");
    text.textContent = anchor.chord;
    svgEl.appendChild(text);

    // Create a bounding box for the chord anchor so it can be clicked
    const bbox = text.getBBox();
    eventBBoxes.set(anchor.globalIdx, {
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
    });

    // Record system index and staff metrics for this chord anchor
    eventToSystemIdx.set(anchor.globalIdx, systemIdx);
    eventToStaff.set(anchor.globalIdx, staffMetrics);
  }
}

// Helper to get caret X position relative to a specific system
function getCaretX(
  idx: number,
  systemIdx: number,
  eventBBoxes: Map<number, NoteBBox>,
  eventToSystemIdx: Map<number, number>,
  firstSystemStaff: { top: number; bottom: number; noteStartX: number } | null,
  totalEvents: number
): number {
  const prevIdx = idx - 1;
  const nextIdx = idx;

  const prevBBox = eventBBoxes.get(prevIdx);
  const nextBBox = eventBBoxes.get(nextIdx);

  const prevOnSystem = prevBBox && eventToSystemIdx.get(prevIdx) === systemIdx;
  const nextOnSystem = nextBBox && eventToSystemIdx.get(nextIdx) === systemIdx;

  if (prevOnSystem && nextOnSystem) {
    // Midpoint between notes on same system
    return (prevBBox.x + prevBBox.width + nextBBox.x) / 2;
  } else if (nextOnSystem) {
    // Start of system (before first note of selection/system)
    return nextBBox.x;
  } else if (prevOnSystem) {
    // End of system (after last note of selection/system)
    let spacing = 25;
    const prevPrevBBox = eventBBoxes.get(prevIdx - 1);
    // Check if prevPrev is on same system
    if (prevPrevBBox && eventToSystemIdx.get(prevIdx - 1) === systemIdx) {
      spacing = (prevBBox.x - (prevPrevBBox.x + prevPrevBBox.width)) / 2;
    }
    return prevBBox.x + prevBBox.width + spacing;
  } else {
    // Empty document case
    if (totalEvents === 0 && firstSystemStaff && systemIdx === 0) {
      return firstSystemStaff.noteStartX;
    }
    return 0;
  }
}

// Render selection highlight, caret, and clickable hitboxes
function renderOverlays(
  svgEl: Element,
  eventBBoxes: Map<number, NoteBBox>,
  caret: number,
  selection: { start: number; end: number } | null,
  showCaret: boolean,
  totalEvents: number,
  eventToSystemIdx: Map<number, number>,
  eventToStaff: Map<number, { top: number; bottom: number }>,
  firstSystemStaff: { top: number; bottom: number; noteStartX: number } | null
) {
  const NS = "http://www.w3.org/2000/svg";

  // Add CSS for blinking caret
  const style = document.createElementNS(NS, "style");
  style.textContent = `
    @keyframes ls-caret-blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }
    .ls-caret {
      animation: ls-caret-blink 1.2s step-end infinite;
    }
  `;
  svgEl.appendChild(style);

  // Create separate overlay groups for layering
  const selectionGroup = document.createElementNS(NS, "g");
  selectionGroup.setAttribute("id", "selection-overlay");
  selectionGroup.setAttribute("pointer-events", "none");

  const caretGroup = document.createElementNS(NS, "g");
  caretGroup.setAttribute("id", "caret-overlay");
  caretGroup.setAttribute("pointer-events", "none");

  const hitboxGroup = document.createElementNS(NS, "g");
  hitboxGroup.setAttribute("id", "hitbox-overlay");

  // Try to insert selection behind notes (best effort)
  const firstNoteNode = svgEl.querySelector(
    ".vf-stavenote, .vf-note, .vf-glyph"
  );
  if (firstNoteNode) {
    svgEl.insertBefore(selectionGroup, firstNoteNode);
  } else {
    svgEl.appendChild(selectionGroup);
  }
  svgEl.appendChild(caretGroup);
  svgEl.appendChild(hitboxGroup);

  // 1) Render selection highlights
  if (selection) {
    // Find all systems covered by the selection
    const systems = new Set<number>();
    for (let i = selection.start; i < selection.end; i++) {
      const sys = eventToSystemIdx.get(i);
      if (sys !== undefined) systems.add(sys);
    }

    const sortedSystems = Array.from(systems).sort((a, b) => a - b);

    for (const systemIdx of sortedSystems) {
      let firstEventIdxInSys = -1;
      let lastEventIdxInSys = -1;

      // Find extent of selection on this system
      for (let i = selection.start; i < selection.end; i++) {
        if (eventToSystemIdx.get(i) === systemIdx) {
          if (firstEventIdxInSys === -1) firstEventIdxInSys = i;
          lastEventIdxInSys = i;
        }
      }

      if (firstEventIdxInSys !== -1) {
        const x1 = getCaretX(
          firstEventIdxInSys,
          systemIdx,
          eventBBoxes,
          eventToSystemIdx,
          firstSystemStaff,
          totalEvents
        );
        const x2 = getCaretX(
          lastEventIdxInSys + 1,
          systemIdx,
          eventBBoxes,
          eventToSystemIdx,
          firstSystemStaff,
          totalEvents
        );

        // Get Y bounds from staff metrics
        const staff = eventToStaff.get(firstEventIdxInSys);
        if (staff) {
          const rect = document.createElementNS(NS, "rect");
          const rectY = staff.top - 8; // standard padding
          const rectHeight = staff.bottom - staff.top + 16;

          rect.setAttribute("x", String(Math.min(x1, x2)));
          rect.setAttribute("y", String(rectY));
          rect.setAttribute("width", String(Math.abs(x2 - x1)));
          rect.setAttribute("height", String(rectHeight));
          rect.setAttribute("fill", "rgba(59, 130, 246, 0.2)"); // blue.500 with opacity
          rect.setAttribute("stroke", "transparent");
          rect.setAttribute("pointer-events", "none");
          selectionGroup.appendChild(rect);
        }
      }
    }
  }

  // 2) Render caret (insertion cursor)
  if (showCaret) {
    // Determine which system the caret should be on
    let systemIdx = eventToSystemIdx.get(caret);
    if (systemIdx === undefined) {
      systemIdx = eventToSystemIdx.get(caret - 1);
    }
    if (systemIdx === undefined && firstSystemStaff) {
      systemIdx = 0;
    }

    if (systemIdx !== undefined) {
      const cx = getCaretX(
        caret,
        systemIdx,
        eventBBoxes,
        eventToSystemIdx,
        firstSystemStaff,
        totalEvents
      );

      // Get staff metrics
      let staff = eventToStaff.get(caret) || eventToStaff.get(caret - 1);

      // Ensure staff matches the target system if ambiguous
      if (staff) {
        const s1 = eventToSystemIdx.get(caret);
        const s2 = eventToSystemIdx.get(caret - 1);
        if (s1 !== systemIdx && s2 !== systemIdx) {
          // Try to find any staff on this system (should generally match caret logic)
          // But usually one of them matches.
        }
      }

      if (!staff && firstSystemStaff && systemIdx === 0) {
        staff = { top: firstSystemStaff.top, bottom: firstSystemStaff.bottom };
      }

      if (staff) {
        const staffPadding = 8;
        const cy = staff.top - staffPadding;
        const ch = staff.bottom - staff.top + 2 * staffPadding;

        const line = document.createElementNS(NS, "line");
        line.setAttribute("class", "ls-caret");
        line.setAttribute("x1", String(cx));
        line.setAttribute("y1", String(cy));
        line.setAttribute("x2", String(cx));
        line.setAttribute("y2", String(cy + ch));
        line.setAttribute("stroke", "rgb(59, 130, 246)"); // blue.500
        line.setAttribute("stroke-width", "2");
        line.setAttribute("pointer-events", "none");
        caretGroup.appendChild(line);
      }
    }
  }

  // 3) Add transparent hitboxes for each rendered event
  for (const [eventIdx, bbox] of eventBBoxes.entries()) {
    const hitbox = document.createElementNS(NS, "rect");
    hitbox.setAttribute("x", String(bbox.x));
    hitbox.setAttribute("y", String(bbox.y));
    hitbox.setAttribute("width", String(bbox.width));
    hitbox.setAttribute("height", String(bbox.height));
    hitbox.setAttribute("fill", "transparent");
    hitbox.setAttribute("stroke", "transparent");
    hitbox.setAttribute("cursor", "pointer");
    hitbox.setAttribute("data-event-idx", String(eventIdx));
    hitboxGroup.appendChild(hitbox);
  }
}

// Render chord regions as boxes above the staff
function renderChordRegions(
  svgEl: Element,
  chordTrack: ChordTrack,
  timeSignature: TimeSignature,
  measureMetadata: MeasureMetadata[],
  documentEndUnit: Unit
) {
  const NS = "http://www.w3.org/2000/svg";
  const unitsPerBar = getBarCapacity(timeSignature);

  // Create a group for chord regions
  const chordGroup = document.createElementNS(NS, "g");
  chordGroup.setAttribute("id", "chord-regions");
  svgEl.appendChild(chordGroup);

  // Render each chord region
  for (const region of chordTrack.regions) {
    const startBar = Math.floor(region.start / unitsPerBar);
    const endBar = Math.floor((region.end - 1) / unitsPerBar);

    // Find all measures this region spans
    const spannedMeasures = measureMetadata.filter(
      (m) => m.measureIndex >= startBar && m.measureIndex <= endBar
    );

    if (spannedMeasures.length === 0) continue;

    // For each system this region appears on, render a box
    const systemsSpanned = new Set(spannedMeasures.map((m) => m.systemIndex));

    for (const systemIdx of systemsSpanned) {
      const measuresInSystem = spannedMeasures.filter(
        (m) => m.systemIndex === systemIdx
      );
      if (measuresInSystem.length === 0) continue;

      const firstMeasure = measuresInSystem[0]!;
      const lastMeasure = measuresInSystem[measuresInSystem.length - 1]!;

      // Calculate x position within first measure
      const startOffsetInBar = region.start % unitsPerBar;
      const startFraction = startOffsetInBar / unitsPerBar;
      const firstMeasureNoteWidth =
        firstMeasure.width - (firstMeasure.noteStartX - firstMeasure.x);
      const startX =
        firstMeasure.noteStartX + startFraction * firstMeasureNoteWidth;

      // Calculate x position within last measure
      const endOffsetInBar = region.end % unitsPerBar;
      const endFraction =
        endOffsetInBar === 0 ? 1 : endOffsetInBar / unitsPerBar;
      const lastMeasureNoteWidth =
        lastMeasure.width - (lastMeasure.noteStartX - lastMeasure.x);
      const endX = lastMeasure.noteStartX + endFraction * lastMeasureNoteWidth;

      // Calculate width
      const width = endX - startX;

      // Position above the staff
      const y = firstMeasure.staffTop - 50;
      const height = 30;

      // Render the chord box
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", String(startX));
      rect.setAttribute("y", String(y));
      rect.setAttribute("width", String(width));
      rect.setAttribute("height", String(height));
      rect.setAttribute("fill", "rgba(147, 197, 253, 0.3)"); // blue.300 with opacity
      rect.setAttribute("stroke", "rgb(59, 130, 246)"); // blue.500
      rect.setAttribute("stroke-width", "1");
      rect.setAttribute("rx", "4");
      rect.setAttribute("cursor", "pointer");
      rect.setAttribute("data-chord-id", region.id);
      chordGroup.appendChild(rect);

      // Render the chord text
      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", String(startX + 6));
      text.setAttribute("y", String(y + height / 2 + 5));
      text.setAttribute("font-family", "Arial, sans-serif");
      text.setAttribute("font-size", "14");
      text.setAttribute("font-weight", "600");
      text.setAttribute("fill", "rgb(30, 64, 175)"); // blue.800
      text.setAttribute("pointer-events", "none");
      text.textContent = region.text;
      chordGroup.appendChild(text);

      // Render left handle
      const leftHandle = document.createElementNS(NS, "rect");
      leftHandle.setAttribute("x", String(startX - 3));
      leftHandle.setAttribute("y", String(y + height / 2 - 8));
      leftHandle.setAttribute("width", "6");
      leftHandle.setAttribute("height", "16");
      leftHandle.setAttribute("fill", "rgb(59, 130, 246)"); // blue.500
      leftHandle.setAttribute("rx", "2");
      leftHandle.setAttribute("cursor", "ew-resize");
      leftHandle.setAttribute("data-chord-id", region.id);
      leftHandle.setAttribute("data-handle", "left");
      chordGroup.appendChild(leftHandle);

      // Render right handle
      const rightHandle = document.createElementNS(NS, "rect");
      rightHandle.setAttribute("x", String(endX - 3));
      rightHandle.setAttribute("y", String(y + height / 2 - 8));
      rightHandle.setAttribute("width", "6");
      rightHandle.setAttribute("height", "16");
      rightHandle.setAttribute("fill", "rgb(59, 130, 246)"); // blue.500
      rightHandle.setAttribute("rx", "2");
      rightHandle.setAttribute("cursor", "ew-resize");
      rightHandle.setAttribute("data-chord-id", region.id);
      rightHandle.setAttribute("data-handle", "right");
      chordGroup.appendChild(rightHandle);
    }
  }
}
