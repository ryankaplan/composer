import React from "react";
import { Box, Flex } from "@chakra-ui/react";
import { Tooltip } from "@chakra-ui/react/tooltip";

export function ShortcutPalette() {
  const shortcuts = [
    {
      group: "Navigation",
      items: [
        { icon: "←→", label: "Move caret", keys: "← →" },
        { icon: "⇧←→", label: "Move with selection", keys: "Shift+← →" },
      ],
    },
    {
      group: "Notes",
      items: [
        { icon: "A-G", label: "Insert note", keys: "A-G" },
        { icon: "R", label: "Insert rest", keys: "R" },
        { icon: "↑↓", label: "Transpose octave", keys: "↑ ↓" },
        { icon: "⌘↑↓", label: "Transpose semitone", keys: "⌘+↑ ↓" },
      ],
    },
    {
      group: "Edit",
      items: [
        { icon: "♯♭", label: "Accidentals", keys: "[ ] N" },
        { icon: "⌢", label: "Tie", keys: "T" },
        { icon: "−", label: "Extend", keys: "-" },
        { icon: '"', label: "Chord mode", keys: 'Shift+"' },
      ],
    },
    {
      group: "Undo",
      items: [
        { icon: "↶", label: "Undo", keys: "⌘+Z" },
        { icon: "↷", label: "Redo", keys: "⌘+Shift+Z" },
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
