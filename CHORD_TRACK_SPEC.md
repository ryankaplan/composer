# Chord Track Specification

## Overview

This document describes the redesign of chord entry in the composer app, moving from a modal text-input approach to a separate time-aligned chord track with visual, interactive chord regions.

## Original Requirements (from Mocks)

### UI/UX Goals
1. **Measure hover interaction**: Hovering over a measure shows a subtle measure-sized `+` box
2. **Click to insert**: Clicking the `+` inserts a chord region that fills the available portion of the measure
3. **Visual chord regions**: Chords render as boxes spanning time (not just symbols attached to notes)
4. **Resize handles**: Chord boxes have left/right handles for adjusting start/end times
5. **Click to edit**: Clicking a chord box opens an inline text input for editing
6. **Autocomplete**: Chord input shows autocomplete suggestions (e.g., C, Cm, CMaj7, C7)
7. **Independent from melody**: User can work on chords before/without writing melody

## Design Decisions

### Data Model

#### Chord Track
- **Separate from melody events**: `ChordTrack` is independent of `MelodyEvent[]`
- **Time-ranged regions**: Each chord is a `ChordRegion` with `start` and `end` in absolute time units
- **Non-overlapping invariant**: Regions cannot overlap within the track (enforced by mutation functions)
- **Raw text storage**: Chords are stored as raw strings (e.g., "CMaj7"), not parsed structures
  - **Rationale**: Avoid redundant persisted data; parsing can be done on-demand for playback/features

#### Time Axis
- **Unit = 1/16 note**: All timing uses integer units where 1 unit = 1/16 note
- **Mapping layer for melody**: Existing `MelodyEvent[]` stays as-is initially; a derived mapping converts event indices to unit positions
- **Document length**: Derived as `max(melodyEndUnit, lastChordEndUnit)` (no stored `measureCount`)
  - **Rationale**: Avoid redundancy; length is implicit from event data

#### Data Types
```typescript
type Unit = number; // integer, 1 unit = 1/16 note

type ChordRegion = {
  id: string;
  start: Unit;    // inclusive
  end: Unit;      // exclusive, must be > start
  text: string;   // raw chord text (e.g., "CMaj7")
};

type ChordTrack = {
  regions: ChordRegion[]; // sorted by start, non-overlapping
};
```

### Editing Semantics

#### Insertion
- **Trigger**: Press `Cmd+Shift+C` (or click measure `+` when implemented)
- **Default length**: Fills the available gap in the measure
  - If measure is empty: chord spans the entire measure
  - If measure has existing chords: chord fills the largest contiguous gap
- **Snap to beat boundaries**: UI drags snap to beats; data model supports 1/16 units

#### Resizing
- **Handle dragging**: Left/right handles adjust start/end
- **Snap to beats**: Dragging snaps to beat boundaries (e.g., 4 units = 1 beat in 4/4)
- **Clamp to neighbors**: Resize is clamped to prevent overlap with adjacent chords

#### Editing Text
- **Click to edit**: Clicking a chord box opens an inline input overlay
- **Commit**: Press `Enter` to save changes
- **Cancel**: Press `Escape` to discard changes

### Undo/Redo
- **Unified history**: Chord edits and melody edits share the same undo/redo stack
- **Snapshot includes chords**: `DocumentSnapshot` now includes `ChordTrack` state

## Implemented Features

### Core Data Layer
- ✅ `ChordRegion` and `ChordTrack` types (`src/lead-sheet/types.ts`)
- ✅ Utility functions for chord track operations (`src/lead-sheet/chords.ts`):
  - `validateChordTrack()` - enforce non-overlap invariant
  - `findRegionsInMeasure()` - query chords in a measure
  - `findInsertionGap()` - find available space for new chord
  - `insertChordRegion()`, `updateChordText()`, `deleteChordRegion()`, `resizeChordRegion()`
- ✅ `Document.chords` observable (`src/lead-sheet/Document.ts`)
- ✅ Document methods: `insertChordInMeasure()`, `updateChordRegionText()`, `deleteChordRegion()`, `resizeChordRegion()`
- ✅ Undo/redo integration for chord operations

### Melody-to-Unit Mapping
- ✅ Derived values in `Document`:
  - `eventStartUnits: Unit[]` - start time for each melody event
  - `melodyEndUnit: Unit` - end of melody track
  - `documentEndUnit: Unit` - max of melody and chord end times
- ✅ Helper functions (`src/lead-sheet/measure.ts`):
  - `computeEventStartUnits()`, `computeMelodyEndUnit()`

### Rendering
- ✅ Chord regions rendered as SVG boxes above the staff (`src/lead-sheet/vexflow-render.ts`)
- ✅ Chord text displayed in boxes
- ✅ Left/right resize handles visible on each chord
- ✅ Measure metadata collected for accurate chord positioning
- ✅ Multi-system spanning (chords that cross systems render on each system)

### Editor Interactions
- ✅ Click detection for chord regions (via `data-chord-id` attributes)
- ✅ Click-to-edit: clicking a chord opens an inline input overlay
- ✅ Inline input with Enter/Escape handlers
- ✅ Keyboard shortcut `Cmd+Shift+C` to insert a chord in the current measure
- ✅ Legacy modal chord input (`Shift+'`) still works (calls old `attachChord()` method)

## Deferred Features (Not Implemented)

### UI Enhancements
- ❌ **Measure hover + box**: Hovering a measure does not yet show the `+` insertion box
  - Would require tracking mouse position, rendering hover overlay, handling clicks
- ❌ **Handle dragging**: Resize handles are rendered but not interactive
  - Would require mouse drag tracking, beat snapping logic, live preview
- ❌ **Autocomplete**: No chord suggestion list yet
  - Would require chord dictionary, fuzzy matching, dropdown UI

### Advanced Editing
- ❌ **Move chords** (drag entire region left/right)
- ❌ **Split/merge chords**
- ❌ **Keyboard navigation** between chords (arrow keys)
- ❌ **Multi-select chords** (for batch operations)

### Data Layer
- ❌ **Chord parsing**: `text` is not parsed into structured data (root, quality, extensions, bass)
  - Parsing can be added later without changing persistence
- ❌ **Normalized chord representation**: No canonical spelling stored
  - Can be derived on-demand from parsed data when needed

### Migration
- ❌ **Legacy chord conversion**: Old `note.chord` and `chordAnchor` events are not migrated
  - The old chord system still works; new chords use the new track
  - Migration can be added later if needed

## Files Changed

### New Files
- `src/lead-sheet/chords.ts` - Chord track utility functions

### Modified Files
- `src/lead-sheet/types.ts` - Added `Unit`, `ChordRegion`, `ChordTrack` types
- `src/lead-sheet/Document.ts` - Added chord track state, methods, undo integration
- `src/lead-sheet/measure.ts` - Added unit mapping helpers
- `src/lead-sheet/vexflow-render.ts` - Added chord region rendering
- `src/lead-sheet/actions.ts` - Added `insertChordInCurrentMeasureAction()`
- `src/components/LeadSheetEditor.tsx` - Added chord click detection, inline edit input

## Usage

### Insert a Chord
1. Position caret in desired measure (by clicking a note or using arrow keys)
2. Press `Cmd+Shift+C`
3. A chord region labeled "C" appears, filling the available measure space
4. Click the chord to edit its text

### Edit a Chord
1. Click any chord region
2. An inline input appears with the current chord text
3. Type the new chord name (e.g., "Dm7", "G7sus4")
4. Press `Enter` to save or `Escape` to cancel

### Delete a Chord
Currently requires manual intervention via console:
```javascript
doc.deleteChordRegion(chordId);
```
*(Keyboard shortcut TBD)*

## Future Work

### Short Term
1. Implement measure hover + insertion UI
2. Add handle dragging with beat snapping
3. Add keyboard shortcut for deleting selected chord
4. Add visual selection state for chords

### Medium Term
1. Autocomplete chord suggestions
2. Chord parsing for playback/analysis
3. Keyboard navigation between chords
4. Migrate or coexist with old chord system

### Long Term
1. Migrate melody to explicit time-based events (align with chord track)
2. Multi-track support (bass, drums, etc.)
3. Time signature changes within a document
4. Advanced chord features (slash chords, polychords, chord voicings)

