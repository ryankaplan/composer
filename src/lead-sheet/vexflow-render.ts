import {
  Renderer,
  Stave,
  StaveNote,
  Formatter,
  Voice,
  Accidental as VexAccidental,
  BarlineType,
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
  midi: number,
  letter: string,
  accidental: Accidental
): string {
  const octave = Math.floor(midi / 12) - 1; // VexFlow uses scientific pitch notation (C4 = middle C)
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
  const { container, events, measures, timeSignature, width, height } = options;

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

  renderMeasures(context, events, measures, timeSignature, width, height);
}

function renderMeasures(
  context: any,
  events: MelodyEvent[],
  measures: Measure[],
  timeSignature: TimeSignature,
  width: number,
  height: number
) {
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

      // Convert events to VexFlow notes
      const vexNotes: StaveNote[] = [];
      for (const event of measureEvents) {
        if (event.kind === "note") {
          const vexDuration = durationToVexFlow(event.duration);
          const vexKey = pitchToVexFlowKey(
            event.pitch.midi,
            event.pitch.letter,
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

          // TODO: Add chord symbol above note if present
          // This would require using VexFlow's TextNote or custom SVG

          vexNotes.push(note);
        } else if (event.kind === "rest") {
          const vexDuration = durationToVexFlow(event.duration);
          const rest = new StaveNote({
            keys: ["b/4"],
            duration: `${vexDuration}r`, // 'r' suffix for rest
            clef: "treble",
          });
          vexNotes.push(rest);
        }
        // Note: chordAnchor events are not rendered as notes (they have no duration)
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
        } catch (error) {
          console.error("Error rendering measure notes:", error);
        }
      }

      xOffset += MEASURE_WIDTH + INTER_MEASURE_GAP;
    }

    yOffset += STAVE_HEIGHT + STAVE_MARGIN;
  }

  // TODO: Render caret overlay
  // TODO: Render selection overlay
  // TODO: Render chord symbols
}
