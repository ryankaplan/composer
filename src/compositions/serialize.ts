// Serialization and deserialization between Document runtime state and persisted schema

import { Document } from "../lead-sheet/Document";
import {
  PersistedLeadSheetV1,
  PersistedMelodyEventV1,
  PersistedChordRegionV1,
} from "./schema";

/**
 * Extract persistable lead-sheet data from a Document instance.
 * This creates a snapshot of the musical content (events, chords, time/key signatures)
 * without any UI state like caret position, selection, or undo history.
 */
export function serializeDocumentToV1(doc: Document): PersistedLeadSheetV1 {
  const events = doc.events.get();
  const persistedEvents: PersistedMelodyEventV1[] = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i]!;
    if (event.kind === "note") {
      persistedEvents.push({
        ...event,
        duration: { ...event.duration },
        pitch: { ...event.pitch },
      });
    } else {
      persistedEvents.push({
        ...event,
        duration: { ...event.duration },
      });
    }
  }

  const chords = doc.chords.get();
  const persistedChordRegions: PersistedChordRegionV1[] = [];
  for (let i = 0; i < chords.regions.length; i++) {
    persistedChordRegions.push({ ...chords.regions[i]! });
  }

  return {
    timeSignature: { ...doc.timeSignature.get() },
    keySignature: doc.keySignature.get(),
    explicitEndTick: doc.explicitEndTick.get(),
    events: persistedEvents,
    chords: {
      regions: persistedChordRegions,
    },
  };
}

/**
 * Apply persisted lead-sheet data to a Document instance.
 * This replaces the document's musical content and clears transient state
 * (undo/redo history, selection, caret).
 *
 * NOTE: This does NOT clear playback state - caller should stop playback separately.
 */
export function applyV1ToDocument(
  doc: Document,
  data: PersistedLeadSheetV1
): void {
  const events: any[] = [];
  for (let i = 0; i < data.events.length; i++) {
    const event = data.events[i]!;
    if (event.kind === "note") {
      events.push({
        ...event,
        duration: { ...event.duration },
        pitch: { ...event.pitch },
      });
    } else {
      events.push({
        ...event,
        duration: { ...event.duration },
      });
    }
  }

  const chordRegions: any[] = [];
  for (let i = 0; i < data.chords.regions.length; i++) {
    chordRegions.push({ ...data.chords.regions[i]! });
  }

  // Use the document's internal restore method to apply the snapshot
  // We need to construct a full snapshot including UI state set to defaults
  const snapshot = {
    timeSignature: { ...data.timeSignature },
    keySignature: data.keySignature,
    explicitEndTick: data.explicitEndTick,
    events,
    chords: {
      regions: chordRegions,
    },
    // Reset UI state to defaults
    caret: 0,
    selection: null,
  };

  // Clear undo/redo history
  doc.clearHistory();

  // Apply the snapshot (mark as applying history to skip undo tracking)
  (doc as any).isApplyingHistory = true;
  doc.events.set(snapshot.events);
  doc.timeSignature.set(snapshot.timeSignature);
  doc.keySignature.set(snapshot.keySignature);
  doc.caret.set(snapshot.caret);
  doc.selection.set(snapshot.selection);
  doc.chords.set(snapshot.chords);
  doc.explicitEndTick.set(snapshot.explicitEndTick);
  (doc as any).isApplyingHistory = false;
}
