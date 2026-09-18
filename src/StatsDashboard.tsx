// ============================================================
// Fika - Statistics Dashboard Component
//
// Presentational React component displaying user problem-solving
// statistics:
//   - Total Solved & Current Streak
//   - Timeframe counts (Today, This Week, This Month)
//   - Difficulty Breakdown (Easy, Medium, Hard)
//   - Topic Distribution
//   - Language Distribution
//
// Designed to be clean, responsive, self-contained, and dark-themed.
//
// ============================================================

import React, { useEffect, useState } from "react";
import { FikaStats, calculateStatistics } from "./statsEngine";
import { getAllSubmissions, ProblemMetadata } from "./storageService";

// ----------------------------------------------------------
// Component Props Interface
// ----------------------------------------------------------
export interface StatsDashboardProps {
  /** Pre-calculated statistics (optional) */
  stats?: FikaStats;

  /** Raw metadata array (optional; used if stats is not passed) */
  submissions?: ProblemMetadata[];
}

// ----------------------------------------------------------
// Inline Styles (Self-contained Dark Theme)
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
    fontSize: "20px",
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: "1px",
  },
  subtitle: {
    fontSize: "11px",
    color: "#8888aa",
    marginTop: "2px",
  },
  streakBanner: {
    background: "linear-gradient(135deg, #6c63ff, #3f3d9e)",
    padding: "12px 16px",
    borderRadius: "8px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  streakLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#ffffff",
  },
  streakValue: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#ffd700",
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "8px",
    marginBottom: "14px",
  },
  card: {
    backgroundColor: "#16213e",
    padding: "10px",
    borderRadius: "6px",
    textAlign: "center" as const,
    border: "1px solid #2a2a4a",
  },
  cardValue: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#ffffff",
  },
  cardLabel: {
    fontSize: "10px",
    fontWeight: "600",
    color: "#8888aa",
    textTransform: "uppercase" as const,
    marginTop: "2px",
  },
  sectionTitle: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#a0a0c0",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
    marginBottom: "8px",
    marginTop: "14px",
  },
  difficultyGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "8px",
    marginBottom: "14px",
  },
  easyCard: {
    backgroundColor: "#0d2b1d",
    border: "1px solid #1b5e20",
    padding: "8px",
    borderRadius: "6px",
    textAlign: "center" as const,
  },
  mediumCard: {
    backgroundColor: "#332200",
    border: "1px solid #e65100",
    padding: "8px",
    borderRadius: "6px",
    textAlign: "center" as const,
  },
  hardCard: {
    backgroundColor: "#330d0d",
    border: "1px solid #b71c1c",
    padding: "8px",
    borderRadius: "6px",
    textAlign: "center" as const,
  },
  easyText: { color: "#4caf50", fontWeight: "700", fontSize: "16px" },
  mediumText: { color: "#ff9800", fontWeight: "700", fontSize: "16px" },
  hardText: { color: "#f44336", fontWeight: "700", fontSize: "16px" },
  diffLabel: { fontSize: "10px", color: "#aaaaaa", marginTop: "2px" },
  listContainer: {
    backgroundColor: "#16213e",
    borderRadius: "6px",
    padding: "8px 12px",
    border: "1px solid #2a2a4a",
    marginBottom: "10px",
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 0",
    fontSize: "12px",
    borderBottom: "1px solid #222244",
  },
  itemKey: { color: "#c0c0d0" },
  itemVal: { fontWeight: "700", color: "#6c63ff" },
  emptyText: { fontSize: "11px", color: "#666688", fontStyle: "italic" },
  loading: { textAlign: "center" as const, padding: "20px", color: "#8888aa" },
};

// ----------------------------------------------------------
// Helper Sub-Component: Key-Value Distribution List
// ----------------------------------------------------------
function DistributionList(props: {
  data: Record<string, number>;
  maxItems?: number;
}) {
  const entries = Object.entries(props.data).sort(function (a, b) {
    return b[1] - a[1];
  });

  const displayEntries = props.maxItems
    ? entries.slice(0, props.maxItems)
    : entries;

  if (displayEntries.length === 0) {
    return <div style={styles.emptyText}>No data recorded</div>;
  }

  return (
    <div style={styles.listContainer}>
      {displayEntries.map(function ([key, value], index) {
        const isLast = index === displayEntries.length - 1;
        return (
          <div
            key={key}
            style={{
              ...styles.listItem,
              borderBottom: isLast ? "none" : "1px solid #222244",
            }}
          >
            <span style={styles.itemKey}>{key}</span>
            <span style={styles.itemVal}>{value}</span>
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------
// Main StatsDashboard Component
// ----------------------------------------------------------
export function StatsDashboard(props: StatsDashboardProps) {
  const [stats, setStats] = useState<FikaStats | null>(props.stats || null);
  const [loading, setLoading] = useState<boolean>(!props.stats);
  const [failedCount, setFailedCount] = useState<number>(0);

  useEffect(() => {
    if (props.stats) {
      setStats(props.stats);
      setLoading(false);
      return;
    }

    if (props.submissions) {
      setStats(calculateStatistics(props.submissions));
      setLoading(false);
      return;
    }

    let isMounted = true;
    getAllSubmissions()
      .then(function (submissions) {
        if (isMounted) {
          setStats(calculateStatistics(submissions));
          const failed = submissions.filter((s) => s.syncStatus === "failed");
          setFailedCount(failed.length);
          setLoading(false);
        }
      })
      .catch(function () {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [props.stats, props.submissions]);

  if (loading) {
    return <div style={styles.loading}>Loading statistics...</div>;
  }

  if (!stats) {
    return <div style={styles.loading}>No statistics available.</div>;
  }

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.title}>Fika Statistics</div>
        <div style={styles.subtitle}>Problem Solving Analytics</div>
      </div>

      {/* FAILED SYNC NOTIFICATION BANNER */}
      {failedCount > 0 && (
        <div
          style={{
            backgroundColor: "#330d0d",
            border: "1px solid #b71c1c",
            color: "#f44336",
            padding: "8px 12px",
            borderRadius: "6px",
            fontSize: "11px",
            marginBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>⚠️ {failedCount} submission(s) failed to sync</span>
        </div>
      )}


      {/* STREAK & TODAY BANNER */}
      <div style={styles.streakBanner}>
        <div>
          <div style={styles.streakLabel}>🔥 Active Streak</div>
          <div style={styles.streakValue}>{stats.currentStreak} Days</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={styles.streakLabel}>Solved Today</div>
          <div style={styles.streakValue}>{stats.todayCount}</div>
        </div>
      </div>

      {/* OVERVIEW CARDS */}
      <div style={styles.grid3}>
        <div style={styles.card}>
          <div style={styles.cardValue}>{stats.totalSolved}</div>
          <div style={styles.cardLabel}>Total</div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardValue}>{stats.thisWeekCount}</div>
          <div style={styles.cardLabel}>This Week</div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardValue}>{stats.thisMonthCount}</div>
          <div style={styles.cardLabel}>This Month</div>
        </div>
      </div>

      {/* DIFFICULTY BREAKDOWN */}
      <div style={styles.sectionTitle}>Difficulty</div>
      <div style={styles.difficultyGrid}>
        <div style={styles.easyCard}>
          <div style={styles.easyText}>{stats.difficultyBreakdown.easy}</div>
          <div style={styles.diffLabel}>Easy</div>
        </div>
        <div style={styles.mediumCard}>
          <div style={styles.mediumText}>{stats.difficultyBreakdown.medium}</div>
          <div style={styles.diffLabel}>Medium</div>
        </div>
        <div style={styles.hardCard}>
          <div style={styles.hardText}>{stats.difficultyBreakdown.hard}</div>
          <div style={styles.diffLabel}>Hard</div>
        </div>
      </div>

      {/* TOPIC DISTRIBUTION */}
      <div style={styles.sectionTitle}>Top Topics</div>
      <DistributionList data={stats.topicBreakdown} maxItems={5} />

      {/* LANGUAGE DISTRIBUTION */}
      <div style={styles.sectionTitle}>Languages</div>
      <DistributionList data={stats.languageBreakdown} maxItems={4} />
    </div>
  );
}

export default StatsDashboard;
