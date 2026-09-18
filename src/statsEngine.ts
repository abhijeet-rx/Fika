// ============================================================
// Fika - Statistics Engine
//
// Computes aggregated statistics and analytics from Fika's
// local problem metadata.
//
// Outputs:
//   - Total problems solved
//   - Difficulty distribution (Easy, Medium, Hard)
//   - Topic distribution (Array, Graph, DP, etc.)
//   - Language distribution (Python3, C++, Java, etc.)
//   - Timeframe counts (Today, This Week, This Month)
//   - Active daily streak (consecutive solve days)
//
// This is a PURE module: given an array of ProblemMetadata,
// it computes and returns a FikaStats object without side effects.
//
// ============================================================

import { ProblemMetadata } from "./storageService";

// ----------------------------------------------------------
// Statistics Output Interface
// ----------------------------------------------------------
export interface FikaStats {
  /** Total number of successfully synced problems */
  totalSolved: number;

  /** Breakdown by difficulty level */
  difficultyBreakdown: {
    easy: number;
    medium: number;
    hard: number;
  };

  /** Breakdown by topic tag: e.g. { "Array": 12, "Hash Table": 8 } */
  topicBreakdown: Record<string, number>;

  /** Breakdown by programming language: e.g. { "Python3": 15, "C++": 5 } */
  languageBreakdown: Record<string, number>;

  /** Problems solved today (local date) */
  todayCount: number;

  /** Problems solved in the past 7 days */
  thisWeekCount: number;

  /** Problems solved in the current calendar month */
  thisMonthCount: number;

  /** Current active daily streak (consecutive days) */
  currentStreak: number;
}

// ----------------------------------------------------------
// Date Helper: Format Date to local "YYYY-MM-DD" string
// ----------------------------------------------------------
export function formatLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ----------------------------------------------------------
// Date Helper: Check if two dates are on the same calendar day
// ----------------------------------------------------------
function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

// ----------------------------------------------------------
// Date Helper: Check if two dates are in the same calendar month
// ----------------------------------------------------------
function isSameMonth(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()
  );
}

// ----------------------------------------------------------
// Date Helper: Check if date is within past N days relative to refDate
// ----------------------------------------------------------
function isWithinPastNDays(targetDate: Date, refDate: Date, nDays: number): boolean {
  const diffTime = refDate.getTime() - targetDate.getTime();
  const diffDays = diffTime / (1000 * 3600 * 24);
  return diffDays >= 0 && diffDays < nDays;
}

// ----------------------------------------------------------
// Calculate Daily Streak
// ----------------------------------------------------------
// Algorithm:
//   1. Build a set of unique local date strings ("YYYY-MM-DD")
//   2. Check if today or yesterday is present in the set
//   3. Count consecutive preceding calendar days
// ----------------------------------------------------------
export function calculateStreak(
  solvedDatesSet: Set<string>,
  refDate: Date = new Date()
): number {
  const todayStr = formatLocalDateString(refDate);

  // Compute yesterday's date string
  const yesterdayDate = new Date(refDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = formatLocalDateString(yesterdayDate);

  let startDate: Date;

  if (solvedDatesSet.has(todayStr)) {
    // User solved a problem today -> streak includes today
    startDate = new Date(refDate);
  } else if (solvedDatesSet.has(yesterdayStr)) {
    // User hasn't solved today yet, but solved yesterday -> streak still active
    startDate = yesterdayDate;
  } else {
    // Neither today nor yesterday has a solve -> active streak is 0
    return 0;
  }

  let streak = 0;
  const checkDate = new Date(startDate);

  // Count backwards day by day as long as the date exists in solvedDatesSet
  while (solvedDatesSet.has(formatLocalDateString(checkDate))) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return streak;
}

// ----------------------------------------------------------
// Core Calculation Function
// ----------------------------------------------------------
// Pass an array of ProblemMetadata records and an optional
// reference date (defaults to current date/time).
// Returns a populated FikaStats object.
// ----------------------------------------------------------
export function calculateStatistics(
  submissions: ProblemMetadata[],
  refDate: Date = new Date()
): FikaStats {
  const stats: FikaStats = {
    totalSolved: 0,
    difficultyBreakdown: {
      easy: 0,
      medium: 0,
      hard: 0,
    },
    topicBreakdown: {},
    languageBreakdown: {},
    todayCount: 0,
    thisWeekCount: 0,
    thisMonthCount: 0,
    currentStreak: 0,
  };

  const solvedDatesSet = new Set<string>();

  // Filter to include only successfully synced problems
  const syncedSubmissions = submissions.filter(function (sub) {
    return sub.syncStatus === "synced";
  });

  stats.totalSolved = syncedSubmissions.length;

  for (let i = 0; i < syncedSubmissions.length; i++) {
    const sub = syncedSubmissions[i];

    // ---- 1. Difficulty Breakdown ----
    const diff = sub.difficulty.toLowerCase();
    if (diff === "easy") {
      stats.difficultyBreakdown.easy++;
    } else if (diff === "medium") {
      stats.difficultyBreakdown.medium++;
    } else if (diff === "hard") {
      stats.difficultyBreakdown.hard++;
    }

    // ---- 2. Topic Breakdown ----
    if (Array.isArray(sub.topics)) {
      sub.topics.forEach(function (topic) {
        if (topic && topic.trim()) {
          const t = topic.trim();
          stats.topicBreakdown[t] = (stats.topicBreakdown[t] || 0) + 1;
        }
      });
    }

    // ---- 3. Language Breakdown ----
    if (sub.language && sub.language.trim()) {
      const lang = sub.language.trim();
      stats.languageBreakdown[lang] = (stats.languageBreakdown[lang] || 0) + 1;
    }

    // ---- 4. Date Analysis ----
    if (sub.acceptedAt) {
      const subDate = new Date(sub.acceptedAt);

      if (!isNaN(subDate.getTime())) {
        // Record local YYYY-MM-DD date for streak calculation
        solvedDatesSet.add(formatLocalDateString(subDate));

        // Check Today
        if (isSameDay(subDate, refDate)) {
          stats.todayCount++;
        }

        // Check Past 7 Days (This Week)
        if (isWithinPastNDays(subDate, refDate, 7)) {
          stats.thisWeekCount++;
        }

        // Check Current Calendar Month
        if (isSameMonth(subDate, refDate)) {
          stats.thisMonthCount++;
        }
      }
    }
  }

  // ---- 5. Streak Calculation ----
  stats.currentStreak = calculateStreak(solvedDatesSet, refDate);

  return stats;
}
