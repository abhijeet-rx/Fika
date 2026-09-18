// ============================================================
// Fika Content Script
// Injected into coding platform pages (e.g., leetcode.com, geeksforgeeks.org)
// ============================================================

(function () {
  "use strict";

  console.log("[Fika] Content script initialized.");
  console.log("[Fika] Current URL:", window.location.href);

  // ============================================================
  // Toast Notification Helper
  // ============================================================
  function showToast(message, type = "info") {
    let container = document.getElementById("fika-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "fika-toast-container";
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    const bgColor =
      type === "success"
        ? "#10b981"
        : type === "error"
        ? "#ef4444"
        : type === "warning"
        ? "#f59e0b"
        : "#3b82f6";

    toast.style.cssText = `
      background: ${bgColor};
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
      font-size: 14px;
      font-weight: 600;
      max-width: 380px;
      line-height: 1.4;
      transition: opacity 0.4s ease, transform 0.4s ease;
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 400);
    }, 6000);
  }

  // ============================================================
  // LeetCode Platform Adapter
  // ============================================================
  const LeetCodeAdapter = {
    platformName: "LeetCode",

    matchesUrl(url) {
      return /leetcode\.com\/problems\/([a-z0-9-]+)/i.test(url);
    },

    isAccepted() {
      const resultElements = document.querySelectorAll(
        '[data-e2e-locator="submission-result"], [class*="result"], [class*="success"], [class*="status"], [class*="accepted"]'
      );
      for (const el of resultElements) {
        const text = el.textContent ? el.textContent.trim() : "";
        if (/\bAccepted\b/i.test(text)) {
          return true;
        }
      }
      return false;
    },

    extractProblem() {
      console.log("[Fika] Starting LeetCode problem extraction...");

      // A. Extract Problem Title & ID
      let problemId = "Unknown";
      let title = "Unknown";

      const titlePattern = /(\d+)\.\s*(.+?)\s*-\s*LeetCode/;
      const titleMatch = document.title.match(titlePattern);

      if (titleMatch) {
        problemId = titleMatch[1];
        title = titleMatch[2].trim();
      } else {
        const headings = document.querySelectorAll("h1, h2, h3, h4, [class*='title']");
        for (const heading of headings) {
          const text = heading.textContent.trim();
          const headingMatch = text.match(/^(\d+)\.\s*(.+)/);
          if (headingMatch) {
            problemId = headingMatch[1];
            title = headingMatch[2].trim();
            break;
          }
        }
      }

      // B. Extract Difficulty
      let difficulty = "Easy";
      const validDifficulties = ["Easy", "Medium", "Hard"];
      const diffSelectors = [
        "[class*='difficulty-easy']",
        "[class*='difficulty-medium']",
        "[class*='difficulty-hard']"
      ];

      for (const selector of diffSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            const text = el.textContent.trim();
            if (validDifficulties.includes(text)) {
              difficulty = text;
              break;
            }
          }
        } catch (e) {}
      }

      if (difficulty === "Easy") {
        const candidates = document.querySelectorAll("div, span, a, p");
        for (const el of candidates) {
          const text = el.textContent.trim();
          if (validDifficulties.includes(text) && el.children.length === 0) {
            difficulty = text;
            break;
          }
        }
      }

      // C. Extract Topics
      const topics = [];
      const topicLinks = document.querySelectorAll('a[href*="/tag/"]');
      topicLinks.forEach((el) => {
        const tagText = el.textContent.trim();
        if (tagText && !topics.includes(tagText)) {
          topics.push(tagText);
        }
      });

      // D. Extract Statement
      let statement = "";
      function htmlToCleanText(element) {
        const clone = element.cloneNode(true);
        clone.querySelectorAll("style, script").forEach((el) => el.remove());
        clone.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
        clone.querySelectorAll("p, div, li, h1, h2, h3, h4, pre").forEach((el) => {
          el.prepend(document.createTextNode("\n"));
        });
        clone.querySelectorAll("li").forEach((el) => {
          el.prepend(document.createTextNode("• "));
        });

        let text = clone.textContent || "";
        text = text.replace(/\n{3,}/g, "\n\n");
        return text
          .split("\n")
          .map((line) => line.trim())
          .join("\n")
          .trim();
      }

      const descriptionSelectors = [
        '[data-track-load="description_content"]',
        'div[class*="elfjS"]',
        'div[class*="_1l1MA"]',
        'div.content__u3I1 div.question-content',
        'div[class*="question-content"]',
        'div[class*="description"]'
      ];

      for (const selector of descriptionSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el && el.textContent.trim().length > 50) {
            statement = htmlToCleanText(el);
            break;
          }
        } catch (e) {}
      }

      // E. Test cases
      const testCases = [];
      if (statement) {
        const testCasePattern = /Input:\s*([\s\S]*?)Output:\s*([\s\S]*?)(?=Example|Input:|Explanation|Constraints|Note:|\n\n|$)/gi;
        let tcMatch;
        while ((tcMatch = testCasePattern.exec(statement)) !== null) {
          const input = tcMatch[1].trim();
          const output = tcMatch[2].trim();
          if (input || output) {
            testCases.push({ input: input, output: output });
          }
        }
      }

      // F. Language
      let language = "C++";
      const knownLanguages = [
        "C++", "Java", "Python", "Python3", "C", "C#",
        "JavaScript", "TypeScript", "PHP", "Swift",
        "Kotlin", "Dart", "Go", "Ruby", "Scala",
        "Rust", "Racket", "Erlang", "Elixir",
        "MySQL", "MS SQL Server", "Oracle"
      ];

      const buttons = document.querySelectorAll("button");
      for (const btn of buttons) {
        const btnText = btn.textContent.trim();
        if (knownLanguages.includes(btnText)) {
          language = btnText;
          break;
        }
      }

      // G. Code
      let code = "";
      const viewLines = document.querySelectorAll(".view-line");
      const cmLines = document.querySelectorAll(".cm-line");
      const aceLines = document.querySelectorAll(".ace_line");

      if (viewLines.length > 0) {
        const lines = [];
        viewLines.forEach((lineEl) => {
          let lineText = lineEl.textContent || "";
          lines.push(lineText.replace(/\u00A0/g, " "));
        });
        code = lines.join("\n").replace(/\n+$/, "");
      } else if (cmLines.length > 0) {
        const lines = [];
        cmLines.forEach((lineEl) => {
          let lineText = lineEl.textContent || "";
          lines.push(lineText.replace(/\u00A0/g, " "));
        });
        code = lines.join("\n").replace(/\n+$/, "");
      } else if (aceLines.length > 0) {
        const lines = [];
        aceLines.forEach((lineEl) => {
          let lineText = lineEl.textContent || "";
          lines.push(lineText.replace(/\u00A0/g, " "));
        });
        code = lines.join("\n").replace(/\n+$/, "");
      }

      const urlMatch = window.location.href.match(/leetcode\.com\/problems\/([a-z0-9-]+)/i);
      const slug = urlMatch ? urlMatch[1] : "unknown-problem";

      const problemInfo = {
        problemId: problemId,
        title: title,
        slug: slug,
        platform: "LeetCode",
        difficulty: difficulty,
        topics: topics,
        primaryTopic: topics.length > 0 ? topics[0] : "General",
        statement: statement,
        testCases: testCases,
        language: language,
        code: code,
        acceptedAt: new Date().toISOString(),
      };

      console.log("[Fika] ✅ LeetCodeAdapter extracted CodingProblem:", problemInfo);
      return problemInfo;
    },

    _observer: null,

    startObserving(onAccepted) {
      let alreadyDetected = false;
      const scriptLoadTime = Date.now();
      const INITIAL_IGNORE_PERIOD_MS = 1500;

      const checkDomForAccepted = () => {
        if (alreadyDetected) return;
        if (Date.now() - scriptLoadTime < INITIAL_IGNORE_PERIOD_MS) return;

        if (this.isAccepted()) {
          alreadyDetected = true;
          console.log("[Fika] ✅ ACCEPTED submission detected by LeetCodeAdapter!");
          const problemInfo = this.extractProblem();
          if (onAccepted && typeof onAccepted === "function") {
            onAccepted(problemInfo);
          }
          this.stopObserving();
        }
      };

      this._observer = new MutationObserver(() => {
        checkDomForAccepted();
      });

      this._observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      setTimeout(checkDomForAccepted, 2000);
      console.log("[Fika] LeetCodeAdapter Observer active.");
    },

    stopObserving() {
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
        console.log("[Fika] LeetCodeAdapter observer disconnected.");
      }
    },
  };

  // ============================================================
  // GeeksforGeeks Platform Adapter
  // ============================================================
  const GeeksForGeeksAdapter = {
    platformName: "GeeksforGeeks",

    matchesUrl(url) {
      return /geeksforgeeks\.org\/problems\/([a-z0-9-]+)/i.test(url);
    },

    isAccepted() {
      const statusSelectors = [
        "[class*='status']",
        "[class*='result']",
        "[class*='problem-tab']",
        "div.problems_header_content__status",
      ];
      for (const selector of statusSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent ? el.textContent.trim() : "";
          if (
            text.includes("Correct Answer") ||
            text.includes("Problem Solved Successfully")
          ) {
            return true;
          }
        }
      }
      return false;
    },

    extractProblem() {
      console.log("[Fika] Starting GeeksforGeeks problem extraction...");
      const currentUrl = window.location.href;
      const urlMatch = currentUrl.match(/geeksforgeeks\.org\/problems\/([a-z0-9-]+)/i);
      const slug = urlMatch ? urlMatch[1] : "unknown-gfg-problem";

      let title = "Unknown Problem";
      let problemId = slug;

      const pageTitle = document.title;
      const titleMatch = pageTitle.match(/^([^|]+)\s*\|\s*Practice/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      } else {
        const heading = document.querySelector(".problem-tab__title, [class*='problem-title'], h3, h2, h1");
        if (heading && heading.textContent) {
          title = heading.textContent.trim();
        }
      }

      const idMatch = slug.match(/(\d+)$/);
      if (idMatch) problemId = idMatch[1];

      let rawDifficulty = "Easy";
      const validDiffs = ["school", "basic", "easy", "medium", "hard"];
      const diffSelectors = ["[class*='problem-tab__difficulty']", "span[class*='difficulty']"];
      for (const selector of diffSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          const txt = el.textContent.trim().toLowerCase();
          if (validDiffs.includes(txt)) {
            rawDifficulty = el.textContent.trim();
            break;
          }
        }
      }

      let difficulty = "Easy";
      const cleanDiff = rawDifficulty.toLowerCase();
      if (cleanDiff === "medium") difficulty = "Medium";
      else if (cleanDiff === "hard") difficulty = "Hard";

      const topics = [];
      const topicLinks = document.querySelectorAll('a[href*="category"], a[href*="tag"], [class*="topic-tag"]');
      topicLinks.forEach((el) => {
        const txt = el.textContent ? el.textContent.trim() : "";
        if (txt && txt.length < 30 && !topics.includes(txt)) topics.push(txt);
      });

      let statement = "";
      const descSelectors = ["[class*='problem-statement']", "[class*='problemDescription']", "[class*='mark-down']"];
      for (const selector of descSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent && el.textContent.trim().length > 30) {
          statement = el.textContent.trim();
          break;
        }
      }

      const testCases = [];
      if (statement) {
        const tcPattern = /Input:\s*([\s\S]*?)Output:\s*([\s\S]*?)(?=Example|Input:|Explanation|Constraints|Note:|\n\n|$)/gi;
        let match;
        while ((match = tcPattern.exec(statement)) !== null) {
          const input = match[1].trim();
          const output = match[2].trim();
          if (input || output) testCases.push({ input: input, output: output });
        }
      }

      let language = "C++";
      const knownLangs = ["C++", "Java", "Python3", "Python", "JavaScript", "C#"];
      const langSelectors = ["[class*='language-select']", "button[class*='lang']", "div[class*='editor'] button"];
      for (const selector of langSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          const txt = el.textContent.trim();
          const matched = knownLangs.find((l) => l.toLowerCase() === txt.toLowerCase());
          if (matched) { language = matched; break; }
        }
      }

      let code = "";
      const aceLines = document.querySelectorAll(".ace_line");
      const monacoLines = document.querySelectorAll(".view-line");
      const cmLines = document.querySelectorAll(".cm-line");

      if (aceLines.length > 0) {
        const lines = [];
        aceLines.forEach((el) => lines.push((el.textContent || "").replace(/\u00A0/g, " ")));
        code = lines.join("\n").replace(/\n+$/, "");
      } else if (monacoLines.length > 0) {
        const lines = [];
        monacoLines.forEach((el) => lines.push((el.textContent || "").replace(/\u00A0/g, " ")));
        code = lines.join("\n").replace(/\n+$/, "");
      } else if (cmLines.length > 0) {
        const lines = [];
        cmLines.forEach((el) => lines.push((el.textContent || "").replace(/\u00A0/g, " ")));
        code = lines.join("\n").replace(/\n+$/, "");
      }

      const problemInfo = {
        problemId: problemId,
        title: title,
        slug: slug,
        platform: "GeeksforGeeks",
        difficulty: difficulty,
        topics: topics,
        primaryTopic: topics.length > 0 ? topics[0] : "General",
        statement: statement,
        testCases: testCases,
        language: language,
        code: code,
        acceptedAt: new Date().toISOString(),
      };

      console.log("[Fika] ✅ GeeksForGeeksAdapter extracted CodingProblem:", problemInfo);
      return problemInfo;
    },

    _observer: null,

    startObserving(onAccepted) {
      let alreadyDetected = false;
      const scriptLoadTime = Date.now();
      const INITIAL_IGNORE_PERIOD_MS = 1500;

      const checkDomForAccepted = () => {
        if (alreadyDetected) return;
        if (Date.now() - scriptLoadTime < INITIAL_IGNORE_PERIOD_MS) return;

        if (this.isAccepted()) {
          alreadyDetected = true;
          console.log("[Fika] ✅ GFG Correct Answer submission detected!");
          const problemInfo = this.extractProblem();
          if (onAccepted && typeof onAccepted === "function") {
            onAccepted(problemInfo);
          }
          this.stopObserving();
        }
      };

      this._observer = new MutationObserver(() => {
        checkDomForAccepted();
      });

      this._observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      setTimeout(checkDomForAccepted, 2000);
      console.log("[Fika] GeeksForGeeksAdapter Observer active.");
    },

    stopObserving() {
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
        console.log("[Fika] GeeksForGeeksAdapter observer disconnected.");
      }
    },
  };

  // ============================================================
  // GitHub Synchronization Helpers
  // ============================================================

  function getStoredCredentials() {
    return new Promise((resolve) => {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        resolve(null);
        return;
      }
      chrome.storage.local.get(
        ["fika_github_token", "fika_github_owner", "fika_github_repo"],
        (result) => {
          if (result.fika_github_token && result.fika_github_owner && result.fika_github_repo) {
            resolve({
              token: result.fika_github_token,
              owner: result.fika_github_owner,
              repo: result.fika_github_repo,
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  const TOPIC_ABBREVIATIONS = {
    DynamicProgramming: "dp",
    BreadthFirstSearch: "bfs",
    DepthFirstSearch: "dfs",
    BinarySearch: "binarysearch",
    TwoPointers: "twopointers",
    SlidingWindow: "slidingwindow",
    LinkedList: "linkedlist",
    BinaryTree: "binarytree",
    BinarySearchTree: "bst",
    HashTable: "hashtable",
  };

  function normalizeTopic(topic) {
    if (!topic) return "General";
    return topic
      .split(/[\s\-_]+/)
      .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
      .join("")
      .replace(/[^a-zA-Z0-9]/g, "");
  }

  function generateFilePath(problem) {
    const rawTopic = problem.primaryTopic || (problem.topics && problem.topics[0]) || "General";
    const folderName = normalizeTopic(rawTopic) || "General";
    const fileName = TOPIC_ABBREVIATIONS[folderName] || folderName.toLowerCase();
    const diff = problem.difficulty || "Easy";
    return `${diff}/${folderName}/${fileName}.md`;
  }

  function formatProblemMarkdown(problem) {
    const lines = [];
    lines.push(`## ${problem.problemId}. ${problem.title}`);
    lines.push("");
    lines.push(`- **Platform**: ${problem.platform}`);
    lines.push(`- **Problem ID**: ${problem.problemId}`);
    lines.push(`- **Difficulty**: ${problem.difficulty}`);
    lines.push(`- **Language**: ${problem.language}`);
    lines.push(`- **Topics**: ${problem.topics && problem.topics.length > 0 ? problem.topics.join(", ") : "None"}`);
    lines.push(`- **Solved**: ${problem.acceptedAt || new Date().toISOString()}`);
    lines.push("");
    lines.push("### Problem");
    lines.push("");
    lines.push(problem.statement || "*Problem statement not available.*");
    lines.push("");

    if (problem.testCases && problem.testCases.length > 0) {
      lines.push("### Test Cases");
      lines.push("");
      problem.testCases.forEach((tc, idx) => {
        lines.push(`#### Test Case ${idx + 1}`);
        lines.push("");
        lines.push("**Input:**");
        lines.push("```");
        lines.push(tc.input);
        lines.push("```");
        lines.push("");
        lines.push("**Output:**");
        lines.push("```");
        lines.push(tc.output);
        lines.push("```");
        lines.push("");
      });
    }

    const langMap = { "C++": "cpp", "Python3": "python", "Python": "python", "Java": "java", "JavaScript": "javascript", "TypeScript": "typescript" };
    const mdLang = langMap[problem.language] || (problem.language ? problem.language.toLowerCase() : "");

    lines.push("### Solution");
    lines.push("");
    lines.push("```" + mdLang);
    lines.push(problem.code || "// No code extracted");
    lines.push("```");
    lines.push("");

    return lines.join("\n");
  }

  function processDuplicateDetection(existingContent, problem) {
    const newMarkdown = formatProblemMarkdown(problem);
    if (!existingContent || !existingContent.trim()) {
      return { action: "created", content: newMarkdown };
    }

    const sections = existingContent
      .split(/(?:^|\n)\s*---\s*(?=\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let existingIndex = -1;
    let existingCode = "";

    for (let i = 0; i < sections.length; i++) {
      const platformMatch = sections[i].match(/-\s*\*\*Platform\*\*:\s*([^\r\n]+)/i);
      const idMatch = sections[i].match(/-\s*\*\*Problem ID\*\*:\s*([^\r\n]+)/i);
      if (
        platformMatch &&
        idMatch &&
        platformMatch[1].trim().toLowerCase() === problem.platform.toLowerCase() &&
        idMatch[1].trim() === String(problem.problemId).trim()
      ) {
        existingIndex = i;
        const codeMatch = sections[i].match(/```(?:\w+)?\r?\n([\s\S]*?)\r?\n```/);
        if (codeMatch) existingCode = codeMatch[1].trim();
        break;
      }
    }

    if (existingIndex === -1) {
      sections.push(newMarkdown);
      return { action: "created", content: sections.join("\n\n---\n\n") };
    }

    const normExisting = existingCode.trim().replace(/\r\n/g, "\n");
    const normNew = (problem.code || "").trim().replace(/\r\n/g, "\n");

    if (normExisting === normNew) {
      return { action: "skipped", content: existingContent };
    }

    sections[existingIndex] = newMarkdown;
    return { action: "updated", content: sections.join("\n\n---\n\n") };
  }

  function utf8ToBase64(str) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    const cleaned = b64.replace(/\s/g, "");
    const bin = atob(cleaned);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  }

  function saveMetadataToLocalStorage(problem, filePath, syncStatus, error) {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(["fika_submissions_map"], (result) => {
      const map = result.fika_submissions_map || {};
      const key = `${problem.platform}:${problem.problemId}`;
      map[key] = {
        key: key,
        platform: problem.platform,
        problemId: problem.problemId,
        title: problem.title,
        difficulty: problem.difficulty,
        topics: problem.topics || [],
        language: problem.language,
        acceptedAt: problem.acceptedAt || new Date().toISOString(),
        githubPath: filePath,
        syncStatus: syncStatus,
        error: error || "",
      };
      chrome.storage.local.set({ fika_submissions_map: map });
    });
  }

  async function syncProblemToGitHub(problem, creds) {
    const filePath = generateFilePath(problem);
    console.log("[Fika Sync] Target repository path:", filePath);

    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const apiUrl = `https://api.github.com/repos/${creds.owner}/${creds.repo}/contents/${encodedPath}`;
    const headers = {
      Authorization: "Bearer " + creds.token,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    let existingContent = "";
    let sha = null;

    try {
      const res = await fetch(apiUrl, { method: "GET", headers: headers });
      if (res.ok) {
        const data = await res.json();
        sha = data.sha;
        existingContent = base64ToUtf8(data.content || "");
      } else if (res.status !== 404) {
        const errTxt = await res.text();
        saveMetadataToLocalStorage(problem, filePath, "failed", `GitHub GET ${res.status}`);
        return { success: false, error: `GitHub API error ${res.status}: ${errTxt}` };
      }
    } catch (err) {
      saveMetadataToLocalStorage(problem, filePath, "failed", "Network error during GET");
      return { success: false, error: "Network error fetching file from GitHub." };
    }

    const detect = processDuplicateDetection(existingContent, problem);
    if (detect.action === "skipped") {
      console.log(`[Fika Sync] ℹ️ Problem ${problem.platform} #${problem.problemId} is identical. Skipping GitHub commit.`);
      saveMetadataToLocalStorage(problem, filePath, "synced");
      return { success: true, action: "skipped" };
    }

    const commitMsg = `${detect.action === "created" ? "Add" : "Update"} ${problem.platform} ${problem.problemId}: ${problem.title} [${problem.difficulty}]`;
    const payload = {
      message: commitMsg,
      content: utf8ToBase64(detect.content),
    };
    if (sha) payload.sha = sha;

    try {
      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: headers,
        body: JSON.stringify(payload),
      });

      if (!putRes.ok) {
        const errorBody = await putRes.text();
        saveMetadataToLocalStorage(problem, filePath, "failed", `PUT error ${putRes.status}`);
        return { success: false, error: `GitHub PUT error ${putRes.status}: ${errorBody}` };
      }

      const putData = await putRes.json();
      saveMetadataToLocalStorage(problem, filePath, "synced");
      console.log(`[Fika Sync] 🎉 SUCCESS! Synced ${problem.platform} #${problem.problemId} (${problem.title}) to ${creds.owner}/${creds.repo} -> ${filePath}`);
      return { success: true, action: detect.action, commitSha: putData.commit?.sha };
    } catch (err) {
      saveMetadataToLocalStorage(problem, filePath, "failed", "Network error during PUT");
      return { success: false, error: "Network error pushing to GitHub." };
    }
  }

  // ============================================================
  // Main Execution Loop
  // ============================================================
  const registeredAdapters = [LeetCodeAdapter, GeeksForGeeksAdapter];

  const currentUrl = window.location.href;
  const activeAdapter = registeredAdapters.find((adapter) =>
    adapter.matchesUrl(currentUrl)
  );

  if (activeAdapter) {
    console.log("[Fika] Active adapter found:", activeAdapter.platformName);
    activeAdapter.startObserving(async (problem) => {
      console.log("[Fika] ✅ ACCEPTED submission detected! Extracting problem:", problem.title);
      showToast(`Fika: 🚀 Accepted submission detected! Syncing "${problem.title}"...`, "info");

      const creds = await getStoredCredentials();
      if (!creds) {
        console.warn("[Fika] ⚠️ Sync skipped: GitHub credentials not configured.");
        showToast("Fika: ⚠️ GitHub credentials missing! Click extension icon to configure.", "warning");
        return;
      }

      console.log(`[Fika] Syncing problem to GitHub repo ${creds.owner}/${creds.repo}...`);
      const result = await syncProblemToGitHub(problem, creds);
      if (result.success) {
        console.log(`[Fika] ✅ SYNC COMPLETE! [Action: ${result.action}]`);
        showToast(`Fika: 🎉 Solution pushed to GitHub! (${result.action})`, "success");
      } else {
        console.error(`[Fika] ❌ SYNC FAILED: ${result.error}`);
        showToast(`Fika: ❌ Push failed: ${result.error}`, "error");
      }
    });
  } else {
    console.log("[Fika] No matching platform adapter for URL:", currentUrl);
  }
})();
