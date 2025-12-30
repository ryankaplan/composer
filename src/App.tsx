import React from "react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";

export function App() {
  return (
    <ChakraProvider value={defaultSystem}>
      <div>Hello World</div>
    </ChakraProvider>
  );
}

