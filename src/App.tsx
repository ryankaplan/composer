import React from "react";
import { ChakraProvider, Flex } from "@chakra-ui/react";
import { system } from "./theme";
import { LeadSheetEditor } from "./components/LeadSheetEditor";
import { Toolbar } from "./components/Toolbar";
import { ShortcutPalette } from "./components/ShortcutPalette";

export function App() {
  return (
    <ChakraProvider value={system}>
      <Flex
        direction="column"
        height="100vh"
        width="100vw"
        overflow="hidden"
        bg="gray.50"
      >
        {/* Top toolbar */}
        <Toolbar />

        {/* Middle: Editor area (takes remaining space) */}
        <Flex flex="1" overflow="hidden">
          <LeadSheetEditor />
        </Flex>

        {/* Bottom: Shortcut palette */}
        <ShortcutPalette />
      </Flex>
    </ChakraProvider>
  );
}
