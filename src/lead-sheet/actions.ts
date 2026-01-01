import { registerKeyboardShortcut } from "../lib/keyboard-shortcut-manager";
import { doc } from "./Document";
import { interfaceState } from "./InterfaceState";
import { PitchLetter, Pitch, pitchToMidi, MelodyEvent } from "./types";

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

// Insert a chord in the current measure (chord track approach)
export function insertChordInCurrentMeasureAction() {
  const measures = doc.measures.get();
  const caret = doc.caret.get();

  // Find which measure the caret is in
  let measureIndex = 0;
  for (const measure of measures) {
    if (caret >= measure.startEventIdx && caret < measure.endEventIdx) {
      measureIndex = measure.index;
      break;
    }
    if (caret >= measure.endEventIdx) {
      measureIndex = measure.index;
    }
  }

  // Insert a placeholder chord
  doc.insertChordInMeasure(measureIndex, "C");
}

export function extendLeftNoteAction() {
  const duration = interfaceState.currentDuration.get();
  doc.extendLeftNoteByDuration(duration);
}

export async function copyAction() {
  const events = doc.getSelectedEvents();
  if (events.length === 0) return;

  try {
    await navigator.clipboard.writeText(JSON.stringify(events));
  } catch (e) {
    console.error("Failed to copy", e);
  }
}

export async function cutAction() {
  const events = doc.getSelectedEvents();
  if (events.length === 0) return;

  try {
    await navigator.clipboard.writeText(JSON.stringify(events));
    doc.withUndoStep(() => {
      doc.deleteSelection();
    });
  } catch (e) {
    console.error("Failed to cut", e);
  }
}

export async function pasteAction() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;

    const events = JSON.parse(text) as MelodyEvent[];
    if (Array.isArray(events)) {
      // Check if it looks like melody events
      if (events.length > 0 && typeof events[0].kind === "string") {
        doc.pasteEvents(events);
      }
    }
  } catch (e) {
    console.error("Failed to paste", e);
  }
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

export function registerShortcuts() {
  // Pitch letters (a-g)
  for (const letter of ["a", "b", "c", "d", "e", "f", "g"] as const) {
    unregisterShortcuts.push(
      registerKeyboardShortcut([letter], () =>
        insertNoteAction(letter.toUpperCase() as PitchLetter)
      )
    );
  }

  // Rest (r)
  unregisterShortcuts.push(
    registerKeyboardShortcut(["r"], () => insertRestAction())
  );

  // Duration keys (4, 8, 6)
  unregisterShortcuts.push(
    registerKeyboardShortcut(["digit4"], () =>
      interfaceState.setCurrentDurationFromKey("4")
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(["digit8"], () =>
      interfaceState.setCurrentDurationFromKey("8")
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(["digit6"], () =>
      interfaceState.setCurrentDurationFromKey("6")
    )
  );

  // Accidentals: ] for sharp, [ for flat
  unregisterShortcuts.push(
    registerKeyboardShortcut(["bracketright"], () =>
      toggleAccidentalAction("#")
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(["bracketleft"], () => toggleAccidentalAction("b"))
  );

  // Navigation
  unregisterShortcuts.push(
    registerKeyboardShortcut(["shift", "arrowleft"], () =>
      doc.moveCaretLeft({ extendSelection: true })
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(["shift", "arrowright"], () =>
      doc.moveCaretRight({ extendSelection: true })
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(["arrowleft"], () =>
      doc.moveCaretLeft({ extendSelection: false })
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(["arrowright"], () =>
      doc.moveCaretRight({ extendSelection: false })
    )
  );

  // Pitch editing: octave transpose
  unregisterShortcuts.push(
    registerKeyboardShortcut(["arrowup"], () =>
      doc.transposeSelectionOrLeftNote(12)
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(["arrowdown"], () =>
      doc.transposeSelectionOrLeftNote(-12)
    )
  );

  // Pitch editing: semitone transpose
  unregisterShortcuts.push(
    registerKeyboardShortcut(["meta", "arrowup"], () =>
      doc.transposeSelectionOrLeftNote(1)
    )
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(["meta", "arrowdown"], () =>
      doc.transposeSelectionOrLeftNote(-1)
    )
  );

  // Naturalize
  unregisterShortcuts.push(
    registerKeyboardShortcut(["n"], () => doc.naturalizeSelectionOrLeftNote())
  );

  // Delete
  unregisterShortcuts.push(
    registerKeyboardShortcut(["backspace"], () => doc.deleteBackward())
  );
  unregisterShortcuts.push(
    registerKeyboardShortcut(["delete"], () => doc.deleteForward())
  );

  // Insert chord in current measure (chord track)
  unregisterShortcuts.push(
    registerKeyboardShortcut(["meta", "shift", "c"], () =>
      insertChordInCurrentMeasureAction()
    )
  );

  // Tie toggle
  unregisterShortcuts.push(
    registerKeyboardShortcut(["t"], () => doc.toggleTieAcrossCaret())
  );

  // Extend (dash key)
  unregisterShortcuts.push(
    registerKeyboardShortcut(["minus"], () => extendLeftNoteAction())
  );

  // Undo/Redo
  unregisterShortcuts.push(
    registerKeyboardShortcut(["meta", "shift", "z"], () => doc.redo())
  );

  unregisterShortcuts.push(
    registerKeyboardShortcut(["meta", "z"], () => doc.undo())
  );

  // Copy
  unregisterShortcuts.push(
    registerKeyboardShortcut(["meta", "c"], () => copyAction())
  );

  // Cut
  unregisterShortcuts.push(
    registerKeyboardShortcut(["meta", "x"], () => cutAction())
  );

  // Paste
  unregisterShortcuts.push(
    registerKeyboardShortcut(["meta", "v"], () => pasteAction())
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
