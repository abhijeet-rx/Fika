// ============================================================
// Fika - GitHub Repository Path Generator
//
// Determines where a problem's Markdown content should be
// stored in the GitHub repository based on:
//   1. Difficulty (Easy / Medium / Hard)
//   2. Primary topic (first topic tag)
//
// This is a PURE module — no side effects, no API calls.
// It only computes file paths from problem metadata.
//
// Repository structure:
//   {Difficulty}/{TopicFolder}/{topic_file}.md
//
// Examples:
//   Easy/Array/array.md
//   Medium/Graph/graph.md
//   Hard/DynamicProgramming/dp.md
// ============================================================

import { CodingProblem, Difficulty } from "./types";

// ----------------------------------------------------------
// Topic abbreviation map
// ----------------------------------------------------------
// Some topic names are long and produce awkward file names.
// We map them to clean short names for the .md file.
//
// The FOLDER name keeps the full PascalCase form for clarity
// when browsing the repo. Only the FILE name is abbreviated.
//
// If a topic is not in this map, the file name is the
// lowercase version of the folder name.
// ----------------------------------------------------------
const TOPIC_FILE_ABBREVIATIONS: Record<string, string> = {
  "DynamicProgramming": "dp",
  "BreadthFirstSearch": "bfs",
  "DepthFirstSearch": "dfs",
  "BinarySearch": "binarysearch",
  "TwoPointers": "twopointers",
  "SlidingWindow": "slidingwindow",
  "LinkedList": "linkedlist",
  "BinaryTree": "binarytree",
  "BinarySearchTree": "bst",
  "HashTable": "hashtable",
  "DivideAndConquer": "divideandconquer",
  "BackTracking": "backtracking",
  "UnionFind": "unionfind",
  "MonotonicStack": "monotonicstack",
  "MonotonicQueue": "monotonicqueue",
  "OrderedSet": "orderedset",
  "TopologicalSort": "topologicalsort",
  "ShortestPath": "shortestpath",
  "BitManipulation": "bitmanipulation",
};

// ----------------------------------------------------------
// Normalize a topic name into a safe PascalCase folder name
// ----------------------------------------------------------
// Input:  "Dynamic Programming"  →  Output: "DynamicProgramming"
// Input:  "Hash Table"           →  Output: "HashTable"
// Input:  "Breadth-First Search" →  Output: "BreadthFirstSearch"
// Input:  "Array"                →  Output: "Array"
//
// Steps:
//   1. Split by spaces, hyphens, or underscores
//   2. Capitalize the first letter of each word
//   3. Join without separators
//   4. Remove any remaining non-alphanumeric characters
// ----------------------------------------------------------
function normalizeTopicToFolderName(topic: string): string {
  return topic
    .split(/[\s\-_]+/)
    .map(function (word) {
      if (word.length === 0) return "";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("")
    .replace(/[^a-zA-Z0-9]/g, "");
}

// ----------------------------------------------------------
// Get the file name for a topic
// ----------------------------------------------------------
// Check the abbreviation map first. If no abbreviation exists,
// use the lowercase version of the folder name.
//
// Input folder: "DynamicProgramming"  →  Output: "dp"
// Input folder: "Array"               →  Output: "array"
// Input folder: "Graph"               →  Output: "graph"
// ----------------------------------------------------------
function getTopicFileName(folderName: string): string {
  return TOPIC_FILE_ABBREVIATIONS[folderName] || folderName.toLowerCase();
}

// ----------------------------------------------------------
// Select the primary topic from a problem's topic list
// ----------------------------------------------------------
// The primary topic determines the folder in the repository.
//
// Strategy:
//   - Use the first topic in the array (topics[0]).
//     LeetCode lists the most relevant/primary topic first.
//   - If the topics array is empty, return "General" as a
//     catch-all folder for uncategorized problems.
// ----------------------------------------------------------
export function selectPrimaryTopic(topics: string[]): string {
  if (topics.length === 0) {
    return "General";
  }
  return topics[0];
}

// ----------------------------------------------------------
// Generate the full repository file path for a problem
// ----------------------------------------------------------
// This is the main exported function. It combines:
//   1. Difficulty  → top-level folder
//   2. Primary topic → subfolder and file name
//
// Returns a path like: "Easy/Array/array.md"
// ----------------------------------------------------------
export function generateFilePath(
  difficulty: Difficulty,
  primaryTopic: string
): string {
  const folderName = normalizeTopicToFolderName(primaryTopic);
  const fileName = getTopicFileName(folderName);

  return `${difficulty}/${folderName}/${fileName}.md`;
}

// ----------------------------------------------------------
// Convenience: Generate file path directly from a CodingProblem
// ----------------------------------------------------------
export function generateFilePathFromProblem(
  problem: CodingProblem
): string {
  return generateFilePath(problem.difficulty, problem.primaryTopic);
}
