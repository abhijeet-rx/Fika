// ============================================================
// Fika - Local Storage Service
//
// Manages Fika's local submission metadata in chrome.storage.local.
//
// Responsibilities:
//   - Save problem submission metadata locally after sync
//   - Retrieve all local submission metadata for statistics calculation
//   - Query metadata for fast local duplicate checks
//   - Track sync status ("synced" | "pending" | "failed")
//
// Key Design Principles:
//   - Stores metadata ONLY (no raw solution code or HTML statements)
//   - Uses composite key "platform:problemId" (e.g. "LeetCode:1")
//   - Asynchronous API wrapped in Promises
//
// ============================================================

import { CodingProblem, Difficulty, Platform } from "./types";

// ----------------------------------------------------------
// Storage Key Constant
// ----------------------------------------------------------
const STORAGE_KEY_SUBMISSIONS = "fika_submissions_map";

// ----------------------------------------------------------
// Sync Status Union Type
// ----------------------------------------------------------
export type SyncStatus = "synced" | "pending" | "failed";

// ----------------------------------------------------------
// Problem Metadata Interface (Statistics Data Model)
// ----------------------------------------------------------
export interface ProblemMetadata {
  /** Composite primary key: "Platform:ProblemId" (e.g. "LeetCode:1") */
  key: string;

  /** Platform where problem was solved */
  platform: Platform;

  /** Unique identifier on the platform */
  problemId: string;

  /** Problem title */
  title: string;

  /** Normalized difficulty */
  difficulty: Difficulty;

  /** Topic tags */
  topics: string[];

  /** Programming language used */
  language: string;

  /** ISO 8601 timestamp of accepted submission */
  acceptedAt: string;

  /** Repository relative path (e.g. "Easy/Array/array.md") */
  githubPath: string;

  /** Current synchronization status */
  syncStatus: SyncStatus;

  /** Error message if sync failed */
  error?: string;
}

/** Map dictionary type for internal storage */
type SubmissionsMap = Record<string, ProblemMetadata>;

// ----------------------------------------------------------
// Helper: Construct composite key
// ----------------------------------------------------------
export function getSubmissionKey(platform: string, problemId: string): string {
  return `${platform}:${problemId}`;
}

// ----------------------------------------------------------
// Internal Helper: Read submissions map from chrome.storage.local
// ----------------------------------------------------------
function getSubmissionsMap(): Promise<SubmissionsMap> {
  return new Promise(function (resolve, reject) {
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.local
    ) {
      resolve({});
      return;
    }

    chrome.storage.local.get([STORAGE_KEY_SUBMISSIONS], function (result) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result[STORAGE_KEY_SUBMISSIONS] || {});
    });
  });
}

// ----------------------------------------------------------
// Internal Helper: Write submissions map to chrome.storage.local
// ----------------------------------------------------------
function setSubmissionsMap(map: SubmissionsMap): Promise<void> {
  return new Promise(function (resolve, reject) {
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.local
    ) {
      resolve();
      return;
    }

    chrome.storage.local.set(
      { [STORAGE_KEY_SUBMISSIONS]: map },
      function () {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      }
    );
  });
}

// ----------------------------------------------------------
// 1. Save or Update Problem Metadata
// ----------------------------------------------------------
// Creates a ProblemMetadata record from a CodingProblem and saves
// it into chrome.storage.local.
// ----------------------------------------------------------
export async function saveProblemMetadata(
  problem: CodingProblem,
  githubPath: string,
  syncStatus: SyncStatus,
  error?: string
): Promise<ProblemMetadata> {
  const map = await getSubmissionsMap();

  const key = getSubmissionKey(problem.platform, problem.problemId);

  const metadata: ProblemMetadata = {
    key: key,
    platform: problem.platform,
    problemId: problem.problemId,
    title: problem.title,
    difficulty: problem.difficulty,
    topics: problem.topics || [],
    language: problem.language,
    acceptedAt: problem.acceptedAt || new Date().toISOString(),
    githubPath: githubPath,
    syncStatus: syncStatus,
    error: error || "",
  };

  map[key] = metadata;
  await setSubmissionsMap(map);

  return metadata;
}

// ----------------------------------------------------------
// 2. Get Metadata for a Single Problem
// ----------------------------------------------------------
// Returns null if the problem has not been stored locally.
// ----------------------------------------------------------
export async function getProblemMetadata(
  platform: string,
  problemId: string
): Promise<ProblemMetadata | null> {
  const map = await getSubmissionsMap();
  const key = getSubmissionKey(platform, problemId);
  return map[key] || null;
}

// ----------------------------------------------------------
// 3. Get All Stored Submissions
// ----------------------------------------------------------
// Returns an array of all stored ProblemMetadata objects.
// Used directly by the statistics engine.
// ----------------------------------------------------------
export async function getAllSubmissions(): Promise<ProblemMetadata[]> {
  const map = await getSubmissionsMap();
  return Object.values(map);
}

// ----------------------------------------------------------
// 4. Update Sync Status of an Existing Entry
// ----------------------------------------------------------
// Allows updating status (e.g. from "pending" to "synced")
// without re-passing the entire problem object.
// ----------------------------------------------------------
export async function updateSyncStatus(
  platform: string,
  problemId: string,
  status: SyncStatus,
  error?: string
): Promise<boolean> {
  const map = await getSubmissionsMap();
  const key = getSubmissionKey(platform, problemId);

  if (!map[key]) {
    return false;
  }

  map[key].syncStatus = status;
  if (error !== undefined) {
    map[key].error = error;
  }

  await setSubmissionsMap(map);
  return true;
}

// ----------------------------------------------------------
// 5. Fast Check: Has Problem Been Synced?
// ----------------------------------------------------------
// Returns true only if metadata exists AND syncStatus === "synced".
// ----------------------------------------------------------
export async function hasProblemBeenSynced(
  platform: string,
  problemId: string
): Promise<boolean> {
  const metadata = await getProblemMetadata(platform, problemId);
  return metadata !== null && metadata.syncStatus === "synced";
}

// ----------------------------------------------------------
// 7. Get All Failed Submissions
// ----------------------------------------------------------
// Returns an array of ProblemMetadata objects that failed to sync.
// ----------------------------------------------------------
export async function getFailedSubmissions(): Promise<ProblemMetadata[]> {
  const map = await getSubmissionsMap();
  return Object.values(map).filter((sub) => sub.syncStatus === "failed");
}

