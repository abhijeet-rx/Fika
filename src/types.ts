// ============================================================
// Fika - Common Data Model
//
// This file defines the TypeScript interfaces that represent
// Fika's internal data structures. Every platform adapter
// (LeetCode, GFG, Codeforces, etc.) must produce objects
// conforming to these interfaces.
//
// These types are the CONTRACT between:
//   Content Script (extraction) → Background Service Worker
//   Background Service Worker   → Markdown Formatter
//   Background Service Worker   → GitHub Service
//   Background Service Worker   → Statistics Engine
//
// NOTE: TypeScript interfaces are erased at compile time.
// They produce zero runtime JavaScript code. They exist
// solely for type checking, documentation, and IDE support.
// ============================================================

// ----------------------------------------------------------
// Supported Coding Platforms
// ----------------------------------------------------------
// A union type restricts a value to one of these exact strings.
// If you write platform = "Leet Code" (with a space), TypeScript
// will flag it as an error at compile time.
// ----------------------------------------------------------
export type Platform =
  | "LeetCode"
  | "GeeksforGeeks"
  | "Codeforces"
  | "CodeChef";

// ----------------------------------------------------------
// Problem Difficulty
// ----------------------------------------------------------
// LeetCode uses Easy/Medium/Hard. Other platforms may use
// different labels (e.g., GFG uses "Basic", "School").
// We normalize everything into these three levels.
// ----------------------------------------------------------
export type Difficulty = "Easy" | "Medium" | "Hard";

// ----------------------------------------------------------
// A single public / example test case
// ----------------------------------------------------------
// We store input and output as raw strings because different
// problems have completely different input formats (arrays,
// trees, strings, linked lists, matrices). Parsing every
// possible format into structured data is unnecessary —
// raw strings are exactly what we need for Markdown display.
// ----------------------------------------------------------
export interface TestCase {
  input: string;
  output: string;
}

// ----------------------------------------------------------
// The core data model: CodingProblem
// ----------------------------------------------------------
// This is the central interface of Fika. Every piece of data
// extracted from any coding platform is normalized into this
// single shape. All downstream systems (Markdown formatter,
// GitHub service, statistics engine) operate on this interface.
// ----------------------------------------------------------
export interface CodingProblem {
  // ---- Identity ----

  /** Unique problem identifier on the platform (e.g., "1" for Two Sum) */
  problemId: string;

  /** Human-readable problem title (e.g., "Two Sum") */
  title: string;

  /** URL-friendly slug extracted from the problem URL (e.g., "two-sum") */
  slug: string;

  /** The coding platform this problem was solved on */
  platform: Platform;

  // ---- Classification ----

  /** Problem difficulty level, normalized to Easy/Medium/Hard */
  difficulty: Difficulty;

  /**
   * All topic tags associated with the problem.
   * Example: ["Array", "Hash Table", "Two Pointers"]
   */
  topics: string[];

  /**
   * The primary topic used to determine the file path in the
   * GitHub repository structure.
   *
   * Derived from topics[0] (the first tag) by default.
   * Example: "Array" → file goes into Easy/Arrays/arrays.md
   *
   * Why separate from topics?
   * A problem may have 5 tags, but it can only live in ONE
   * folder in the repository. primaryTopic decides that folder.
   */
  primaryTopic: string;

  // ---- Problem Content ----

  /** The full problem statement as clean plain text */
  statement: string;

  /** Public/example test cases shown on the problem page */
  testCases: TestCase[];

  // ---- Solution ----

  /** The programming language used for the accepted solution */
  language: string;

  /** The complete source code of the accepted solution */
  code: string;

  // ---- Metadata ----

  /**
   * ISO 8601 timestamp of when the submission was accepted.
   * Example: "2026-09-18T18:30:00+05:30"
   *
   * Used by the statistics engine for:
   *   - Daily/weekly solve counts
   *   - Streak tracking
   *   - Timeline visualization
   */
  acceptedAt: string;
}
