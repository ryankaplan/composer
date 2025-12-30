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
    // Helper to gate shortcuts by focus and chord mode
    const gated = (callback: () => void) => {
      return () => {
        if (!this.hasFocus.get()) return;
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

    // Accidentals (shift+digit3 for #, minus for flat)
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["shift", "digit3"],
        gated(() => this.setPendingAccidental("#"))
      )
    );
    this.unregisterShortcuts.push(
      registerKeyboardShortcut(
        ["minus"],
        gated(() => this.setPendingAccidental("b"))
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
