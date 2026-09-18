// ============================================================
// Fika - Settings Form Component
//
// Presentational and interactive React component for managing
// Fika's configuration:
//   - GitHub authentication & target repository configuration
//   - Synchronization preferences (Auto-sync, Accepted only)
//   - Enabled platform toggles (LeetCode, GeeksforGeeks)
//
// Features:
//   - Controlled React inputs with local form state
//   - Input validation (token format, required fields)
//   - Integration with githubAuth.ts for token validation & storage
//   - Clean dark theme matching Fika design guidelines
//
// ============================================================

import React, { useEffect, useState } from "react";
import { getCredentials, saveCredentials, validateToken } from "./githubAuth";

// ----------------------------------------------------------
// Settings Data Interface
// ----------------------------------------------------------
export interface FikaSettings {
  /** GitHub Personal Access Token (e.g. "ghp_xxxx...") */
  githubToken: string;

  /** GitHub Repository Owner (e.g. "abhijeet-rx") */
  githubOwner: string;

  /** Target Repository Name (e.g. "Leetcode-solutions-") */
  githubRepo: string;

  /** Target Branch (default: "main") */
  githubBranch: string;

  /** Root directory inside repo (default: "") */
  githubRootDir: string;

  /** Automatically sync accepted submissions */
  autoSync: boolean;

  /** Sync only accepted submissions (ignore failed attempts) */
  acceptedOnly: boolean;

  /** Enable LeetCode synchronization */
  enableLeetCode: boolean;

  /** Enable GeeksforGeeks synchronization */
  enableGeeksforGeeks: boolean;
}

// ----------------------------------------------------------
// Default Settings Initial State
// ----------------------------------------------------------
const DEFAULT_SETTINGS: FikaSettings = {
  githubToken: "",
  githubOwner: "",
  githubRepo: "",
  githubBranch: "main",
  githubRootDir: "",
  autoSync: true,
  acceptedOnly: true,
  enableLeetCode: true,
  enableGeeksforGeeks: true,
};

// ----------------------------------------------------------
// Inline Styles (Dark Theme)
// ----------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    backgroundColor: "#1a1a2e",
    color: "#e0e0e0",
    padding: "16px",
    borderRadius: "10px",
    maxWidth: "360px",
    margin: "0 auto",
  },
  header: {
    textAlign: "center" as const,
    marginBottom: "16px",
  },
  title: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: "1px",
  },
  subtitle: {
    fontSize: "11px",
    color: "#8888aa",
    marginTop: "2px",
  },
  section: {
    backgroundColor: "#16213e",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "12px",
    border: "1px solid #2a2a4a",
  },
  sectionTitle: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#6c63ff",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    marginBottom: "10px",
  },
  formGroup: {
    marginBottom: "10px",
  },
  label: {
    display: "block",
    fontSize: "11px",
    fontWeight: "600",
    color: "#a0a0c0",
    marginBottom: "4px",
  },
  input: {
    width: "100%",
    padding: "8px 10px",
    fontSize: "12px",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "5px",
    color: "#ffffff",
    boxSizing: "border-box" as const,
    outline: "none",
  },
  checkboxGroup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 0",
    fontSize: "12px",
    color: "#c0c0d0",
  },
  checkboxLabel: {
    cursor: "pointer",
  },
  button: {
    width: "100%",
    padding: "10px",
    fontSize: "13px",
    fontWeight: "700",
    color: "#ffffff",
    backgroundColor: "#6c63ff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "10px",
    transition: "background-color 0.2s",
  },
  buttonDisabled: {
    backgroundColor: "#444466",
    cursor: "not-allowed",
  },
  statusMessage: {
    marginTop: "10px",
    padding: "8px 10px",
    borderRadius: "5px",
    fontSize: "11px",
    textAlign: "center" as const,
  },
  successMessage: {
    backgroundColor: "#0d2b1d",
    color: "#4caf50",
    border: "1px solid #1b5e20",
  },
  errorMessage: {
    backgroundColor: "#330d0d",
    color: "#f44336",
    border: "1px solid #b71c1c",
  },
};

// ----------------------------------------------------------
// Component: SettingsForm
// ----------------------------------------------------------
export function SettingsForm(props: { onSaved?: () => void }) {
  const [settings, setSettings] = useState<FikaSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // ---- Load existing saved credentials on mount ----
  useEffect(() => {
    let isMounted = true;
    getCredentials()
      .then(function (creds) {
        if (isMounted && creds) {
          setSettings(function (prev) {
            return {
              ...prev,
              githubToken: creds.token || "",
              githubOwner: creds.owner || "",
              githubRepo: creds.repo || "",
            };
          });
        }
        if (isMounted) setLoading(false);
      })
      .catch(function () {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // ---- Controlled input handlers ----
  const handleTextChange = (field: keyof FikaSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setMessage(null);
  };

  const handleCheckboxChange = (field: keyof FikaSettings, checked: boolean) => {
    setSettings((prev) => ({ ...prev, [field]: checked }));
    setMessage(null);
  };

  // ---- Form Validation & Save ----
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    // 1. Validation
    if (!settings.githubToken.trim()) {
      setMessage({ text: "Please enter a GitHub Personal Access Token.", isError: true });
      return;
    }
    if (!settings.githubOwner.trim()) {
      setMessage({ text: "Please enter a GitHub Owner/Username.", isError: true });
      return;
    }
    if (!settings.githubRepo.trim()) {
      setMessage({ text: "Please enter a Repository Name.", isError: true });
      return;
    }

    setSaving(true);

    try {
      // 2. Validate token against GitHub API
      const validation = await validateToken(settings.githubToken.trim());

      if (!validation.valid) {
        setMessage({ text: "Token validation failed: " + validation.error, isError: true });
        setSaving(false);
        return;
      }

      // 3. Save credentials to chrome.storage.local
      await saveCredentials({
        token: settings.githubToken.trim(),
        owner: settings.githubOwner.trim(),
        repo: settings.githubRepo.trim(),
        username: validation.username || settings.githubOwner.trim(),
      });

      setMessage({ text: "Settings saved and GitHub connection verified!", isError: false });
      if (props.onSaved) {
        props.onSaved();
      }
    } catch (err) {
      setMessage({
        text: "Error saving settings: " + (err instanceof Error ? err.message : String(err)),
        isError: true,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ color: "#8888aa", textAlign: "center", padding: "20px" }}>Loading settings...</div>;
  }

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.title}>Fika Settings</div>
        <div style={styles.subtitle}>Configure GitHub & Synchronization</div>
      </div>

      <form onSubmit={handleSave}>
        {/* SECTION 1: GITHUB CONFIGURATION */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>GitHub Credentials</div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Personal Access Token (PAT)</label>
            <input
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={settings.githubToken}
              onChange={(e) => handleTextChange("githubToken", e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Repository Owner / Username</label>
            <input
              type="text"
              placeholder="e.g. octocat"
              value={settings.githubOwner}
              onChange={(e) => handleTextChange("githubOwner", e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Repository Name</label>
            <input
              type="text"
              placeholder="e.g. leetcode-solutions"
              value={settings.githubRepo}
              onChange={(e) => handleTextChange("githubRepo", e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Branch Name</label>
            <input
              type="text"
              placeholder="main"
              value={settings.githubBranch}
              onChange={(e) => handleTextChange("githubBranch", e.target.value)}
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Root Directory (Optional)</label>
            <input
              type="text"
              placeholder="e.g. solutions (leave empty for root)"
              value={settings.githubRootDir}
              onChange={(e) => handleTextChange("githubRootDir", e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        {/* SECTION 2: SYNCHRONIZATION PREFERENCES */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Synchronization Options</div>

          <div style={styles.checkboxGroup}>
            <span style={styles.checkboxLabel}>Auto Sync on Accepted</span>
            <input
              type="checkbox"
              checked={settings.autoSync}
              onChange={(e) => handleCheckboxChange("autoSync", e.target.checked)}
            />
          </div>

          <div style={styles.checkboxGroup}>
            <span style={styles.checkboxLabel}>Accepted Submissions Only</span>
            <input
              type="checkbox"
              checked={settings.acceptedOnly}
              onChange={(e) => handleCheckboxChange("acceptedOnly", e.target.checked)}
            />
          </div>
        </div>

        {/* SECTION 3: SUPPORTED PLATFORMS */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Supported Platforms</div>

          <div style={styles.checkboxGroup}>
            <span style={styles.checkboxLabel}>LeetCode</span>
            <input
              type="checkbox"
              checked={settings.enableLeetCode}
              onChange={(e) => handleCheckboxChange("enableLeetCode", e.target.checked)}
            />
          </div>

          <div style={styles.checkboxGroup}>
            <span style={styles.checkboxLabel}>GeeksforGeeks</span>
            <input
              type="checkbox"
              checked={settings.enableGeeksforGeeks}
              onChange={(e) => handleCheckboxChange("enableGeeksforGeeks", e.target.checked)}
            />
          </div>
        </div>

        {/* SAVE BUTTON */}
        <button
          type="submit"
          disabled={saving}
          style={{
            ...styles.button,
            ...(saving ? styles.buttonDisabled : {}),
          }}
        >
          {saving ? "Validating & Saving..." : "Save & Verify Connection"}
        </button>

        {/* STATUS MESSAGE */}
        {message && (
          <div
            style={{
              ...styles.statusMessage,
              ...(message.isError ? styles.errorMessage : styles.successMessage),
            }}
          >
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
}

export default SettingsForm;
