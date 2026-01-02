import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const customConfig = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#e6f2ff" },
          100: { value: "#e6f2ff" },
          200: { value: "#bfdeff" },
          300: { value: "#99caff" },
          400: { value: "#4dffff" }, // placeholder
          500: { value: "#0078ff" }, // primary brand color
          600: { value: "#0063d1" },
          700: { value: "#004eadd" },
          800: { value: "#003975" },
          900: { value: "#002347" },
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, customConfig);

