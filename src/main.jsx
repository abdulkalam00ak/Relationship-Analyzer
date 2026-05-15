/**
 * dilbar — src/main.jsx
 * ─────────────────────────────────────────────────────────────
 * React entry point.
 * Mounts the App component into the #root div in index.html.
 * Imports global styles.
 * ─────────────────────────────────────────────────────────────
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
