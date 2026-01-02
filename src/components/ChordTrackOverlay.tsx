import React, { useState, useRef, useEffect } from "react";
import { Box } from "@chakra-ui/react";
import {
  ChordTrack,
  TimeSignature,
  KeySignature,
  ChordRegion,
  Unit,
} from "../lead-sheet/types";
import { LeadSheetLayout, MeasureMetadata } from "../lead-sheet/vexflow-render";
import {
  clampResizeToNeighbors,
  computeInsertionGaps,
} from "../lead-sheet/chords";
import { isDiatonicChordSymbol } from "../lead-sheet/diatonic-chords";

type ChordTrackOverlayProps = {
  chordTrack: ChordTrack;
  timeSignature: TimeSignature;
  keySignature: KeySignature;
  layout: LeadSheetLayout;
  selectedChordId: string | null;
  onChordClick: (
    chordId: string,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => void;
  onBackgroundClick: () => void;
  onMeasureInsertClick: (measureIndex: number, clickUnit: Unit) => void;
  onResizeCommit: (regionId: string, newStart: Unit, newEnd: Unit) => void;
  onChordAppend: (
    start: Unit,
    end: Unit,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => void;
};

type DragState = {
  regionId: string;
  handle: "left" | "right";
  originalStart: Unit;
  originalEnd: Unit;
  previewStart: Unit;
  previewEnd: Unit;
};

// A chord segment represents a visual box for a chord region on a specific system
type ChordSegment = {
  regionId: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// A gap box represents a clickable insertion area for a gap
type GapBox = {
  measureIndex: number;
  gapStart: Unit;
  gapEnd: Unit;
  x: number;
  y: number;
  width: number;
  height: number;
};

// An append box represents a clickable area to append a chord after the last chord
type AppendBox = {
  start: Unit;
  end: Unit;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function ChordTrackOverlay({
  chordTrack,
  timeSignature,
  keySignature,
  layout,
  selectedChordId,
  onChordClick,
  onBackgroundClick,
  onMeasureInsertClick,
  onResizeCommit,
  onChordAppend,
}: ChordTrackOverlayProps) {
  const [hoveredGapKey, setHoveredGapKey] = useState<string | null>(null);
  const [hoveredAppendKey, setHoveredAppendKey] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const segments = computeChordSegments(
    chordTrack,
    layout.measureMetadata,
    layout.unitsPerBar
  );

  // Compute gap boxes for insertion
  const gapBoxes = computeGapBoxes(
    chordTrack,
    timeSignature,
    layout.measureMetadata,
    layout.unitsPerBar
  );

  // Compute chord append boxes (right of last chord)
  const appendBoxes = computeChordAppendBoxes(chordTrack, layout);

  // Apply drag preview to segments if dragging
  const displaySegments = dragState
    ? applyDragPreviewToSegments(
        segments,
        dragState,
        layout.measureMetadata,
        layout.unitsPerBar
      )
    : segments;

  // Handle pointer move during drag
  useEffect(() => {
    if (!dragState || !overlayRef.current) return;

    function handlePointerMove(e: PointerEvent) {
      if (!dragState || !layout) return;

      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;

      // Convert mouse position to Units
      const unit = pixelToUnit(
        mouseX,
        layout.measureMetadata,
        layout.unitsPerBar
      );
      if (unit === null) return;

      // Snap to beat boundaries (4 units per beat in 4/4)
      const beatsPerUnit = 4;
      const snappedUnit = Math.round(unit / beatsPerUnit) * beatsPerUnit;

      // Compute new start/end based on which handle is dragging
      let newStart = dragState.originalStart;
      let newEnd = dragState.originalEnd;

      if (dragState.handle === "left") {
        newStart = snappedUnit;
      } else {
        newEnd = snappedUnit;
      }

      // Clamp to neighbors
      const region = chordTrack.regions.find(
        (r) => r.id === dragState.regionId
      );
      if (!region) return;

      const clamped = clampResizeToNeighbors(
        chordTrack,
        dragState.regionId,
        newStart,
        newEnd
      );
      if (!clamped) return;

      setDragState({
        ...dragState,
        previewStart: clamped.start,
        previewEnd: clamped.end,
      });
    }

    function handlePointerUp() {
      if (!dragState) return;

      // Commit the resize
      onResizeCommit(
        dragState.regionId,
        dragState.previewStart,
        dragState.previewEnd
      );
      setDragState(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, layout, chordTrack, onResizeCommit]);

  // Start dragging a handle
  function startDrag(regionId: string, handle: "left" | "right") {
    const region = chordTrack.regions.find((r) => r.id === regionId);
    if (!region) return;

    // Clear hover state when starting drag
    setHoveredGapKey(null);

    setDragState({
      regionId,
      handle,
      originalStart: region.start,
      originalEnd: region.end,
      previewStart: region.start,
      previewEnd: region.end,
    });
  }

  return (
    <Box
      ref={overlayRef}
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      pointerEvents="none"
    >
      {/* Background click area to deselect chords */}
      <Box
        position="absolute"
        top={0}
        left={0}
        width="100%"
        height="100%"
        pointerEvents="auto"
        onClick={onBackgroundClick}
      />

      {/* Gap insertion hover boxes - only show when not dragging */}
      {!dragState &&
        gapBoxes.map((gapBox) => {
          const gapKey = `gap-${gapBox.measureIndex}-${gapBox.gapStart}-${gapBox.gapEnd}`;
          return (
            <GapInsertionBox
              key={gapKey}
              gapBox={gapBox}
              isHovered={hoveredGapKey === gapKey}
              onHover={() => setHoveredGapKey(gapKey)}
              onLeave={() => setHoveredGapKey(null)}
              onClick={(clickUnit) =>
                onMeasureInsertClick(gapBox.measureIndex, clickUnit)
              }
              overlayRef={overlayRef}
              layout={layout}
            />
          );
        })}

      {/* Chord append boxes - only show when not dragging */}
      {!dragState &&
        appendBoxes.map((appendBox, idx) => {
          const key = `append-${appendBox.start}-${appendBox.end}-${idx}`;
          return (
            <ChordAppendBox
              key={key}
              appendBox={appendBox}
              isHovered={hoveredAppendKey === key}
              onHover={() => setHoveredAppendKey(key)}
              onLeave={() => setHoveredAppendKey(null)}
              onClick={() =>
                onChordAppend(
                  appendBox.start,
                  appendBox.end,
                  appendBox.text,
                  appendBox.x,
                  appendBox.y,
                  appendBox.width,
                  appendBox.height
                )
              }
            />
          );
        })}

      {displaySegments.map((segment, idx) => (
        <ChordBox
          key={`${segment.regionId}-${idx}`}
          segment={segment}
          keySignature={keySignature}
          isSelected={segment.regionId === selectedChordId}
          isDragging={dragState?.regionId === segment.regionId}
          onChordClick={onChordClick}
          onHandleDragStart={startDrag}
        />
      ))}
    </Box>
  );
}

type GapInsertionBoxProps = {
  gapBox: GapBox;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: (clickUnit: Unit) => void;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  layout: LeadSheetLayout;
};

function GapInsertionBox({
  gapBox,
  isHovered,
  onHover,
  onLeave,
  onClick,
  overlayRef,
  layout,
}: GapInsertionBoxProps) {
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();

    // Convert click position to Unit
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const clickUnit = pixelToUnit(
      mouseX,
      layout.measureMetadata,
      layout.unitsPerBar
    );

    if (clickUnit !== null) {
      onClick(clickUnit);
    }
  }

  return (
    <Box
      position="absolute"
      left={`${gapBox.x}px`}
      top={`${gapBox.y}px`}
      width={`${gapBox.width}px`}
      height={`${gapBox.height}px`}
      border={isHovered ? "1px dashed rgba(59, 130, 246, 0.4)" : "none"}
      bg={isHovered ? "rgba(147, 197, 253, 0.1)" : "transparent"}
      borderRadius="4px"
      cursor="pointer"
      pointerEvents="auto"
      display="flex"
      alignItems="center"
      justifyContent="center"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={handleClick}
    >
      {isHovered && (
        <Box
          fontSize="20px"
          color="rgba(59, 130, 246, 0.6)"
          fontWeight="300"
          userSelect="none"
        >
          +
        </Box>
      )}
    </Box>
  );
}

type ChordBoxProps = {
  segment: ChordSegment;
  keySignature: KeySignature;
  isSelected: boolean;
  isDragging: boolean;
  onChordClick: (
    chordId: string,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) => void;
  onHandleDragStart: (regionId: string, handle: "left" | "right") => void;
};

function ChordBox({
  segment,
  keySignature,
  isSelected,
  isDragging,
  onChordClick,
  onHandleDragStart,
}: ChordBoxProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isDiatonic = isDiatonicChordSymbol(segment.text, keySignature);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onChordClick(
      segment.regionId,
      segment.text,
      segment.x,
      segment.y,
      segment.width,
      segment.height
    );
  }

  function handleLeftHandlePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    onHandleDragStart(segment.regionId, "left");
  }

  function handleRightHandlePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    onHandleDragStart(segment.regionId, "right");
  }

  const showBackground = isSelected || isHovered || isDragging;
  const showNonDiatonicHint = !showBackground && !isDiatonic;

  return (
    <Box
      position="absolute"
      left={`${segment.x - 3}px`}
      top={`${segment.y}px`}
      width={`${segment.width + 6}px`}
      height={`${segment.height}px`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      pointerEvents="none"
    >
      {/* Main chord box */}
      <Box
        position="absolute"
        left="3px"
        top="0"
        width={`${segment.width}px`}
        height={`${segment.height}px`}
        bg={
          showBackground
            ? isSelected
              ? "rgba(59, 130, 246, 0.4)"
              : "rgba(147, 197, 253, 0.3)"
            : showNonDiatonicHint
            ? "rgba(251, 191, 36, 0.12)"
            : "transparent"
        }
        border={
          showBackground
            ? isSelected
              ? "2px solid rgb(37, 99, 235)"
              : "1px solid rgb(59, 130, 246)"
            : "none"
        }
        borderRadius="4px"
        cursor="pointer"
        pointerEvents="auto"
        onClick={handleClick}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {/* Chord text */}
        <Box
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="16px"
          fontWeight="500"
          color={
            showBackground
              ? isSelected
                ? "rgb(29, 78, 216)"
                : "rgb(30, 64, 175)"
              : "#1a1a1a"
          }
          pointerEvents="none"
          userSelect="none"
        >
          {segment.text}
        </Box>
      </Box>

      {/* Left handle */}
      {showBackground && (
        <Box
          position="absolute"
          left="0"
          top={`${segment.height / 2 - 8}px`}
          width="6px"
          height="16px"
          bg={isSelected ? "rgb(37, 99, 235)" : "rgb(59, 130, 246)"}
          borderRadius="2px"
          cursor="ew-resize"
          pointerEvents="auto"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={handleLeftHandlePointerDown}
        />
      )}

      {/* Right handle */}
      {showBackground && (
        <Box
          position="absolute"
          left={`${segment.width}px`}
          top={`${segment.height / 2 - 8}px`}
          width="6px"
          height="16px"
          bg={isSelected ? "rgb(37, 99, 235)" : "rgb(59, 130, 246)"}
          borderRadius="2px"
          cursor="ew-resize"
          pointerEvents="auto"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={handleRightHandlePointerDown}
        />
      )}
    </Box>
  );
}

// Compute visual chord segments from chord regions and layout metadata
// This mirrors the logic from renderChordRegions in vexflow-render.ts
function computeChordSegments(
  chordTrack: ChordTrack,
  measureMetadata: MeasureMetadata[],
  unitsPerBar: number
): ChordSegment[] {
  const segments: ChordSegment[] = [];

  for (const region of chordTrack.regions) {
    const startBar = Math.floor(region.start / unitsPerBar);
    const endBar = Math.floor((region.end - 1) / unitsPerBar);

    // Find all measures this region spans
    const spannedMeasures = measureMetadata.filter(
      (m) => m.measureIndex >= startBar && m.measureIndex <= endBar
    );

    if (spannedMeasures.length === 0) continue;

    // For each system this region appears on, create a segment
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

      segments.push({
        regionId: region.id,
        text: region.text,
        x: startX,
        y,
        width,
        height,
      });
    }
  }

  return segments;
}

// Convert pixel X position to Unit (time position)
function pixelToUnit(
  pixelX: number,
  measureMetadata: MeasureMetadata[],
  unitsPerBar: number
): Unit | null {
  // Find the measure containing this pixel position
  for (const measure of measureMetadata) {
    if (pixelX >= measure.x && pixelX <= measure.x + measure.width) {
      // Position within the measure
      const measureStartUnit = measure.measureIndex * unitsPerBar;
      const noteWidth = measure.width - (measure.noteStartX - measure.x);
      const xInMeasure = pixelX - measure.noteStartX;
      const fraction = Math.max(0, Math.min(1, xInMeasure / noteWidth));
      return measureStartUnit + fraction * unitsPerBar;
    }
  }

  return null;
}

// Apply drag preview to segments (create modified segments for the dragged region)
function applyDragPreviewToSegments(
  segments: ChordSegment[],
  dragState: DragState,
  measureMetadata: MeasureMetadata[],
  unitsPerBar: number
): ChordSegment[] {
  const result: ChordSegment[] = [];

  for (const segment of segments) {
    if (segment.regionId === dragState.regionId) {
      // This segment belongs to the dragged region, recompute with preview start/end
      const previewRegion: ChordRegion = {
        id: dragState.regionId,
        start: dragState.previewStart,
        end: dragState.previewEnd,
        text: segment.text,
      };

      const previewSegments = computeChordSegments(
        { regions: [previewRegion] },
        measureMetadata,
        unitsPerBar
      );

      for (const previewSeg of previewSegments) {
        result.push(previewSeg);
      }
    } else {
      result.push(segment);
    }
  }

  return result;
}

// Compute gap boxes for insertion UI
function computeGapBoxes(
  chordTrack: ChordTrack,
  timeSignature: TimeSignature,
  measureMetadata: MeasureMetadata[],
  unitsPerBar: number
): GapBox[] {
  const gapBoxes: GapBox[] = [];

  for (let i = 0; i < measureMetadata.length; i++) {
    const measure = measureMetadata[i]!;
    const barStartUnit = measure.measureIndex * unitsPerBar;
    const barEndUnit = (measure.measureIndex + 1) * unitsPerBar;

    const gaps = computeInsertionGaps(chordTrack, barStartUnit, barEndUnit);

    for (let j = 0; j < gaps.length; j++) {
      const gap = gaps[j]!;

      // Convert gap units to pixel coordinates within this measure
      const startOffsetInBar = gap.start % unitsPerBar;
      const endOffsetInBar = gap.end % unitsPerBar;

      const startFraction = startOffsetInBar / unitsPerBar;
      const endFraction =
        endOffsetInBar === 0 ? 1 : endOffsetInBar / unitsPerBar;

      const noteWidth = measure.width - (measure.noteStartX - measure.x);
      const startX = measure.noteStartX + startFraction * noteWidth;
      const endX = measure.noteStartX + endFraction * noteWidth;

      const width = endX - startX;
      const y = measure.staffTop - 50;
      const height = 30;

      gapBoxes.push({
        measureIndex: measure.measureIndex,
        gapStart: gap.start,
        gapEnd: gap.end,
        x: startX,
        y,
        width,
        height,
      });
    }
  }

  return gapBoxes;
}

// Compute chord append boxes (right of last chord)
function computeChordAppendBoxes(
  chordTrack: ChordTrack,
  layout: LeadSheetLayout
): AppendBox[] {
  // If no chords, return empty
  if (chordTrack.regions.length === 0) {
    return [];
  }

  // Find the last chord region
  const lastChord = chordTrack.regions[chordTrack.regions.length - 1]!;
  const duration = lastChord.end - lastChord.start;

  // Compute the next region window
  const nextStart = lastChord.end;
  const nextEnd = nextStart + duration;

  if (layout.measureMetadata.length === 0) return [];

  const unitsPerBar = layout.unitsPerBar;
  const startBar = Math.floor(nextStart / unitsPerBar);
  const endBar = Math.floor((nextEnd - 1) / unitsPerBar);

  const measureByIndex = new Map<number, MeasureMetadata>();
  for (let i = 0; i < layout.measureMetadata.length; i++) {
    const m = layout.measureMetadata[i]!;
    measureByIndex.set(m.measureIndex, m);
  }

  const base = layout.measureMetadata[0]!;
  const staffTopDelta = base.staffTop - base.y;
  const staffBottomDelta = base.staffBottom - base.y;
  const noteStartDeltaFallback = base.noteStartX - base.x;

  let noteStartDeltaFirst = noteStartDeltaFallback;
  let noteStartDeltaOther = noteStartDeltaFallback;

  for (let i = 0; i < layout.measureMetadata.length; i++) {
    const m = layout.measureMetadata[i]!;
    const pos = m.measureIndex % layout.measuresPerSystem;
    if (pos === 0) {
      noteStartDeltaFirst = m.noteStartX - m.x;
    } else {
      noteStartDeltaOther = m.noteStartX - m.x;
    }
  }

  const boxes: AppendBox[] = [];

  for (let bar = startBar; bar <= endBar; bar++) {
    const barStartUnit = bar * unitsPerBar;
    const barEndUnit = (bar + 1) * unitsPerBar;

    const segStart = Math.max(nextStart, barStartUnit);
    const segEnd = Math.min(nextEnd, barEndUnit);
    if (segStart >= segEnd) continue;

    const measure =
      measureByIndex.get(bar) ??
      computeVirtualMeasureMetadata({
        layout,
        measureIndex: bar,
        staffTopDelta,
        staffBottomDelta,
        noteStartDeltaFirst,
        noteStartDeltaOther,
      });

    const noteWidth = measure.width - (measure.noteStartX - measure.x);
    const startFraction = (segStart - barStartUnit) / unitsPerBar;
    const endFraction = (segEnd - barStartUnit) / unitsPerBar;
    const startX = measure.noteStartX + startFraction * noteWidth;
    const endX = measure.noteStartX + endFraction * noteWidth;

    boxes.push({
      start: nextStart,
      end: nextEnd,
      text: lastChord.text,
      x: startX,
      y: measure.staffTop - 50,
      width: endX - startX,
      height: 30,
    });
  }

  return boxes;
}

function computeVirtualMeasureMetadata(opts: {
  layout: LeadSheetLayout;
  measureIndex: number;
  staffTopDelta: number;
  staffBottomDelta: number;
  noteStartDeltaFirst: number;
  noteStartDeltaOther: number;
}): MeasureMetadata {
  const { layout, measureIndex } = opts;

  const systemIndex = Math.floor(measureIndex / layout.measuresPerSystem);
  const positionInSystem = measureIndex % layout.measuresPerSystem;

  const x =
    layout.systemPaddingX +
    positionInSystem * (layout.measureWidth + layout.interMeasureGap);
  const y =
    layout.staveMargin +
    systemIndex * (layout.staveHeight + layout.staveMargin);

  const noteStartDelta =
    positionInSystem === 0
      ? opts.noteStartDeltaFirst
      : opts.noteStartDeltaOther;

  return {
    measureIndex,
    systemIndex,
    x,
    y,
    width: layout.measureWidth,
    noteStartX: x + noteStartDelta,
    staffTop: y + opts.staffTopDelta,
    staffBottom: y + opts.staffBottomDelta,
  };
}

type ChordAppendBoxProps = {
  appendBox: AppendBox;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
};

function ChordAppendBox({
  appendBox,
  isHovered,
  onHover,
  onLeave,
  onClick,
}: ChordAppendBoxProps) {
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onClick();
  }

  return (
    <Box
      position="absolute"
      left={`${appendBox.x}px`}
      top={`${appendBox.y}px`}
      width={`${appendBox.width}px`}
      height={`${appendBox.height}px`}
      border={isHovered ? "1px dashed rgba(59, 130, 246, 0.4)" : "none"}
      bg={isHovered ? "rgba(147, 197, 253, 0.1)" : "transparent"}
      borderRadius="4px"
      cursor="pointer"
      pointerEvents="auto"
      display="flex"
      alignItems="center"
      justifyContent="center"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={handleClick}
    >
      {isHovered && (
        <Box
          fontSize="20px"
          color="rgba(59, 130, 246, 0.6)"
          fontWeight="300"
          userSelect="none"
        >
          +
        </Box>
      )}
    </Box>
  );
}
