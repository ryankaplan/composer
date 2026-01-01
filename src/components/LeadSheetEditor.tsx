import React, { useRef, useEffect, useState } from "react";
import { Box, Input } from "@chakra-ui/react";
import { useObservable } from "../lib/observable";
import { doc } from "../lead-sheet/Document";
import { interfaceState } from "../lead-sheet/InterfaceState";
import { commitChordAction } from "../lead-sheet/actions";
import { renderLeadSheet } from "../lead-sheet/vexflow-render";

export function LeadSheetEditor() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const shadowHostRef = useRef<HTMLDivElement>(null);
  const shadowRenderContainerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const chordInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to model state
  const events = useObservable(doc.events);
  const measures = useObservable(doc.measures);
  const timeSignature = useObservable(doc.timeSignature);
  const caret = useObservable(doc.caret);
  const normalizedSelection = useObservable(doc.normalizedSelection);
  const chordMode = useObservable(interfaceState.chordMode);
  const chordTrack = useObservable(doc.chords);
  const eventStartUnits = useObservable(doc.eventStartUnits);
  const documentEndUnit = useObservable(doc.documentEndUnit);

  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });

  const [shadowReady, setShadowReady] = useState(false);
  const [editingChordId, setEditingChordId] = useState<string | null>(null);
  const [editingChordText, setEditingChordText] = useState("");

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
      showCaret: chordMode === null,
      chordTrack,
      eventStartUnits,
      documentEndUnit,
    });
  }, [
    events,
    measures,
    timeSignature,
    caret,
    normalizedSelection,
    containerSize,
    shadowReady,
    chordMode,
    chordTrack,
    eventStartUnits,
    documentEndUnit,
  ]);

  // Focus chord input when chord mode opens
  useEffect(() => {
    if (chordMode && chordInputRef.current) {
      chordInputRef.current.focus();
    }
  }, [chordMode]);

  // Handle clicks on rendered notes/rests/chords in the shadow DOM
  useEffect(() => {
    const host = shadowHostRef.current;
    if (!host || !host.shadowRoot) return;

    function handleClick(e: Event) {
      // Use composedPath to traverse through shadow DOM
      const path = e.composedPath();
      for (const element of path) {
        if (element instanceof Element) {
          // Check for chord region click
          const chordIdAttr = element.getAttribute("data-chord-id");
          if (chordIdAttr !== null) {
            const region = chordTrack.regions.find((r) => r.id === chordIdAttr);
            if (region) {
              setEditingChordId(region.id);
              setEditingChordText(region.text);
              e.stopPropagation();
              return;
            }
          }

          // Check for melody event click
          const eventIdxAttr = element.getAttribute("data-event-idx");
          if (eventIdxAttr !== null) {
            const eventIdx = parseInt(eventIdxAttr, 10);
            if (!isNaN(eventIdx)) {
              doc.selectSingleEvent(eventIdx);
              // Focus the editor so keyboard shortcuts work
              editorRef.current?.focus();
              e.stopPropagation();
              return;
            }
          }
        }
      }
      // If we clicked empty space, just clear selection
      doc.clearSelection();
      setEditingChordId(null);
    }

    const shadowRoot = host.shadowRoot;
    shadowRoot.addEventListener("click", handleClick);

    return () => {
      shadowRoot.removeEventListener("click", handleClick);
    };
  }, [chordTrack]);

  // Handle chord input changes (legacy modal mode)
  function handleChordInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    interfaceState.setChordDraft(e.target.value);
  }

  // Handle chord input key events (legacy modal mode)
  function handleChordInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitChordAction();
    } else if (e.key === "Escape") {
      e.preventDefault();
      interfaceState.cancelChordMode();
    }
  }

  // Handle chord region editing
  function handleChordEditChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEditingChordText(e.target.value);
  }

  function handleChordEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (editingChordId && editingChordText.trim()) {
        doc.updateChordRegionText(editingChordId, editingChordText.trim());
      }
      setEditingChordId(null);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingChordId(null);
    }
  }

  return (
    <Box width="100%" height="100%" position="relative">
      {/* Editor surface (focusable) - viewport wrapper with stable size */}
      <Box
        ref={editorRef}
        tabIndex={0}
        p={4}
        position="relative"
        outline="none"
        bg="blue.50"
        cursor="default"
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

        {/* Chord input overlay (legacy modal mode) */}
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

        {/* Chord region edit overlay */}
        {editingChordId && (
          <Box
            position="absolute"
            top="20px"
            left="50%"
            transform="translateX(-50%)"
            zIndex={10}
          >
            <Input
              autoFocus
              value={editingChordText}
              onChange={handleChordEditChange}
              onKeyDown={handleChordEditKeyDown}
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
