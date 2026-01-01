import { Observable } from "../lib/observable";
import { Duration, Accidental } from "./types";

export class InterfaceState {
  // Observable state (not undoable)
  readonly currentDuration = new Observable<Duration>("1/4");
  readonly pendingAccidental = new Observable<Accidental>(null);

  // Duration
  setCurrentDurationFromKey(key: "4" | "8" | "6") {
    const durationMap: Record<"4" | "8" | "6", Duration> = {
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
  setPendingAccidental(accidental: Accidental) {
    this.pendingAccidental.set(accidental);
  }

  clearPendingAccidental() {
    this.pendingAccidental.set(null);
  }
}

export const interfaceState = new InterfaceState();
