/**
 * dilbar — App.jsx
 * ─────────────────────────────────────────────────────────────
 * Root component of the entire app.
 *
 * Responsibilities:
 *   - Dark mode state + localStorage persistence
 *   - Active page / navigation state
 *   - Passes analyze fn down to Home, result up to Dashboard
 *   - Renders Sidebar + Topbar + current page
 * ─────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from "react";
import { useAnalysis } from "./hooks/useAnalysis.js";

import Sidebar  from "./components/Sidebar.jsx";
import Topbar   from "./components/Topbar.jsx";
import Home      from "./pages/Home.jsx";
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {

  // ── Dark mode ────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("dilbar-dark");
    if (saved !== null) return saved === "1";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("dilbar-dark", darkMode ? "1" : "0");
  }, [darkMode]);

  // ── Navigation ───────────────────────────────────────────
  const [activePage, setActivePage] = useState("dashboard");

  // ── Analysis state ────────────────────────────────────────
  const { status, result, progress, error, analyze, reset } = useAnalysis();

  // Auto-navigate to dashboard when analysis completes
  useEffect(() => {
    if (status === "done") setActivePage("dashboard");
  }, [status]);

  // Handle new analysis — reset and go home
  const handleReset = () => {
    reset();
    setActivePage("dashboard");
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="layout">

      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(d => !d)}
        hasResult={status === "done"}
      />

      <div className="main">

        <Topbar
          result={result}
          onReset={handleReset}
        />

        <div className="content">
          {/* Show home page until analysis is done */}
          {status !== "done" ? (
            <Home
              status={status}
              progress={progress}
              error={error}
              onFile={analyze}
            />
          ) : (
            <Dashboard
              result={result}
              activePage={activePage}
            />
          )}
        </div>

      </div>
    </div>
  );
}
