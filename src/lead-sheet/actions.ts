import { registerKeyboardShortcut } from "../lib/keyboard-shortcut-manager";
import { doc } from "./Document";
import { interfaceState } from "./InterfaceState";
import { PitchLetter, Pitch, pitchToMidi } from "./types";

// Default octave for first note (C4 = MIDI 60)
const DEFAULT_OCTAVE = 4;

// Find the nearest octave for a pitch relative to a previous pitch
function findNearestOctave(targetChroma: number, prevMidi: number): number {
  const prevOctave = Math.floor(prevMidi / 12);

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

// ==================== ACTIONS ====================

export function insertNoteAction(letter: PitchLetter) {
  const accidental = interfaceState.pendingAccidental.get();
  const duration = interfaceState.currentDuration.get();

  // Start with default octave
  let octave = DEFAULT_OCTAVE;

  // Apply nearest-octave rule
  const prevMidi = doc.getPrevNoteMidiAtCaret();
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

  doc.insertNote(pitch, duration);

  // Clear pending accidental (one-shot)
  interfaceState.clearPendingAccidental();
}

export function insertRestAction() {
  const duration = interfaceState.currentDuration.get();
  doc.insertRest(duration);
}

export function toggleAccidentalAction(accidental: "#" | "b") {
  const selectedIndices = getSelectedNoteIndices();

  // If we have a selection or note to the left, apply to document
  if (selectedIndices.length > 0 || findNoteLeftOfCaret() !== null) {
    doc.toggleAccidentalSelectionOrLeftNote(accidental);
  } else {
    // No selection and no note left of caret: set as pending accidental
    interfaceState.setPendingAccidental(accidental);
  }
}

export function commitChordAction() {
  const mode = interfaceState.chordMode.get();
  if (!mode || !mode.text.trim()) {
    interfaceState.commitChordMode();
    return;
  }

  const chordText = mode.text.trim();
  doc.attachChord(chordText);
  interfaceState.commitChordMode();
}

export function extendLeftNoteAction() {
  const duration = interfaceState.currentDuration.get();
  doc.extendLeftNoteByDuration(duration);
}

// Helper functions (similar to Document's private methods but for actions)
function getSelectedNoteIndices(): number[] {
  const normalized = doc.normalizedSelection.get();
  if (!normalized) return [];

  const events = doc.events.get();
  const noteIndices: number[] = [];

  for (let i = normalized.start; i < normalized.end; i++) {
    const event = events[i];
    if (event && event.kind === "note") {
      noteIndices.push(i);
    }
  }

  return noteIndices;
}

function findNoteLeftOfCaret(): number | null {
  const caret = doc.caret.get();
  const events = doc.events.get();

  for (let i = caret - 1; i >= 0; i--) {
    const event = events[i];
    if (event && event.kind === "note") {
      return i;
    }
  }

  return null;
}

// ==================== KEYBOARD SHORTCUTS ====================

const unregisterShortcuts: (() => void)[] = [];

// Helper to gate shortcuts by chord mode
function gated(callback: () => void) {
  return () => {
    if (interfaceState.chordMode.get() !== null) return;
    callback();
  };
}

export function registerShortcuts() {
  // Pitch letters (a-g)
  for (const letter of ["a", "b", "c", "d", "e", "f", "g"] as const) {
    unregisterShortcuts.push(
      registerKeyboardShortcut(
        [letter],
        gated(() => insertNoteAction(letter.toUpperCase() as PitchLetter))
      )
    );
  }

  // Rest (r)
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["r"],
      gated(() => insertRestAction())
    )
  );

  // Duration keys (4, 8, 6)
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["digit4"],
      gated(() => interfaceState.setCurrentDurationFromKey("4"))
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["digit8"],
      gated(() => interfaceState.setCurrentDurationFromKey("8"))
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["digit6"],
      gated(() => interfaceState.setCurrentDurationFromKey("6"))
    )
  );

  // Accidentals: ] for sharp, [ for flat
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["bracketright"],
      gated(() => toggleAccidentalAction("#"))
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["bracketleft"],
      gated(() => toggleAccidentalAction("b"))
    )
  );

  // Navigation
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["arrowleft"],
      gated(() => doc.moveCaretLeft({ extendSelection: false }))
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["arrowright"],
      gated(() => doc.moveCaretRight({ extendSelection: false }))
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["shift", "arrowleft"],
      gated(() => doc.moveCaretLeft({ extendSelection: true }))
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["shift", "arrowright"],
      gated(() => doc.moveCaretRight({ extendSelection: true }))
    )
  );

  // Pitch editing: octave transpose
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["arrowup"],
      gated(() => doc.transposeSelectionOrLeftNote(12))
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["arrowdown"],
      gated(() => doc.transposeSelectionOrLeftNote(-12))
    )
  );

  // Pitch editing: semitone transpose
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["meta", "arrowup"],
      gated(() => doc.transposeSelectionOrLeftNote(1))
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["meta", "arrowdown"],
      gated(() => doc.transposeSelectionOrLeftNote(-1))
    )
  );

  // Naturalize
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["n"],
      gated(() => doc.naturalizeSelectionOrLeftNote())
    )
  );

  // Delete
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["backspace"],
      gated(() => doc.deleteBackward())
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["delete"],
      gated(() => doc.deleteForward())
    )
  );

  // Chord mode entry (quote key)
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["shift", "quote"],
      gated(() => interfaceState.enterChordMode(doc.caret.get()))
    )
  );

  // Tie toggle
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["t"],
      gated(() => doc.toggleTieAcrossCaret())
    )
  );

  // Extend (dash key)
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["minus"],
      gated(() => extendLeftNoteAction())
    )
  );

  // Undo/Redo
  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["meta", "shift", "z"],
      gated(() => doc.redo())
    )
  );

  unregisterShortcuts.push(
    registerKeyboardShortcut(
      ["meta", "z"],
      gated(() => doc.undo())
    )
  );
}

export function disposeShortcuts() {
  for (const unregister of unregisterShortcuts) {
    unregister();
  }
  unregisterShortcuts.length = 0;
}

// Register shortcuts on module initialization
registerShortcuts();
