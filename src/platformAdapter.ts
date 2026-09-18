// ============================================================
// Fika - Common Platform Adapter Interface
//
// Defines the common contract for all platform extraction adapters
// (LeetCode, GeeksforGeeks, Codeforces, CodeChef, etc.).
//
// Every adapter must implement this interface to:
//   1. Identify if a URL matches its platform
//   2. Detect when a submission has been accepted
//   3. Extract DOM data and convert it into a CodingProblem
//
// ============================================================

import { CodingProblem, Platform } from "./types";

// ----------------------------------------------------------
// Common Platform Adapter Interface
// ----------------------------------------------------------
export interface PlatformAdapter {
  /** The canonical name of the platform (e.g. "LeetCode", "GeeksforGeeks") */
  readonly platformName: Platform;

  /**
   * Check if a given URL string belongs to this platform.
   * Example: "https://leetcode.com/problems/two-sum/" -> true
   */
  matchesUrl(url: string): boolean;

  /**
   * Check if the current DOM page shows an accepted submission state.
   */
  isAccepted(): boolean;

  /**
   * Extract DOM content and return a normalized CodingProblem object.
   * May return a Promise if extraction requires async DOM checks.
   */
  extractProblem(): CodingProblem | Promise<CodingProblem>;

  /**
   * Optional: Initialize a MutationObserver or DOM event listener
   * to automatically notify when an accepted submission occurs.
   */
  startObserving?(onAccepted: (problem: CodingProblem) => void): void;

  /**
   * Optional: Stop observers and clean up event listeners.
   */
  stopObserving?(): void;
}

// ----------------------------------------------------------
// Platform Adapter Registry
// ----------------------------------------------------------
// Manages all registered platform adapters and routes incoming
// URLs to the correct adapter.
// ----------------------------------------------------------
export class AdapterRegistry {
  private adapters: PlatformAdapter[] = [];

  /**
   * Register a new platform adapter instance.
   */
  register(adapter: PlatformAdapter): void {
    // Avoid duplicate registration of the same platform
    const existing = this.adapters.find(
      (a) => a.platformName === adapter.platformName
    );
    if (!existing) {
      this.adapters.push(adapter);
    }
  }

  /**
   * Find the matching adapter for a given URL string.
   * Returns null if no platform adapter matches.
   */
  getAdapterForUrl(url: string): PlatformAdapter | null {
    for (let i = 0; i < this.adapters.length; i++) {
      if (this.adapters[i].matchesUrl(url)) {
        return this.adapters[i];
      }
    }
    return null;
  }

  /**
   * Get all registered platform adapters.
   */
  getRegisteredAdapters(): PlatformAdapter[] {
    return [...this.adapters];
  }
}

// Global registry instance
export const globalAdapterRegistry = new AdapterRegistry();
