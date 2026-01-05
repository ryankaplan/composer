import * as Tone from "tone";
import { Observable } from "../lib/observable";
import { PlaybackIR } from "./build-ir";
import { secondsPerTick, tickOffsetToSeconds, secondsToTickOffset } from "./time";

// Playback engine state
export class PlaybackEngine {
  readonly isPlaying = new Observable<boolean>(false);
  readonly bpm = new Observable<number>(120);
  readonly swingEnabled = new Observable<boolean>(false);
  readonly swingRatio = new Observable<number>(2 / 3);
  readonly playheadTick = new Observable<number>(0);

  private sampler: Tone.Sampler | null = null;
  private isInitialized = false;
  private scheduledEventIds: number[] = [];
  private playbackStartTime: number | null = null;
  private startTick: number = 0;
  private endTick: number = 0;
  private animationFrameId: number | null = null;

  async initialize() {
    if (this.isInitialized) return;

    // Initialize Tone.js sampler with Salamander piano samples
    this.sampler = new Tone.Sampler({
      urls: {
        A0: "A0.mp3",
        C1: "C1.mp3",
        "D#1": "Ds1.mp3",
        "F#1": "Fs1.mp3",
        A1: "A1.mp3",
        C2: "C2.mp3",
        "D#2": "Ds2.mp3",
        "F#2": "Fs2.mp3",
        A2: "A2.mp3",
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
        "D#5": "Ds5.mp3",
        "F#5": "Fs5.mp3",
        A5: "A5.mp3",
        C6: "C6.mp3",
        "D#6": "Ds6.mp3",
        "F#6": "Fs6.mp3",
        A6: "A6.mp3",
        C7: "C7.mp3",
        "D#7": "Ds7.mp3",
        "F#7": "Fs7.mp3",
        A7: "A7.mp3",
        C8: "C8.mp3",
      },
      release: 1,
      baseUrl: "https://tonejs.github.io/audio/salamander/",
    }).toDestination();

    await Tone.loaded();

    this.isInitialized = true;
  }

  async playIR(ir: PlaybackIR, startTickParam: number) {
    // Ensure audio context is started (browser requires user gesture)
    await Tone.start();
    await this.initialize();

    if (!this.sampler) return;

    // Stop any existing playback
    this.stop();

    this.startTick = startTickParam;
    this.endTick = ir.endTick;
    this.playheadTick.set(startTickParam);
    this.isPlaying.set(true);

    // Schedule all events using Transport
    const now = Tone.now();
    this.playbackStartTime = now;

    const bpm = this.bpm.get();
    const swingEnabled = this.swingEnabled.get();
    const swingRatio = this.swingRatio.get();

    // Schedule melody events
    for (const event of ir.melodyEvents) {
      if (event.kind === "note" && event.midi !== undefined) {
        const startTime =
          now +
          (tickOffsetToSeconds(event.startTick, bpm, swingEnabled, swingRatio) -
            tickOffsetToSeconds(startTickParam, bpm, swingEnabled, swingRatio));
        const durationSeconds =
          tickOffsetToSeconds(
            event.startTick + event.durationTicks,
            bpm,
            swingEnabled,
            swingRatio
          ) - tickOffsetToSeconds(event.startTick, bpm, swingEnabled, swingRatio);
        this.scheduleNoteWithTransport(event.midi, startTime, durationSeconds);
      }
      // Rests don't need scheduling (they're just silence)
    }

    // Schedule chord events
    for (const event of ir.chordEvents) {
      const startTime =
        now +
        (tickOffsetToSeconds(event.startTick, bpm, swingEnabled, swingRatio) -
          tickOffsetToSeconds(startTickParam, bpm, swingEnabled, swingRatio));
      const durationSeconds =
        tickOffsetToSeconds(
          event.startTick + event.durationTicks,
          bpm,
          swingEnabled,
          swingRatio
        ) - tickOffsetToSeconds(event.startTick, bpm, swingEnabled, swingRatio);
      this.scheduleChordWithTransport(
        event.midiNotes,
        startTime,
        durationSeconds
      );
    }

    // Start playhead animation
    this.startPlayheadAnimation();

    // Schedule automatic stop at the end
    const totalDuration =
      tickOffsetToSeconds(ir.endTick, bpm, swingEnabled, swingRatio) -
      tickOffsetToSeconds(startTickParam, bpm, swingEnabled, swingRatio);
    const stopTimeoutId = setTimeout(() => {
      if (this.isPlaying.get()) {
        this.stop();
      }
    }, totalDuration * 1000);
    this.scheduledEventIds.push(stopTimeoutId);
  }

  async start(
    startTickParam: number,
    scheduleCallback: (startTime: number) => void
  ) {
    // Ensure audio context is started (browser requires user gesture)
    await Tone.start();
    await this.initialize();

    if (!this.sampler) return;

    // Stop any existing playback
    this.stop();

    this.startTick = startTickParam;
    this.playheadTick.set(startTickParam);
    this.isPlaying.set(true);

    // Schedule all events
    const now = Tone.now();
    this.playbackStartTime = now;
    scheduleCallback(now);

    // Start playhead animation
    this.startPlayheadAnimation();
  }

  pause() {
    if (!this.isPlaying.get()) return;

    this.isPlaying.set(false);
    this.stopPlayheadAnimation();

    // Clear all scheduled events
    this.clearScheduledEvents();
  }

  stop() {
    this.isPlaying.set(false);
    this.stopPlayheadAnimation();
    this.clearScheduledEvents();
    this.playbackStartTime = null;
    this.startTick = 0;
  }

  scheduleNote(midi: number, startTime: number, durationSeconds: number) {
    if (!this.sampler) return;

    const note = Tone.Frequency(midi, "midi").toNote();
    this.sampler.triggerAttackRelease(note, durationSeconds, startTime);
  }

  scheduleChord(
    midiNotes: number[],
    startTime: number,
    durationSeconds: number
  ) {
    if (!this.sampler) return;

    const notes = midiNotes.map((midi) =>
      Tone.Frequency(midi, "midi").toNote()
    );
    this.sampler.triggerAttackRelease(notes, durationSeconds, startTime);
  }

  private scheduleNoteWithTransport(
    midi: number,
    startTime: number,
    durationSeconds: number
  ) {
    if (!this.sampler) return;

    const note = Tone.Frequency(midi, "midi").toNote();
    const now = Tone.now();
    const delayMs = Math.max(0, (startTime - now) * 1000);

    const timeoutId = setTimeout(() => {
      if (this.sampler && this.isPlaying.get()) {
        this.sampler.triggerAttackRelease(note, durationSeconds);
      }
    }, delayMs);

    this.scheduledEventIds.push(timeoutId);
  }

  private scheduleChordWithTransport(
    midiNotes: number[],
    startTime: number,
    durationSeconds: number
  ) {
    if (!this.sampler) return;

    const notes = midiNotes.map((midi) =>
      Tone.Frequency(midi, "midi").toNote()
    );
    const now = Tone.now();
    const delayMs = Math.max(0, (startTime - now) * 1000);

    const timeoutId = setTimeout(() => {
      if (this.sampler && this.isPlaying.get()) {
        this.sampler.triggerAttackRelease(notes, durationSeconds);
      }
    }, delayMs);

    this.scheduledEventIds.push(timeoutId);
  }

  private startPlayheadAnimation() {
    const animate = () => {
      if (!this.isPlaying.get() || this.playbackStartTime === null) return;

      const currentTime = Tone.now();
      const elapsedSeconds = currentTime - this.playbackStartTime;
      const bpm = this.bpm.get();
      const swingEnabled = this.swingEnabled.get();
      const swingRatio = this.swingRatio.get();

      const startSeconds = tickOffsetToSeconds(
        this.startTick,
        bpm,
        swingEnabled,
        swingRatio
      );
      const currentTick = secondsToTickOffset(
        startSeconds + elapsedSeconds,
        bpm,
        swingEnabled,
        swingRatio
      );

      this.playheadTick.set(currentTick);

      // Auto-stop when we reach the end
      if (this.endTick > 0 && currentTick >= this.endTick) {
        this.stop();
        return;
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
  }

  private stopPlayheadAnimation() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private clearScheduledEvents() {
    if (!this.sampler) return;

    // Cancel all scheduled timeouts
    for (const timeoutId of this.scheduledEventIds) {
      clearTimeout(timeoutId);
    }
    this.scheduledEventIds = [];

    // Release all active notes
    this.sampler.releaseAll();
  }

  getSecondsPerTick(): number {
    return secondsPerTick(this.bpm.get());
  }

  async previewNote(midi: number, durationSeconds: number = 0.5) {
    if (this.isPlaying.get()) return;

    await Tone.start();
    await this.initialize();

    if (!this.sampler) return;

    const note = Tone.Frequency(midi, "midi").toNote();
    const now = Tone.now();
    this.sampler.triggerAttackRelease(note, durationSeconds, now);
  }

  async previewChord(midiNotes: number[], durationSeconds: number = 1.0) {
    if (this.isPlaying.get() || midiNotes.length === 0) return;

    await Tone.start();
    await this.initialize();

    if (!this.sampler) return;

    const notes = midiNotes.map((midi) =>
      Tone.Frequency(midi, "midi").toNote()
    );
    const now = Tone.now();
    this.sampler.triggerAttackRelease(notes, durationSeconds, now);
  }
}

// Global singleton instance
export const playbackEngine = new PlaybackEngine();
