import React, { useState } from "react";
import { Box, Flex, Input } from "@chakra-ui/react";
import { Tooltip } from "@chakra-ui/react/tooltip";
import { useObservable } from "../lib/observable";
import { doc } from "../lead-sheet/Document";
import { getActionShortcutText } from "../lead-sheet/actions";
import { playbackEngine } from "../playback/engine";
import { buildPlaybackIR } from "../playback/build-ir";
import { caretToTick } from "../playback/time";
import { KEY_SIGNATURES, KeySignature } from "../lead-sheet/types";
import { compositionStore } from "../compositions/store";
import { FaIcon } from "./FaIcon";
import { exportDocumentToMusicXML } from "../musicxml/export";

type TopToolbarProps = {
  onToggleSidebar: () => void;
};

export function TopToolbar(props: TopToolbarProps) {
  const { onToggleSidebar } = props;
  const timeSignature = useObservable(doc.timeSignature);
  const keySignature = useObservable(doc.keySignature);
  const caret = useObservable(doc.caret);
  const events = useObservable(doc.events);
  const documentEndTick = useObservable(doc.documentEndTick);
  const isPlaying = useObservable(playbackEngine.isPlaying);
  const bpm = useObservable(playbackEngine.bpm);
  const swingEnabled = useObservable(playbackEngine.swingEnabled);
  const compositions = useObservable(compositionStore.compositions);
  const currentCompositionId = useObservable(
    compositionStore.currentCompositionId
  );

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");

  const [isEditingBpm, setIsEditingBpm] = useState(false);
  const [editingBpm, setEditingBpm] = useState(bpm.toString());

  // Keep editingBpm in sync with bpm when not editing
  if (!isEditingBpm && editingBpm !== bpm.toString()) {
    setEditingBpm(bpm.toString());
  }

  const currentComposition = compositions.find(
    (c) => c.id === currentCompositionId
  );
  const currentTitle = currentComposition?.title || "Untitled";

  function handleTimeSignatureChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const beatsPerBar = parseInt(e.target.value) as 3 | 4;
    doc.setTimeSignature({ beatsPerBar, beatUnit: 4 });
  }

  function handleKeySignatureChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const key = e.target.value as KeySignature;
    doc.setKeySignature(key);
  }

  async function handlePlay() {
    if (!isPlaying) {
      const chordTrack = doc.chords.get();
      const caretTick = caretToTick(events, caret);
      const ir = buildPlaybackIR(
        events,
        caretTick,
        documentEndTick,
        chordTrack
      );
      await playbackEngine.playIR(ir, caretTick);
    }
  }

  function handlePause() {
    if (isPlaying) {
      playbackEngine.pause();
    }
  }

  function handleBpmChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEditingBpm(e.target.value);
  }

  function handleBpmFocus(e: React.FocusEvent<HTMLInputElement>) {
    setIsEditingBpm(true);
    e.target.select();
  }

  function handleBpmBlur() {
    commitBpmEdit();
  }

  function handleBpmKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      commitBpmEdit();
    } else if (e.key === "Escape") {
      setIsEditingBpm(false);
      setEditingBpm(bpm.toString());
    }
  }

  function commitBpmEdit() {
    const newBpm = parseInt(editingBpm);
    if (!isNaN(newBpm) && newBpm >= 20 && newBpm <= 300) {
      playbackEngine.bpm.set(newBpm);
    }
    setIsEditingBpm(false);
    setEditingBpm(bpm.toString());
  }

  function handleToggleSwing() {
    playbackEngine.swingEnabled.set(!swingEnabled);
  }

  function handleToggleSidebar() {
    onToggleSidebar();
  }

  function handleTitleClick() {
    setIsEditingTitle(true);
    setEditingTitle(currentTitle);
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEditingTitle(e.target.value);
  }

  function handleTitleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.select();
  }

  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      commitTitleEdit();
    } else if (e.key === "Escape") {
      setIsEditingTitle(false);
    }
  }

  function handleTitleBlur() {
    commitTitleEdit();
  }

  function commitTitleEdit() {
    if (editingTitle.trim() && editingTitle !== currentTitle) {
      compositionStore.updateCurrentTitle(editingTitle.trim());
    }
    setIsEditingTitle(false);
  }

  function handleExportMusicXML() {
    try {
      const xml = exportDocumentToMusicXML(doc, currentTitle);
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentTitle}.musicxml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(
        "Export failed: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }

  return (
    <Flex
      as="nav"
      position="fixed"
      top="0"
      left="0"
      right="0"
      zIndex="1000"
      bg="surface"
      borderBottom="1px solid"
      borderColor="border"
      px={4}
      py={2}
      gap={3}
      alignItems="center"
      flexWrap="wrap"
      boxShadow="header"
      backdropFilter="blur(8px)"
      height="56px"
    >
      {/* Left side */}
      <Flex alignItems="center" gap={2}>
        {/* Sidebar toggle */}
        <button
          onClick={handleToggleSidebar}
          style={{
            background: "transparent",
            color: "#4a5568",
            padding: "6px",
            borderRadius: "4px",
            fontSize: "16px",
            cursor: "pointer",
            userSelect: "none",
            transition: "all 0.15s ease",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.04)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <FaIcon name="bars" style={{ fontSize: "16px" }} />
        </button>

        {/* Export */}
        <Tooltip.Root positioning={{ placement: "bottom" }}>
          <Tooltip.Trigger asChild>
            <button
              onClick={handleExportMusicXML}
              style={{
                background: "transparent",
                color: "#4a5568",
                padding: "6px",
                borderRadius: "4px",
                fontSize: "14px",
                cursor: "pointer",
                userSelect: "none",
                transition: "all 0.15s ease",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <FaIcon name="file-export" style={{ fontSize: "14px" }} />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Positioner>
            <Tooltip.Content
              bg="gray.800"
              color="white"
              px={2}
              py={1}
              borderRadius="md"
              fontSize="xs"
            >
              Export MusicXML
            </Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Root>

        <Box width="1px" height="20px" bg="gray.200" mx={1} />

        {/* Time Signature */}
        <Flex alignItems="center" gap={1.5}>
          <Box fontSize="xs" color="gray.600" fontWeight="medium">
            Time
          </Box>
          <select
            id="time-sig"
            value={timeSignature.beatsPerBar}
            onChange={handleTimeSignatureChange}
            style={{
              padding: "3px 6px",
              borderRadius: "4px",
              border: "1px solid #e2e8f0",
              backgroundColor: "white",
              fontSize: "13px",
              cursor: "pointer",
              outline: "none",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#cbd5e0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
            }}
          >
            <option value="3">3/4</option>
            <option value="4">4/4</option>
          </select>
        </Flex>

        {/* Key Signature */}
        <Flex alignItems="center" gap={1.5}>
          <Box fontSize="xs" color="gray.600" fontWeight="medium">
            Key
          </Box>
          <select
            id="key-sig"
            value={keySignature}
            onChange={handleKeySignatureChange}
            style={{
              padding: "3px 6px",
              borderRadius: "4px",
              border: "1px solid #e2e8f0",
              backgroundColor: "white",
              fontSize: "13px",
              cursor: "pointer",
              outline: "none",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#cbd5e0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
            }}
          >
            {KEY_SIGNATURES.map((key) => (
              <option key={key} value={key}>
                {key} Major
              </option>
            ))}
          </select>
        </Flex>
      </Flex>

      {/* Spacer */}
      <Box flex="1" />

      {/* Center - Composition Title */}
      <Flex alignItems="center" justifyContent="center">
        {isEditingTitle ? (
          <Input
            autoFocus
            value={editingTitle}
            onChange={handleTitleChange}
            onKeyDown={handleTitleKeyDown}
            onBlur={handleTitleBlur}
            onFocus={handleTitleFocus}
            size="sm"
            width="240px"
            textAlign="center"
            bg="white"
            border="1px solid"
            borderColor="gray.300"
            fontSize="sm"
            fontWeight="medium"
          />
        ) : (
          <Box
            onClick={handleTitleClick}
            px={3}
            py={1}
            borderRadius="4px"
            fontSize="sm"
            fontWeight="medium"
            color="gray.800"
            cursor="pointer"
            transition="all 0.15s ease"
            _hover={{
              bg: "gray.100",
            }}
          >
            {currentTitle}
          </Box>
        )}
      </Flex>

      {/* Spacer */}
      <Box flex="1" />

      {/* Playback Controls - Right */}
      <Flex alignItems="center" gap={2}>
        <PlaybackButton
          label="▶"
          tooltip="Play"
          shortcut={getActionShortcutText("Play/Pause")}
          onClick={handlePlay}
          disabled={isPlaying}
        />
        <PlaybackButton
          label="⏸"
          tooltip="Pause"
          onClick={handlePause}
          disabled={!isPlaying}
        />

        <Box width="1px" height="20px" bg="gray.200" mx={1} />

        <Tooltip.Root positioning={{ placement: "bottom" }}>
          <Tooltip.Trigger asChild>
            <button
              onClick={handleToggleSwing}
              style={{
                background: swingEnabled ? "#edf2f7" : "transparent",
                color: swingEnabled ? "#2b6cb0" : "#4a5568",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                userSelect: "none",
                transition: "all 0.15s ease",
                border: "1px solid",
                borderColor: swingEnabled ? "#bee3f8" : "transparent",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
              onMouseEnter={(e) => {
                if (!swingEnabled) {
                  e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (!swingEnabled) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <Box
                width="8px"
                height="8px"
                borderRadius="full"
                bg={swingEnabled ? "blue.500" : "gray.300"}
              />
              SWING
            </button>
          </Tooltip.Trigger>
          <Tooltip.Positioner>
            <Tooltip.Content
              bg="gray.800"
              color="white"
              px={2}
              py={1}
              borderRadius="md"
              fontSize="xs"
            >
              Swing (2:1)
            </Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Root>

        <Box width="1px" height="20px" bg="gray.200" mx={1} />

        <Flex alignItems="center" gap={1.5}>
          <Box fontSize="xs" color="gray.600" fontWeight="medium">
            BPM
          </Box>
          <Input
            value={editingBpm}
            onChange={handleBpmChange}
            onFocus={handleBpmFocus}
            onBlur={handleBpmBlur}
            onKeyDown={handleBpmKeyDown}
            width="50px"
            size="xs"
            textAlign="center"
            bg="white"
            border="1px solid"
            borderColor={isEditingBpm ? "blue.400" : "gray.200"}
            _hover={{
              borderColor: isEditingBpm ? "blue.400" : "gray.300",
            }}
            outline="none"
          />
        </Flex>
      </Flex>
    </Flex>
  );
}

type PlaybackButtonProps = {
  label: string;
  tooltip: string;
  shortcut?: string | null;
  onClick: () => void;
  disabled?: boolean;
};

function PlaybackButton(props: PlaybackButtonProps) {
  const { label, tooltip, shortcut, onClick, disabled } = props;

  return (
    <Tooltip.Root positioning={{ placement: "bottom" }}>
      <Tooltip.Trigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          style={{
            background: "transparent",
            color: disabled ? "#a0aec0" : "#4a5568",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "16px",
            fontWeight: 500,
            cursor: disabled ? "not-allowed" : "pointer",
            userSelect: "none",
            transition: "all 0.15s ease",
            border: "none",
            minWidth: "32px",
            opacity: disabled ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.04)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          onMouseDown={(e) => {
            if (!disabled) {
              e.currentTarget.style.transform = "scale(0.98)";
            }
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {label}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content
          bg="gray.800"
          color="white"
          px={2}
          py={1}
          borderRadius="md"
          fontSize="xs"
        >
          {tooltip}
          {shortcut && !disabled && ` (${shortcut})`}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}
