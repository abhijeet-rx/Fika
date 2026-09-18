// ============================================================
// Fika - Markdown Formatter
//
// Converts a CodingProblem object into a formatted Markdown
// string ready to be appended to a topic file in the GitHub
// repository.
//
// This is a PURE function: no side effects, no DOM access,
// no network calls. Input → String output.
//
// The generated Markdown follows the user's desired structure:
//
//   ## Problem Title
//   metadata fields...
//   ### Problem
//   statement text...
//   ### Test Cases
//   input/output pairs...
//   ### Solution
//   code block with syntax highlighting...
//
// ============================================================

import { CodingProblem } from "./types";

// ----------------------------------------------------------
// Language name mapping: LeetCode names → GitHub Markdown IDs
// ----------------------------------------------------------
// LeetCode uses display names like "Python3" and "C++".
// GitHub Markdown code fences use lowercase identifiers like
// "python" and "cpp" for syntax highlighting.
//
// If a language is not in this map, we fall back to the
// original name in lowercase.
// ----------------------------------------------------------
const LANGUAGE_TO_MARKDOWN: Record<string, string> = {
  "C++": "cpp",
  "C": "c",
  "C#": "csharp",
  "Java": "java",
  "Python": "python",
  "Python3": "python",
  "JavaScript": "javascript",
  "TypeScript": "typescript",
  "PHP": "php",
  "Swift": "swift",
  "Kotlin": "kotlin",
  "Dart": "dart",
  "Go": "go",
  "Ruby": "ruby",
  "Scala": "scala",
  "Rust": "rust",
  "Racket": "racket",
  "Erlang": "erlang",
  "Elixir": "elixir",
  "MySQL": "sql",
  "MS SQL Server": "sql",
  "Oracle": "sql",
};

// ----------------------------------------------------------
// Get the Markdown-compatible language identifier
// ----------------------------------------------------------
function getMarkdownLanguage(language: string): string {
  return LANGUAGE_TO_MARKDOWN[language] || language.toLowerCase();
}

// ----------------------------------------------------------
// Format a single CodingProblem into Markdown
// ----------------------------------------------------------
// This function produces Markdown for ONE problem entry.
// Multiple problems are appended to the same file, separated
// by horizontal rules (---).
// ----------------------------------------------------------
export function formatProblemToMarkdown(problem: CodingProblem): string {
  const lines: string[] = [];

  // ---- Header: Problem Title ----
  lines.push(`## ${problem.problemId}. ${problem.title}`);
  lines.push("");

  // ---- Metadata Block ----
  lines.push(`- **Platform**: ${problem.platform}`);
  lines.push(`- **Problem ID**: ${problem.problemId}`);
  lines.push(`- **Difficulty**: ${problem.difficulty}`);
  lines.push(`- **Language**: ${problem.language}`);
  lines.push(`- **Topics**: ${problem.topics.join(", ") || "None"}`);
  lines.push(`- **Solved**: ${problem.acceptedAt}`);
  lines.push("");

  // ---- Problem Statement ----
  lines.push("### Problem");
  lines.push("");
  lines.push(problem.statement || "*Problem statement not available.*");
  lines.push("");

  // ---- Test Cases ----
  if (problem.testCases.length > 0) {
    lines.push("### Test Cases");
    lines.push("");

    problem.testCases.forEach(function (tc, index) {
      lines.push(`#### Test Case ${index + 1}`);
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

  // ---- Solution Code ----
  const markdownLang = getMarkdownLanguage(problem.language);

  lines.push("### Solution");
  lines.push("");
  lines.push("```" + markdownLang);
  lines.push(problem.code || "// No code extracted");
  lines.push("```");
  lines.push("");

  // Join all lines into a single Markdown string
  return lines.join("\n");
}

// NOTE: Path generation is handled by pathGenerator.ts
// (generateFilePathFromProblem) which includes topic abbreviations (e.g. DP -> dp).


// ----------------------------------------------------------
// Format the content to append to an existing file
// ----------------------------------------------------------
// When a file already contains previous problems, we need to
// add a horizontal rule separator before the new problem.
// If the file is new (empty), no separator is needed.
// ----------------------------------------------------------
export function formatForAppend(
  existingContent: string,
  problem: CodingProblem
): string {
  const newProblemMarkdown = formatProblemToMarkdown(problem);

  if (existingContent.trim() === "") {
    // New file — no separator needed
    return newProblemMarkdown;
  }

  // Existing file — add a horizontal rule separator
  return existingContent.trimEnd() + "\n\n---\n\n" + newProblemMarkdown;
}
