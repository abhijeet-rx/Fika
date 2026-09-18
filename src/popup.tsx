// ============================================================
// Fika - Popup Root Entry Point
//
// React application entry point for Fika's Chrome extension popup.
// Provides tabbed navigation between:
//   1. Dashboard (Statistics & Analytics)
//   2. Settings (GitHub Auth & Preferences)
//
// ============================================================

import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import StatsDashboard from "./StatsDashboard";
import SettingsForm from "./SettingsForm";

type ActiveTab = "dashboard" | "settings";

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    width: "350px",
    minHeight: "480px",
    backgroundColor: "#1a1a2e",
    color: "#e0e0e0",
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    margin: "0",
    padding: "0",
    boxSizing: "border-box",
  },
  header: {
    background: "linear-gradient(135deg, #6c63ff, #3f3d9e)",
    padding: "16px 20px 12px 20px",
    textAlign: "center",
  },
  title: {
    fontSize: "24px",
    fontWeight: "800",
    letterSpacing: "4px",
    color: "#ffffff",
    margin: "0",
  },
  subtitle: {
    fontSize: "11px",
    color: "#c4c1f7",
    marginTop: "2px",
    letterSpacing: "1px",
  },
  tabBar: {
    display: "flex",
    backgroundColor: "#16213e",
    borderBottom: "1px solid #2a2a4a",
  },
  tabButton: {
    flex: 1,
    padding: "10px",
    fontSize: "12px",
    fontWeight: "700",
    color: "#8888aa",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  activeTabButton: {
    color: "#ffffff",
    borderBottom: "2px solid #6c63ff",
    backgroundColor: "#1f2b4d",
  },
  contentArea: {
    padding: "8px 0",
  },
  footer: {
    textAlign: "center",
    padding: "10px",
    fontSize: "10px",
    color: "#555577",
    borderTop: "1px solid #2a2a4a",
    marginTop: "10px",
  },
};

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");

  return (
    <div style={styles.appContainer}>
      {/* HEADER */}
      <div style={styles.header}>
        <h1 style={styles.title}>FIKA</h1>
        <div style={styles.subtitle}>Coding Problem Sync</div>
      </div>

      {/* TAB NAVIGATION */}
      <div style={styles.tabBar}>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === "dashboard" ? styles.activeTabButton : {}),
          }}
          onClick={() => setActiveTab("dashboard")}
        >
          📊 Dashboard
        </button>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === "settings" ? styles.activeTabButton : {}),
          }}
          onClick={() => setActiveTab("settings")}
        >
          ⚙️ Settings
        </button>
      </div>

      {/* TAB CONTENT */}
      <div style={styles.contentArea}>
        {activeTab === "dashboard" && <StatsDashboard />}
        {activeTab === "settings" && (
          <SettingsForm onSaved={() => setActiveTab("dashboard")} />
        )}
      </div>

      {/* FOOTER */}
      <div style={styles.footer}>Fika v1.0.0 — Automated GitHub Sync</div>
    </div>
  );
}

// Mount React Root
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
