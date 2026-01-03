import { Observable } from "../lib/observable";
import { Duration, Accidental } from "./types";

export type ChordInsertRequest = {
  measureIndex: number;
  existingChordId?: string;
  existingChordText?: string;
};

// Pending accidental: null = use diatonic default, "natural" = explicitly natural
export type PendingAccidental = "#" | "b" | "natural" | null;

export class InterfaceState {
  // Observable state (not undoable)
  readonly currentDuration = new Observable<Duration>("1/4");
  readonly pendingAccidental = new Observable<PendingAccidental>(null);
  readonly selectedChordId = new Observable<string | null>(null);
  readonly chordInsertRequest = new Observable<ChordInsertRequest | null>(null);

  // Duration
  setCurrentDurationFromKey(key: "1" | "2" | "4" | "8" | "6") {
    const durationMap: Record<"1" | "2" | "4" | "8" | "6", Duration> = {
      "1": "1/1",
      "2": "1/2",
      "4": "1/4",
      "8": "1/8",
      "6": "1/16",
    };
    this.currentDuration.set(durationMap[key]);
  }

  setCurrentDuration(duration: Duration) {
    this.currentDuration.set(duration);
  }

  // Accidentals
  setPendingAccidental(accidental: PendingAccidental) {
    this.pendingAccidental.set(accidental);
  }

  clearPendingAccidental() {
    this.pendingAccidental.set(null);
  }

  // Chord selection
  setSelectedChord(chordId: string | null) {
    this.selectedChordId.set(chordId);
  }

  clearSelectedChord() {
    this.selectedChordId.set(null);
  }

  // Chord insert request (bridge for keyboard actions to request chord editing UI)
  requestChordInsert(
    measureIndex: number,
    existingChordId?: string,
    existingChordText?: string
  ) {
    this.chordInsertRequest.set({
      measureIndex,
      existingChordId,
      existingChordText,
    });
  }

  clearChordInsertRequest() {
    this.chordInsertRequest.set(null);
  }
}

export const interfaceState = new InterfaceState();
