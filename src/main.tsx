import { createRoot } from "react-dom/client";
import { App } from "./App";
import React from "react";
import VexFlow from "vexflow/bravura";

async function runApp(): Promise<void> {
  await VexFlow.loadFonts();
  VexFlow.setFonts("Bravura", "Academico");

  const container = document.getElementById("root");
  if (!container) return;

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

window.addEventListener("DOMContentLoaded", runApp);
