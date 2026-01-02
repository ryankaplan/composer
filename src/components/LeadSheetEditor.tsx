import React, { useRef, useEffect, useState } from "react";
import { Box, Input } from "@chakra-ui/react";
import { useObservable } from "../lib/observable";
import { doc } from "../lead-sheet/Document";
import { renderLeadSheet, LeadSheetLayout } from "../lead-sheet/vexflow-render";
import { ChordTrackOverlay } from "./ChordTrackOverlay";
import { interfaceState } from "../lead-sheet/InterfaceState";
import { matchChords } from "../lead-sheet/chord-autocomplete";
import { computeMeasures } from "../lead-sheet/measure";
import { playbackEngine } from "../playback/engine";
import { FaIcon } from "./FaIcon";

export function LeadSheetEditor() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const shadowHostRef = useRef<HTMLDivElement>(null);
  const shadowRenderContainerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Subscribe to model state
  const events = useObservable(doc.events);
  const measures = useObservable(doc.measures);
  const timeSignature = useObservable(doc.timeSignature);
  const caret = useObservable(doc.caret);
  const normalizedSelection = useObservable(doc.normalizedSelection);
  const chordTrack = useObservable(doc.chords);
  const eventStartUnits = useObservable(doc.eventStartUnits);
  const documentEndUnit = useObservable(doc.documentEndUnit);
  const selectedChordId = useObservable(interfaceState.selectedChordId);
  const isPlaying = useObservable(playbackEngine.isPlaying);
  const playheadUnit = useObservable(playbackEngine.playheadUnit);

  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });

  const [shadowReady, setShadowReady] = useState(false);
  const [editingChordId, setEditingChordId] = useState<string | null>(null);
  const [editingChordText, setEditingChordText] = useState("");
  const [editingChordPosition, setEditingChordPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<
    string[]
  >([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] =
    useState<number>(0);
  const [layout, setLayout] = useState<LeadSheetLayout | null>(null);

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

    const newLayout = renderLeadSheet({
      container: shadowRenderContainerRef.current,
      events,
      measures,
      timeSignature,
      caret,
      selection: normalizedSelection,
      width: containerSize.width,
      height: containerSize.height,
      showCaret: !isPlaying,
      playheadUnit: isPlaying ? playheadUnit : undefined,
    });

    setLayout(newLayout);
  }, [
    events,
    measures,
    timeSignature,
    caret,
    normalizedSelection,
    containerSize,
    shadowReady,
    chordTrack,
    eventStartUnits,
    documentEndUnit,
    isPlaying,
    playheadUnit,
  ]);

  // Handle clicks on rendered notes/rests in the shadow DOM
  useEffect(() => {
    const host = shadowHostRef.current;
    if (!host || !host.shadowRoot) return;

    function handleClick(e: Event) {
      // Use composedPath to traverse through shadow DOM
      const path = e.composedPath();
      for (const element of path) {
        if (element instanceof Element) {
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
      // If we clicked empty space, clear melody selection and chord selection
      doc.clearSelection();
      setEditingChordId(null);
      setEditingChordPosition(null);
      setAutocompleteSuggestions([]);
      setSelectedSuggestionIndex(0);
      interfaceState.clearSelectedChord();
    }

    const shadowRoot = host.shadowRoot;
    shadowRoot.addEventListener("click", handleClick);

    return () => {
      shadowRoot.removeEventListener("click", handleClick);
    };
  }, []);

  // Handle chord region editing
  function handleChordEditChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newText = e.target.value;
    setEditingChordText(newText);

    // Update autocomplete suggestions
    const suggestions = matchChords(newText, 4);
    setAutocompleteSuggestions(suggestions);
    setSelectedSuggestionIndex(suggestions.length > 0 ? 0 : -1);
  }

  function handleChordEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const totalOptions = autocompleteSuggestions.length + 1; // +1 for delete option

    if (e.key === "Enter") {
      e.preventDefault();

      // If delete option is selected
      if (selectedSuggestionIndex === autocompleteSuggestions.length) {
        handleDeleteChord();
        return;
      }

      // If there are suggestions and one is selected, use it
      if (
        autocompleteSuggestions.length > 0 &&
        selectedSuggestionIndex >= 0 &&
        selectedSuggestionIndex < autocompleteSuggestions.length
      ) {
        const selectedSuggestion =
          autocompleteSuggestions[selectedSuggestionIndex];
        if (selectedSuggestion && editingChordId) {
          doc.updateChordRegionText(editingChordId, selectedSuggestion);
        }
      } else if (editingChordId && editingChordText.trim()) {
        // No suggestions or invalid index, use the typed text
        doc.updateChordRegionText(editingChordId, editingChordText.trim());
      }

      setEditingChordId(null);
      setEditingChordPosition(null);
      setAutocompleteSuggestions([]);
      setSelectedSuggestionIndex(0);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingChordId(null);
      setEditingChordPosition(null);
      setAutocompleteSuggestions([]);
      setSelectedSuggestionIndex(0);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev < totalOptions - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : 0));
    }
  }

  function handleDeleteChord() {
    if (editingChordId) {
      doc.deleteChordRegion(editingChordId);
    }
    setEditingChordId(null);
    setEditingChordPosition(null);
    setAutocompleteSuggestions([]);
    setSelectedSuggestionIndex(0);
    interfaceState.clearSelectedChord();
  }

  // Handle chord clicks from the React overlay
  function handleChordClick(
    chordId: string,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    interfaceState.setSelectedChord(chordId);
    setEditingChordId(chordId);
    setEditingChordText(text);
    setEditingChordPosition({ x, y, width, height });

    // Initialize autocomplete suggestions
    const suggestions = matchChords(text, 4);
    setAutocompleteSuggestions(suggestions);
    setSelectedSuggestionIndex(suggestions.length > 0 ? 0 : -1);
  }

  // Handle clicking on an autocomplete suggestion
  function handleSuggestionClick(suggestion: string) {
    if (editingChordId) {
      doc.updateChordRegionText(editingChordId, suggestion);
    }
    setEditingChordId(null);
    setEditingChordPosition(null);
    setAutocompleteSuggestions([]);
    setSelectedSuggestionIndex(0);
  }

  // Handle background clicks to clear chord selection
  function handleChordBackgroundClick() {
    interfaceState.clearSelectedChord();
    setEditingChordId(null);
    setEditingChordPosition(null);
    setAutocompleteSuggestions([]);
    setSelectedSuggestionIndex(0);
  }

  // Handle measure insertion click
  function handleMeasureInsertClick(measureIndex: number, clickUnit: number) {
    doc.insertChordInMeasure(measureIndex, "C", clickUnit);
  }

  // Handle chord region resize commit
  function handleResizeCommit(
    regionId: string,
    newStart: number,
    newEnd: number
  ) {
    doc.resizeChordRegion(regionId, newStart, newEnd);
  }

  // Handle chord append (insert chord after last chord)
  function handleChordAppend(
    start: number,
    end: number,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const chordId = doc.insertChordRegionAbsolute(start, end, text);
    if (!chordId) return;

    // Start the chord editing flow immediately
    handleChordClick(chordId, text, x, y, width, height);
  }

  // Handle measure append (extend document by 1 bar)
  function handleMeasureAppend() {
    doc.extendDocumentByBars(1);
  }

  // Auto-scroll to keep playhead visible during playback
  useEffect(() => {
    if (
      !isPlaying ||
      !layout ||
      !editorRef.current ||
      playheadUnit === undefined
    ) {
      return;
    }

    // Find which system the playhead is in
    const unitsPerBar = layout.unitsPerBar;
    const measureIndex = Math.floor(playheadUnit / unitsPerBar);
    const systemIndex = Math.floor(measureIndex / layout.measuresPerSystem);

    // Calculate the Y position of this system
    const systemY =
      layout.staveMargin +
      systemIndex * (layout.staveHeight + layout.staveMargin);

    // Get the current scroll position and viewport height
    const editorElement = editorRef.current;
    const scrollTop = editorElement.scrollTop;
    const viewportHeight = editorElement.clientHeight;

    // Define scroll margins (how close to edge before scrolling)
    const topMargin = 100;
    const bottomMargin = 100;

    // Check if system is out of view or too close to edges
    const systemTopInViewport = systemY - scrollTop;
    const systemBottomInViewport = systemTopInViewport + layout.staveHeight;

    if (systemTopInViewport < topMargin) {
      // System is too close to top or above viewport - scroll up
      editorElement.scrollTo({
        top: systemY - topMargin,
        behavior: "smooth",
      });
    } else if (systemBottomInViewport > viewportHeight - bottomMargin) {
      // System is too close to bottom or below viewport - scroll down
      editorElement.scrollTo({
        top: systemY - topMargin,
        behavior: "smooth",
      });
    }
  }, [isPlaying, playheadUnit, layout]);

  // Compute melody measure count (un-padded)
  const melodyMeasureCount = computeMeasures(events, timeSignature).length;

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

          {/* Chord track overlay (React layer) */}
          {layout && (
            <ChordTrackOverlay
              chordTrack={chordTrack}
              timeSignature={timeSignature}
              layout={layout}
              selectedChordId={selectedChordId}
              onChordClick={handleChordClick}
              onBackgroundClick={handleChordBackgroundClick}
              onMeasureInsertClick={handleMeasureInsertClick}
              onResizeCommit={handleResizeCommit}
              onChordAppend={handleChordAppend}
            />
          )}

          {/* Measure append box (right of last melody measure) */}
          {layout &&
            melodyMeasureCount > 0 &&
            (() => {
              // Show the + box in the next virtual measure slot, so you can extend repeatedly.
              // This is intentionally NOT tied to melodyMeasureCount.
              const targetMeasureIndex = measures.length;
              const rect = computeVirtualMeasureRect(
                layout,
                targetMeasureIndex
              );
              if (!rect) return null;
              return (
                <MeasureAppendBox rect={rect} onClick={handleMeasureAppend} />
              );
            })()}

          {/* Chord region edit overlay */}
          {editingChordId &&
            editingChordPosition &&
            (() => {
              // Clamp width to minimum 140px, maximum 300px
              const widthPx = Math.max(
                140,
                Math.min(editingChordPosition.width, 300)
              );
              // Clamp left position to stay in bounds
              const leftPx = Math.max(
                0,
                Math.min(editingChordPosition.x, containerSize.width - widthPx)
              );
              const topPx = Math.max(0, editingChordPosition.y);

              return (
                <Box
                  position="absolute"
                  left={`${leftPx}px`}
                  top={`${topPx}px`}
                  zIndex={10}
                >
                  <Input
                    autoFocus
                    value={editingChordText}
                    onChange={handleChordEditChange}
                    onKeyDown={handleChordEditKeyDown}
                    placeholder="Enter chord (e.g. Cmaj7)"
                    size="sm"
                    width={`${widthPx}px`}
                    bg="white"
                    border="2px solid"
                    borderColor="blue.500"
                    boxShadow="0 2px 8px rgba(0, 0, 0, 0.15)"
                  />

                  {/* Autocomplete dropdown */}
                  <Box
                    position="absolute"
                    top="32px"
                    left="0"
                    width={`${widthPx}px`}
                    bg="white"
                    border="1px solid"
                    borderColor="gray.300"
                    borderRadius="4px"
                    boxShadow="0 4px 12px rgba(0, 0, 0, 0.15)"
                    maxH="200px"
                    overflowY="auto"
                    zIndex={11}
                  >
                    {autocompleteSuggestions.map((suggestion, index) => (
                      <Box
                        key={suggestion}
                        px={3}
                        py={2}
                        cursor="pointer"
                        bg={
                          index === selectedSuggestionIndex
                            ? "blue.100"
                            : "transparent"
                        }
                        _hover={{ bg: "gray.100" }}
                        fontSize="sm"
                        onClick={() => handleSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </Box>
                    ))}

                    {/* Delete Option */}
                    <Box
                      px={3}
                      py={2}
                      cursor="pointer"
                      bg={
                        selectedSuggestionIndex ===
                        autocompleteSuggestions.length
                          ? "red.100"
                          : "transparent"
                      }
                      _hover={{ bg: "red.50" }}
                      color="red.600"
                      fontSize="sm"
                      onClick={handleDeleteChord}
                      borderTop="1px solid"
                      borderColor="gray.200"
                      display="flex"
                      alignItems="center"
                    >
                      <FaIcon name="trash" style={{ marginRight: "8px" }} />
                      Delete Chord
                    </Box>
                  </Box>
                </Box>
              );
            })()}
        </div>
      </Box>
    </Box>
  );
}

type MeasureAppendBoxProps = {
  rect: { x: number; y: number; width: number; height: number };
  onClick: () => void;
};

function MeasureAppendBox({ rect, onClick }: MeasureAppendBoxProps) {
  const [isHovered, setIsHovered] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onClick();
  }

  return (
    <Box
      position="absolute"
      left={`${rect.x}px`}
      top={`${rect.y}px`}
      width={`${rect.width}px`}
      height={`${rect.height}px`}
      border={isHovered ? "1px dashed rgba(59, 130, 246, 0.4)" : "none"}
      bg={isHovered ? "rgba(147, 197, 253, 0.05)" : "transparent"}
      borderRadius="4px"
      cursor="pointer"
      pointerEvents="auto"
      display="flex"
      alignItems="center"
      justifyContent="center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      zIndex={1}
    >
      {isHovered && (
        <Box
          fontSize="24px"
          color="rgba(59, 130, 246, 0.6)"
          fontWeight="300"
          userSelect="none"
        >
          +
        </Box>
      )}
    </Box>
  );
}

function computeVirtualMeasureRect(
  layout: LeadSheetLayout,
  measureIndex: number
): { x: number; y: number; width: number; height: number } | null {
  if (layout.measureMetadata.length === 0) return null;

  const measuresPerSystem = layout.measuresPerSystem;
  const systemIndex = Math.floor(measureIndex / measuresPerSystem);
  const positionInSystem = measureIndex % measuresPerSystem;

  const x =
    layout.systemPaddingX +
    positionInSystem * (layout.measureWidth + layout.interMeasureGap);
  const y =
    layout.staveMargin +
    systemIndex * (layout.staveHeight + layout.staveMargin);

  // Derive staff height from any rendered measure (stable across systems)
  const base = layout.measureMetadata[0]!;
  const staffTopDelta = base.staffTop - base.y;
  const staffBottomDelta = base.staffBottom - base.y;

  const staffTop = y + staffTopDelta;
  const staffBottom = y + staffBottomDelta;

  // Measure-append box should live in the melody staff area (not the chord band)
  const paddingY = 6;
  return {
    x,
    y: staffTop - paddingY,
    width: layout.measureWidth,
    height: staffBottom - staffTop + paddingY * 2,
  };
}
