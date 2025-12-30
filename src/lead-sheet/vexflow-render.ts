import {
  Renderer,
  Stave,
  StaveNote,
  Formatter,
  Voice,
  Accidental as VexAccidental,
  BarlineType,
  ChordSymbol,
} from "vexflow/bravura";
import { MelodyEvent, Measure, TimeSignature, Accidental } from "./types";

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

  renderMeasures(
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
}

// Bounding box for a rendered note/rest
type NoteBBox = {
  x: number;
  y: number;
  width: number;
  height: number;
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
) {
  // Map global event index to its bounding box after rendering
  const eventBBoxes = new Map<number, NoteBBox>();
  // Calculate how many measures fit per system
  const availableWidth = Math.max(0, width - SYSTEM_PADDING_X * 2);
  const measuresPerSystem = Math.max(
    1,
    Math.floor(availableWidth / (MEASURE_WIDTH + INTER_MEASURE_GAP))
  );

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

      // Draw invalid measure background (only if there are events)
      if (measureEvents.length > 0 && measure.status !== "ok") {
        const bgColor =
          measure.status === "under"
            ? "rgba(255, 200, 100, 0.2)"
            : "rgba(255, 100, 100, 0.2)";
        context.save();
        context.setFillStyle(bgColor);
        context.fillRect(xOffset, yOffset, MEASURE_WIDTH, STAVE_HEIGHT);
        context.restore();
      }

      stave.setContext(context).draw();

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
        } else if (event.kind === "rest") {
          const vexDuration = durationToVexFlow(event.duration);
          const rest = new StaveNote({
            keys: ["b/4"],
            duration: `${vexDuration}r`, // 'r' suffix for rest
            clef: "treble",
          });
          vexNotes.push(rest);
          noteToEventIdx.set(rest, globalIdx);
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

          // After drawing, capture bounding boxes for each note/rest
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
          }
        } catch (error) {
          console.error("Error rendering measure notes:", error);
        }
      }

      // Render standalone chord anchors (chords without notes)
      if (chordAnchors.length > 0 && svgEl) {
        renderChordAnchors(svgEl, chordAnchors, stave, eventBBoxes);
      }

      xOffset += MEASURE_WIDTH + INTER_MEASURE_GAP;
    }

    yOffset += STAVE_HEIGHT + STAVE_MARGIN;
  }

  // Render selection + caret overlays and hitboxes
  if (svgEl) {
    renderOverlays(
      svgEl,
      eventBBoxes,
      caret,
      selection,
      showCaret,
      events.length
    );
  }
}

// Render standalone chord anchors as text on the staff
function renderChordAnchors(
  svgEl: Element,
  chordAnchors: Array<{ globalIdx: number; chord: string }>,
  stave: Stave,
  eventBBoxes: Map<number, NoteBBox>
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
  }
}

// Render selection highlight, caret, and clickable hitboxes
function renderOverlays(
  svgEl: Element,
  eventBBoxes: Map<number, NoteBBox>,
  caret: number,
  selection: { start: number; end: number } | null,
  showCaret: boolean,
  totalEvents: number
) {
  const NS = "http://www.w3.org/2000/svg";

  // Create an overlay group
  const overlayGroup = document.createElementNS(NS, "g");
  overlayGroup.setAttribute("id", "cursor-selection-overlay");
  svgEl.appendChild(overlayGroup);

  // 1) Render selection highlights
  if (selection) {
    for (let i = selection.start; i < selection.end; i++) {
      const bbox = eventBBoxes.get(i);
      if (!bbox) continue;

      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", String(bbox.x));
      rect.setAttribute("y", String(bbox.y));
      rect.setAttribute("width", String(bbox.width));
      rect.setAttribute("height", String(bbox.height));
      rect.setAttribute("fill", "rgba(59, 130, 246, 0.2)"); // blue.500 with opacity
      rect.setAttribute("stroke", "rgba(59, 130, 246, 0.5)");
      rect.setAttribute("stroke-width", "1");
      rect.setAttribute("pointer-events", "none");
      overlayGroup.appendChild(rect);
    }
  }

  // 2) Render caret (insertion cursor)
  if (showCaret) {
    let caretX: number | null = null;
    let caretY = 0;
    let caretHeight = STAVE_HEIGHT;

    // Find the bbox of the event at or after the caret position
    const nextEventBBox = eventBBoxes.get(caret);
    if (nextEventBBox) {
      // Place caret at the left edge of the next event
      caretX = nextEventBBox.x;
      caretY = nextEventBBox.y;
      caretHeight = nextEventBBox.height;
    } else if (caret > 0) {
      // Place caret at the right edge of the last event
      const prevEventBBox = eventBBoxes.get(caret - 1);
      if (prevEventBBox) {
        caretX = prevEventBBox.x + prevEventBBox.width;
        caretY = prevEventBBox.y;
        caretHeight = prevEventBBox.height;
      }
    } else if (caret === 0 && totalEvents === 0) {
      // Empty document: place caret at a reasonable default position
      caretX = SYSTEM_PADDING_X + 60; // After clef/time signature
      caretY = STAVE_MARGIN;
      caretHeight = STAVE_HEIGHT;
    }

    if (caretX !== null) {
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", String(caretX));
      line.setAttribute("y1", String(caretY));
      line.setAttribute("x2", String(caretX));
      line.setAttribute("y2", String(caretY + caretHeight));
      line.setAttribute("stroke", "rgb(59, 130, 246)"); // blue.500
      line.setAttribute("stroke-width", "2");
      line.setAttribute("pointer-events", "none");
      overlayGroup.appendChild(line);
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
    hitbox.setAttribute("cursor", "pointer");
    hitbox.setAttribute("data-event-idx", String(eventIdx));
    overlayGroup.appendChild(hitbox);
  }
}
