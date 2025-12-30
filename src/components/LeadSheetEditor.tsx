import React, { useRef, useEffect, useState } from "react";
import { Box, Input } from "@chakra-ui/react";
import { useObservable } from "../lib/observable";
import { LeadSheetModel, model } from "../lead-sheet/LeadSheetModel";
import { renderLeadSheet } from "../lead-sheet/vexflow-render";

export function LeadSheetEditor() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const shadowHostRef = useRef<HTMLDivElement>(null);
  const shadowRenderContainerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const chordInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to model state
  const events = useObservable(model.events);
  const measures = useObservable(model.measures);
  const timeSignature = useObservable(model.timeSignature);
  const caret = useObservable(model.caret);
  const normalizedSelection = useObservable(model.normalizedSelection);
  const chordMode = useObservable(model.chordMode);
  const hasFocus = useObservable(model.hasFocus);

  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });

  const [shadowReady, setShadowReady] = useState(false);

  // Isolate VexFlow SVG output from app CSS by rendering into a ShadowRoot.
  useEffect(() => {
    const host = shadowHostRef.current;
    if (!host) return;

    if (!host.shadowRoot) {
      host.attachShadow({ mode: "open" });
    }

    const shadowRoot = host.shadowRoot;
    if (!shadowRoot) return;

    // Create (or reuse) the render container inside the shadow root.
    let container = shadowRenderContainerRef.current;
    if (!container) {
      container = document.createElement("div");
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.position = "relative";

      // Optional: set a base font size for any non-music text VexFlow may emit.
      // This does not affect SMuFL glyphs which have explicit font-size attributes.
      const style = document.createElement("style");
      style.textContent = `
        :host { display: block; width: 100%; height: 100%; }
      `;

      shadowRoot.appendChild(style);
      shadowRoot.appendChild(container);
      shadowRenderContainerRef.current = container;
    }

    setShadowReady(true);
  }, []);

  // Handle container resize - observe the viewport wrapper (stable size)
  useEffect(() => {
    if (!viewportRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  // Render VexFlow notation whenever data changes
  useEffect(() => {
    if (!shadowReady) return;
    if (!shadowRenderContainerRef.current) return;

    renderLeadSheet({
      container: shadowRenderContainerRef.current,
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
    shadowReady,
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

  return (
    <Box width="100%" height="100%" position="relative">
      {/* Editor surface (focusable) - viewport wrapper with stable size */}
      <Box
        ref={editorRef}
        tabIndex={0}
        onFocus={handleEditorFocus}
        onBlur={handleEditorBlur}
        border="2px solid"
        borderColor={hasFocus ? "blue.500" : "gray.300"}
        borderRadius="md"
        p={4}
        position="relative"
        outline="none"
        bg={hasFocus ? "blue.50" : "white"}
        cursor={hasFocus ? "default" : "pointer"}
        height="100%"
        _focusVisible={{
          borderColor: "blue.500",
          boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)",
        }}
      >
        {/* Viewport wrapper - this is what we observe for resize */}
        <div
          ref={viewportRef}
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            minHeight: "400px",
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
                Start typing notes (A-G)
              </Box>
              <Box fontSize="sm">Press 4, 8, or 6 to change duration first</Box>
            </Box>
          )}

          {/* VexFlow container (ShadowRoot host) */}
          <div
            ref={shadowHostRef}
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
            }}
          />
        </div>

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
    </Box>
  );
}
