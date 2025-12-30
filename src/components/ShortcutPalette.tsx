import React from "react";
import { Box, Flex } from "@chakra-ui/react";

export function ShortcutPalette() {
  const shortcuts = [
    { keys: "A-G", description: "Insert note" },
    { keys: "R", description: "Insert rest" },
    { keys: "← →", description: "Move caret" },
    { keys: "Shift+← →", description: "Move caret with selection" },
    { keys: "↑ ↓", description: "Transpose by octave" },
    { keys: "⌘+↑ ↓", description: "Transpose by semitone" },
    { keys: "-", description: "Extend note (tie + insert)" },
    { keys: "⌫ / ⌦", description: "Remove notes" },
    { keys: 'Shift+"', description: "Enter chord mode" },
  ];

  return (
    <Box
      bg="white"
      borderTop="1px solid"
      borderColor="gray.200"
      px={3}
      py={2}
      maxHeight="120px"
      overflowY="auto"
      boxShadow="0 -1px 3px rgba(0, 0, 0, 0.04)"
    >
      <Flex gap={3} flexWrap="wrap" fontSize="xs">
        {shortcuts.map((shortcut, index) => (
          <Flex key={index} alignItems="center" gap={1.5}>
            <Box
              as="kbd"
              fontFamily="system-ui, -apple-system"
              bg="gray.50"
              px={1.5}
              py={0.5}
              borderRadius="4px"
              border="1px solid"
              borderColor="gray.200"
              fontSize="xs"
              fontWeight="medium"
              color="gray.700"
              whiteSpace="nowrap"
            >
              {shortcut.keys}
            </Box>
            <Box color="gray.600" fontSize="xs">
              {shortcut.description}
            </Box>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}
