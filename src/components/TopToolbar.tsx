import React from "react";
import { Box, Flex, Input } from "@chakra-ui/react";
import { Tooltip } from "@chakra-ui/react/tooltip";
import { useObservable } from "../lib/observable";
import { doc } from "../lead-sheet/Document";
import { interfaceState } from "../lead-sheet/InterfaceState";
import { toggleAccidentalAction } from "../lead-sheet/actions";
import { Duration } from "../lead-sheet/types";
import { formatShortcut } from "../lib/format-shortcut";
import {
  QuarterNoteIcon,
  EighthNoteIcon,
  SixteenthNoteIcon,
} from "./NoteIcons";
import { playbackEngine } from "../playback/engine";
import { buildPlaybackIR } from "../playback/build-ir";
import { caretToUnit } from "../playback/time";

export function TopToolbar() {
  const timeSignature = useObservable(doc.timeSignature);
  const currentDuration = useObservable(interfaceState.currentDuration);
  const pendingAccidental = useObservable(interfaceState.pendingAccidental);
  const caret = useObservable(doc.caret);
  const events = useObservable(doc.events);
  const documentEndUnit = useObservable(doc.documentEndUnit);
  const isPlaying = useObservable(playbackEngine.isPlaying);
  const bpm = useObservable(playbackEngine.bpm);

  function handleTimeSignatureChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const beatsPerBar = parseInt(e.target.value) as 3 | 4;
    doc.setTimeSignature({ beatsPerBar, beatUnit: 4 });
  }

  async function handlePlayPause() {
    if (isPlaying) {
      playbackEngine.pause();
    } else {
      // Build IR from current document state
      const chordTrack = doc.chords.get();
      const caretUnit = caretToUnit(events, caret);
      const ir = buildPlaybackIR(
        events,
        caretUnit,
        documentEndUnit,
        chordTrack
      );
      await playbackEngine.playIR(ir, caretUnit);
    }
  }

  function handleBpmChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newBpm = parseInt(e.target.value);
    if (!isNaN(newBpm) && newBpm > 0 && newBpm <= 300) {
      playbackEngine.bpm.set(newBpm);
    }
  }

  function handleDurationChange(duration: Duration) {
    interfaceState.setCurrentDuration(duration);
  }

  function handleSharpClick() {
    toggleAccidentalAction("#");
  }

  function handleFlatClick() {
    toggleAccidentalAction("b");
  }

  function handleNaturalClick() {
    doc.naturalizeSelectionOrLeftNote();
  }

  function handleTieClick() {
    doc.toggleTieAcrossCaret();
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
      {/* Time Signature */}
      <Flex alignItems="center" gap={1.5}>
        <Box fontSize="xs" color="gray.600" fontWeight="medium">
          Time:
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

      {/* Divider */}
      <Box width="1px" height="20px" bg="gray.200" />

      {/* Duration Segmented Control */}
      <Flex alignItems="center" gap={1.5}>
        <Box fontSize="xs" color="gray.600" fontWeight="medium">
          Duration:
        </Box>
        <Flex
          bg="gray.50"
          borderRadius="6px"
          padding="2px"
          border="1px solid"
          borderColor="gray.200"
        >
          <DurationButton
            icon={<QuarterNoteIcon size={18} />}
            duration="1/4"
            currentDuration={currentDuration}
            onClick={() => handleDurationChange("1/4")}
            shortcut={formatShortcut(["digit4"])}
          />
          <DurationButton
            icon={<EighthNoteIcon size={18} />}
            duration="1/8"
            currentDuration={currentDuration}
            onClick={() => handleDurationChange("1/8")}
            shortcut={formatShortcut(["digit8"])}
          />
          <DurationButton
            icon={<SixteenthNoteIcon size={18} />}
            duration="1/16"
            currentDuration={currentDuration}
            onClick={() => handleDurationChange("1/16")}
            shortcut={formatShortcut(["digit6"])}
          />
        </Flex>
      </Flex>

      {/* Divider */}
      <Box width="1px" height="20px" bg="gray.200" />

      {/* Accidentals */}
      <Flex alignItems="center" gap={1.5}>
        <Box fontSize="xs" color="gray.600" fontWeight="medium">
          Accidentals:
        </Box>
        <Flex gap={1}>
          <IconButton
            label="♮"
            tooltip={`Natural (${formatShortcut(["n"])})`}
            onClick={handleNaturalClick}
          />
          <IconButton
            label="♯"
            tooltip={`Sharp (${formatShortcut(["bracketright"])})`}
            onClick={handleSharpClick}
          />
          <IconButton
            label="♭"
            tooltip={`Flat (${formatShortcut(["bracketleft"])})`}
            onClick={handleFlatClick}
          />
        </Flex>
      </Flex>

      {/* Divider */}
      <Box width="1px" height="20px" bg="gray.200" />

      {/* Tie */}
      <IconButton
        label="⌢"
        tooltip={`Toggle Tie (${formatShortcut(["t"])})`}
        onClick={handleTieClick}
      />

      {/* Spacer */}
      <Box flex="1" />

      {/* Status indicators */}
      <Flex gap={2} fontSize="xs" color="gray.500" alignItems="center">
        {pendingAccidental && (
          <Box
            bg="blue.50"
            color="blue.700"
            px={1.5}
            py={0.5}
            borderRadius="md"
            fontSize="xs"
            fontWeight="medium"
          >
            Pending: {pendingAccidental === "#" ? "♯" : "♭"}
          </Box>
        )}
      </Flex>

      {/* Playback controls */}
      <Flex alignItems="center" gap={2}>
        <Tooltip.Root positioning={{ placement: "bottom" }}>
          <Tooltip.Trigger asChild>
            <Box
              as="button"
              onClick={handlePlayPause}
              bg={isPlaying ? "blue.500" : "white"}
              color={isPlaying ? "white" : "gray.700"}
              px={3}
              py={1}
              borderRadius="4px"
              fontSize="sm"
              fontWeight="medium"
              cursor="pointer"
              userSelect="none"
              transition="all 0.15s ease"
              border="1px solid"
              borderColor={isPlaying ? "blue.500" : "gray.200"}
              _hover={{
                bg: isPlaying ? "blue.600" : "gray.50",
                borderColor: isPlaying ? "blue.600" : "gray.300",
              }}
              _active={{
                transform: "scale(0.98)",
              }}
            >
              {isPlaying ? "⏸" : "▶"}
            </Box>
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
              {isPlaying ? "Pause" : `Play (${formatShortcut(["space"])})`}
            </Tooltip.Content>
          </Tooltip.Positioner>
        </Tooltip.Root>

        <Flex alignItems="center" gap={1}>
          <Box fontSize="xs" color="gray.600" fontWeight="medium">
            BPM:
          </Box>
          <Input
            type="number"
            value={bpm}
            onChange={handleBpmChange}
            min={20}
            max={300}
            width="60px"
            size="xs"
            textAlign="center"
            bg="white"
            border="1px solid"
            borderColor="gray.200"
            _hover={{
              borderColor: "gray.300",
            }}
          />
        </Flex>
      </Flex>
    </Flex>
  );
}

type DurationButtonProps = {
  icon: React.ReactNode;
  duration: Duration;
  currentDuration: Duration;
  onClick: () => void;
  shortcut: string;
};

function DurationButton(props: DurationButtonProps) {
  const { icon, duration, currentDuration, onClick, shortcut } = props;
  const isActive = currentDuration === duration;

  return (
    <Tooltip.Root positioning={{ placement: "bottom" }}>
      <Tooltip.Trigger asChild>
        <Box
          as="button"
          onClick={onClick}
          bg={isActive ? "white" : "transparent"}
          color={isActive ? "gray.900" : "gray.600"}
          px={2}
          py={1}
          borderRadius="4px"
          fontSize="md"
          fontWeight="medium"
          cursor="pointer"
          userSelect="none"
          transition="all 0.15s ease"
          border={isActive ? "1px solid" : "1px solid transparent"}
          borderColor={isActive ? "gray.300" : "transparent"}
          boxShadow={isActive ? "0 1px 2px rgba(0, 0, 0, 0.05)" : "none"}
          display="flex"
          alignItems="center"
          justifyContent="center"
          _hover={{
            bg: isActive ? "white" : "gray.100",
            color: "gray.900",
          }}
          _active={{
            transform: "scale(0.98)",
          }}
        >
          {icon}
        </Box>
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
          {shortcut}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}

type IconButtonProps = {
  label: string;
  tooltip: string;
  onClick: () => void;
};

function IconButton(props: IconButtonProps) {
  const { label, tooltip, onClick } = props;

  return (
    <Tooltip.Root positioning={{ placement: "bottom" }}>
      <Tooltip.Trigger asChild>
        <Box
          as="button"
          onClick={onClick}
          bg="white"
          color="gray.700"
          px={2}
          py={1}
          borderRadius="4px"
          fontSize="md"
          fontWeight="medium"
          cursor="pointer"
          userSelect="none"
          transition="all 0.15s ease"
          border="1px solid"
          borderColor="gray.200"
          minWidth="28px"
          _hover={{
            bg: "gray.50",
            borderColor: "gray.300",
            color: "gray.900",
          }}
          _active={{
            transform: "scale(0.98)",
            bg: "gray.100",
          }}
        >
          {label}
        </Box>
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
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}
