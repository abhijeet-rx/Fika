// ============================================================
// Fika - GeeksforGeeks (GFG) Platform Adapter
//
// Implements the PlatformAdapter contract for geeksforgeeks.org
//
// Responsibilities:
//   - Match GeeksforGeeks problem page URLs
//   - Detect GFG "Correct Answer" submission results
//   - Extract GFG DOM elements (title, difficulty, topics, statement, code)
//   - Normalize GFG difficulty levels (School/Basic -> Easy)
//   - Output a standardized CodingProblem object
//
// ============================================================

import { CodingProblem, Difficulty, TestCase } from "./types";
import { PlatformAdapter } from "./platformAdapter";

// ----------------------------------------------------------
// GeeksforGeeks Adapter Implementation
// ----------------------------------------------------------
export class GeeksForGeeksAdapter implements PlatformAdapter {
  readonly platformName = "GeeksforGeeks" as const;

  private _observer: MutationObserver | null = null;

  /**
   * Check if a given URL belongs to a GFG problem page.
   * Pattern: geeksforgeeks.org/problems/{problem-slug}/{version}
   */
  matchesUrl(url: string): boolean {
    const gfgPattern = /geeksforgeeks\.org\/problems\/([a-z0-9-]+)/i;
    return gfgPattern.test(url);
  }

  /**
   * Check if the current DOM page displays a GFG accepted submission.
   * GFG uses text like "Correct Answer" or "Problem Solved Successfully".
   */
  isAccepted(): boolean {
    const statusSelectors = [
      "[class*='status']",
      "[class*='result']",
      "[class*='problem-tab']",
      "div.problems_header_content__status",
      "[class*='success']",
    ];

    for (let i = 0; i < statusSelectors.length; i++) {
      try {
        const elements = document.querySelectorAll(statusSelectors[i]);
        for (let j = 0; j < elements.length; j++) {
          const text = elements[j].textContent
            ? elements[j].textContent!.trim()
            : "";
          if (
            text.includes("Correct Answer") ||
            text.includes("Problem Solved Successfully") ||
            text === "Correct"
          ) {
            return true;
          }
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }
    return false;
  }

  /**
   * Normalize GFG's 5 difficulty tiers into Fika's Easy / Medium / Hard
   */
  private normalizeDifficulty(rawDiff: string): Difficulty {
    const clean = rawDiff.trim().toLowerCase();
    if (clean === "school" || clean === "basic" || clean === "easy") {
      return "Easy";
    }
    if (clean === "medium") {
      return "Medium";
    }
    if (clean === "hard") {
      return "Hard";
    }
    return "Easy"; // Default fallback
  }

  /**
   * Helper: Convert HTML element to clean plain text
   */
  private htmlToCleanText(element: Element): string {
    const clone = element.cloneNode(true) as Element;
    clone.querySelectorAll("style, script").forEach((el) => el.remove());
    clone.querySelectorAll("br").forEach((el) => el.replaceWith("\n"));
    clone
      .querySelectorAll("p, div, li, h1, h2, h3, h4, pre")
      .forEach((el) => {
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

  /**
   * Extract problem details from GFG DOM into a CodingProblem object.
   */
  async extractProblem(): Promise<CodingProblem> {
    const currentUrl = window.location.href;
    const urlMatch = currentUrl.match(
      /geeksforgeeks\.org\/problems\/([a-z0-9-]+)/i
    );
    const slug = urlMatch ? urlMatch[1] : "unknown-gfg-problem";

    // ---- A. Extract Title & Problem ID ----
    let title = "Unknown Problem";
    let problemId = slug;

    // Method 1: Try document.title format: "Missing number in array | Practice | GeeksforGeeks"
    const pageTitle = document.title;
    const titleMatch = pageTitle.match(/^([^|]+)\s*\|\s*Practice/i);

    if (titleMatch) {
      title = titleMatch[1].trim();
    } else {
      // Method 2: DOM heading query
      const heading = document.querySelector(
        ".problem-tab__title, [class*='problem-title'], h3, h2, h1"
      );
      if (heading && heading.textContent) {
        title = heading.textContent.trim();
      }
    }

    // Extract numerical ID suffix if present in slug (e.g. "missing-number-in-array1416" -> "1416")
    const idSuffixMatch = slug.match(/(\d+)$/);
    if (idSuffixMatch) {
      problemId = idSuffixMatch[1];
    }

    // ---- B. Extract Difficulty ----
    let rawDifficulty = "Easy";
    const validDiffs = ["school", "basic", "easy", "medium", "hard"];

    const diffSelectors = [
      "[class*='problem-tab__difficulty']",
      "span[class*='difficulty']",
      "div[class*='difficulty']",
    ];

    for (const selector of diffSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          const txt = el.textContent.trim().toLowerCase();
          if (validDiffs.includes(txt)) {
            rawDifficulty = el.textContent.trim();
            break;
          }
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }

    const difficulty: Difficulty = this.normalizeDifficulty(rawDifficulty);

    // ---- C. Extract Topics / Tags ----
    const topics: string[] = [];
    const topicLinks = document.querySelectorAll(
      'a[href*="category"], a[href*="tag"], [class*="topic-tag"], [class*="company-tag"]'
    );

    topicLinks.forEach((el) => {
      const tagText = el.textContent ? el.textContent.trim() : "";
      if (tagText && tagText.length < 30 && !topics.includes(tagText)) {
        topics.push(tagText);
      }
    });

    // ---- D. Extract Problem Statement ----
    let statement = "";
    const descriptionSelectors = [
      "[class*='problem-statement']",
      "[class*='problemDescription']",
      "div.problems_problem_content__statement",
      "[class*='mark-down']",
    ];

    for (const selector of descriptionSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el && el.textContent && el.textContent.trim().length > 30) {
          statement = this.htmlToCleanText(el);
          break;
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }

    // ---- E. Extract Test Cases ----
    const testCases: TestCase[] = [];
    if (statement) {
      const testCasePattern =
        /Input:\s*([\s\S]*?)Output:\s*([\s\S]*?)(?=Example|Input:|Explanation|Constraints|Note:|\n\n|$)/gi;
      let tcMatch: RegExpExecArray | null;
      while ((tcMatch = testCasePattern.exec(statement)) !== null) {
        const input = tcMatch[1].trim();
        const output = tcMatch[2].trim();
        if (input || output) {
          testCases.push({ input: input, output: output });
        }
      }
    }

    // ---- F. Extract Programming Language ----
    let language = "C++"; // Standard default on GFG
    const knownLanguages = [
      "C++",
      "Java",
      "Python3",
      "Python",
      "JavaScript",
      "C#",
      "C",
    ];

    const langSelectors = [
      "[class*='language-select']",
      "button[class*='lang']",
      "div[class*='editor'] button",
      "select[class*='lang']",
    ];

    for (const selector of langSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el && el.textContent) {
          const txt = el.textContent.trim();
          const matched = knownLanguages.find(
            (l) => l.toLowerCase() === txt.toLowerCase()
          );
          if (matched) {
            language = matched;
            break;
          }
        }
      } catch (e) {
        // Skip invalid selectors
      }
    }

    // ---- G. Extract Solution Code (Ace or Monaco Editor) ----
    let code = "";

    // Check Ace Editor (.ace_line) first (most common on GFG)
    const aceLines = document.querySelectorAll(".ace_line");
    if (aceLines.length > 0) {
      const lines: string[] = [];
      aceLines.forEach((lineEl) => {
        let lineText = lineEl.textContent || "";
        lineText = lineText.replace(/\u00A0/g, " ");
        lines.push(lineText);
      });
      code = lines.join("\n").replace(/\n+$/, "");
    } else {
      // Check Monaco Editor (.view-line) fallback
      const monacoLines = document.querySelectorAll(".view-line");
      if (monacoLines.length > 0) {
        const lines: string[] = [];
        monacoLines.forEach((lineEl) => {
          let lineText = lineEl.textContent || "";
          lineText = lineText.replace(/\u00A0/g, " ");
          lines.push(lineText);
        });
        code = lines.join("\n").replace(/\n+$/, "");
      }
    }

    const primaryTopic = topics.length > 0 ? topics[0] : "General";

    return {
      problemId: problemId,
      title: title,
      slug: slug,
      platform: "GeeksforGeeks",
      difficulty: difficulty,
      topics: topics,
      primaryTopic: primaryTopic,
      statement: statement,
      testCases: testCases,
      language: language,
      code: code,
      acceptedAt: new Date().toISOString(),
    };
  }

  /**
   * Start watching GFG DOM for a "Correct Answer" submission result.
   */
  startObserving(onAccepted: (problem: CodingProblem) => void): void {
    let alreadyDetected = false;
    const scriptLoadTime = Date.now();
    const INITIAL_IGNORE_PERIOD_MS = 2500;
    const MAX_RESULT_TEXT_LENGTH = 500;

    this._observer = new MutationObserver((mutationsList) => {
      if (alreadyDetected) return;

      for (const mutation of mutationsList) {
        if (mutation.type !== "childList") continue;

        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const addedNode = mutation.addedNodes[i];
          if (addedNode.nodeType !== Node.ELEMENT_NODE) continue;

          const textContent = addedNode.textContent || "";

          // Guard 1: Skip large DOM containers
          if (textContent.length > MAX_RESULT_TEXT_LENGTH) continue;

          // Guard 2: Check for GFG success strings
          const isCorrect =
            /\bCorrect Answer\b/i.test(textContent) ||
            /\bProblem Solved Successfully\b/i.test(textContent);

          if (!isCorrect) continue;

          // Guard 3: Ignore initial page load period
          const timeSinceLoad = Date.now() - scriptLoadTime;
          if (timeSinceLoad < INITIAL_IGNORE_PERIOD_MS) continue;

          // All guards passed
          alreadyDetected = true;
          console.log("[Fika] ✅ GFG Correct Answer submission detected!");

          this.extractProblem().then((problem) => {
            if (onAccepted && typeof onAccepted === "function") {
              onAccepted(problem);
            }
          });

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
  }

  /**
   * Stop observing GFG DOM changes.
   */
  stopObserving(): void {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
      console.log("[Fika] GeeksForGeeksAdapter observer disconnected.");
    }
  }
}

export const gfgAdapter = new GeeksForGeeksAdapter();
