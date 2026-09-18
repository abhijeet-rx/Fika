// ============================================================
// Fika Content Script — v4
//
// Chrome content scripts run in an ISOLATED JavaScript world.
// They share the DOM but NOT the JS globals with the page.
// Therefore we CANNOT monkey-patch window.fetch from here.
//
// Strategy:
//   1. Inject a <script> into the PAGE's main world that patches
//      the real window.fetch and fires a CustomEvent when LeetCode's
//      submission-check API returns "Accepted".
//   2. This content script listens for that CustomEvent, reads the
//      DOM to extract problem info, reads chrome.storage for creds,
//      and pushes to GitHub.
// ============================================================

(function () {
  "use strict";

  console.log("[Fika] Content script v4 loaded on:", window.location.href);

  // ── Toast helper ───────────────────────────────────────────
  function showToast(message, type) {
    type = type || "info";
    var container = document.getElementById("fika-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "fika-toast-container";
      container.style.cssText =
        "position:fixed;top:20px;right:20px;z-index:999999;" +
        "display:flex;flex-direction:column;gap:10px;pointer-events:none;" +
        "font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
      document.body.appendChild(container);
    }
    var bg =
      type === "success" ? "#10b981"
        : type === "error" ? "#ef4444"
          : type === "warning" ? "#f59e0b"
            : "#3b82f6";

    var toast = document.createElement("div");
    toast.style.cssText =
      "background:" + bg + ";color:#fff;padding:12px 18px;border-radius:8px;" +
      "box-shadow:0 10px 25px -5px rgba(0,0,0,.4);font-size:14px;font-weight:600;" +
      "max-width:380px;line-height:1.4;transition:opacity .4s,transform .4s;" +
      "pointer-events:auto;";
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(function () { toast.remove(); }, 400);
    }, 6000);
  }

  // ── Credential reader (only works in content script world) ─
  function getStoredCredentials() {
    return new Promise(function (resolve) {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        return resolve(null);
      }
      chrome.storage.local.get(
        ["fika_github_token", "fika_github_owner", "fika_github_repo"],
        function (r) {
          if (r.fika_github_token && r.fika_github_owner && r.fika_github_repo) {
            resolve({ token: r.fika_github_token, owner: r.fika_github_owner, repo: r.fika_github_repo });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  // ── Code extraction (reads DOM — works from content script) ─
  function extractCodeFromEditor() {
    var selectors = [".view-lines .view-line", ".view-line", ".cm-line", ".ace_line"];
    for (var s = 0; s < selectors.length; s++) {
      var els = document.querySelectorAll(selectors[s]);
      if (els.length > 0) {
        var lines = [];
        els.forEach(function (el) { lines.push((el.textContent || "").replace(/\u00A0/g, " ")); });
        var code = lines.join("\n").replace(/\n+$/, "");
        if (code.trim().length > 5) return code;
      }
    }
    return "";
  }

  // ── LeetCode problem extractor ─────────────────────────────
  function extractLeetCodeProblem() {
    var problemId = "Unknown", title = "Unknown";
    var m = document.title.match(/(\d+)\.\s*(.+?)\s*[-–—]\s*LeetCode/);
    if (m) { problemId = m[1]; title = m[2].trim(); }
    else {
      var hdgs = document.querySelectorAll("[class*='title'], h1, h2, h3");
      for (var i = 0; i < hdgs.length; i++) {
        var hm = hdgs[i].textContent.trim().match(/^(\d+)\.\s*(.+)/);
        if (hm) { problemId = hm[1]; title = hm[2].trim(); break; }
      }
    }

    var um = window.location.href.match(/leetcode\.com\/problems\/([a-z0-9-]+)/i);
    var slug = um ? um[1] : "unknown";
    if (title === "Unknown") {
      title = slug.split("-").map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(" ");
    }

    var difficulty = "Easy";
    var allLeafs = document.querySelectorAll("div, span");
    for (var j = 0; j < allLeafs.length; j++) {
      if (allLeafs[j].children.length > 0) continue;
      var t = (allLeafs[j].textContent || "").trim();
      if (t === "Easy" || t === "Medium" || t === "Hard") { difficulty = t; break; }
    }

    var topics = [];
    document.querySelectorAll('a[href*="/tag/"]').forEach(function (el) {
      var tt = el.textContent.trim();
      if (tt && topics.indexOf(tt) === -1) topics.push(tt);
    });

    var statement = "";
    var descSel = ['[data-track-load="description_content"]', 'div[class*="elfjS"]', 'div[class*="question-content"]', 'div[class*="description"]'];
    for (var k = 0; k < descSel.length; k++) {
      try {
        var de = document.querySelector(descSel[k]);
        if (de && de.textContent.trim().length > 50) { statement = de.textContent.trim(); break; }
      } catch (e) { }
    }

    var testCases = [];
    if (statement) {
      var tp = /Input:\s*([\s\S]*?)Output:\s*([\s\S]*?)(?=Example|Input:|Explanation|Constraints|Note:|\n\n|$)/gi;
      var tcm;
      while ((tcm = tp.exec(statement)) !== null) {
        if (tcm[1].trim() || tcm[2].trim()) testCases.push({ input: tcm[1].trim(), output: tcm[2].trim() });
      }
    }

    var language = "JavaScript";
    var knownLangs = ["C++", "Java", "Python", "Python3", "C", "C#", "JavaScript", "TypeScript", "PHP", "Swift", "Kotlin", "Dart", "Go", "Ruby", "Scala", "Rust"];
    var btns = document.querySelectorAll("button");
    for (var b = 0; b < btns.length; b++) {
      var bt = btns[b].textContent.trim();
      if (knownLangs.indexOf(bt) !== -1) { language = bt; break; }
    }

    var code = extractCodeFromEditor();

    return {
      problemId: problemId, title: title, slug: slug, platform: "LeetCode",
      difficulty: difficulty, topics: topics,
      primaryTopic: topics.length > 0 ? topics[0] : "General",
      statement: statement, testCases: testCases, language: language,
      code: code, acceptedAt: new Date().toISOString()
    };
  }

  // ── GFG problem extractor ──────────────────────────────────
  function extractGFGProblem() {
    var urlMatch = window.location.href.match(/geeksforgeeks\.org\/problems\/([a-z0-9-]+)/i);
    var slug = urlMatch ? urlMatch[1] : "unknown-gfg";
    var title = "Unknown Problem", problemId = slug;

    var tm = document.title.match(/^([^|]+)\s*\|\s*Practice/i);
    if (tm) title = tm[1].trim();
    else {
      var h = document.querySelector("[class*='problem-title'], .problem-tab__title, h3, h2, h1");
      if (h && h.textContent) title = h.textContent.trim();
    }
    var im = slug.match(/(\d+)$/);
    if (im) problemId = im[1];

    var difficulty = "Easy";
    var ds = document.querySelector("[class*='difficulty'], [class*='problem-tab__difficulty']");
    if (ds) {
      var dt = ds.textContent.trim().toLowerCase();
      if (dt === "medium") difficulty = "Medium";
      else if (dt === "hard") difficulty = "Hard";
    }

    var topics = [];
    document.querySelectorAll('a[href*="category"], a[href*="tag"], [class*="topic-tag"]').forEach(function (el) {
      var t2 = (el.textContent || "").trim();
      if (t2 && t2.length < 30 && topics.indexOf(t2) === -1) topics.push(t2);
    });

    var statement = "";
    var dSel = ["[class*='problem-statement']", "[class*='problemDescription']", "[class*='mark-down']"];
    for (var s2 = 0; s2 < dSel.length; s2++) {
      var e2 = document.querySelector(dSel[s2]);
      if (e2 && e2.textContent && e2.textContent.trim().length > 30) { statement = e2.textContent.trim(); break; }
    }

    var testCases = [];
    if (statement) {
      var tp2 = /Input:\s*([\s\S]*?)Output:\s*([\s\S]*?)(?=Example|Input:|Explanation|Constraints|Note:|\n\n|$)/gi;
      var tcm2;
      while ((tcm2 = tp2.exec(statement)) !== null) {
        if (tcm2[1].trim() || tcm2[2].trim()) testCases.push({ input: tcm2[1].trim(), output: tcm2[2].trim() });
      }
    }

    var language = "C++";
    var knownLangs2 = ["C++", "Java", "Python3", "Python", "JavaScript", "C#"];
    var langSels = ["[class*='language-select']", "button[class*='lang']", "div[class*='editor'] button"];
    for (var ls = 0; ls < langSels.length; ls++) {
      var le = document.querySelector(langSels[ls]);
      if (le && le.textContent) {
        var lt = le.textContent.trim();
        var ml = knownLangs2.find(function (l) { return l.toLowerCase() === lt.toLowerCase(); });
        if (ml) { language = ml; break; }
      }
    }

    var code = extractCodeFromEditor();

    return {
      problemId: problemId, title: title, slug: slug, platform: "GeeksforGeeks",
      difficulty: difficulty, topics: topics,
      primaryTopic: topics.length > 0 ? topics[0] : "General",
      statement: statement, testCases: testCases, language: language,
      code: code, acceptedAt: new Date().toISOString()
    };
  }

  // ── Path / markdown / duplicate helpers ────────────────────
  var TOPIC_ABBR = {
    DynamicProgramming: "dp", BreadthFirstSearch: "bfs", DepthFirstSearch: "dfs",
    BinarySearch: "binarysearch", TwoPointers: "twopointers", SlidingWindow: "slidingwindow",
    LinkedList: "linkedlist", BinaryTree: "binarytree", BinarySearchTree: "bst", HashTable: "hashtable"
  };

  function normalizeTopic(t) {
    if (!t) return "General";
    return t.split(/[\s\-_]+/).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join("").replace(/[^a-zA-Z0-9]/g, "");
  }

  function generateFilePath(p) {
    var raw = p.primaryTopic || (p.topics && p.topics[0]) || "General";
    var folder = normalizeTopic(raw) || "General";
    var file = TOPIC_ABBR[folder] || folder.toLowerCase();
    return (p.difficulty || "Easy") + "/" + folder + "/" + file + ".md";
  }

  function formatProblemMarkdown(p) {
    var langMap = { "C++": "cpp", "Python3": "python", "Python": "python", "Java": "java", "JavaScript": "javascript", "TypeScript": "typescript" };
    var mdLang = langMap[p.language] || (p.language || "").toLowerCase();
    var lines = [
      "## " + p.problemId + ". " + p.title, "",
      "- **Platform**: " + p.platform,
      "- **Problem ID**: " + p.problemId,
      "- **Difficulty**: " + p.difficulty,
      "- **Language**: " + p.language,
      "- **Topics**: " + (p.topics && p.topics.length ? p.topics.join(", ") : "None"),
      "- **Solved**: " + (p.acceptedAt || new Date().toISOString()),
      "", "### Problem", "",
      p.statement || "*Problem statement not available.*", ""
    ];
    if (p.testCases && p.testCases.length) {
      lines.push("### Test Cases", "");
      p.testCases.forEach(function (tc, i) {
        lines.push("#### Test Case " + (i + 1), "", "**Input:**", "```", tc.input, "```", "", "**Output:**", "```", tc.output, "```", "");
      });
    }
    lines.push("### Solution", "", "```" + mdLang, p.code || "// No code extracted", "```", "");
    return lines.join("\n");
  }

  function processDuplicateDetection(existing, problem) {
    var md = formatProblemMarkdown(problem);
    if (!existing || !existing.trim()) return { action: "created", content: md };
    var sections = existing.split(/(?:^|\n)\s*---\s*(?=\n|$)/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
    var idx = -1, oldCode = "";
    for (var i = 0; i < sections.length; i++) {
      var pm = sections[i].match(/-\s*\*\*Platform\*\*:\s*([^\r\n]+)/i);
      var idm = sections[i].match(/-\s*\*\*Problem ID\*\*:\s*([^\r\n]+)/i);
      if (pm && idm && pm[1].trim().toLowerCase() === problem.platform.toLowerCase() && idm[1].trim() === String(problem.problemId).trim()) {
        idx = i;
        var cm = sections[i].match(/```(?:\w+)?\r?\n([\s\S]*?)\r?\n```/);
        if (cm) oldCode = cm[1].trim();
        break;
      }
    }
    if (idx === -1) { sections.push(md); return { action: "created", content: sections.join("\n\n---\n\n") }; }
    if (oldCode.replace(/\r\n/g, "\n") === (problem.code || "").trim().replace(/\r\n/g, "\n")) return { action: "skipped", content: existing };
    sections[idx] = md;
    return { action: "updated", content: sections.join("\n\n---\n\n") };
  }

  function utf8ToBase64(s) { var b = new TextEncoder().encode(s), r = ""; for (var i = 0; i < b.length; i++) r += String.fromCharCode(b[i]); return btoa(r); }
  function base64ToUtf8(b) { var d = atob(b.replace(/\s/g, "")); var a = new Uint8Array(d.length); for (var i = 0; i < d.length; i++) a[i] = d.charCodeAt(i); return new TextDecoder().decode(a); }

  function saveMetadata(p, path, status, err) {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(["fika_submissions_map"], function (r) {
      var m = r.fika_submissions_map || {};
      var k = p.platform + ":" + p.problemId;
      m[k] = {
        key: k, platform: p.platform, problemId: p.problemId, title: p.title, difficulty: p.difficulty,
        topics: p.topics || [], language: p.language, acceptedAt: p.acceptedAt || new Date().toISOString(),
        githubPath: path, syncStatus: status, error: err || ""
      };
      chrome.storage.local.set({ fika_submissions_map: m });
    });
  }

  // ── GitHub push ────────────────────────────────────────────
  async function syncToGitHub(problem, creds) {
    var filePath = generateFilePath(problem);
    console.log("[Fika Sync] Target:", filePath);
    var encoded = filePath.split("/").map(encodeURIComponent).join("/");
    var url = "https://api.github.com/repos/" + creds.owner + "/" + creds.repo + "/contents/" + encoded;
    var hdrs = {
      Authorization: "Bearer " + creds.token,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    };

    var existing = "", sha = null;
    try {
      var gr = await fetch(url, { method: "GET", headers: hdrs });
      if (gr.ok) { var gd = await gr.json(); sha = gd.sha; existing = base64ToUtf8(gd.content || ""); }
      else if (gr.status !== 404) { saveMetadata(problem, filePath, "failed", "GET " + gr.status); return { success: false, error: "GitHub GET " + gr.status }; }
    } catch (e) { saveMetadata(problem, filePath, "failed", "Network GET"); return { success: false, error: "Network error (GET)" }; }

    var det = processDuplicateDetection(existing, problem);
    if (det.action === "skipped") { console.log("[Fika Sync] Identical → skip"); saveMetadata(problem, filePath, "synced"); return { success: true, action: "skipped" }; }

    var body = { message: (det.action === "created" ? "Add" : "Update") + " " + problem.platform + " " + problem.problemId + ": " + problem.title + " [" + problem.difficulty + "]", content: utf8ToBase64(det.content) };
    if (sha) body.sha = sha;
    try {
      var pr = await fetch(url, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
      if (!pr.ok) { var et = await pr.text(); saveMetadata(problem, filePath, "failed", "PUT " + pr.status); return { success: false, error: "PUT " + pr.status + ": " + et }; }
      var pd = await pr.json(); saveMetadata(problem, filePath, "synced");
      console.log("[Fika Sync] 🎉 SUCCESS →", filePath);
      return { success: true, action: det.action, commitSha: pd.commit && pd.commit.sha };
    } catch (e) { saveMetadata(problem, filePath, "failed", "Network PUT"); return { success: false, error: "Network error (PUT)" }; }
  }

  // ── Deduplication ──────────────────────────────────────────
  var lastSyncedKey = "";

  async function runSyncPipeline(problem) {
    var key = problem.platform + ":" + problem.problemId + ":" + (problem.code || "").slice(0, 60);
    if (key === lastSyncedKey) { console.log("[Fika] Duplicate sync suppressed"); return; }
    lastSyncedKey = key;

    console.log("[Fika] 🚀 Syncing:", problem.platform, "#" + problem.problemId, problem.title);
    showToast('Fika: 🚀 Syncing "' + problem.title + '" to GitHub…', "info");

    var creds = await getStoredCredentials();
    if (!creds) {
      console.warn("[Fika] ⚠️ No GitHub credentials configured.");
      showToast("Fika: ⚠️ GitHub credentials missing! Open extension to configure.", "warning");
      return;
    }

    var result = await syncToGitHub(problem, creds);
    if (result.success) {
      console.log("[Fika] ✅ SYNC COMPLETE [" + result.action + "]");
      showToast("Fika: 🎉 Pushed to GitHub! (" + result.action + ")", "success");
    } else {
      console.error("[Fika] ❌ SYNC FAILED:", result.error);
      showToast("Fika: ❌ Push failed — " + result.error, "error");
    }
  }

  // ================================================================
  // INJECTED MAIN-WORLD SCRIPT
  //
  // This code is serialized to a string, injected into the page via
  // a <script> tag, and runs in the PAGE's JavaScript world — where
  // it can intercept the REAL window.fetch that LeetCode uses.
  //
  // Communication back to the content script is via CustomEvent on
  // the document.
  // ================================================================
  var INJECTED_CODE = function () {
    if (window.__fikaInjected) return;
    window.__fikaInjected = true;

    var originalFetch = window.fetch;

    window.fetch = function () {
      var url = (typeof arguments[0] === "string") ? arguments[0] : (arguments[0] && arguments[0].url ? arguments[0].url : "");
      var opts = arguments[1] || {};
      var method = (opts.method || "GET").toUpperCase();

      // ── LeetCode: detect submission POST ──
      if (/\/problems\/[^/]+\/submit\/?$/i.test(url) && method === "POST") {
        console.log("[Fika-inject] 📤 Submission POST detected:", url);
        document.dispatchEvent(new CustomEvent("__fika_submit_detected"));

        return originalFetch.apply(this, arguments).then(function (response) {
          var cloned = response.clone();
          cloned.json().then(function (data) {
            if (data && data.submission_id) {
              console.log("[Fika-inject] 📝 submission_id:", data.submission_id);
            }
          }).catch(function () { });
          return response;
        });
      }

      // ── LeetCode: detect check-result poll ──
      if (/\/submissions\/detail\/\d+\/check\/?/i.test(url)) {
        return originalFetch.apply(this, arguments).then(function (response) {
          var cloned = response.clone();
          cloned.json().then(function (data) {
            if (data && data.state === "SUCCESS" && data.status_msg === "Accepted") {
              console.log("[Fika-inject] ✅ Accepted confirmed by API!");
              document.dispatchEvent(new CustomEvent("__fika_accepted", {
                detail: { submissionId: data.submission_id, runtime: data.status_runtime, memory: data.status_memory }
              }));
            }
          }).catch(function () { });
          return response;
        });
      }

      // ── LeetCode: GraphQL submissions ──
      if (/\/graphql\/?$/i.test(url) && method === "POST") {
        return originalFetch.apply(this, arguments).then(function (response) {
          var cloned = response.clone();
          cloned.text().then(function (text) {
            try {
              var json = JSON.parse(text);
              // Check for submission mutation response
              if (json && json.data && json.data.submissionId) {
                console.log("[Fika-inject] 📝 GraphQL submission_id:", json.data.submissionId);
              }
              // Check for submission check via GraphQL
              if (json && json.data && json.data.submissionDetails && json.data.submissionDetails.statusDisplay === "Accepted") {
                console.log("[Fika-inject] ✅ GraphQL Accepted confirmed!");
                document.dispatchEvent(new CustomEvent("__fika_accepted", {
                  detail: { submissionId: json.data.submissionDetails.id }
                }));
              }
            } catch (e) { }
          }).catch(function () { });
          return response;
        });
      }

      // ── GFG: detect submission API ──
      if (/geeksforgeeks/i.test(window.location.hostname) && /submit|run/i.test(url) && method === "POST") {
        console.log("[Fika-inject] 📤 GFG submission detected:", url);
        document.dispatchEvent(new CustomEvent("__fika_submit_detected"));
      }

      return originalFetch.apply(this, arguments);
    };

    // ── Also intercept XMLHttpRequest for older API paths ──
    var origXHROpen = XMLHttpRequest.prototype.open;
    var origXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__fikaUrl = url;
      this.__fikaMethod = method;
      return origXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      var self = this;
      var url = self.__fikaUrl || "";

      if (/\/problems\/[^/]+\/submit\/?$/i.test(url)) {
        console.log("[Fika-inject] 📤 XHR Submission detected:", url);
        document.dispatchEvent(new CustomEvent("__fika_submit_detected"));
      }

      self.addEventListener("load", function () {
        try {
          if (/\/submissions\/detail\/\d+\/check\/?/i.test(url)) {
            var data = JSON.parse(self.responseText);
            if (data && data.state === "SUCCESS" && data.status_msg === "Accepted") {
              console.log("[Fika-inject] ✅ XHR Accepted confirmed!");
              document.dispatchEvent(new CustomEvent("__fika_accepted", {
                detail: { submissionId: data.submission_id }
              }));
            }
          }
        } catch (e) { }
      });

      return origXHRSend.apply(this, arguments);
    };

    console.log("[Fika-inject] ✅ Main-world fetch/XHR interceptors active");
  };

  // ── Inject the script into the page's main world ───────────
  function injectMainWorldScript() {
    var script = document.createElement("script");
    script.textContent = "(" + INJECTED_CODE.toString() + ")();";
    (document.head || document.documentElement).appendChild(script);
    script.remove(); // Clean up the tag (the code already executed)
    console.log("[Fika] Injected main-world interceptor script");
  }

  // ================================================================
  // LEETCODE ADAPTER
  // ================================================================
  function initLeetCode() {
    console.log("[Fika] Initializing LeetCode adapter");
    injectMainWorldScript();

    // Listen for the Accepted event from the injected script
    document.addEventListener("__fika_accepted", function () {
      console.log("[Fika] ✅ Received __fika_accepted event from main world!");

      // Delay slightly so the DOM has updated with the result
      setTimeout(function () {
        var problem = extractLeetCodeProblem();
        console.log("[Fika] Extracted problem:", JSON.stringify({
          id: problem.problemId,
          title: problem.title,
          difficulty: problem.difficulty,
          language: problem.language,
          codeLength: (problem.code || "").length,
          topics: problem.topics
        }));
        runSyncPipeline(problem);
      }, 2000);
    });

    document.addEventListener("__fika_submit_detected", function () {
      console.log("[Fika] 📤 Submit detected — watching for result…");
      showToast("Fika: ⏳ Submission sent! Watching for result…", "info");
    });

    console.log("[Fika] ✅ LeetCode adapter ready. Waiting for submissions…");
  }

  // ================================================================
  // GFG ADAPTER
  // ================================================================
  function initGFG() {
    console.log("[Fika] Initializing GFG adapter");
    injectMainWorldScript();

    var isPolling = false;

    function startGFGPoll() {
      if (isPolling) return;
      isPolling = true;
      var attempts = 0;
      var maxAttempts = 40;
      var interval = setInterval(function () {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(interval);
          isPolling = false;
          console.log("[Fika] ⏱ GFG result poll timed out");
          return;
        }
        var bodyText = document.body.innerText || "";
        if (/Correct Answer|Problem Solved Successfully/i.test(bodyText)) {
          clearInterval(interval);
          isPolling = false;
          console.log("[Fika] ✅ GFG Correct Answer detected!");
          setTimeout(function () {
            var problem = extractGFGProblem();
            runSyncPipeline(problem);
          }, 1000);
        }
      }, 500);
    }

    // Listen for submit detection from injected script
    document.addEventListener("__fika_submit_detected", function () {
      console.log("[Fika] 📤 GFG Submit detected — polling for result…");
      showToast("Fika: ⏳ Submission sent! Watching for result…", "info");
      startGFGPoll();
    });

    // Also listen for button clicks directly
    document.addEventListener("click", function (e) {
      var el = e.target;
      if (!el) return;
      var btn = el.closest("button, [role='button']");
      if (!btn) return;
      var text = (btn.textContent || "").trim().toLowerCase();
      if (text.indexOf("submit") !== -1 || btn.id === "run-and-submit-btn") {
        console.log("[Fika] 📤 GFG Submit button clicked");
        showToast("Fika: ⏳ Submission sent! Watching for result…", "info");
        startGFGPoll();
      }
    }, true);

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        startGFGPoll();
      }
    }, true);

    console.log("[Fika] ✅ GFG adapter ready. Watching for submissions…");
  }

  // ================================================================
  // ROUTER
  // ================================================================
  var host = window.location.hostname;

  if (host.indexOf("leetcode.com") !== -1 && /\/problems\/[a-z0-9-]/i.test(window.location.pathname)) {
    initLeetCode();
  } else if (host.indexOf("geeksforgeeks.org") !== -1 && /\/problems\/[a-z0-9-]/i.test(window.location.pathname)) {
    initGFG();
  } else {
    console.log("[Fika] Not a supported problem page:", window.location.href);
  }
})();
