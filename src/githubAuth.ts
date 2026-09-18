// ============================================================
// Fika - GitHub Authentication Service
//
// Manages the user's GitHub Personal Access Token (PAT).
//
// Responsibilities:
//   - Store the PAT securely in chrome.storage.local
//   - Retrieve the PAT for API requests
//   - Validate the PAT by calling GitHub's API
//   - Store the target repository owner and name
//   - Clear credentials when the user logs out
//
// SECURITY NOTES:
//   - The PAT is NEVER hardcoded in source code.
//   - The PAT is stored in chrome.storage.local, which is:
//       • Isolated to this extension (other extensions cannot read it)
//       • Encrypted at rest by Chrome (tied to the OS user profile)
//       • Persistent across browser restarts
//   - The PAT is only sent to https://api.github.com (declared
//     in manifest.json host_permissions).
//   - The user generates the PAT on GitHub with minimal
//     permissions: "Contents: Read and write" on one repository.
//
// ============================================================

// ----------------------------------------------------------
// Storage key constants
// ----------------------------------------------------------
// We use descriptive key names prefixed with "fika_" to avoid
// collisions with any other data in chrome.storage.local.
// ----------------------------------------------------------
const STORAGE_KEYS = {
  GITHUB_TOKEN: "fika_github_token",
  GITHUB_OWNER: "fika_github_owner",
  GITHUB_REPO: "fika_github_repo",
  GITHUB_USERNAME: "fika_github_username",
};

// ----------------------------------------------------------
// Type definitions for GitHub credentials
// ----------------------------------------------------------

/** The complete set of GitHub credentials Fika needs */
interface GitHubCredentials {
  /** The Personal Access Token (e.g., "ghp_xxxx...") */
  token: string;

  /** The GitHub username of the token owner (e.g., "abhijeet-rx") */
  username: string;

  /** The repository owner (usually same as username) */
  owner: string;

  /** The repository name (e.g., "Leetcode-solutions-") */
  repo: string;
}

/** Result of a token validation attempt */
interface ValidationResult {
  valid: boolean;
  username: string;
  error: string;
}

// ----------------------------------------------------------
// Save GitHub credentials to chrome.storage.local
// ----------------------------------------------------------
// chrome.storage.local.set() accepts an object of key-value
// pairs and stores them persistently. The callback fires
// after the write completes.
//
// We wrap Chrome's callback-based API in a Promise so we can
// use modern async/await syntax in the rest of Fika.
// ----------------------------------------------------------
export function saveCredentials(credentials: GitHubCredentials): Promise<void> {
  return new Promise(function (resolve, reject) {
    chrome.storage.local.set(
      {
        [STORAGE_KEYS.GITHUB_TOKEN]: credentials.token,
        [STORAGE_KEYS.GITHUB_OWNER]: credentials.owner,
        [STORAGE_KEYS.GITHUB_REPO]: credentials.repo,
        [STORAGE_KEYS.GITHUB_USERNAME]: credentials.username,
      },
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
// Retrieve GitHub credentials from chrome.storage.local
// ----------------------------------------------------------
// Returns null if no credentials are stored (user has not
// configured Fika yet).
// ----------------------------------------------------------
export function getCredentials(): Promise<GitHubCredentials | null> {
  return new Promise(function (resolve, reject) {
    chrome.storage.local.get(
      [
        STORAGE_KEYS.GITHUB_TOKEN,
        STORAGE_KEYS.GITHUB_OWNER,
        STORAGE_KEYS.GITHUB_REPO,
        STORAGE_KEYS.GITHUB_USERNAME,
      ],
      function (result) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        const token = result[STORAGE_KEYS.GITHUB_TOKEN];
        const owner = result[STORAGE_KEYS.GITHUB_OWNER];
        const repo = result[STORAGE_KEYS.GITHUB_REPO];
        const username = result[STORAGE_KEYS.GITHUB_USERNAME];

        // If any required field is missing, credentials are incomplete
        if (!token || !owner || !repo) {
          resolve(null);
          return;
        }

        resolve({
          token: token,
          owner: owner,
          repo: repo,
          username: username || "",
        });
      }
    );
  });
}

// ----------------------------------------------------------
// Validate a GitHub PAT by calling the GitHub API
// ----------------------------------------------------------
// We call GET https://api.github.com/user which returns the
// authenticated user's profile. This endpoint:
//   - Requires a valid token (returns 401 if invalid)
//   - Returns the username (which we store for display)
//   - Does not modify anything (safe GET request)
//
// Why not just store the token without validation?
// If the user pastes an expired, revoked, or mistyped token,
// Fika would silently fail on every push attempt. Validating
// upfront gives immediate feedback.
// ----------------------------------------------------------
export async function validateToken(token: string): Promise<ValidationResult> {
  try {
    const response = await fetch("https://api.github.com/user", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          valid: false,
          username: "",
          error: "Invalid or expired token. Please generate a new token.",
        };
      }
      if (response.status === 403) {
        return {
          valid: false,
          username: "",
          error: "Token does not have sufficient permissions.",
        };
      }
      return {
        valid: false,
        username: "",
        error: "GitHub API returned status " + response.status,
      };
    }

    const data = await response.json();

    return {
      valid: true,
      username: data.login || "",
      error: "",
    };
  } catch (err) {
    return {
      valid: false,
      username: "",
      error: "Network error: Unable to reach GitHub. Check your connection.",
    };
  }
}

// ----------------------------------------------------------
// Validate Token AND Target Repository Access
// ----------------------------------------------------------
// Verifies that:
//   1. The token is valid and authenticated
//   2. The target repository (owner/repo) exists
//   3. The token has access permissions to the repository
// ----------------------------------------------------------
export async function validateRepository(
  token: string,
  owner: string,
  repo: string
): Promise<ValidationResult> {
  // Step 1: Validate token and get username
  const tokenResult = await validateToken(token);
  if (!tokenResult.valid) {
    return tokenResult;
  }

  // Step 2: Validate target repository exists and is accessible
  try {
    const encodedOwner = encodeURIComponent(owner);
    const encodedRepo = encodeURIComponent(repo);
    const repoUrl = `https://api.github.com/repos/${encodedOwner}/${encodedRepo}`;

    const response = await fetch(repoUrl, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          valid: false,
          username: tokenResult.username,
          error: `Repository '${owner}/${repo}' not found or is private/inaccessible with this token.`,
        };
      }
      if (response.status === 403) {
        return {
          valid: false,
          username: tokenResult.username,
          error: `Token does not have sufficient access permissions for repository '${owner}/${repo}'.`,
        };
      }
      return {
        valid: false,
        username: tokenResult.username,
        error: `GitHub API error (${response.status}) checking repository '${owner}/${repo}'.`,
      };
    }

    return {
      valid: true,
      username: tokenResult.username,
      error: "",
    };
  } catch (err) {
    return {
      valid: false,
      username: tokenResult.username,
      error: "Network error: Unable to verify repository on GitHub.",
    };
  }
}


// ----------------------------------------------------------
// Clear all stored credentials (logout)
// ----------------------------------------------------------
export function clearCredentials(): Promise<void> {
  return new Promise(function (resolve, reject) {
    chrome.storage.local.remove(
      [
        STORAGE_KEYS.GITHUB_TOKEN,
        STORAGE_KEYS.GITHUB_OWNER,
        STORAGE_KEYS.GITHUB_REPO,
        STORAGE_KEYS.GITHUB_USERNAME,
      ],
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
// Check if credentials are configured
// ----------------------------------------------------------
export async function isAuthenticated(): Promise<boolean> {
  const credentials = await getCredentials();
  return credentials !== null;
}
