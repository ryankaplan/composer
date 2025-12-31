import { Observable, derivedValue, Derived } from "../lib/observable";
import {
  MelodyEvent,
  TimeSignature,
  Selection,
  Measure,
  Pitch,
  generateEventId,
  pitchToMidi,
  transposePitch,
} from "./types";
import {
  computeMeasures,
  normalizeSelection,
  findPrevNoteMidi,
} from "./measure";

type DocumentSnapshot = {
  events: MelodyEvent[];
  timeSignature: TimeSignature;
  caret: number;
  selection: Selection;
};

const MAX_HISTORY_SIZE = 200;

export class Document {
  // Observable state (undoable)
  readonly timeSignature = new Observable<TimeSignature>({
    beatsPerBar: 4,
    beatUnit: 4,
  });
  readonly events = new Observable<MelodyEvent[]>([]);
  readonly caret = new Observable<number>(0);
  readonly selection = new Observable<Selection>(null);

  // Derived values
  readonly normalizedSelection: Derived<{ start: number; end: number } | null>;
  readonly measures: Derived<Measure[]>;

  // Undo/redo state
  private undoStack: DocumentSnapshot[] = [];
  private redoStack: DocumentSnapshot[] = [];
  readonly canUndo = new Observable<boolean>(false);
  readonly canRedo = new Observable<boolean>(false);
  private isApplyingHistory = false;

  constructor() {
    // Set up derived values
    this.normalizedSelection = derivedValue(
      () => normalizeSelection(this.selection.get()),
      [this.selection]
    );

    this.measures = derivedValue(
      () => computeMeasures(this.events.get(), this.timeSignature.get()),
      [this.events, this.timeSignature]
    );
  }

  // ==================== UNDO/REDO ====================

  private createSnapshot(): DocumentSnapshot {
    return {
      events: this.cloneEvents(this.events.get()),
      timeSignature: { ...this.timeSignature.get() },
      caret: this.caret.get(),
      selection: this.selection.get() ? { ...this.selection.get()! } : null,
    };
  }

  private cloneEvents(events: MelodyEvent[]): MelodyEvent[] {
    return events.map((event) => {
      if (event.kind === "note") {
        return {
          ...event,
          pitch: { ...event.pitch },
        };
      }
      return { ...event };
    });
  }

  private restoreSnapshot(snapshot: DocumentSnapshot) {
    this.isApplyingHistory = true;
    this.events.set(this.cloneEvents(snapshot.events));
    this.timeSignature.set({ ...snapshot.timeSignature });
    this.caret.set(snapshot.caret);
    this.selection.set(snapshot.selection ? { ...snapshot.selection } : null);
    this.isApplyingHistory = false;
  }

  private pushUndo() {
    if (this.isApplyingHistory) return;

    const snapshot = this.createSnapshot();
    this.undoStack.push(snapshot);

    // Cap the undo stack
    if (this.undoStack.length > MAX_HISTORY_SIZE) {
      this.undoStack.shift();
    }

    this.canUndo.set(true);
  }

  private clearRedo() {
    if (this.redoStack.length > 0) {
      this.redoStack = [];
      this.canRedo.set(false);
    }
  }

  /**
   * Execute an edit operation within an undo step.
   * Captures state before the operation, then clears redo stack.
   */
  withUndoStep<T>(fn: () => T): T {
    if (this.isApplyingHistory) {
      return fn();
    }

    this.pushUndo();
    this.clearRedo();
    return fn();
  }

  undo() {
    if (this.undoStack.length === 0) return;

    const currentSnapshot = this.createSnapshot();
    this.redoStack.push(currentSnapshot);
    this.canRedo.set(true);

    const snapshot = this.undoStack.pop()!;
    this.restoreSnapshot(snapshot);

    this.canUndo.set(this.undoStack.length > 0);
  }

  redo() {
    if (this.redoStack.length === 0) return;

    const currentSnapshot = this.createSnapshot();
    this.undoStack.push(currentSnapshot);
    this.canUndo.set(true);

    const snapshot = this.redoStack.pop()!;
    this.restoreSnapshot(snapshot);

    this.canRedo.set(this.redoStack.length > 0);
  }

  // ==================== SELECTION / CARET (NO UNDO) ====================

  // Helper: get MIDI of previous note before caret
  getPrevNoteMidiAtCaret(): number | null {
    return findPrevNoteMidi(this.events.get(), this.caret.get());
  }

  clearSelection() {
    this.selection.set(null);
  }

  // Set caret position (clamps to valid range) and clear selection
  setCaret(newCaret: number) {
    const events = this.events.get();
    const clampedCaret = Math.max(0, Math.min(newCaret, events.length));
    this.caret.set(clampedCaret);
    this.selection.set(null);
  }

  // Select a single event by clicking it - moves caret after the event
  selectSingleEvent(eventIdx: number) {
    const events = this.events.get();
    if (eventIdx < 0 || eventIdx >= events.length) return;

    // Set selection to span just this event
    this.selection.set({ anchor: eventIdx, focus: eventIdx + 1 });
    // Move caret to after the clicked event
    this.caret.set(eventIdx + 1);
  }

  moveCaretLeft(opts: { extendSelection: boolean }) {
    const currentCaret = this.caret.get();
    if (currentCaret <= 0) return;

    const newCaret = currentCaret - 1;

    if (opts.extendSelection) {
      const currentSelection = this.selection.get();
      if (currentSelection === null) {
        // Start selection from current caret
        this.selection.set({ anchor: currentCaret, focus: newCaret });
      } else {
        // Extend selection
        this.selection.set({ ...currentSelection, focus: newCaret });
      }
    } else {
      // Clear selection and move caret
      this.selection.set(null);
    }

    this.caret.set(newCaret);
  }

  moveCaretRight(opts: { extendSelection: boolean }) {
    const currentCaret = this.caret.get();
    const events = this.events.get();
    if (currentCaret >= events.length) return;

    const newCaret = currentCaret + 1;

    if (opts.extendSelection) {
      const currentSelection = this.selection.get();
      if (currentSelection === null) {
        // Start selection from current caret
        this.selection.set({ anchor: currentCaret, focus: newCaret });
      } else {
        // Extend selection
        this.selection.set({ ...currentSelection, focus: newCaret });
      }
    } else {
      // Clear selection and move caret
      this.selection.set(null);
    }

    this.caret.set(newCaret);
  }

  // ==================== DOCUMENT EDIT OPS (WITH UNDO) ====================

  // Helper: get indices of selected note events
  private getSelectedNoteIndices(): number[] {
    const normalized = this.normalizedSelection.get();
    if (!normalized) return [];

    const events = this.events.get();
    const noteIndices: number[] = [];

    for (let i = normalized.start; i < normalized.end; i++) {
      const event = events[i];
      if (event && event.kind === "note") {
        noteIndices.push(i);
      }
    }

    return noteIndices;
  }

  // Helper: find note left of caret (skipping non-notes)
  private findNoteLeftOfCaret(): number | null {
    const caret = this.caret.get();
    const events = this.events.get();

    for (let i = caret - 1; i >= 0; i--) {
      const event = events[i];
      if (event && event.kind === "note") {
        return i;
      }
    }

    return null;
  }

  // Helper: find note right of caret (skipping non-notes)
  private findNoteRightOfCaret(): number | null {
    const caret = this.caret.get();
    const events = this.events.get();

    for (let i = caret; i < events.length; i++) {
      const event = events[i];
      if (event && event.kind === "note") {
        return i;
      }
    }

    return null;
  }

  // Cleanup invalid ties after mutations
  private cleanupInvalidTies() {
    const events = this.events.get();
    const newEvents = [...events];
    let modified = false;

    for (let i = 0; i < newEvents.length; i++) {
      const event = newEvents[i];
      if (event && event.kind === "note" && event.tieToNext) {
        // Find next note (skip non-notes)
        let nextNoteIdx = null;
        for (let j = i + 1; j < newEvents.length; j++) {
          const nextEvent = newEvents[j];
          if (nextEvent && nextEvent.kind === "note") {
            nextNoteIdx = j;
            break;
          }
        }

        // Check if tie is valid
        if (nextNoteIdx === null) {
          // No next note - clear tie
          newEvents[i] = { ...event, tieToNext: undefined };
          modified = true;
        } else {
          const nextNote = newEvents[nextNoteIdx];
          if (nextNote && nextNote.kind === "note") {
            const currentMidi = pitchToMidi(event.pitch);
            const nextMidi = pitchToMidi(nextNote.pitch);
            if (currentMidi !== nextMidi) {
              // Different pitch - clear tie
              newEvents[i] = { ...event, tieToNext: undefined };
              modified = true;
            }
          }
        }
      }
    }

    if (modified) {
      this.events.set(newEvents);
    }
  }

  // Delete selection helper
  private deleteSelection(): boolean {
    const normalized = this.normalizedSelection.get();
    if (!normalized) return false;

    const events = this.events.get();
    const newEvents = [...events];
    newEvents.splice(normalized.start, normalized.end - normalized.start);

    this.events.set(newEvents);
    this.caret.set(normalized.start);
    this.selection.set(null);

    return true;
  }

  insertNote(pitch: Pitch, duration: string) {
    return this.withUndoStep(() => {
      // Delete selection if present
      this.deleteSelection();

      const newEvent: MelodyEvent = {
        kind: "note",
        id: generateEventId(),
        duration: duration as any,
        pitch,
      };

      const events = this.events.get();
      const caret = this.caret.get();
      const newEvents = [...events];
      newEvents.splice(caret, 0, newEvent);

      this.events.set(newEvents);
      this.caret.set(caret + 1);
    });
  }

  insertRest(duration: string) {
    return this.withUndoStep(() => {
      // Delete selection if present
      this.deleteSelection();

      const newEvent: MelodyEvent = {
        kind: "rest",
        id: generateEventId(),
        duration: duration as any,
      };

      const events = this.events.get();
      const caret = this.caret.get();
      const newEvents = [...events];
      newEvents.splice(caret, 0, newEvent);

      this.events.set(newEvents);
      this.caret.set(caret + 1);
    });
  }

  deleteBackward() {
    return this.withUndoStep(() => {
      // If there's a selection, delete it
      if (this.deleteSelection()) return;

      const caret = this.caret.get();
      if (caret <= 0) return;

      const events = this.events.get();
      const newEvents = [...events];
      newEvents.splice(caret - 1, 1);

      this.events.set(newEvents);
      this.caret.set(caret - 1);
    });
  }

  deleteForward() {
    return this.withUndoStep(() => {
      // If there's a selection, delete it
      if (this.deleteSelection()) return;

      const caret = this.caret.get();
      const events = this.events.get();
      if (caret >= events.length) return;

      const newEvents = [...events];
      newEvents.splice(caret, 1);

      this.events.set(newEvents);
    });
  }

  setTimeSignature(timeSignature: TimeSignature) {
    return this.withUndoStep(() => {
      this.timeSignature.set(timeSignature);
    });
  }

  // Transpose selected notes or note left of caret
  transposeSelectionOrLeftNote(semitones: number) {
    const selectedIndices = this.getSelectedNoteIndices();
    const targetIndices =
      selectedIndices.length > 0
        ? selectedIndices
        : (() => {
            const leftIdx = this.findNoteLeftOfCaret();
            return leftIdx !== null ? [leftIdx] : [];
          })();

    if (targetIndices.length === 0) return;

    return this.withUndoStep(() => {
      const events = this.events.get();
      const newEvents = [...events];

      for (const idx of targetIndices) {
        const event = newEvents[idx];
        if (event && event.kind === "note") {
          const newPitch = transposePitch(event.pitch, semitones);
          newEvents[idx] = { ...event, pitch: newPitch };
        }
      }

      this.events.set(newEvents);
      this.cleanupInvalidTies();
    });
  }

  // Naturalize selected notes or note left of caret
  naturalizeSelectionOrLeftNote() {
    const selectedIndices = this.getSelectedNoteIndices();
    const targetIndices =
      selectedIndices.length > 0
        ? selectedIndices
        : (() => {
            const leftIdx = this.findNoteLeftOfCaret();
            return leftIdx !== null ? [leftIdx] : [];
          })();

    if (targetIndices.length === 0) return;

    return this.withUndoStep(() => {
      const events = this.events.get();
      const newEvents = [...events];

      for (const idx of targetIndices) {
        const event = newEvents[idx];
        if (event && event.kind === "note") {
          newEvents[idx] = {
            ...event,
            pitch: { ...event.pitch, accidental: null },
          };
        }
      }

      this.events.set(newEvents);
      this.cleanupInvalidTies();
    });
  }

  // Toggle accidental on selected notes or note left of caret
  toggleAccidentalSelectionOrLeftNote(accidental: "#" | "b") {
    const selectedIndices = this.getSelectedNoteIndices();

    // If we have a selection, apply to selected notes
    if (selectedIndices.length > 0) {
      return this.withUndoStep(() => {
        const events = this.events.get();
        const newEvents = [...events];

        for (const idx of selectedIndices) {
          const event = newEvents[idx];
          if (event && event.kind === "note") {
            const currentAccidental = event.pitch.accidental;
            const newAccidental =
              currentAccidental === accidental ? null : accidental;
            newEvents[idx] = {
              ...event,
              pitch: { ...event.pitch, accidental: newAccidental },
            };
          }
        }

        this.events.set(newEvents);
        this.cleanupInvalidTies();
      });
    }

    // No selection: try to apply to note left of caret
    const leftIdx = this.findNoteLeftOfCaret();
    if (leftIdx !== null) {
      return this.withUndoStep(() => {
        const events = this.events.get();
        const event = events[leftIdx];
        if (event && event.kind === "note") {
          const newEvents = [...events];
          const currentAccidental = event.pitch.accidental;
          const newAccidental =
            currentAccidental === accidental ? null : accidental;

          newEvents[leftIdx] = {
            ...event,
            pitch: { ...event.pitch, accidental: newAccidental },
          };

          this.events.set(newEvents);
          this.cleanupInvalidTies();
        }
      });
    }

    // No-op if no selection and no note to the left
  }

  // Toggle tie between note left and right of caret
  toggleTieAcrossCaret() {
    const leftIdx = this.findNoteLeftOfCaret();
    const rightIdx = this.findNoteRightOfCaret();

    if (leftIdx === null || rightIdx === null) return;

    const events = this.events.get();
    const leftNote = events[leftIdx];
    const rightNote = events[rightIdx];

    if (!leftNote || leftNote.kind !== "note") return;
    if (!rightNote || rightNote.kind !== "note") return;

    // Check if same MIDI
    const leftMidi = pitchToMidi(leftNote.pitch);
    const rightMidi = pitchToMidi(rightNote.pitch);

    if (leftMidi !== rightMidi) return;

    return this.withUndoStep(() => {
      // Toggle tie
      const newEvents = [...events];
      newEvents[leftIdx] = {
        ...leftNote,
        tieToNext: leftNote.tieToNext ? undefined : true,
      };

      this.events.set(newEvents);
    });
  }

  // Extend note left of caret by inserting a tied note of current duration
  extendLeftNoteByDuration(duration: string) {
    const leftIdx = this.findNoteLeftOfCaret();
    if (leftIdx === null) return;

    const events = this.events.get();
    const leftNote = events[leftIdx];

    if (!leftNote || leftNote.kind !== "note") return;

    return this.withUndoStep(() => {
      // Create a new note with same pitch
      const newNote: MelodyEvent = {
        kind: "note",
        id: generateEventId(),
        duration: duration as any,
        pitch: { ...leftNote.pitch },
      };

      // Insert immediately after the left note and set tie
      const newEvents = [...events];
      newEvents.splice(leftIdx + 1, 0, newNote);
      newEvents[leftIdx] = { ...leftNote, tieToNext: true };

      this.events.set(newEvents);
      // Note: caret stays where it is (between the two tied notes)
    });
  }

  // Attach/update chord to event at or after caret
  attachChord(chordText: string) {
    const events = this.events.get();
    const caret = this.caret.get();

    // Find next note event at or after caret
    let foundNote = false;
    for (let i = caret; i < events.length; i++) {
      const event = events[i];
      if (event && event.kind === "note") {
        return this.withUndoStep(() => {
          // Attach chord to this note
          const newEvents = [...events];
          newEvents[i] = { ...event, chord: chordText };
          this.events.set(newEvents);
        });
      }
    }

    // If no note found, insert chord anchor
    if (!foundNote) {
      return this.withUndoStep(() => {
        const newEvent: MelodyEvent = {
          kind: "chordAnchor",
          id: generateEventId(),
          chord: chordText,
        };

        const newEvents = [...events];
        newEvents.splice(caret, 0, newEvent);
        this.events.set(newEvents);
        this.caret.set(caret + 1);
      });
    }
  }
}

export const doc = new Document();
