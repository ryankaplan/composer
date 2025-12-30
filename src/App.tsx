import React from "react";
import { ChakraProvider, defaultSystem, Flex } from "@chakra-ui/react";
import { LeadSheetEditor } from "./components/LeadSheetEditor";
import { Toolbar } from "./components/Toolbar";
import { ShortcutPalette } from "./components/ShortcutPalette";

export function App() {
  return (
    <ChakraProvider value={defaultSystem}>
      <Flex direction="column" height="100vh" width="100vw" overflow="hidden">
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
