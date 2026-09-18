# ⚡ Fika — Coding Problem Sync Engine

> A high-performance Chrome Extension (Manifest V3) that automatically syncs your accepted coding solutions from **LeetCode** and **GeeksforGeeks** straight to your **GitHub** repository in real time.

---

## 🌟 Key Features

- 🎯 **Dual Platform Support**: Seamlessly syncs accepted submissions from both **LeetCode** (`leetcode.com`) and **GeeksforGeeks** (`geeksforgeeks.org`).
- ⚡ **Zero-Click Interception**: Uses `MAIN` world script injection (`document_start`) to intercept underlying `fetch` and `XMLHttpRequest` response payloads without altering UI or slowing down problem solving.
- 📝 **Structured Markdown Output**: Generates clean, standardized directory structures per problem containing:
  - Clean source code file (e.g. `Solution.cpp`, `Solution.py`, `Solution.java`)
  - Dedicated `README.md` with Problem Description, Difficulty Badge, Runtime & Memory stats, and direct Problem Link.
- 🔒 **SHA-256 Duplicate Prevention Engine**: Checks existing GitHub repository file SHAs to prevent redundant commits or overwriting past progress.
- 🎨 **Modern React 18 Extension Popup UI**:
  - **Connection Verifier**: Validates GitHub Personal Access Tokens (PAT) against specified username & repository with real-time green connection indicators.
  - **Analytics Dashboard**: Live stats tracking total problems synced, platform split (LeetCode vs. GFG), difficulty breakdown (Easy, Medium, Hard), and recent submission logs.
- 🔔 **In-Page Toast Notifications**: High-visibility toast messages injected directly into LeetCode/GFG pages confirming successful GitHub commits or failure diagnostic messages.

---

## 🏗️ Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser Tab                        │
│          (LeetCode.com / GeeksforGeeks.org)             │
└────────────────────────────┬────────────────────────────┘
                             │
            [Submit Solution / Network Fetch]
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│              inject.js (MAIN World Script)              │
│    Intercepts window.fetch / XMLHttpRequest responses    │
└────────────────────────────┬────────────────────────────┘
                             │
                     [window.postMessage]
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│            content.js (ISOLATED World Script)           │
│   Parses solution payload, extracts runtime/memory/code │
└────────────────────────────┬────────────────────────────┘
                             │
                    [chrome.storage.local]
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                    Sync Engine & API                    │
│   - Formats Markdown & file paths                       │
│   - Checks SHA duplicate collision                       │
│   - Pushes to GitHub REST API (v3)                      │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                  GitHub Repository                      │
│     📁 LeetCode/                                        │
│        └── 0001-Two-Sum/                                │
│            ├── README.md                                │
│            └── Two_Sum.py                               │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

- **Extension Specification**: Chrome Manifest V3
- **Frontend / Popup**: React 18, TypeScript, Vite
- **DOM & Page Injection**: Vanilla JS (Isolated & Main execution contexts)
- **API Interactivity**: GitHub REST API v3
- **Styling**: Modern CSS3 with dark mode glassmorphism & dynamic status micro-animations

---

## 📁 Repository Structure

```
fika/
├── manifest.json            # Chrome Extension Manifest V3 configuration
├── inject.js                # Main-world fetch/XHR interceptor
├── content.js               # Content script and message listener
├── popup.html               # Popup HTML container
├── vite.config.ts           # Vite build & bundle script configuration
├── tsconfig.json            # TypeScript compiler configuration
├── package.json             # Dependencies and scripts
└── src/                     # React Popup App & Core Business Logic
    ├── popup.tsx            # Main React mounting entry point
    ├── SettingsForm.tsx     # Token, username, repository config & verification UI
    ├── StatsDashboard.tsx   # Analytics & submission history dashboard
    ├── platformAdapter.ts   # Unified interface for LeetCode & GFG parsers
    ├── gfgAdapter.ts        # GeeksforGeeks response payload extractor
    ├── githubService.ts     # GitHub REST API helper (PAT auth, SHA check, commit)
    ├── githubAuth.ts        # Credential validation & connection status verifier
    ├── duplicateDetector.ts # Payload fingerprinting & SHA duplicate prevention
    ├── storageService.ts    # Chrome storage local wrapper & fallback state
    ├── statsEngine.ts       # Submission counting & analytics aggregation engine
    ├── pathGenerator.ts     # Directory layout & filename sanitization logic
    ├── formatter.ts         # Markdown & code block template generator
    ├── errorHandler.ts      # Structured extension error handling & logging
    └── types.ts             # TypeScript interfaces for submissions & configurations
```

---

## 🚀 Getting Started (Developer Setup)

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation & Local Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/abhijeet-rx/Fika.git
   cd Fika
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   npm run build
   ```
   *This compiles TypeScript and bundles the popup UI into the `dist/` directory.*

4. **Load into Google Chrome**:
   1. Open Google Chrome and navigate to `chrome://extensions/`.
   2. Enable **Developer mode** (toggle in the top-right corner).
   3. Click **Load unpacked**.
   4. Select the root repository folder (`d:\projects\fika`).

---

## ⚙️ Configuration & Usage

1. Click the **Fika** icon in your Chrome extensions toolbar to open the dashboard.
2. Go to **Settings**:
   - Enter your **GitHub Username**.
   - Enter your target **GitHub Repository Name** (e.g. `LeetCode-Solutions`).
   - Enter your **GitHub Personal Access Token (PAT)** (Needs `repo` permission).
3. Click **Verify Connection**. A green signal will confirm your token and repo are valid.
4. Solve any problem on [LeetCode](https://leetcode.com) or [GeeksforGeeks](https://geeksforgeeks.org).
5. When your submission is **Accepted**, Fika will automatically commit your solution and update your dashboard!

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

---

<p center>Crafted with precision by <a href="https://github.com/abhijeet-rx">Abhijeet Singh</a></p>
