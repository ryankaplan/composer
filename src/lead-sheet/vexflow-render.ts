import {
  Renderer,
  Stave,
  StaveNote,
  Formatter,
  Voice,
  Accidental as VexAccidental,
  BarlineType,
  StaveTie,
  Dot,
} from "vexflow/bravura";
import {
  MelodyEvent,
  Measure,
  TimeSignature,
  KeySignature,
  Accidental,
  pitchToMidi,
  ChordTrack,
  Tick,
  getBarCapacity,
  durationToTicks,
  NoteValue,
} from "./types";

export type RenderOptions = {
  container: HTMLElement;
  events: MelodyEvent[];
  measures: Measure[];
  timeSignature: TimeSignature;
  keySignature: KeySignature;
  caret: number;
  selection: { start: number; end: number } | null;
  width: number;
  height: number;
  showCaret: boolean;
  playheadTick?: Tick;
};

// Convert duration base to VexFlow duration string
function durationToVexFlow(base: NoteValue): string {
  switch (base) {
    case "1/1":
      return "w"; // whole
    case "1/2":
      return "h"; // half
    case "1/4":
      return "q"; // quarter
    case "1/8":
      return "8"; // eighth
    case "1/16":
      return "16"; // sixteenth
  }
}

// Convert pitch to VexFlow key string (e.g., "c/4", "d#/5", "bb/4")
function pitchToVexFlowKey(
  letter: string,
  accidental: Accidental,
  octave: number
): string {
  const vexLetter = letter.toLowerCase();
  const accidentalStr =
    accidental === "#" ? "#" : accidental === "b" ? "b" : "";
  return `${vexLetter}${accidentalStr}/${octave}`;
}

// System layout configuration
const STAVE_HEIGHT = 120;
const STAVE_MARGIN = 10;
const MEASURE_WIDTH = 200;
const SYSTEM_PADDING_X = 20;
const INTER_MEASURE_GAP = 0;

export function renderLeadSheet(options: RenderOptions): LeadSheetLayout {
  const {
    container,
    events,
    measures,
    timeSignature,
    keySignature,
    width,
    height,
    caret,
    selection,
    showCaret,
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
    keySignature,
    width,
    height,
    caret,
    selection,
    showCaret,
    options.playheadTick
  );

  // Return layout data for React overlay
  const ticksPerBar = getBarCapacity(timeSignature);
  const availableWidth = Math.max(0, width - SYSTEM_PADDING_X * 2);
  const measuresPerSystem = Math.max(
    1,
    Math.floor(availableWidth / (MEASURE_WIDTH + INTER_MEASURE_GAP))
  );
  return {
    measureMetadata,
    ticksPerBar,
    measuresPerSystem,
    measureWidth: MEASURE_WIDTH,
    systemPaddingX: SYSTEM_PADDING_X,
    interMeasureGap: INTER_MEASURE_GAP,
    staveMargin: STAVE_MARGIN,
    staveHeight: STAVE_HEIGHT,
  };
}

// Bounding box for a rendered note/rest
type NoteBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Metadata about rendered measures for chord overlay
export type MeasureMetadata = {
  measureIndex: number;
  systemIndex: number;
  x: number; // left edge of measure
  y: number; // top of staff
  width: number;
  noteStartX: number; // where notes start (after clef/time sig)
  staffTop: number;
  staffBottom: number;
};

// Layout data returned by renderLeadSheet for React overlay
export type LeadSheetLayout = {
  measureMetadata: MeasureMetadata[];
  ticksPerBar: Tick;
  measuresPerSystem: number;
  measureWidth: number;
  systemPaddingX: number;
  interMeasureGap: number;
  staveMargin: number;
  staveHeight: number;
};

function renderMeasures(
  context: any,
  svgEl: Element | null,
  events: MelodyEvent[],
  measures: Measure[],
  timeSignature: TimeSignature,
  keySignature: KeySignature,
  width: number,
  height: number,
  caret: number,
  selection: { start: number; end: number } | null,
  showCaret: boolean,
  playheadTick?: Tick
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

      // Add clef, key signature, and time signature to first measure of each system
      if (isFirstMeasureInSystem) {
        stave.addClef("treble");
        stave.addKeySignature(keySignature);
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

      for (let localIdx = 0; localIdx < measureEvents.length; localIdx++) {
        const event = measureEvents[localIdx];
        if (!event) continue;
        const globalIdx = measure.startEventIdx + localIdx;

        if (event.kind === "note") {
          const vexDuration = durationToVexFlow(event.duration.base);
          const vexKey = pitchToVexFlowKey(
            event.pitch.letter,
            event.pitch.accidental,
            event.pitch.octave
          );

          const note = new StaveNote({
            keys: [vexKey],
            duration: vexDuration,
            clef: "treble",
          });

          // Add dots if any
          for (let d = 0; d < event.duration.dots; d++) {
            Dot.buildAndAttach([note], { all: true });
          }

          vexNotes.push(note);
          noteToEventIdx.set(note, globalIdx);
          eventToStaveNote.set(globalIdx, note);
        } else if (event.kind === "rest") {
          const vexDuration = durationToVexFlow(event.duration.base);
          const rest = new StaveNote({
            keys: ["b/4"],
            duration: `${vexDuration}r`, // 'r' suffix for rest
            clef: "treble",
          });

          // Add dots if any
          for (let d = 0; d < event.duration.dots; d++) {
            Dot.buildAndAttach([rest], { all: true });
          }

          vexNotes.push(rest);
          noteToEventIdx.set(rest, globalIdx);
          eventToStaveNote.set(globalIdx, rest);
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

          // Apply accidentals based on key signature
          VexAccidental.applyAccidentals([voice], keySignature);

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
      firstSystemStaff,
      playheadTick,
      events,
      measures,
      measureMetadata,
      timeSignature
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
  firstSystemStaff: { top: number; bottom: number; noteStartX: number } | null,
  playheadTick?: Tick,
  events?: MelodyEvent[],
  measures?: Measure[],
  measureMetadata?: MeasureMetadata[],
  timeSignature?: TimeSignature
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

  const playheadGroup = document.createElementNS(NS, "g");
  playheadGroup.setAttribute("id", "playhead-overlay");
  playheadGroup.setAttribute("pointer-events", "none");

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
  svgEl.appendChild(playheadGroup);
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

  // 3) Render playhead (if active)
  if (
    playheadTick !== undefined &&
    events &&
    measures &&
    measures.length > 0 &&
    measureMetadata &&
    timeSignature
  ) {
    // Find which measure the playhead is in
    const ticksPerBar = getBarCapacity(timeSignature);
    const measureIndex = Math.floor(playheadTick / ticksPerBar);

    // Find the measure metadata
    const measureMeta = measureMetadata.find(
      (m) => m.measureIndex === measureIndex
    );

    if (measureMeta) {
      // Calculate position within the measure
      const measureStartTick = measureIndex * ticksPerBar;
      const tickWithinMeasure = playheadTick - measureStartTick;
      const fractionWithinMeasure = tickWithinMeasure / ticksPerBar;

      // Interpolate X position within the measure's note area
      const noteAreaWidth =
        measureMeta.width - (measureMeta.noteStartX - measureMeta.x);
      const px = measureMeta.noteStartX + fractionWithinMeasure * noteAreaWidth;

      // Get staff metrics from the measure
      const staffPadding = 8;
      const py = measureMeta.staffTop - staffPadding;
      const ph =
        measureMeta.staffBottom - measureMeta.staffTop + 2 * staffPadding;

      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", String(px));
      line.setAttribute("y1", String(py));
      line.setAttribute("x2", String(px));
      line.setAttribute("y2", String(py + ph));
      line.setAttribute("stroke", "rgb(239, 68, 68)"); // red.500
      line.setAttribute("stroke-width", "2");
      line.setAttribute("pointer-events", "none");
      playheadGroup.appendChild(line);
    } else if (measureIndex >= 0 && firstSystemStaff) {
      // Fallback: playhead is beyond rendered measures (at the end)
      // Use the last rendered measure or first system staff
      const lastMeasure = measureMetadata[measureMetadata.length - 1];
      if (lastMeasure) {
        const px =
          lastMeasure.noteStartX +
          lastMeasure.width -
          (lastMeasure.noteStartX - lastMeasure.x);
        const staffPadding = 8;
        const py = lastMeasure.staffTop - staffPadding;
        const ph =
          lastMeasure.staffBottom - lastMeasure.staffTop + 2 * staffPadding;

        const line = document.createElementNS(NS, "line");
        line.setAttribute("x1", String(px));
        line.setAttribute("y1", String(py));
        line.setAttribute("x2", String(px));
        line.setAttribute("y2", String(py + ph));
        line.setAttribute("stroke", "rgb(239, 68, 68)"); // red.500
        line.setAttribute("stroke-width", "2");
        line.setAttribute("pointer-events", "none");
        playheadGroup.appendChild(line);
      }
    }
  }

  // 4) Add transparent hitboxes for each rendered event
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
