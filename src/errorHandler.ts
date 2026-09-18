// ============================================================
// Fika - Centralized Error Handler
//
// Manages error categorization, logging, developer diagnostics,
// and user-facing message formatting across the Fika extension.
//
// Handles 12 Failure Scenarios:
//   1. LeetCode extraction fails
//   2. Code extraction fails
//   3. Test case extraction fails
//   4. GitHub authentication fails
//   5. GitHub API fails
//   6. Repository doesn't exist
//   7. Branch doesn't exist
//   8. File doesn't exist
//   9. Network unavailable
//  10. Duplicate problem
//  11. Unsupported language
//  12. Unsupported platform
//
// ============================================================

// ----------------------------------------------------------
// Error Category Union Type
// ----------------------------------------------------------
export type FikaErrorCategory =
  | "EXTRACTION_FAILED"
  | "CODE_EXTRACTION_FAILED"
  | "TESTCASE_EXTRACTION_FAILED"
  | "AUTH_FAILED"
  | "GITHUB_API_ERROR"
  | "REPO_NOT_FOUND"
  | "BRANCH_NOT_FOUND"
  | "FILE_NOT_FOUND"
  | "NETWORK_UNAVAILABLE"
  | "DUPLICATE_PROBLEM"
  | "UNSUPPORTED_LANGUAGE"
  | "UNSUPPORTED_PLATFORM";

// ----------------------------------------------------------
// Standardized Fika Error Info Interface
// ----------------------------------------------------------
export interface FikaErrorInfo {
  /** Error classification category */
  category: FikaErrorCategory;

  /** Clean, friendly message designed for display in user UI */
  userMessage: string;

  /** Detailed diagnostic info for console logging / developer debugging */
  developerDetails: string;

  /** Timestamp of when error occurred */
  timestamp: string;

  /** Indicates whether the operation can be retried */
  recoverable: boolean;
}

// ----------------------------------------------------------
// Error Definition Mapping Dictionary
// ----------------------------------------------------------
const ERROR_DEFINITIONS: Record<
  FikaErrorCategory,
  { userMessage: string; defaultDetails: string; recoverable: boolean }
> = {
  EXTRACTION_FAILED: {
    userMessage: "Failed to extract problem details from the page.",
    defaultDetails: "DOM elements for problem title or ID could not be located using fallback selectors.",
    recoverable: true,
  },
  CODE_EXTRACTION_FAILED: {
    userMessage: "Solution code could not be read from the editor.",
    defaultDetails: "Monaco/Ace editor line elements (.view-line / .ace_line) were missing or empty.",
    recoverable: true,
  },
  TESTCASE_EXTRACTION_FAILED: {
    userMessage: "Example test cases could not be parsed.",
    defaultDetails: "Regex pattern matching Input/Output pairs failed to find structured examples in statement.",
    recoverable: true,
  },
  AUTH_FAILED: {
    userMessage: "GitHub authentication failed. Please check your Personal Access Token in Settings.",
    defaultDetails: "GitHub API returned 401 Unauthorized or 403 Forbidden on credential check.",
    recoverable: true,
  },
  GITHUB_API_ERROR: {
    userMessage: "GitHub API returned an error while saving your solution.",
    defaultDetails: "GitHub REST API returned a non-2xx HTTP response status code.",
    recoverable: true,
  },
  REPO_NOT_FOUND: {
    userMessage: "Target GitHub repository was not found. Please verify repo name in Settings.",
    defaultDetails: "GitHub returned 404 Not Found for configured owner/repo path.",
    recoverable: true,
  },
  BRANCH_NOT_FOUND: {
    userMessage: "Target Git branch does not exist on your repository.",
    defaultDetails: "Reference lookup for branch failed on target GitHub repository.",
    recoverable: true,
  },
  FILE_NOT_FOUND: {
    userMessage: "Target repository file was not found.",
    defaultDetails: "GET request for repo file contents returned 404 Not Found (normal for new topic files).",
    recoverable: true,
  },
  NETWORK_UNAVAILABLE: {
    userMessage: "Network unavailable. Please check your internet connection.",
    defaultDetails: "Fetch API thrown TypeError (Offline, DNS failure, or CORS blocked).",
    recoverable: true,
  },
  DUPLICATE_PROBLEM: {
    userMessage: "This problem solution is already synchronized with GitHub.",
    defaultDetails: "Duplicate detector found identical solution code for platform + problemId key.",
    recoverable: false,
  },
  UNSUPPORTED_LANGUAGE: {
    userMessage: "Programming language is not recognized.",
    defaultDetails: "Extracted language string was missing or not in known language map.",
    recoverable: true,
  },
  UNSUPPORTED_PLATFORM: {
    userMessage: "Current website is not a supported coding platform.",
    defaultDetails: "URL hostname did not match any registered platform adapter.",
    recoverable: false,
  },
};

// ----------------------------------------------------------
// Core Error Handler Function
// ----------------------------------------------------------
// Constructs a standardized FikaErrorInfo object and logs
// comprehensive diagnostic details to the developer console.
// ----------------------------------------------------------
export function handleFikaError(
  category: FikaErrorCategory,
  customDetails?: string,
  rawError?: unknown
): FikaErrorInfo {
  const def = ERROR_DEFINITIONS[category];

  const developerDetails = customDetails
    ? `${def.defaultDetails} (${customDetails})`
    : def.defaultDetails;

  const errorInfo: FikaErrorInfo = {
    category: category,
    userMessage: def.userMessage,
    developerDetails: developerDetails,
    timestamp: new Date().toISOString(),
    recoverable: def.recoverable,
  };

  // ---- Developer Console Logging ----
  console.groupCollapsed(`[Fika Error] ⚠️ ${category}`);
  console.error("User Message:", errorInfo.userMessage);
  console.error("Developer Details:", errorInfo.developerDetails);
  console.log("Timestamp:", errorInfo.timestamp);
  console.log("Recoverable:", errorInfo.recoverable);

  if (rawError) {
    console.error("Raw Stack / Exception:", rawError);
  }
  console.groupEnd();

  return errorInfo;
}

// ----------------------------------------------------------
// Category-Specific Helper Factories
// ----------------------------------------------------------

export function handleExtractionError(details?: string, err?: unknown): FikaErrorInfo {
  return handleFikaError("EXTRACTION_FAILED", details, err);
}

export function handleCodeExtractionError(details?: string, err?: unknown): FikaErrorInfo {
  return handleFikaError("CODE_EXTRACTION_FAILED", details, err);
}

export function handleAuthError(details?: string, err?: unknown): FikaErrorInfo {
  return handleFikaError("AUTH_FAILED", details, err);
}

export function handleGitHubApiError(statusCode: number, details?: string): FikaErrorInfo {
  if (statusCode === 401 || statusCode === 403) {
    return handleFikaError("AUTH_FAILED", `HTTP Status ${statusCode}: ${details || ''}`);
  }
  if (statusCode === 404) {
    return handleFikaError("REPO_NOT_FOUND", `HTTP Status ${statusCode}: ${details || ''}`);
  }
  return handleFikaError("GITHUB_API_ERROR", `HTTP Status ${statusCode}: ${details || ''}`);
}

export function handleNetworkError(err?: unknown): FikaErrorInfo {
  const details = err instanceof Error ? err.message : String(err || "");
  return handleFikaError("NETWORK_UNAVAILABLE", details, err);
}

export function handleDuplicateError(problemId: string): FikaErrorInfo {
  return handleFikaError("DUPLICATE_PROBLEM", `Problem ID: ${problemId}`);
}

export function handleUnsupportedPlatformError(url: string): FikaErrorInfo {
  return handleFikaError("UNSUPPORTED_PLATFORM", `URL: ${url}`);
}
