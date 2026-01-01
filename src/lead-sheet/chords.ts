import { ChordTrack, ChordRegion, Unit, generateEventId } from "./types";

// ==================== VALIDATION ====================

// Validate chord track invariants (for dev assertions)
export function validateChordTrack(track: ChordTrack): void {
  const regions = track.regions;

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i]!;

    // Each region must have end > start
    if (region.end <= region.start) {
      throw new Error(
        `Invalid chord region ${region.id}: end (${region.end}) must be > start (${region.start})`
      );
    }

    // Regions must be sorted by start
    if (i > 0) {
      const prev = regions[i - 1]!;
      if (region.start < prev.start) {
        throw new Error(
          `Chord regions not sorted: region ${region.id} starts at ${region.start}, but previous region ${prev.id} starts at ${prev.start}`
        );
      }

      // Regions must not overlap (non-overlapping invariant)
      if (region.start < prev.end) {
        throw new Error(
          `Chord regions overlap: region ${region.id} starts at ${region.start}, but previous region ${prev.id} ends at ${prev.end}`
        );
      }
    }
  }
}

// ==================== QUERIES ====================

// Find all chord regions that overlap a given measure range [barStartUnit, barEndUnit)
export function findRegionsInMeasure(
  track: ChordTrack,
  barStartUnit: Unit,
  barEndUnit: Unit
): ChordRegion[] {
  const result: ChordRegion[] = [];

  for (const region of track.regions) {
    // Region overlaps measure if: region.start < barEndUnit && region.end > barStartUnit
    if (region.start < barEndUnit && region.end > barStartUnit) {
      result.push(region);
    }
  }

  return result;
}

// Find the largest available gap in a measure for inserting a new chord
// Returns { start, end } for the gap, or null if the measure is completely filled
export function findInsertionGap(
  track: ChordTrack,
  barStartUnit: Unit,
  barEndUnit: Unit,
  clickUnit?: Unit
): { start: Unit; end: Unit } | null {
  const regionsInMeasure = findRegionsInMeasure(
    track,
    barStartUnit,
    barEndUnit
  );

  if (regionsInMeasure.length === 0) {
    // No chords in this measure, return the entire measure
    return { start: barStartUnit, end: barEndUnit };
  }

  // Build list of gaps between/around regions within the measure bounds
  const gaps: Array<{ start: Unit; end: Unit }> = [];

  // Sort regions by start (should already be sorted, but be safe)
  const sorted = [...regionsInMeasure].sort((a, b) => a.start - b.start);

  // Gap before first region
  const firstRegion = sorted[0]!;
  const gapBeforeStart = Math.max(barStartUnit, barStartUnit);
  const gapBeforeEnd = Math.max(barStartUnit, firstRegion.start);
  if (gapBeforeEnd > gapBeforeStart) {
    gaps.push({ start: gapBeforeStart, end: gapBeforeEnd });
  }

  // Gaps between regions
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]!;
    const next = sorted[i + 1]!;
    const gapStart = Math.max(barStartUnit, current.end);
    const gapEnd = Math.min(barEndUnit, next.start);
    if (gapEnd > gapStart) {
      gaps.push({ start: gapStart, end: gapEnd });
    }
  }

  // Gap after last region
  const lastRegion = sorted[sorted.length - 1]!;
  const gapAfterStart = Math.max(barStartUnit, lastRegion.end);
  const gapAfterEnd = Math.min(barEndUnit, barEndUnit);
  if (gapAfterEnd > gapAfterStart) {
    gaps.push({ start: gapAfterStart, end: gapAfterEnd });
  }

  if (gaps.length === 0) {
    return null; // Measure is completely filled
  }

  // If clickUnit is provided, find the gap containing it
  if (clickUnit !== undefined) {
    for (const gap of gaps) {
      if (clickUnit >= gap.start && clickUnit < gap.end) {
        return gap;
      }
    }
  }

  // Otherwise, return the largest gap
  let largestGap = gaps[0]!;
  for (const gap of gaps) {
    if (gap.end - gap.start > largestGap.end - largestGap.start) {
      largestGap = gap;
    }
  }

  return largestGap;
}

// ==================== MUTATIONS ====================

// Insert a new chord region, maintaining sorted + non-overlapping invariant
// Returns the new track and the inserted region
export function insertChordRegion(
  track: ChordTrack,
  start: Unit,
  end: Unit,
  text: string
): { track: ChordTrack; region: ChordRegion } {
  if (end <= start) {
    throw new Error(`Cannot insert chord: end (${end}) must be > start (${start})`);
  }

  const newRegion: ChordRegion = {
    id: generateEventId(),
    start,
    end,
    text,
  };

  // Find insertion index (maintain sorted order)
  let insertIdx = 0;
  for (let i = 0; i < track.regions.length; i++) {
    if (track.regions[i]!.start < start) {
      insertIdx = i + 1;
    } else {
      break;
    }
  }

  const newRegions = [...track.regions];
  newRegions.splice(insertIdx, 0, newRegion);

  const newTrack = { regions: newRegions };

  // Validate (dev check)
  if (process.env.NODE_ENV !== "production") {
    validateChordTrack(newTrack);
  }

  return { track: newTrack, region: newRegion };
}

// Update the text of a chord region
export function updateChordText(
  track: ChordTrack,
  id: string,
  text: string
): ChordTrack {
  const newRegions = track.regions.map((region) =>
    region.id === id ? { ...region, text } : region
  );

  return { regions: newRegions };
}

// Delete a chord region by id
export function deleteChordRegion(track: ChordTrack, id: string): ChordTrack {
  const newRegions = track.regions.filter((region) => region.id !== id);
  return { regions: newRegions };
}

// Resize a chord region, clamping to neighbor boundaries to maintain non-overlap
// Returns the new track, or null if the resize would be invalid
export function resizeChordRegion(
  track: ChordTrack,
  id: string,
  newStart: Unit,
  newEnd: Unit
): ChordTrack | null {
  const regionIdx = track.regions.findIndex((r) => r.id === id);
  if (regionIdx === -1) {
    return null; // Region not found
  }

  // Clamp to neighbor boundaries
  const prevRegion = regionIdx > 0 ? track.regions[regionIdx - 1]! : null;
  const nextRegion =
    regionIdx < track.regions.length - 1 ? track.regions[regionIdx + 1]! : null;

  const clampedStart = prevRegion
    ? Math.max(newStart, prevRegion.end)
    : newStart;
  const clampedEnd = nextRegion ? Math.min(newEnd, nextRegion.start) : newEnd;

  // Ensure end > start after clamping
  if (clampedEnd <= clampedStart) {
    return null; // Invalid resize
  }

  const newRegions = [...track.regions];
  newRegions[regionIdx] = {
    ...newRegions[regionIdx]!,
    start: clampedStart,
    end: clampedEnd,
  };

  const newTrack = { regions: newRegions };

  // Validate (dev check)
  if (process.env.NODE_ENV !== "production") {
    validateChordTrack(newTrack);
  }

  return newTrack;
}

// Helper to clamp a resize operation to neighbor boundaries
// Returns the clamped { start, end }
export function clampResizeToNeighbors(
  track: ChordTrack,
  id: string,
  newStart: Unit,
  newEnd: Unit
): { start: Unit; end: Unit } | null {
  const regionIdx = track.regions.findIndex((r) => r.id === id);
  if (regionIdx === -1) {
    return null;
  }

  const prevRegion = regionIdx > 0 ? track.regions[regionIdx - 1]! : null;
  const nextRegion =
    regionIdx < track.regions.length - 1 ? track.regions[regionIdx + 1]! : null;

  const clampedStart = prevRegion
    ? Math.max(newStart, prevRegion.end)
    : newStart;
  const clampedEnd = nextRegion ? Math.min(newEnd, nextRegion.start) : newEnd;

  if (clampedEnd <= clampedStart) {
    return null;
  }

  return { start: clampedStart, end: clampedEnd };
}

