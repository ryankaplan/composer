import React, { useState, useRef, useEffect } from "react";
import { Box } from "@chakra-ui/react";
import {
  ChordTrack,
  TimeSignature,
  ChordRegion,
  Unit,
} from "../lead-sheet/types";
import { LeadSheetLayout, MeasureMetadata } from "../lead-sheet/vexflow-render";
import { clampResizeToNeighbors } from "../lead-sheet/chords";

type ChordTrackOverlayProps = {
  chordTrack: ChordTrack;
  timeSignature: TimeSignature;
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
  onMeasureInsertClick: (measureIndex: number) => void;
  onResizeCommit: (regionId: string, newStart: Unit, newEnd: Unit) => void;
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

export function ChordTrackOverlay({
  chordTrack,
  timeSignature,
  layout,
  selectedChordId,
  onChordClick,
  onBackgroundClick,
  onMeasureInsertClick,
  onResizeCommit,
}: ChordTrackOverlayProps) {
  const [hoveredMeasureIndex, setHoveredMeasureIndex] = useState<number | null>(
    null
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const segments = computeChordSegments(
    chordTrack,
    layout.measureMetadata,
    layout.unitsPerBar
  );

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

      {/* Measure insertion hover boxes */}
      {layout.measureMetadata.map((measure) => (
        <MeasureInsertionBox
          key={`measure-insert-${measure.measureIndex}`}
          measure={measure}
          isHovered={hoveredMeasureIndex === measure.measureIndex}
          onHover={() => setHoveredMeasureIndex(measure.measureIndex)}
          onLeave={() => setHoveredMeasureIndex(null)}
          onClick={() => onMeasureInsertClick(measure.measureIndex)}
        />
      ))}

      {displaySegments.map((segment, idx) => (
        <ChordBox
          key={`${segment.regionId}-${idx}`}
          segment={segment}
          isSelected={segment.regionId === selectedChordId}
          isDragging={dragState?.regionId === segment.regionId}
          onChordClick={onChordClick}
          onHandleDragStart={startDrag}
        />
      ))}
    </Box>
  );
}

type MeasureInsertionBoxProps = {
  measure: MeasureMetadata;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
};

function MeasureInsertionBox({
  measure,
  isHovered,
  onHover,
  onLeave,
  onClick,
}: MeasureInsertionBoxProps) {
  const y = measure.staffTop - 50;
  const height = 30;

  return (
    <Box
      position="absolute"
      left={`${measure.x}px`}
      top={`${y}px`}
      width={`${measure.width}px`}
      height={`${height}px`}
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
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
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
  isSelected,
  isDragging,
  onChordClick,
  onHandleDragStart,
}: ChordBoxProps) {
  const [isHovered, setIsHovered] = useState(false);

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
          left={`${segment.width + 3}px`}
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
