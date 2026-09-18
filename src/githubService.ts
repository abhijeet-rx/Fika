// ============================================================
// Fika - GitHub API Service
//
// Handles all communication with GitHub's REST API.
//
// Responsibilities:
//   - Read file contents from a repository
//   - Create new files in a repository
//   - Update existing files in a repository
//
// This module uses the credentials stored by githubAuth.ts.
// It never stores or handles raw tokens directly — it
// retrieves them from chrome.storage.local via getCredentials().
//
// API Reference:
//   https://docs.github.com/en/rest/repos/contents
//
// ============================================================

import { getCredentials } from "./githubAuth";

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------
const GITHUB_API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

// ----------------------------------------------------------
// Type definitions for API responses
// ----------------------------------------------------------

/** Represents a file read from the GitHub repository */
interface GitHubFileResponse {
  /** The file's name (e.g., "array.md") */
  name: string;

  /** The full path in the repo (e.g., "Easy/Array/array.md") */
  path: string;

  /**
   * The file's SHA hash — a unique identifier for this exact
   * version of the file. Required when updating an existing file.
   *
   * WHY IS SHA NEEDED FOR UPDATES?
   * Git uses SHA hashes to track file versions. When you update
   * a file, GitHub requires the SHA of the version you are
   * replacing. This prevents accidental overwrites — if someone
   * else updated the file between your read and your write,
   * the SHA would not match and GitHub would reject the update.
   * This is called "optimistic concurrency control".
   */
  sha: string;

  /** The file content, Base64 encoded */
  content: string;

  /** The encoding used (always "base64" for file contents) */
  encoding: string;
}

/** Result of a file operation (create or update) */
interface GitHubWriteResult {
  success: boolean;
  /** The commit SHA if successful */
  commitSha: string;
  /** Error message if unsuccessful */
  error: string;
}

/** Result of a file read operation */
interface GitHubReadResult {
  /** Whether the file was found */
  found: boolean;
  /** The decoded file content (empty string if not found) */
  content: string;
  /** The file's SHA hash (empty string if not found) */
  sha: string;
  /** Error message if an error occurred (not including 404) */
  error: string;
}

// ----------------------------------------------------------
// Helper: Build common request headers
// ----------------------------------------------------------
// Every GitHub API request needs these headers:
//   - Authorization: Proves who we are
//   - Accept: Tells GitHub we want JSON responses
//   - X-GitHub-Api-Version: Pins a specific API version so
//     our code doesn't break if GitHub changes their API
// ----------------------------------------------------------
function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": API_VERSION,
  };
}

// ----------------------------------------------------------
// Helper: Build the API URL for a file path
// ----------------------------------------------------------
// Constructs: https://api.github.com/repos/{owner}/{repo}/contents/{path}
//
// encodeURIComponent() is used on each path segment to handle
// special characters (spaces, etc.) in folder or file names.
// ----------------------------------------------------------
function buildContentsUrl(
  owner: string,
  repo: string,
  filePath: string
): string {
  // Split the path into segments, encode each one, rejoin
  const encodedPath = filePath
    .split("/")
    .map(function (segment) {
      return encodeURIComponent(segment);
    })
    .join("/");

  return `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodedPath}`;
}

// ----------------------------------------------------------
// Helper: Encode a string to Base64
// ----------------------------------------------------------
// GitHub requires file content to be Base64 encoded in the
// PUT request body.
//
// WHY NOT JUST USE btoa()?
// btoa() fails on strings containing non-ASCII characters
// (e.g., accented letters, emoji, Unicode). We first encode
// the string to UTF-8 bytes, then Base64-encode those bytes.
// ----------------------------------------------------------
function encodeToBase64(text: string): string {
  // TextEncoder converts a string to a Uint8Array of UTF-8 bytes
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  // Convert the byte array to a binary string
  let binaryString = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }

  // btoa() converts a binary string to Base64
  return btoa(binaryString);
}

// ----------------------------------------------------------
// Helper: Decode Base64 to a string
// ----------------------------------------------------------
// GitHub returns file content as Base64. We decode it back
// to a readable string.
//
// GitHub also adds line breaks (\n) inside the Base64 string
// for readability. We strip those before decoding.
// ----------------------------------------------------------
function decodeFromBase64(base64: string): string {
  // Remove any whitespace/newlines GitHub adds
  const cleaned = base64.replace(/\s/g, "");

  // atob() converts Base64 to a binary string
  const binaryString = atob(cleaned);

  // Convert binary string to a Uint8Array
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // TextDecoder converts UTF-8 bytes back to a string
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

// ----------------------------------------------------------
// 1. READ: Get a file's content from the repository
// ----------------------------------------------------------
//
// Sends: GET /repos/{owner}/{repo}/contents/{path}
//
// Possible responses:
//   200 OK       → File exists. Returns content + SHA.
//   404 Not Found → File does not exist. This is NOT an error
//                   for Fika — it means we need to CREATE the
//                   file instead of updating it.
//   401/403      → Authentication problem.
//
// ----------------------------------------------------------
export async function readFile(filePath: string): Promise<GitHubReadResult> {
  const credentials = await getCredentials();

  if (!credentials) {
    return {
      found: false,
      content: "",
      sha: "",
      error: "GitHub credentials not configured. Please set up your token in Fika settings.",
    };
  }

  const url = buildContentsUrl(credentials.owner, credentials.repo, filePath);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(credentials.token),
    });

    // 404 means the file doesn't exist yet — this is normal
    if (response.status === 404) {
      return {
        found: false,
        content: "",
        sha: "",
        error: "",
      };
    }

    if (!response.ok) {
      return {
        found: false,
        content: "",
        sha: "",
        error: "GitHub API error: " + response.status + " " + response.statusText,
      };
    }

    const data: GitHubFileResponse = await response.json();

    return {
      found: true,
      content: decodeFromBase64(data.content),
      sha: data.sha,
      error: "",
    };
  } catch (err) {
    return {
      found: false,
      content: "",
      sha: "",
      error: "Network error: " + (err instanceof Error ? err.message : String(err)),
    };
  }
}

// ----------------------------------------------------------
// 2. CREATE: Create a new file in the repository
// ----------------------------------------------------------
//
// Sends: PUT /repos/{owner}/{repo}/contents/{path}
// Body:  { message, content }  (no SHA — this is a new file)
//
// GitHub automatically creates any intermediate directories
// that don't exist. So creating "Easy/Array/array.md" will
// create the Easy/ and Array/ folders if needed.
//
// ----------------------------------------------------------
export async function createFile(
  filePath: string,
  content: string,
  commitMessage: string
): Promise<GitHubWriteResult> {
  const credentials = await getCredentials();

  if (!credentials) {
    return {
      success: false,
      commitSha: "",
      error: "GitHub credentials not configured.",
    };
  }

  const url = buildContentsUrl(credentials.owner, credentials.repo, filePath);

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: buildHeaders(credentials.token),
      body: JSON.stringify({
        message: commitMessage,
        content: encodeToBase64(content),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        commitSha: "",
        error: "GitHub API error " + response.status + ": " + errorBody,
      };
    }

    const data = await response.json();

    return {
      success: true,
      commitSha: data.commit?.sha || "",
      error: "",
    };
  } catch (err) {
    return {
      success: false,
      commitSha: "",
      error: "Network error: " + (err instanceof Error ? err.message : String(err)),
    };
  }
}

// ----------------------------------------------------------
// 3. UPDATE: Update an existing file in the repository
// ----------------------------------------------------------
//
// Sends: PUT /repos/{owner}/{repo}/contents/{path}
// Body:  { message, content, sha }
//
// The SHA is REQUIRED for updates. It tells GitHub which
// version of the file we are replacing. If the SHA doesn't
// match the current file (because someone else updated it),
// GitHub returns 409 Conflict.
//
// ----------------------------------------------------------
export async function updateFile(
  filePath: string,
  content: string,
  sha: string,
  commitMessage: string
): Promise<GitHubWriteResult> {
  const credentials = await getCredentials();

  if (!credentials) {
    return {
      success: false,
      commitSha: "",
      error: "GitHub credentials not configured.",
    };
  }

  const url = buildContentsUrl(credentials.owner, credentials.repo, filePath);

  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: buildHeaders(credentials.token),
      body: JSON.stringify({
        message: commitMessage,
        content: encodeToBase64(content),
        sha: sha,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        commitSha: "",
        error: "GitHub API error " + response.status + ": " + errorBody,
      };
    }

    const data = await response.json();

    return {
      success: true,
      commitSha: data.commit?.sha || "",
      error: "",
    };
  } catch (err) {
    return {
      success: false,
      commitSha: "",
      error: "Network error: " + (err instanceof Error ? err.message : String(err)),
    };
  }
}

// ----------------------------------------------------------
// 4. UPSERT: Create or update a file (convenience function)
// ----------------------------------------------------------
//
// This combines readFile + createFile/updateFile into a
// single operation. It handles the common workflow:
//
//   1. Try to read the file (to check if it exists)
//   2. If it exists  → update it (append new content)
//   3. If it doesn't → create it
//
// The appendContent function receives the existing content
// (or empty string for new files) and returns the final
// content to write. This lets the caller decide how to
// merge new data with existing data (e.g., appending with
// a horizontal rule separator).
// ----------------------------------------------------------
export async function upsertFile(
  filePath: string,
  appendContent: (existingContent: string) => string,
  commitMessage: string
): Promise<GitHubWriteResult> {
  // Step 1: Check if the file already exists
  const readResult = await readFile(filePath);

  if (readResult.error) {
    return {
      success: false,
      commitSha: "",
      error: "Failed to check existing file: " + readResult.error,
    };
  }

  // Step 2: Compute the final content
  const finalContent = appendContent(readResult.content);

  // Step 3: Create or update based on whether the file exists
  if (readResult.found) {
    // File exists — update it (requires SHA)
    return updateFile(filePath, finalContent, readResult.sha, commitMessage);
  } else {
    // File doesn't exist — create it
    return createFile(filePath, finalContent, commitMessage);
  }
}
