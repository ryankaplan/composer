import React, { useEffect, useState } from "react";
import { ChakraProvider, Box } from "@chakra-ui/react";
import { system } from "./theme";
import { LeadSheetEditor } from "./components/LeadSheetEditor";
import { TopToolbar } from "./components/TopToolbar";
import { BottomToolbar } from "./components/BottomToolbar";
import { Sidebar } from "./components/Sidebar";
import { compositionStore } from "./compositions/store";

export function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Initialize the composition store on app load
    compositionStore.init().then(() => {
      setIsInitialized(true);
    });
  }, []);

  function toggleSidebar() {
    setSidebarOpen(!sidebarOpen);
  }

  if (!isInitialized) {
    return (
      <ChakraProvider value={system}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          height="100vh"
          width="100vw"
          bg="bg"
          fontSize="sm"
          color="gray.600"
        >
          Loading...
        </Box>
      </ChakraProvider>
    );
  }

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
        <TopToolbar onToggleSidebar={toggleSidebar} />

        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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
