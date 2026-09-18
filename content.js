// ============================================================
// Fika Content Script
// Injected into coding platform pages (e.g., leetcode.com)
//
// Refactored to use the PlatformAdapter Architecture:
//   - Encapsulates platform logic in LeetCodeAdapter
//   - Conforms to PlatformAdapter interface (matchesUrl, isAccepted, extractProblem, startObserving)
//   - Preserves all robust DOM extraction logic and MutationObserver guards
// ============================================================

(function () {
  "use strict";

  console.log("[Fika] Content script initialized.");
  console.log("[Fika] Current URL:", window.location.href);

  // ============================================================
  // LeetCode Platform Adapter
  // Implements the PlatformAdapter contract for LeetCode
  // ============================================================
  const LeetCodeAdapter = {
    platformName: "LeetCode",

    /**
     * Check if a given URL belongs to a LeetCode problem page.
     * Pattern: leetcode.com/problems/{slug}/
     */
    matchesUrl(url) {
      const leetcodeProblemPattern = /leetcode\.com\/problems\/([a-z0-9-]+)/i;
      return leetcodeProblemPattern.test(url);
    },

    /**
     * Check if the current DOM page displays an accepted submission result.
     */
    isAccepted() {
      const resultElements = document.querySelectorAll(
        '[data-e2e-locator="submission-result"], [class*="result"]'
      );
      for (const el of resultElements) {
        const text = el.textContent ? el.textContent.trim() : "";
        if (text === "Accepted") {
          return true;
        }
      }
      return false;
    },

    /**
     * Extract problem information from the LeetCode DOM.
     * Returns a normalized CodingProblem object.
     */
    extractProblem() {
      console.log("[Fika] Starting LeetCode problem extraction...");

      // ---- A. Extract Problem Title & ID from document.title ----
      let problemId = "Unknown";
      let title = "Unknown";

      const titlePattern = /(\d+)\.\s*(.+?)\s*-\s*LeetCode/;
      const titleMatch = document.title.match(titlePattern);

      if (titleMatch) {
        problemId = titleMatch[1];
        title = titleMatch[2].trim();
        console.log("[Fika] Extracted from document.title → ID:", problemId, "Title:", title);
      } else {
        console.log("[Fika] document.title did not match. Trying DOM fallback...");
        const headings = document.querySelectorAll("h1, h2, h3, h4, [class*='title']");
        for (const heading of headings) {
          const text = heading.textContent.trim();
          const headingMatch = text.match(/^(\d+)\.\s*(.+)/);
          if (headingMatch) {
            problemId = headingMatch[1];
            title = headingMatch[2].trim();
            console.log("[Fika] Extracted from DOM heading → ID:", problemId, "Title:", title);
            break;
          }
        }
      }

      // ---- B. Extract Difficulty ----
      let difficulty = "Unknown";
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
              console.log("[Fika] Extracted difficulty from selector:", difficulty);
              break;
            }
          }
        } catch (e) {
          // Ignore querySelector errors
        }
      }

      if (difficulty === "Unknown") {
        const candidates = document.querySelectorAll("div, span, a, p");
        for (const el of candidates) {
          const text = el.textContent.trim();
          if (validDifficulties.includes(text) && el.children.length === 0) {
            difficulty = text;
            console.log("[Fika] Extracted difficulty from text scan:", difficulty);
            break;
          }
        }
      }

      // ---- C. Extract Topics / Tags ----
      const topics = [];
      const topicLinks = document.querySelectorAll('a[href*="/tag/"]');
      topicLinks.forEach(function (el) {
        const tagText = el.textContent.trim();
        if (tagText && !topics.includes(tagText)) {
          topics.push(tagText);
        }
      });

      // ---- D. Extract Problem Statement ----
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
        text = text
          .split("\n")
          .map((line) => line.trim())
          .join("\n");
        return text.trim();
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
            console.log("[Fika] Extracted statement using selector:", selector);
            break;
          }
        } catch (e) {
          // Ignore selector errors
        }
      }

      // ---- E. Extract Test Cases ----
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

      // ---- F. Extract Programming Language ----
      let language = "Unknown";
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
          console.log("[Fika] Extracted language:", language);
          break;
        }
      }

      // ---- G. Extract Solution Code ----
      let code = "";
      const viewLines = document.querySelectorAll(".view-line");
      if (viewLines.length > 0) {
        const lines = [];
        viewLines.forEach((lineEl) => {
          let lineText = lineEl.textContent || "";
          lineText = lineText.replace(/\u00A0/g, " ");
          lines.push(lineText);
        });
        code = lines.join("\n").replace(/\n+$/, "");
        console.log("[Fika] Extracted code (" + lines.length + " lines)");
      }

      // ---- H. Construct CodingProblem Object ----
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

    /** Active MutationObserver instance */
    _observer: null,

    /**
     * Start watching the DOM for an accepted submission result.
     * Invokes onAccepted(problemInfo) when detected.
     */
    startObserving(onAccepted) {
      let alreadyDetected = false;
      const scriptLoadTime = Date.now();
      const INITIAL_IGNORE_PERIOD_MS = 3000;
      const MAX_RESULT_TEXT_LENGTH = 500;

      this._observer = new MutationObserver((mutationsList) => {
        if (alreadyDetected) return;

        for (const mutation of mutationsList) {
          if (mutation.type !== "childList") continue;

          for (const addedNode of mutation.addedNodes) {
            if (addedNode.nodeType !== Node.ELEMENT_NODE) continue;

            const textContent = addedNode.textContent || "";

            // Guard 1: Ignore large DOM chunks (e.g. history panel re-renders)
            if (textContent.length > MAX_RESULT_TEXT_LENGTH) continue;

            // Guard 2: Look for standalone word "Accepted"
            if (!/\bAccepted\b/.test(textContent)) continue;

            // Guard 3: Ignore initial page load period
            const timeSinceLoad = Date.now() - scriptLoadTime;
            if (timeSinceLoad < INITIAL_IGNORE_PERIOD_MS) {
              console.log("[Fika] Ignored early 'Accepted' text (" + timeSinceLoad + "ms after load)");
              continue;
            }

            // All guards passed!
            alreadyDetected = true;
            console.log("[Fika] ✅ ACCEPTED submission detected by LeetCodeAdapter!");

            const problemInfo = this.extractProblem();

            if (onAccepted && typeof onAccepted === "function") {
              onAccepted(problemInfo);
            }

            this.stopObserving();
            return;
          }
        }
      });

      this._observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      console.log("[Fika] LeetCodeAdapter MutationObserver active.");
    },

    /**
     * Stop observing DOM changes.
     */
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
  // Implements the PlatformAdapter contract for GeeksforGeeks
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
      if (aceLines.length > 0) {
        const lines = [];
        aceLines.forEach((el) => lines.push((el.textContent || "").replace(/\u00A0/g, " ")));
        code = lines.join("\n").replace(/\n+$/, "");
      } else {
        const monacoLines = document.querySelectorAll(".view-line");
        if (monacoLines.length > 0) {
          const lines = [];
          monacoLines.forEach((el) => lines.push((el.textContent || "").replace(/\u00A0/g, " ")));
          code = lines.join("\n").replace(/\n+$/, "");
        }
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
      const INITIAL_IGNORE_PERIOD_MS = 2500;
      const MAX_RESULT_TEXT_LENGTH = 500;

      this._observer = new MutationObserver((mutationsList) => {
        if (alreadyDetected) return;

        for (const mutation of mutationsList) {
          if (mutation.type !== "childList") continue;

          for (const addedNode of mutation.addedNodes) {
            if (addedNode.nodeType !== Node.ELEMENT_NODE) continue;

            const textContent = addedNode.textContent || "";
            if (textContent.length > MAX_RESULT_TEXT_LENGTH) continue;

            const isCorrect =
              /\bCorrect Answer\b/i.test(textContent) ||
              /\bProblem Solved Successfully\b/i.test(textContent);

            if (!isCorrect) continue;

            const timeSinceLoad = Date.now() - scriptLoadTime;
            if (timeSinceLoad < INITIAL_IGNORE_PERIOD_MS) continue;

            alreadyDetected = true;
            console.log("[Fika] ✅ GFG Correct Answer submission detected!");

            const problemInfo = this.extractProblem();
            if (onAccepted && typeof onAccepted === "function") {
              onAccepted(problemInfo);
            }
            this.stopObserving();
            return;
          }
        }
      });

      this._observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      console.log("[Fika] GeeksForGeeksAdapter MutationObserver active.");
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
  // Main Execution Loop
  // Matches URL against registered adapters and activates observer
  // ============================================================
  const registeredAdapters = [LeetCodeAdapter, GeeksForGeeksAdapter];

  const currentUrl = window.location.href;
  const activeAdapter = registeredAdapters.find((adapter) =>
    adapter.matchesUrl(currentUrl)
  );

  if (activeAdapter) {
    console.log("[Fika] Active adapter found:", activeAdapter.platformName);
    activeAdapter.startObserving((problem) => {
      console.log("[Fika] Ready to sync problem:", problem.title);
    });
  } else {
    console.log("[Fika] No matching platform adapter for URL:", currentUrl);
  }
})();


