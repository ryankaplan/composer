import React, { useRef, useEffect, useState } from "react";
import { Box, Input } from "@chakra-ui/react";
import VexFlow from "vexflow/bravura";
import { useObservable } from "../lib/observable";
import { LeadSheetModel, model } from "../lead-sheet/LeadSheetModel";
import { renderLeadSheet } from "../lead-sheet/vexflow-render";

export function LeadSheetEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const chordInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to model state
  const events = useObservable(model.events);
  const measures = useObservable(model.measures);
  const timeSignature = useObservable(model.timeSignature);
  const caret = useObservable(model.caret);
  const normalizedSelection = useObservable(model.normalizedSelection);
  const chordMode = useObservable(model.chordMode);
  const currentDuration = useObservable(model.currentDuration);
  const pendingAccidental = useObservable(model.pendingAccidental);
  const hasFocus = useObservable(model.hasFocus);

  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    // Ensure the SMuFL font is available before the first render.
    // (VexFlow.loadFonts() would fetch from a CDN; we want the bundled bravura entry.)
    let cancelled = false;

    function markLoaded() {
      if (cancelled) return;
      setFontsLoaded(true);
    }

    if (typeof document === "undefined" || !document.fonts) {
      markLoaded();
      return () => {
        cancelled = true;
      };
    }

    Promise.all([
      document.fonts.load("16px Bravura"),
      document.fonts.load("16px Academico"),
    ])
      .then(markLoaded)
      .catch(markLoaded);

    return () => {
      cancelled = true;
    };
  }, []);

  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Render VexFlow notation whenever data changes
  useEffect(() => {
    if (!containerRef.current || !fontsLoaded) return;

    renderLeadSheet({
      container: containerRef.current,
      events,
      measures,
      timeSignature,
      caret,
      selection: normalizedSelection,
      width: containerSize.width,
      height: containerSize.height,
    });
  }, [
    events,
    measures,
    timeSignature,
    caret,
    normalizedSelection,
    containerSize,
    fontsLoaded,
  ]);

  // Focus chord input when chord mode opens
  useEffect(() => {
    if (chordMode && chordInputRef.current) {
      chordInputRef.current.focus();
    }
  }, [chordMode]);

  // Handle focus/blur for editor surface
  function handleEditorFocus() {
    model.setHasFocus(true);
  }

  function handleEditorBlur() {
    model.setHasFocus(false);
  }

  // Handle keydown for quote key (chord mode entry)
  function handleEditorKeyDown(e: React.KeyboardEvent) {
    // Check if quote key (") was pressed
    if (e.key === '"' && !model.chordMode.get()) {
      e.preventDefault();
      model.enterChordMode();
    }
  }

  // Handle chord input changes
  function handleChordInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    model.setChordDraft(e.target.value);
  }

  // Handle chord input key events
  function handleChordInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      model.commitChord();
    } else if (e.key === "Escape") {
      e.preventDefault();
      model.cancelChordMode();
    }
  }

  // Handle time signature change
  function handleTimeSignatureChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const beatsPerBar = parseInt(e.target.value) as 3 | 4;
    model.setTimeSignature({ beatsPerBar, beatUnit: 4 });
  }

  return (
    <Box>
      {/* Controls */}
      <Box mb={4} display="flex" gap={4} alignItems="center" flexWrap="wrap">
        <Box>
          <label htmlFor="time-sig">Time Signature: </label>
          <select
            id="time-sig"
            value={timeSignature.beatsPerBar}
            onChange={handleTimeSignatureChange}
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          >
            <option value="3">3/4</option>
            <option value="4">4/4</option>
          </select>
        </Box>
        <Box>
          Current Duration: <strong>{currentDuration}</strong>
        </Box>
        {pendingAccidental && (
          <Box color="blue.600">
            Pending Accidental: <strong>{pendingAccidental}</strong>
          </Box>
        )}
        <Box>
          Caret: {caret} / {events.length}
        </Box>
        <Box color={hasFocus ? "green.600" : "gray.500"}>
          {hasFocus ? "Focused ✓" : "Click to focus"}
        </Box>
      </Box>

      {/* Editor surface (focusable) */}
      <Box
        ref={editorRef}
        tabIndex={0}
        onFocus={handleEditorFocus}
        onBlur={handleEditorBlur}
        onKeyDown={handleEditorKeyDown}
        border="2px solid"
        borderColor={hasFocus ? "blue.500" : "gray.300"}
        borderRadius="md"
        p={4}
        position="relative"
        outline="none"
        bg={hasFocus ? "blue.50" : "white"}
        cursor={hasFocus ? "default" : "pointer"}
        _focusVisible={{
          borderColor: "blue.500",
          boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
        }}
      >
        {events.length === 0 && (
          <Box
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            textAlign="center"
            color="gray.500"
            pointerEvents="none"
          >
            <Box fontSize="lg" mb={2}>
              Click here and start typing notes (A-G)
            </Box>
            <Box fontSize="sm">Press 4, 8, or 6 to change duration first</Box>
          </Box>
        )}

        {/* VexFlow container */}
        <div
          ref={containerRef}
          style={{
            width: "100%",
            minHeight: "400px",
            position: "relative",
          }}
        />

        {/* Chord input overlay */}
        {chordMode && (
          <Box
            position="absolute"
            top="20px"
            left="50%"
            transform="translateX(-50%)"
            zIndex={10}
          >
            <Input
              ref={chordInputRef}
              value={chordMode.text}
              onChange={handleChordInputChange}
              onKeyDown={handleChordInputKeyDown}
              placeholder="Enter chord (e.g. Cmaj7)"
              size="sm"
              width="200px"
              bg="white"
              border="2px solid"
              borderColor="blue.500"
            />
          </Box>
        )}
      </Box>

      {/* Instructions */}
      <Box mt={4} fontSize="sm" color="gray.600">
        <strong>Instructions:</strong>
        <ul>
          <li>A-G: Insert note</li>
          <li>R: Insert rest</li>
          <li>4/8/6: Set duration (quarter/eighth/sixteenth)</li>
          <li>Shift+3: Sharp (#), Minus: Flat (♭)</li>
          <li>Arrow keys: Move caret (Shift to select)</li>
          <li>Backspace/Delete: Remove notes</li>
          <li>" (quote): Enter chord mode</li>
        </ul>
      </Box>
    </Box>
  );
}
