## Initial proposal

Add a playback mode to this app. Use the TS library "tone": "15.1.22". It should be initialized roughly like this...

sampler = new Tone.Sampler({
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

We should use this to play both chords and melody.

From a UX perspective there's lots to figure out. All I know right now is that I want header controls for playing that include: a play button which changes color when playing, a pause button and an adjustable bpm. These should be grouped together on the right of the toolbar. Remove "Position" which currently lives there.

Playing should play from the current caret position. But it should not move the caret. When playing the user should see a line move through the score so that it touches notes at the time that they play. This is tricky because it needs to move at a non-linear speed.

Lastly... playing itself is tricky because we're playing chords and melody which have differen time units. It may be worth building an IR for music playback that we transform our Document into. Although then we need to be careful to still be able to play starting a particular caret position, given the IR.

## Engineering / design plan (incorporating decisions)

### UX / controls

- Add toolbar controls on the **right side**:
  - **Play/Pause toggle** (spacebar should also toggle).
    - Play button changes color/state while playing.
  - **Pause** (optional separate button; could be the same toggle).
  - **BPM input** (used when starting playback; no need to support tempo changes mid-playback yet).
- Remove the existing **Position** indicator currently on the right of the toolbar.

### Playback start/stop behavior (decisions)

- **Start**: convert caret → musical time and play **only music events whose start time is >= caret**.
  - This includes melody notes/rests and chord regions that begin at or after the caret time.
  - **Do not** play chords that started before the caret (even if still “active”).
- **Stop**: stop at the end of the document (no looping).

### Timing model (existing codebase alignment)

- The codebase already defines **Unit** time where `1 Unit = 1/16 note`.
- Melody timing:
  - `eventStartUnits[i]` gives the start unit of melody event `events[i]`.
  - `durationToUnits()` converts durations to units.
- Chord timing:
  - Chords are stored as regions `[startUnit, endUnit)` in `doc.chords`.
- Document length:
  - `doc.documentEndUnit` is already the max of melody end, chord end, and explicit end.

### Playback IR (intermediate representation)

Build a lightweight IR each time playback starts (snapshot is fine; we’re not optimizing for live edits during playback yet):

- `MelodyPlaybackEvent`:
  - `startUnit`, `durationUnits`, `kind: "note" | "rest"`, `midi?`
  - **Tie handling**: treat tied notes as a single sustained note (do not retrigger). This means merging sequences where `tieToNext` is set and the next note has the same MIDI.
- `ChordPlaybackEvent`:
  - `startUnit`, `durationUnits`, `midiNotes[]`
  - Regions are played only if `region.start >= caretUnit`.

Filter step:

- Drop any IR events with `startUnit < caretUnit`.
- Compute the final `endUnit` as `doc.documentEndUnit`.

### Sound engine (Tone.js sampler)

- Add dependency `tone@15.1.22`.
- Initialize a single `Tone.Sampler` using the Salamander piano sample set (as in the proposal) and route to destination.
- Playback initiation must be gated by a user gesture (browser audio policy). Ensure we call `Tone.start()` (or equivalent) on first play.

Scheduling:

- Convert units to seconds via BPM:
  - Quarter note = 4 units → seconds per unit = `60 / (bpm * 4)`.
- For each IR event:
  - Melody note: schedule `triggerAttackRelease(note, durationSeconds, timeSeconds)`.
  - Melody rest: schedule nothing (but still advances time in the visualization).
  - Chord: schedule `triggerAttackRelease(notes[], durationSeconds, timeSeconds)`.

Pause/resume:

- MVP approach: on pause, stop all scheduled playback; on resume, rebuild IR and schedule again from the current playhead time (we don’t need sample-accurate resume yet).
- BPM changes during playback: ignore for now (apply BPM only on new playback start).

### Chord symbol → MIDI notes (MVP parser + voicing rules)

Goal: “simple triad / 7th chord based on suffixes.”

Parsing:

- Root letter: `[A-G]` with optional accidental `#|b`.
- Optional quality / extensions (MVP supported set):
  - Major triad: `""` (e.g. `C`)
  - Minor: `m` (e.g. `Cm`)
  - Diminished: `dim` or `o`
  - Augmented: `aug` or `+`
  - Suspended: `sus2`, `sus4`, and optionally `7sus4`
  - Sevenths: `7`, `maj7` / `M7`, `m7`, `m7b5` / `ø7`
- Slash chords: `X/Y`
  - **Decision**: replace the root with the slash bass (i.e. use `Y` as the chord’s root for building the triad/7th).

Voicing:

- Keep it simple and stable:
  - Choose a default octave (e.g. around C3–C4) and generate chord tones in close position.
  - Optionally clamp notes to a comfortable range (avoid extreme highs/lows).
- If parsing fails, choose a safe fallback (e.g. play only the root as a single note, or treat as rest).

### Visual playhead (non-linear motion + autoscroll)

Key requirement: the playhead line should “touch notes at the time they play,” which implies **non-linear x motion** because note spacing in notation is not proportional to time.

Plan:

- Extend the rendered layout information to expose enough mapping data for playback visualization:
  - Use VexFlow-rendered note bounding boxes and/or caret X computation to derive an x-position per event.
  - For spans with no melody events (padded measures), fall back to a linear mapping inside the measure’s note area.
- Render a playhead overlay line that spans:
  - **Chord track area + melody staff height** (decision).
- Drive playhead position from elapsed time:
  - `playheadUnit = caretUnit + elapsedSeconds / secondsPerUnit`.
  - Compute x/y span for the current system; if crossing systems, jump to the next system.
- **Auto-scroll**:
  - When the playhead enters a different system (or gets close to viewport edge), scroll the editor container to keep it visible.

### Keyboard shortcuts

- Bind **Space** to play/pause toggle.
  - Ensure it does not conflict with existing global “prevent default for space” behavior in the shortcut manager (it currently prevents default, so the binding should work cleanly).
