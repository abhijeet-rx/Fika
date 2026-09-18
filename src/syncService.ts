// ============================================================
// Fika - Synchronization Orchestrator
//
// Master pipeline orchestrator that connects all Fika components:
//   1. Path Generator (pathGenerator.ts)
//   2. Duplicate Detector (duplicateDetector.ts)
//   3. GitHub Service (githubService.ts)
//   4. Storage Service (storageService.ts)
//
// Full Pipeline Execution:
//   CodingProblem
//     ├─► 1. generateFilePathFromProblem() -> repo path
//     ├─► 2. readFile() from GitHub API
//     ├─► 3. processDuplicateDetection() -> check duplicate/update/create
//     ├─► 4. updateFile() or createFile() on GitHub (if changed)
//     └─► 5. saveProblemMetadata() in chrome.storage.local
//
// ============================================================

import { CodingProblem } from "./types";
import { generateFilePathFromProblem } from "./pathGenerator";
import { processDuplicateDetection, DuplicateCheckResult } from "./duplicateDetector";
import { readFile, createFile, updateFile } from "./githubService";
import { saveProblemMetadata } from "./storageService";

// ----------------------------------------------------------
// Result Interface for Synchronization Pipeline
// ----------------------------------------------------------
export interface SyncResult {
  /** Indicates whether the synchronization operation succeeded */
  success: boolean;

  /** Action taken: "created" | "updated" | "skipped" */
  action: "created" | "updated" | "skipped";

  /** The target repository relative file path */
  filePath: string;

  /** The Git commit SHA returned by GitHub (empty if skipped or failed) */
  commitSha: string;

  /** Human-readable error message if operation failed */
  error: string;
}

// ----------------------------------------------------------
// Helper: Generate descriptive Git commit message
// ----------------------------------------------------------
function generateCommitMessage(
  problem: CodingProblem,
  action: "created" | "updated"
): string {
  const actionPrefix = action === "created" ? "Add" : "Update";
  return `${actionPrefix} ${problem.platform} ${problem.problemId}: ${problem.title} [${problem.difficulty}]`;
}

// ----------------------------------------------------------
// Main Synchronization Orchestration Function
// ----------------------------------------------------------
export async function syncProblemToGitHub(
  problem: CodingProblem
): Promise<SyncResult> {
  // Step 1: Compute target repository file path
  const filePath = generateFilePathFromProblem(problem);

  try {
    // Step 2: Read existing file content from GitHub repository
    const readResult = await readFile(filePath);

    if (readResult.error) {
      // Record failure status in local storage
      await saveProblemMetadata(problem, filePath, "failed", readResult.error);

      return {
        success: false,
        action: "created",
        filePath: filePath,
        commitSha: "",
        error: readResult.error,
      };
    }

    // Step 3: Run Duplicate Detector on existing content vs new problem
    const detectionResult: DuplicateCheckResult = processDuplicateDetection(
      readResult.content,
      problem
    );

    // Scenario A: Problem already exists with IDENTICAL code -> SKIP write!
    if (detectionResult.action === "skipped") {
      console.log(
        `[Fika Sync] Problem ${problem.platform} #${problem.problemId} (${problem.title}) is identical. Skipping GitHub commit.`
      );

      // Record synced status in local storage cache
      await saveProblemMetadata(problem, filePath, "synced");

      return {
        success: true,
        action: "skipped",
        filePath: filePath,
        commitSha: readResult.sha,
        error: "",
      };
    }

    // Scenario B & C: Problem is NEW ("created") or CODE CHANGED ("updated")
    const commitMessage = generateCommitMessage(problem, detectionResult.action);

    let writeResult;
    if (readResult.found) {
      // Update existing file on GitHub (passing version SHA)
      writeResult = await updateFile(
        filePath,
        detectionResult.content,
        readResult.sha,
        commitMessage
      );
    } else {
      // Create brand new file on GitHub
      writeResult = await createFile(
        filePath,
        detectionResult.content,
        commitMessage
      );
    }

    if (!writeResult.success) {
      // Save failed status in local storage
      await saveProblemMetadata(problem, filePath, "failed", writeResult.error);

      return {
        success: false,
        action: detectionResult.action,
        filePath: filePath,
        commitSha: "",
        error: writeResult.error,
      };
    }

    // Step 4: Save success state to local storage database for statistics
    await saveProblemMetadata(problem, filePath, "synced");

    console.log(
      `[Fika Sync] ✅ Successfully synced ${problem.platform} #${problem.problemId} (${problem.title}) -> ${filePath} [Action: ${detectionResult.action}]`
    );

    return {
      success: true,
      action: detectionResult.action,
      filePath: filePath,
      commitSha: writeResult.commitSha,
      error: "",
    };
  } catch (err) {
    const errorMsg =
      "Pipeline exception: " + (err instanceof Error ? err.message : String(err));

    await saveProblemMetadata(problem, filePath, "failed", errorMsg);

    return {
      success: false,
      action: "created",
      filePath: filePath,
      commitSha: "",
      error: errorMsg,
    };
  }
}
