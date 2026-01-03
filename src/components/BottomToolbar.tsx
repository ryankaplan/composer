import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import { Tooltip } from "@chakra-ui/react/tooltip";
import { useObservable } from "../lib/observable";
import { interfaceState } from "../lead-sheet/InterfaceState";
import { getAction, getActionShortcutText } from "../lead-sheet/actions";
import {
  Duration,
  EIGHTH_NOTE,
  HALF_NOTE,
  QUARTER_NOTE,
  SIXTEENTH_NOTE,
  WHOLE_NOTE,
} from "../lead-sheet/types";
import {
  WholeNoteIcon,
  HalfNoteIcon,
  QuarterNoteIcon,
  EighthNoteIcon,
  SixteenthNoteIcon,
} from "./NoteIcons";

export function BottomToolbar() {
  const currentDuration = useObservable(interfaceState.currentDuration);

  function performAction(actionName: string) {
    const action = getAction(actionName as any);
    if (action) {
      action.perform();
    }
  }

  function handleDurationChange(duration: Duration) {
    interfaceState.setCurrentDuration(duration);
  }

  return (
    <Box
      position="fixed"
      bottom="24px"
      left="50%"
      transform="translateX(-50%)"
      zIndex="999"
      bg="surface"
      borderRadius="floating"
      boxShadow="floatingLarge"
      px={5}
      py={4}
      border="1px solid"
      borderColor="border"
    >
      <Flex gap={2} alignItems="center">
        {/* Duration */}
        <Flex alignItems="center" gap={1.5}>
          <Box fontSize="xs" color="gray.600" fontWeight="medium">
            Duration
          </Box>
          <Flex
            bg="gray.50"
            borderRadius="6px"
            padding="2px"
            border="1px solid"
            borderColor="gray.200"
          >
            <DurationButton
              icon={<WholeNoteIcon size={16} />}
              duration={WHOLE_NOTE}
              currentDuration={currentDuration}
              onClick={() =>
                handleDurationChange({
                  base: "1/1",
                  dots: currentDuration.dots,
                })
              }
              shortcut={getActionShortcutText("Set Duration Whole")}
            />
            <DurationButton
              icon={<HalfNoteIcon size={16} />}
              duration={HALF_NOTE}
              currentDuration={currentDuration}
              onClick={() =>
                handleDurationChange({
                  base: "1/2",
                  dots: currentDuration.dots,
                })
              }
              shortcut={getActionShortcutText("Set Duration Half")}
            />
            <DurationButton
              icon={<QuarterNoteIcon size={16} />}
              duration={QUARTER_NOTE}
              currentDuration={currentDuration}
              onClick={() =>
                handleDurationChange({
                  base: "1/4",
                  dots: currentDuration.dots,
                })
              }
              shortcut={getActionShortcutText("Set Duration Quarter")}
            />
            <DurationButton
              icon={<EighthNoteIcon size={16} />}
              duration={EIGHTH_NOTE}
              currentDuration={currentDuration}
              onClick={() =>
                handleDurationChange({
                  base: "1/8",
                  dots: currentDuration.dots,
                })
              }
              shortcut={getActionShortcutText("Set Duration Eighth")}
            />
            <DurationButton
              icon={<SixteenthNoteIcon size={16} />}
              duration={SIXTEENTH_NOTE}
              currentDuration={currentDuration}
              onClick={() =>
                handleDurationChange({
                  base: "1/16",
                  dots: currentDuration.dots,
                })
              }
              shortcut={getActionShortcutText("Set Duration Sixteenth")}
            />
          </Flex>
        </Flex>

        <Box width="1px" height="24px" bg="gray.200" />

        {/* Dotted */}
        <Flex gap={1}>
          <ActionButton
            label="."
            tooltip="Dotted"
            isActive={currentDuration.dots === 1}
            shortcut={getActionShortcutText("Toggle Dotted")}
            onClick={() => performAction("Toggle Dotted")}
          />
        </Flex>

        <Box width="1px" height="24px" bg="gray.200" />

        {/* Accidentals */}
        <Flex gap={1}>
          <ActionButton
            label="♮"
            tooltip="Natural"
            shortcut={getActionShortcutText("Naturalize")}
            onClick={() => performAction("Naturalize")}
          />
          <ActionButton
            label="♯"
            tooltip="Sharp"
            shortcut={getActionShortcutText("Toggle Sharp")}
            onClick={() => performAction("Toggle Sharp")}
          />
          <ActionButton
            label="♭"
            tooltip="Flat"
            shortcut={getActionShortcutText("Toggle Flat")}
            onClick={() => performAction("Toggle Flat")}
          />
        </Flex>

        <Box width="1px" height="24px" bg="gray.200" />

        {/* Transpose */}
        <Flex gap={1}>
          <ActionButton
            label={getActionShortcutText("Transpose Semitone Up")!}
            tooltip="Transpose semitone up"
            shortcut={getActionShortcutText("Transpose Semitone Up")}
            onClick={() => performAction("Transpose Semitone Up")}
          />
          <ActionButton
            label={getActionShortcutText("Transpose Semitone Down")!}
            tooltip="Transpose semitone down"
            shortcut={getActionShortcutText("Transpose Semitone Down")}
            onClick={() => performAction("Transpose Semitone Down")}
          />
          <ActionButton
            label={getActionShortcutText("Transpose Octave Up")!}
            tooltip="Transpose octave up"
            shortcut={getActionShortcutText("Transpose Octave Up")}
            onClick={() => performAction("Transpose Octave Up")}
          />
          <ActionButton
            label={getActionShortcutText("Transpose Octave Down")!}
            tooltip="Transpose octave down"
            shortcut={getActionShortcutText("Transpose Octave Down")}
            onClick={() => performAction("Transpose Octave Down")}
          />
        </Flex>

        <Box width="1px" height="24px" bg="gray.200" />

        {/* Other editing actions */}
        <Flex gap={1}>
          <ActionButton
            label="⌢"
            tooltip="Toggle Tie"
            shortcut={getActionShortcutText("Toggle Tie")}
            onClick={() => performAction("Toggle Tie")}
          />
          <ActionButton
            label="−"
            tooltip="Extend Note"
            shortcut={getActionShortcutText("Extend Note")}
            onClick={() => performAction("Extend Note")}
          />
          <ActionButton
            label='"'
            tooltip="Insert Chord"
            shortcut={getActionShortcutText("Insert Chord")}
            onClick={() => performAction("Insert Chord")}
          />
        </Flex>
      </Flex>
    </Box>
  );
}

type DurationButtonProps = {
  icon: React.ReactNode;
  duration: Duration;
  currentDuration: Duration;
  onClick: () => void;
  shortcut: string | null;
};

function DurationButton(props: DurationButtonProps) {
  const { icon, duration, currentDuration, onClick, shortcut } = props;
  const isActive = currentDuration.base === duration.base;

  return (
    <Tooltip.Root positioning={{ placement: "top" }}>
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
          border="none"
          boxShadow={isActive ? "sm" : "none"}
          display="flex"
          alignItems="center"
          justifyContent="center"
          _hover={{
            bg: isActive ? "white" : "blackAlpha.50",
            color: "gray.900",
          }}
          _active={{
            transform: "scale(0.98)",
          }}
        >
          {icon}
        </Box>
      </Tooltip.Trigger>
      {shortcut && (
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
      )}
    </Tooltip.Root>
  );
}

type ActionButtonProps = {
  label: string;
  tooltip: string;
  shortcut?: string | null;
  isActive?: boolean;
  onClick: () => void;
};

function ActionButton(props: ActionButtonProps) {
  const { label, tooltip, shortcut, isActive, onClick } = props;

  return (
    <Tooltip.Root positioning={{ placement: "top" }}>
      <Tooltip.Trigger asChild>
        <Box
          as="button"
          onClick={onClick}
          bg={isActive ? "white" : "transparent"}
          color={isActive ? "gray.900" : "gray.700"}
          px={2}
          py={1}
          borderRadius="4px"
          fontSize="sm"
          fontWeight="medium"
          cursor="pointer"
          userSelect="none"
          transition="all 0.15s ease"
          border="none"
          minWidth="28px"
          boxShadow={isActive ? "sm" : "none"}
          _hover={{
            bg: isActive ? "white" : "blackAlpha.50",
            color: "gray.900",
          }}
          _active={{
            transform: "scale(0.98)",
            bg: isActive ? "white" : "blackAlpha.100",
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
          {shortcut && ` (${shortcut})`}
        </Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}
