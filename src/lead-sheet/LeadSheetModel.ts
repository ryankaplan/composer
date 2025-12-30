import { Observable, derivedValue, Derived } from "../lib/observable";
import { registerKeyboardShortcut } from "../lib/keyboard-shortcut-manager";
import {
  MelodyEvent,
  TimeSignature,
  Duration,
  PitchLetter,
  Accidental,
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

type ChordMode = {
  text: string;
  openCaret: number;
} | null;

// Default octave for first note (C4 = MIDI 60)
const DEFAULT_OCTAVE = 4;

export class LeadSheetModel {
  // Observable state
  readonly timeSignature = new Observable<TimeSignature>({
    beatsPerBar: 4,
    beatUnit: 4,
  });
  readonly events = new Observable<MelodyEvent[]>([]);
  readonly caret = new Observable<number>(0);
  readonly selection = new Observable<Selection>(null);
  readonly currentDuration = new Observable<Duration>("1/4");
  readonly pendingAccidental = new Observable<Accidental>(null);
  readonly hasFocus = new Observable<boolean>(false);
  readonly chordMode = new Observable<ChordMode>(null);

  // Derived values
  readonly normalizedSelection: Derived<{ start: number; end: number } | null>;
  readonly measures: Derived<Measure[]>;
  readonly prevNoteMidiAtCaret: Derived<number | null>;

  private unregisterShortcuts: (() => void)[] = [];

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

    this.prevNoteMidiAtCaret = derivedValue(
      () => findPrevNoteMidi(this.events.get(), this.caret.get()),
      [this.events, this.caret]
    );

    // Register keyboard shortcuts
    this.registerShortcuts();
  }

  dispose() {
    for (const unregister of this.unregisterShortcuts) {
      unregister();
    }
  }

  private registerShortcuts() {
    // Helper to gate shortcuts by chord mode (no longer gate by focus)
    const gated = (callback: () => void) => {
      return () => {
        if (this.chordMode.get() !== null) return;
        callback();
      };
    };

    // Pitch letters (a-g)
    for (const letter of ["a", "b", "c", "d", "e", "f", "g"] as const) {
      this.unregisterShortcuts.push(
        registerKeyboardShortcut(
          [letter],
          gated(() => this.insertNote(letter.toUpperCase() as PitchLetter))
        )
      );
    }

    // Rest (r)
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["r"],
        gated(() => this.insertRest())
      )
    );

    // Duration keys (4, 8, 6)
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["digit4"],
        gated(() => this.setCurrentDurationFromKey("4"))
      )
    );
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["digit8"],
        gated(() => this.setCurrentDurationFromKey("8"))
      )
    );
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["digit6"],
        gated(() => this.setCurrentDurationFromKey("6"))
      )
    );

    // Accidentals: # and b keys toggle accidental on left note when no pending
    // or set pending accidental for next note
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["shift", "digit3"],
        gated(() => this.toggleAccidentalOnLeftNote("#"))
      )
    );
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["b"],
        gated(() => this.toggleAccidentalOnLeftNote("b"))
      )
    );

    // Navigation
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["arrowleft"],
        gated(() => this.moveCaretLeft({ extendSelection: false }))
      )
    );
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["arrowright"],
        gated(() => this.moveCaretRight({ extendSelection: false }))
      )
    );
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["shift", "arrowleft"],
        gated(() => this.moveCaretLeft({ extendSelection: true }))
      )
    );
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["shift", "arrowright"],
        gated(() => this.moveCaretRight({ extendSelection: true }))
      )
    );

    // Pitch editing: octave transpose
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["arrowup"],
        gated(() => this.transposeSelectionOrLeftNote(12))
      )
    );
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["arrowdown"],
        gated(() => this.transposeSelectionOrLeftNote(-12))
      )
    );

    // Pitch editing: semitone transpose
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["meta", "arrowup"],
        gated(() => this.transposeSelectionOrLeftNote(1))
      )
    );
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["meta", "arrowdown"],
        gated(() => this.transposeSelectionOrLeftNote(-1))
      )
    );

    // Naturalize
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["n"],
        gated(() => this.naturalizeSelectionOrLeftNote())
      )
    );

    // Delete
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["backspace"],
        gated(() => this.deleteBackward())
      )
    );
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["delete"],
        gated(() => this.deleteForward())
      )
    );

    // Chord mode entry (quote key)
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["shift", "quote"],
        gated(() => this.enterChordMode())
      )
    );

    // Tie toggle
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["t"],
        gated(() => this.toggleTieAcrossCaret())
      )
    );

    // Extend (dash key - note this replaces old flat shortcut)
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["minus"],
        gated(() => this.extendLeftNoteByCurrentDurationUnit())
      )
    );
  }

  // Focus management
  setHasFocus(focused: boolean) {
    this.hasFocus.set(focused);
  }

  // Duration
  setCurrentDurationFromKey(key: "4" | "8" | "6") {
    const durationMap: Record<"4" | "8" | "6", Duration> = {
      "4": "1/4",
      "8": "1/8",
      "6": "1/16",
    };
    this.currentDuration.set(durationMap[key]);
  }

  // Accidentals
  setPendingAccidental(accidental: Accidental) {
    this.pendingAccidental.set(accidental);
  }

  // Navigation
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

  // Insert note using nearest-octave rule
  insertNote(letter: PitchLetter) {
    const accidental = this.pendingAccidental.get();
    const duration = this.currentDuration.get();

    // Start with default octave
    let octave = DEFAULT_OCTAVE;

    // Apply nearest-octave rule
    const prevMidi = this.prevNoteMidiAtCaret.get();
    if (prevMidi !== null) {
      // Create temporary pitch to compute midi
      const tempPitch: Pitch = { letter, accidental, octave: DEFAULT_OCTAVE };
      const defaultMidi = pitchToMidi(tempPitch);
      const nearestMidi = findNearestOctave(defaultMidi, prevMidi);
      octave = Math.floor(nearestMidi / 12);
    }

    const pitch: Pitch = {
      letter,
      accidental,
      octave,
    };

    const newEvent: MelodyEvent = {
      kind: "note",
      id: generateEventId(),
      duration,
      pitch,
    };

    // Delete selection if present, then insert
    this.deleteSelection();

    const events = this.events.get();
    const caret = this.caret.get();
    const newEvents = [...events];
    newEvents.splice(caret, 0, newEvent);

    this.events.set(newEvents);
    this.caret.set(caret + 1);

    // Clear pending accidental (one-shot)
    this.pendingAccidental.set(null);
  }

  // Insert rest
  insertRest() {
    const duration = this.currentDuration.get();

    const newEvent: MelodyEvent = {
      kind: "rest",
      id: generateEventId(),
      duration,
    };

    // Delete selection if present, then insert
    this.deleteSelection();

    const events = this.events.get();
    const caret = this.caret.get();
    const newEvents = [...events];
    newEvents.splice(caret, 0, newEvent);

    this.events.set(newEvents);
    this.caret.set(caret + 1);
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

  // Delete backward
  deleteBackward() {
    // If there's a selection, delete it
    if (this.deleteSelection()) return;

    const caret = this.caret.get();
    if (caret <= 0) return;

    const events = this.events.get();
    const newEvents = [...events];
    newEvents.splice(caret - 1, 1);

    this.events.set(newEvents);
    this.caret.set(caret - 1);
  }

  // Delete forward
  deleteForward() {
    // If there's a selection, delete it
    if (this.deleteSelection()) return;

    const caret = this.caret.get();
    const events = this.events.get();
    if (caret >= events.length) return;

    const newEvents = [...events];
    newEvents.splice(caret, 1);

    this.events.set(newEvents);
  }

  // Chord mode
  enterChordMode() {
    this.chordMode.set({
      text: "",
      openCaret: this.caret.get(),
    });
  }

  setChordDraft(text: string) {
    const mode = this.chordMode.get();
    if (!mode) return;

    this.chordMode.set({
      ...mode,
      text,
    });
  }

  cancelChordMode() {
    this.chordMode.set(null);
  }

  commitChord() {
    const mode = this.chordMode.get();
    if (!mode || !mode.text.trim()) {
      this.chordMode.set(null);
      return;
    }

    const chordText = mode.text.trim();
    const events = this.events.get();
    const caret = this.caret.get();

    // Find next note event at or after caret
    let foundNote = false;
    for (let i = caret; i < events.length; i++) {
      const event = events[i];
      if (event && event.kind === "note") {
        // Attach chord to this note
        const newEvents = [...events];
        newEvents[i] = { ...event, chord: chordText };
        this.events.set(newEvents);
        foundNote = true;
        break;
      }
    }

    // If no note found, insert chord anchor
    if (!foundNote) {
      const newEvent: MelodyEvent = {
        kind: "chordAnchor",
        id: generateEventId(),
        chord: chordText,
      };

      const newEvents = [...events];
      newEvents.splice(caret, 0, newEvent);
      this.events.set(newEvents);
      this.caret.set(caret + 1);
    }

    this.chordMode.set(null);
  }

  // Time signature
  setTimeSignature(timeSignature: TimeSignature) {
    this.timeSignature.set(timeSignature);
  }

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
  }

  // Toggle accidental on note left of caret (only when no pending accidental)
  toggleAccidentalOnLeftNote(accidental: "#" | "b") {
    if (this.pendingAccidental.get() !== null) {
      // If there's a pending accidental, set it instead
      this.setPendingAccidental(accidental);
      return;
    }

    const leftIdx = this.findNoteLeftOfCaret();
    if (leftIdx === null) return;

    const events = this.events.get();
    const event = events[leftIdx];
    if (!event || event.kind !== "note") return;

    const newEvents = [...events];
    const currentAccidental = event.pitch.accidental;

    // Toggle: if already has this accidental, remove it; otherwise set it
    const newAccidental = currentAccidental === accidental ? null : accidental;

    newEvents[leftIdx] = {
      ...event,
      pitch: { ...event.pitch, accidental: newAccidental },
    };

    this.events.set(newEvents);
    this.cleanupInvalidTies();
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

    // Toggle tie
    const newEvents = [...events];
    newEvents[leftIdx] = {
      ...leftNote,
      tieToNext: leftNote.tieToNext ? undefined : true,
    };

    this.events.set(newEvents);
  }

  // Extend note left of caret by inserting a tied note of current duration
  extendLeftNoteByCurrentDurationUnit() {
    const leftIdx = this.findNoteLeftOfCaret();
    if (leftIdx === null) return;

    const events = this.events.get();
    const leftNote = events[leftIdx];

    if (!leftNote || leftNote.kind !== "note") return;

    const duration = this.currentDuration.get();

    // Create a new note with same pitch
    const newNote: MelodyEvent = {
      kind: "note",
      id: generateEventId(),
      duration,
      pitch: { ...leftNote.pitch },
    };

    // Insert immediately after the left note and set tie
    const newEvents = [...events];
    newEvents.splice(leftIdx + 1, 0, newNote);
    newEvents[leftIdx] = { ...leftNote, tieToNext: true };

    this.events.set(newEvents);
    // Note: caret stays where it is (between the two tied notes)
  }
}

// Find the nearest octave for a pitch relative to a previous pitch
function findNearestOctave(targetChroma: number, prevMidi: number): number {
  const prevOctave = Math.floor(prevMidi / 12);
  const prevChroma = prevMidi % 12;

  // Try the note in the same octave, one octave up, and one octave down
  const candidates = [
    prevOctave * 12 + (targetChroma % 12),
    (prevOctave + 1) * 12 + (targetChroma % 12),
    (prevOctave - 1) * 12 + (targetChroma % 12),
  ];

  // Find the candidate with the smallest interval
  let bestCandidate = candidates[0]!;
  let smallestInterval = Math.abs(candidates[0]! - prevMidi);

  for (const candidate of candidates) {
    const interval = Math.abs(candidate - prevMidi);
    if (interval < smallestInterval) {
      smallestInterval = interval;
      bestCandidate = candidate;
    }
  }

  return bestCandidate;
}

export const model = new LeadSheetModel();
