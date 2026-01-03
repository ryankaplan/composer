// Serialization and deserialization between Document runtime state and persisted schema

import { Document } from "../lead-sheet/Document";
import { PersistedLeadSheetV1 } from "./schema";

/**
 * Extract persistable lead-sheet data from a Document instance.
 * This creates a snapshot of the musical content (events, chords, time/key signatures)
 * without any UI state like caret position, selection, or undo history.
 */
export function serializeDocumentToV1(doc: Document): PersistedLeadSheetV1 {
  return {
    timeSignature: { ...doc.timeSignature.get() },
    keySignature: doc.keySignature.get(),
    explicitEndUnit: doc.explicitEndUnit.get(),
    events: doc.events.get().map((event) => {
      if (event.kind === "note") {
        return {
          ...event,
          pitch: { ...event.pitch },
        };
      }
      return { ...event };
    }),
    chords: {
      regions: doc.chords.get().regions.map((region) => ({ ...region })),
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
  // Use the document's internal restore method to apply the snapshot
  // We need to construct a full snapshot including UI state set to defaults
  const snapshot = {
    timeSignature: { ...data.timeSignature },
    keySignature: data.keySignature,
    explicitEndUnit: data.explicitEndUnit,
    events: data.events.map((event) => {
      if (event.kind === "note") {
        return {
          ...event,
          pitch: { ...event.pitch },
        };
      }
      return { ...event };
    }),
    chords: {
      regions: data.chords.regions.map((region) => ({ ...region })),
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
  doc.explicitEndUnit.set(snapshot.explicitEndUnit);
  (doc as any).isApplyingHistory = false;
}

