import { registerKeyboardShortcuts } from "../lib/keyboard-shortcut-manager";
import { ShortcutKeys } from "../lib/shortcut-key";
import { shortcutKeysToString } from "../lib/format-shortcut";
import { doc } from "./Document";
import { interfaceState } from "./InterfaceState";
import { PitchLetter, Pitch, pitchToMidi, MelodyEvent } from "./types";
import { playbackEngine } from "../playback/engine";
import { buildPlaybackIR } from "../playback/build-ir";
import { caretToUnit } from "../playback/time";

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

const ACTIONS = [
  // Notes
  {
    name: "Insert A",
    group: "Notes",
    shortcuts: { keyCombos: [["a"] as ShortcutKeys] },
    perform: () => insertNoteAction("A"),
  },
  {
    name: "Insert B",
    group: "Notes",
    shortcuts: { keyCombos: [["b"] as ShortcutKeys] },
    perform: () => insertNoteAction("B"),
  },
  {
    name: "Insert C",
    group: "Notes",
    shortcuts: { keyCombos: [["c"] as ShortcutKeys] },
    perform: () => insertNoteAction("C"),
  },
  {
    name: "Insert D",
    group: "Notes",
    shortcuts: { keyCombos: [["d"] as ShortcutKeys] },
    perform: () => insertNoteAction("D"),
  },
  {
    name: "Insert E",
    group: "Notes",
    shortcuts: { keyCombos: [["e"] as ShortcutKeys] },
    perform: () => insertNoteAction("E"),
  },
  {
    name: "Insert F",
    group: "Notes",
    shortcuts: { keyCombos: [["f"] as ShortcutKeys] },
    perform: () => insertNoteAction("F"),
  },
  {
    name: "Insert G",
    group: "Notes",
    shortcuts: { keyCombos: [["g"] as ShortcutKeys] },
    perform: () => insertNoteAction("G"),
  },
  {
    name: "Insert Rest",
    group: "Notes",
    shortcuts: { keyCombos: [["r"] as ShortcutKeys] },
    perform: () => insertRestAction(),
  },

  // Durations
  {
    name: "Set Duration Quarter",
    group: "Duration",
    shortcuts: { keyCombos: [["digit4"] as ShortcutKeys] },
    perform: () => interfaceState.setCurrentDurationFromKey("4"),
  },
  {
    name: "Set Duration Eighth",
    group: "Duration",
    shortcuts: { keyCombos: [["digit8"] as ShortcutKeys] },
    perform: () => interfaceState.setCurrentDurationFromKey("8"),
  },
  {
    name: "Set Duration Sixteenth",
    group: "Duration",
    shortcuts: { keyCombos: [["digit6"] as ShortcutKeys] },
    perform: () => interfaceState.setCurrentDurationFromKey("6"),
  },

  // Accidentals
  {
    name: "Toggle Sharp",
    group: "Accidentals",
    shortcuts: { keyCombos: [["bracketright"] as ShortcutKeys] },
    perform: () => toggleAccidentalAction("#"),
  },
  {
    name: "Toggle Flat",
    group: "Accidentals",
    shortcuts: { keyCombos: [["bracketleft"] as ShortcutKeys] },
    perform: () => toggleAccidentalAction("b"),
  },
  {
    name: "Naturalize",
    group: "Accidentals",
    shortcuts: { keyCombos: [["n"] as ShortcutKeys] },
    perform: () => doc.naturalizeSelectionOrLeftNote(),
  },

  // Navigation
  {
    name: "Move Caret Left",
    group: "Navigation",
    shortcuts: { keyCombos: [["arrowleft"] as ShortcutKeys] },
    perform: () => doc.moveCaretLeft({ extendSelection: false }),
  },
  {
    name: "Move Caret Right",
    group: "Navigation",
    shortcuts: { keyCombos: [["arrowright"] as ShortcutKeys] },
    perform: () => doc.moveCaretRight({ extendSelection: false }),
  },
  {
    name: "Extend Selection Left",
    group: "Navigation",
    shortcuts: { keyCombos: [["shift", "arrowleft"] as ShortcutKeys] },
    perform: () => doc.moveCaretLeft({ extendSelection: true }),
  },
  {
    name: "Extend Selection Right",
    group: "Navigation",
    shortcuts: { keyCombos: [["shift", "arrowright"] as ShortcutKeys] },
    perform: () => doc.moveCaretRight({ extendSelection: true }),
  },

  // Transpose
  {
    name: "Transpose Octave Up",
    group: "Transpose",
    shortcuts: { keyCombos: [["arrowup"] as ShortcutKeys] },
    perform: () => doc.transposeSelectionOrLeftNote(12),
  },
  {
    name: "Transpose Octave Down",
    group: "Transpose",
    shortcuts: { keyCombos: [["arrowdown"] as ShortcutKeys] },
    perform: () => doc.transposeSelectionOrLeftNote(-12),
  },
  {
    name: "Transpose Semitone Up",
    group: "Transpose",
    shortcuts: { keyCombos: [["meta", "arrowup"] as ShortcutKeys] },
    perform: () => doc.transposeSelectionOrLeftNote(1),
  },
  {
    name: "Transpose Semitone Down",
    group: "Transpose",
    shortcuts: { keyCombos: [["meta", "arrowdown"] as ShortcutKeys] },
    perform: () => doc.transposeSelectionOrLeftNote(-1),
  },

  // Edit
  {
    name: "Delete Backward",
    group: "Edit",
    shortcuts: { keyCombos: [["backspace"] as ShortcutKeys] },
    perform: () => {
      // If a chord is selected, delete it instead of melody
      const selectedChordId = interfaceState.selectedChordId.get();
      if (selectedChordId) {
        deleteSelectedChordAction();
      } else {
        doc.deleteBackward();
      }
    },
  },
  {
    name: "Delete Forward",
    group: "Edit",
    shortcuts: { keyCombos: [["delete"] as ShortcutKeys] },
    perform: () => {
      // If a chord is selected, delete it instead of melody
      const selectedChordId = interfaceState.selectedChordId.get();
      if (selectedChordId) {
        deleteSelectedChordAction();
      } else {
        doc.deleteForward();
      }
    },
  },
  {
    name: "Toggle Tie",
    group: "Edit",
    shortcuts: { keyCombos: [["t"] as ShortcutKeys] },
    perform: () => doc.toggleTieAcrossCaret(),
  },
  {
    name: "Extend Note",
    group: "Edit",
    shortcuts: { keyCombos: [["minus"] as ShortcutKeys] },
    perform: () => extendLeftNoteAction(),
  },

  // Chords
  {
    name: "Insert Chord",
    group: "Chords",
    shortcuts: { keyCombos: [["meta", "shift", "c"] as ShortcutKeys] },
    perform: () => insertChordInCurrentMeasureAction(),
  },

  // Undo/Redo
  {
    name: "Undo",
    group: "Undo",
    shortcuts: { keyCombos: [["meta", "z"] as ShortcutKeys] },
    perform: () => doc.undo(),
  },
  {
    name: "Redo",
    group: "Undo",
    shortcuts: { keyCombos: [["meta", "shift", "z"] as ShortcutKeys] },
    perform: () => doc.redo(),
  },

  // Clipboard
  {
    name: "Copy",
    group: "Clipboard",
    shortcuts: { keyCombos: [["meta", "c"] as ShortcutKeys] },
    perform: () => copyAction(),
  },
  {
    name: "Cut",
    group: "Clipboard",
    shortcuts: { keyCombos: [["meta", "x"] as ShortcutKeys] },
    perform: () => cutAction(),
  },
  {
    name: "Paste",
    group: "Clipboard",
    shortcuts: { keyCombos: [["meta", "v"] as ShortcutKeys] },
    perform: () => pasteAction(),
  },

  // Playback
  {
    name: "Play/Pause",
    group: "Playback",
    shortcuts: { keyCombos: [["space"] as ShortcutKeys] },
    perform: () => togglePlaybackAction(),
  },
] as const;

export type Action = (typeof ACTIONS)[number];
export type ActionName = Action["name"];

// Build lookup map for O(1) access
const ACTION_MAP = new Map<ActionName, Action>();
for (const action of ACTIONS) {
  ACTION_MAP.set(action.name, action);
}

/**
 * Gets an action by name.
 * Returns null if the action doesn't exist.
 */
export function getAction(name: ActionName): Action | null {
  const action = ACTION_MAP.get(name);
  return action || null;
}

/**
 * Gets the shortcut text for an action as a pretty string for UI display.
 * Returns the first shortcut if the action has multiple shortcuts.
 * Returns null if the action doesn't exist or has no shortcuts.
 *
 * Example: getActionShortcutText('Undo') -> "⌘Z" (macOS) or "Ctrl+Z" (Windows)
 */
export function getActionShortcutText(name: ActionName): string | null {
  const action = getAction(name);
  if (!action || !action.shortcuts) {
    return null;
  }

  const firstShortcut = action.shortcuts.keyCombos[0];
  if (!firstShortcut) {
    return null;
  }

  return shortcutKeysToString(firstShortcut);
}

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

// Toggle playback (play/pause)
export async function togglePlaybackAction() {
  const isPlaying = playbackEngine.isPlaying.get();

  if (isPlaying) {
    playbackEngine.pause();
  } else {
    const events = doc.events.get();
    const caret = doc.caret.get();
    const documentEndUnit = doc.documentEndUnit.get();
    const chordTrack = doc.chords.get();
    const caretUnit = caretToUnit(events, caret);
    const ir = buildPlaybackIR(events, caretUnit, documentEndUnit, chordTrack);
    await playbackEngine.playIR(ir, caretUnit);
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

// Delete the selected chord (chord track approach)
export function deleteSelectedChordAction() {
  const selectedChordId = interfaceState.selectedChordId.get();
  if (selectedChordId) {
    doc.deleteChordRegion(selectedChordId);
    interfaceState.clearSelectedChord();
  }
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
  // Build registration list from ACTIONS array
  const registrations: Array<{
    readonly shortcuts: ReadonlyArray<ShortcutKeys>;
    readonly perform: () => void | (() => void) | Promise<void>;
  }> = [];

  for (const action of ACTIONS) {
    if (action.shortcuts && action.shortcuts.keyCombos.length > 0) {
      registrations.push({
        shortcuts: action.shortcuts.keyCombos,
        perform: action.perform as () => void | (() => void) | Promise<void>,
      });
    }
  }

  // Register all shortcuts in one call
  const unregisters = registerKeyboardShortcuts(registrations);
  for (const unregister of unregisters) {
    unregisterShortcuts.push(unregister);
  }
}

export function disposeShortcuts() {
  for (const unregister of unregisterShortcuts) {
    unregister();
  }
  unregisterShortcuts.length = 0;
}

// Register shortcuts on module initialization
registerShortcuts();
