import React from "react";
import { Box } from "@chakra-ui/react";
import { ChordTrack, TimeSignature, ChordRegion } from "../lead-sheet/types";
import { LeadSheetLayout, MeasureMetadata } from "../lead-sheet/vexflow-render";

type ChordTrackOverlayProps = {
  chordTrack: ChordTrack;
  timeSignature: TimeSignature;
  layout: LeadSheetLayout | null;
  onChordClick: (chordId: string, text: string) => void;
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
  onChordClick,
}: ChordTrackOverlayProps) {
  if (!layout) {
    return null;
  }

  const segments = computeChordSegments(
    chordTrack,
    layout.measureMetadata,
    layout.unitsPerBar
  );

  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      pointerEvents="none"
    >
      {segments.map((segment, idx) => (
        <ChordBox
          key={`${segment.regionId}-${idx}`}
          segment={segment}
          onChordClick={onChordClick}
        />
      ))}
    </Box>
  );
}

type ChordBoxProps = {
  segment: ChordSegment;
  onChordClick: (chordId: string, text: string) => void;
};

function ChordBox({ segment, onChordClick }: ChordBoxProps) {
  function handleClick() {
    onChordClick(segment.regionId, segment.text);
  }

  return (
    <>
      {/* Main chord box */}
      <Box
        position="absolute"
        left={`${segment.x}px`}
        top={`${segment.y}px`}
        width={`${segment.width}px`}
        height={`${segment.height}px`}
        bg="rgba(147, 197, 253, 0.3)"
        border="1px solid rgb(59, 130, 246)"
        borderRadius="4px"
        cursor="pointer"
        pointerEvents="auto"
        onClick={handleClick}
      />

      {/* Chord text */}
      <Box
        position="absolute"
        left={`${segment.x + 6}px`}
        top={`${segment.y + segment.height / 2 - 7}px`}
        fontFamily="Arial, sans-serif"
        fontSize="14px"
        fontWeight="600"
        color="rgb(30, 64, 175)"
        pointerEvents="none"
        userSelect="none"
      >
        {segment.text}
      </Box>

      {/* Left handle */}
      <Box
        position="absolute"
        left={`${segment.x - 3}px`}
        top={`${segment.y + segment.height / 2 - 8}px`}
        width="6px"
        height="16px"
        bg="rgb(59, 130, 246)"
        borderRadius="2px"
        cursor="ew-resize"
        pointerEvents="auto"
      />

      {/* Right handle */}
      <Box
        position="absolute"
        left={`${segment.x + segment.width - 3}px`}
        top={`${segment.y + segment.height / 2 - 8}px`}
        width="6px"
        height="16px"
        bg="rgb(59, 130, 246)"
        borderRadius="2px"
        cursor="ew-resize"
        pointerEvents="auto"
      />
    </>
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

