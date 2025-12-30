import React, { useMemo } from "react";
import { ChakraProvider, defaultSystem, Box, Heading } from "@chakra-ui/react";
import { LeadSheetEditor } from "./components/LeadSheetEditor";
import { LeadSheetModel } from "./lead-sheet/LeadSheetModel";

export function App() {
  return (
    <ChakraProvider value={defaultSystem}>
      <Box p={8} maxW="1200px" mx="auto">
        <Heading mb={6} size="lg">
          Lead Sheet Editor
        </Heading>
        <LeadSheetEditor />
      </Box>
    </ChakraProvider>
  );
}
