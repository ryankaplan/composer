import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import { Tooltip } from "@chakra-ui/react/tooltip";
import { getActionShortcutText } from "../lead-sheet/actions";

export function BottomToolbar() {
  // Helper to combine multiple shortcuts with a separator
  function combineShortcuts(...actionNames: string[]): string {
    const shortcuts: string[] = [];
    for (const name of actionNames) {
      const shortcut = getActionShortcutText(name as any);
      if (shortcut) {
        shortcuts.push(shortcut);
      }
    }
    return shortcuts.join(" ");
  }

  const shortcuts = [
    {
      group: "Navigation",
      items: [
        {
          icon: "←→",
          label: "Move caret",
          keys: combineShortcuts("Move Caret Left", "Move Caret Right"),
        },
        {
          icon: "⇧←→",
          label: "Move with selection",
          keys: combineShortcuts(
            "Extend Selection Left",
            "Extend Selection Right"
          ),
        },
      ],
    },
    {
      group: "Notes",
      items: [
        { icon: "A-G", label: "Insert note", keys: "A-G" },
        {
          icon: "R",
          label: "Insert rest",
          keys: getActionShortcutText("Insert Rest") || "R",
        },
        {
          icon: "↑↓",
          label: "Transpose octave",
          keys: combineShortcuts(
            "Transpose Octave Up",
            "Transpose Octave Down"
          ),
        },
        {
          icon: "⌘↑↓",
          label: "Transpose semitone",
          keys: combineShortcuts(
            "Transpose Semitone Up",
            "Transpose Semitone Down"
          ),
        },
      ],
    },
    {
      group: "Edit",
      items: [
        {
          icon: "♯♭",
          label: "Accidentals",
          keys: combineShortcuts("Toggle Flat", "Toggle Sharp", "Naturalize"),
        },
        {
          icon: "⌢",
          label: "Tie",
          keys: getActionShortcutText("Toggle Tie") || "T",
        },
        {
          icon: "−",
          label: "Extend",
          keys: getActionShortcutText("Extend Note") || "-",
        },
        {
          icon: '"',
          label: "Chord mode",
          keys: getActionShortcutText("Insert Chord") || "⌘⇧C",
        },
      ],
    },
    {
      group: "Undo",
      items: [
        {
          icon: "↶",
          label: "Undo",
          keys: getActionShortcutText("Undo") || "⌘Z",
        },
        {
          icon: "↷",
          label: "Redo",
          keys: getActionShortcutText("Redo") || "⌘⇧Z",
        },
      ],
    },
  ];

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
      px={3}
      py={2}
      border="1px solid"
      borderColor="border"
    >
      <Flex gap={2} alignItems="center">
        {shortcuts.map((group, groupIndex) => (
          <React.Fragment key={group.group}>
            {groupIndex > 0 && <Box width="1px" height="24px" bg="gray.200" />}
            <Flex gap={1}>
              {group.items.map((shortcut, index) => (
                <Tooltip.Root key={index} positioning={{ placement: "top" }}>
                  <Tooltip.Trigger asChild>
                    <Box
                      as="button"
                      px={2.5}
                      py={1.5}
                      borderRadius="button"
                      fontSize="sm"
                      fontWeight="medium"
                      color="gray.700"
                      bg="transparent"
                      cursor="default"
                      userSelect="none"
                      transition="all 0.15s ease"
                      _hover={{
                        bg: "gray.50",
                        color: "gray.900",
                      }}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      minW="32px"
                    >
                      {shortcut.icon}
                    </Box>
                  </Tooltip.Trigger>
                  <Tooltip.Positioner>
                    <Tooltip.Content
                      bg="gray.800"
                      color="white"
                      px={2.5}
                      py={1.5}
                      borderRadius="md"
                      fontSize="xs"
                    >
                      <Box fontWeight="medium" mb={0.5}>
                        {shortcut.label}
                      </Box>
                      <Box color="gray.300" fontSize="2xs">
                        {shortcut.keys}
                      </Box>
                    </Tooltip.Content>
                  </Tooltip.Positioner>
                </Tooltip.Root>
              ))}
            </Flex>
          </React.Fragment>
        ))}
      </Flex>
    </Box>
  );
}
