import React from "react";
import { Box, Flex } from "@chakra-ui/react";

export function ShortcutPalette() {
  const shortcuts = [
    { keys: "A-G", description: "Insert note" },
    { keys: "R", description: "Insert rest" },
    {
      keys: "4 / 8 / 6",
      description: "Set duration (quarter / eighth / sixteenth)",
    },
    { keys: "Shift+3 / B", description: "Toggle sharp / flat on left note" },
    { keys: "N", description: "Naturalize (remove accidental)" },
    { keys: "← →", description: "Move caret" },
    { keys: "Shift+← →", description: "Move caret with selection" },
    { keys: "↑ ↓", description: "Transpose by octave" },
    { keys: "Ctrl+↑ ↓", description: "Transpose by semitone" },
    { keys: "T", description: "Toggle tie" },
    { keys: "-", description: "Extend note (tie + insert)" },
    { keys: "Backspace / Delete", description: "Remove notes" },
    { keys: 'Shift+"', description: "Enter chord mode" },
  ];

  return (
    <Box
      bg="gray.50"
      borderTop="1px solid"
      borderColor="gray.300"
      px={4}
      py={2}
      maxHeight="140px"
      overflowY="auto"
    >
      <Flex gap={4} flexWrap="wrap" fontSize="sm">
        {shortcuts.map((shortcut, index) => (
          <Box key={index} display="flex" gap={2}>
            <Box
              as="kbd"
              fontFamily="monospace"
              bg="white"
              px={2}
              py={1}
              borderRadius="sm"
              border="1px solid"
              borderColor="gray.300"
              fontSize="xs"
            >
              {shortcut.keys}
            </Box>
            <Box color="gray.700">{shortcut.description}</Box>
          </Box>
        ))}
      </Flex>
    </Box>
  );
}
