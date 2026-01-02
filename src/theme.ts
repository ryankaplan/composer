import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const customConfig = defineConfig({
  theme: {
    tokens: {
      colors: {
        bg: { value: "#fafaf9" }, // warm off-white background
        surface: { value: "#ffffff" }, // pure white for cards/surfaces
        border: { value: "#e7e5e4" }, // subtle warm border
        // Clean accent colors
        accent: {
          50: { value: "#eff6ff" },
          100: { value: "#dbeafe" },
          200: { value: "#bfdbfe" },
          300: { value: "#93c5fd" },
          400: { value: "#60a5fa" },
          500: { value: "#3b82f6" }, // primary blue
          600: { value: "#2563eb" },
          700: { value: "#1d4ed8" },
          800: { value: "#1e40af" },
          900: { value: "#1e3a8a" },
        },
      },
      shadows: {
        floating: {
          value:
            "0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)",
        },
        floatingLarge: {
          value:
            "0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)",
        },
        header: { value: "0 1px 3px rgba(0, 0, 0, 0.06)" },
      },
      radii: {
        floating: { value: "12px" },
        button: { value: "8px" },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          default: { value: "{colors.bg}" },
        },
        surface: {
          default: { value: "{colors.surface}" },
        },
        controlHover: {
          default: { value: "rgba(0, 0, 0, 0.04)" },
        },
      },
    },
  },
  globalCss: {
    html: {
      height: "100%",
    },
    body: {
      margin: 0,
      height: "100%",
      overflow: "hidden",
      bg: "bg",
      color: "gray.800",
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
    },
    "#root": {
      height: "100%",
    },
  },
});

export const system = createSystem(defaultConfig, customConfig);
