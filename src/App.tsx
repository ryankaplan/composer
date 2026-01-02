import React from "react";
import { ChakraProvider, Box } from "@chakra-ui/react";
import { system } from "./theme";
import { LeadSheetEditor } from "./components/LeadSheetEditor";
import { TopToolbar } from "./components/TopToolbar";
import { BottomToolbar } from "./components/BottomToolbar";

export function App() {
  return (
    <ChakraProvider value={system}>
      <Box
        position="relative"
        height="100vh"
        width="100vw"
        bg="bg"
        overflow="hidden"
      >
        {/* Fixed header toolbar */}
        <TopToolbar />

        {/* Main content area - full height with scrolling */}
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          paddingTop="56px" // Height for fixed toolbar
          overflow="auto"
          bg="bg"
        >
          <LeadSheetEditor />
        </Box>

        {/* Floating shortcut palette */}
        <BottomToolbar />
      </Box>
    </ChakraProvider>
  );
}
