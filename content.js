// ============================================================
// Fika Content Script — v3
// Injected into LeetCode and GeeksforGeeks problem pages.
//
// Detection strategy:
//   LeetCode  → Intercepts fetch() responses to /submissions/detail/
//               to catch the API confirming "Accepted". This is 100%
//               reliable regardless of DOM class-name churn.
//   GFG       → Watches for DOM text "Correct Answer" / "Problem Solved
//               Successfully" appearing AFTER the user clicks Submit.
//
// Both adapters use a submit-intent signal (click / Ctrl+Enter listener)
// to avoid false-positive triggers on page load.
// ============================================================

(function () {
  "use strict";

  console.log("[Fika] Content script v3 loaded on:", window.location.href);

  // ── Deduplication ──────────────────────────────────────────
  let lastSyncedKey = "";

  // ── Toast helper ───────────────────────────────────────────
  function showToast(message, type) {
    type = type || "info";
    let container = document.getElementById("fika-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "fika-toast-container";
      container.style.cssText =
        "position:fixed;top:20px;right:20px;z-index:999999;" +
        "display:flex;flex-direction:column;gap:10px;" +
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
      "max-width:380px;line-height:1.4;transition:opacity .4s,transform .4s;";
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(function () { toast.remove(); }, 400);
    }, 6000);
  }

  // ── Credential reader ──────────────────────────────────────
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

  // ── Path / markdown / duplicate helpers ────────────────────
  var TOPIC_ABBR = {
    DynamicProgramming:"dp",BreadthFirstSearch:"bfs",DepthFirstSearch:"dfs",
    BinarySearch:"binarysearch",TwoPointers:"twopointers",SlidingWindow:"slidingwindow",
    LinkedList:"linkedlist",BinaryTree:"binarytree",BinarySearchTree:"bst",HashTable:"hashtable"
  };

  function normalizeTopic(t) {
    if (!t) return "General";
    return t.split(/[\s\-_]+/).map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join("").replace(/[^a-zA-Z0-9]/g,"");
  }

  function generateFilePath(p) {
    var raw = p.primaryTopic || (p.topics && p.topics[0]) || "General";
    var folder = normalizeTopic(raw) || "General";
    var file = TOPIC_ABBR[folder] || folder.toLowerCase();
    return (p.difficulty||"Easy") + "/" + folder + "/" + file + ".md";
  }

  function formatProblemMarkdown(p) {
    var langMap = {"C++":"cpp","Python3":"python","Python":"python","Java":"java","JavaScript":"javascript","TypeScript":"typescript"};
    var mdLang = langMap[p.language] || (p.language||"").toLowerCase();
    var lines = [
      "## " + p.problemId + ". " + p.title,
      "",
      "- **Platform**: " + p.platform,
      "- **Problem ID**: " + p.problemId,
      "- **Difficulty**: " + p.difficulty,
      "- **Language**: " + p.language,
      "- **Topics**: " + (p.topics && p.topics.length ? p.topics.join(", ") : "None"),
      "- **Solved**: " + (p.acceptedAt || new Date().toISOString()),
      "",
      "### Problem",
      "",
      p.statement || "*Problem statement not available.*",
      ""
    ];
    if (p.testCases && p.testCases.length) {
      lines.push("### Test Cases","");
      p.testCases.forEach(function(tc,i){
        lines.push("#### Test Case "+(i+1),"","**Input:**","```",tc.input,"```","","**Output:**","```",tc.output,"```","");
      });
    }
    lines.push("### Solution","","```"+mdLang, p.code||"// No code extracted","```","");
    return lines.join("\n");
  }

  function processDuplicateDetection(existing, problem) {
    var md = formatProblemMarkdown(problem);
    if (!existing || !existing.trim()) return {action:"created",content:md};
    var sections = existing.split(/(?:^|\n)\s*---\s*(?=\n|$)/).map(function(s){return s.trim();}).filter(function(s){return s.length>0;});
    var idx=-1, oldCode="";
    for (var i=0;i<sections.length;i++){
      var pm=sections[i].match(/-\s*\*\*Platform\*\*:\s*([^\r\n]+)/i);
      var im=sections[i].match(/-\s*\*\*Problem ID\*\*:\s*([^\r\n]+)/i);
      if(pm&&im&&pm[1].trim().toLowerCase()===problem.platform.toLowerCase()&&im[1].trim()===String(problem.problemId).trim()){
        idx=i;
        var cm=sections[i].match(/```(?:\w+)?\r?\n([\s\S]*?)\r?\n```/);
        if(cm) oldCode=cm[1].trim();
        break;
      }
    }
    if(idx===-1){sections.push(md);return {action:"created",content:sections.join("\n\n---\n\n")};}
    if(oldCode.replace(/\r\n/g,"\n")===(problem.code||"").trim().replace(/\r\n/g,"\n")) return {action:"skipped",content:existing};
    sections[idx]=md;
    return {action:"updated",content:sections.join("\n\n---\n\n")};
  }

  function utf8ToBase64(s){var b=new TextEncoder().encode(s),r="";for(var i=0;i<b.length;i++)r+=String.fromCharCode(b[i]);return btoa(r);}
  function base64ToUtf8(b){var d=atob(b.replace(/\s/g,""));var a=new Uint8Array(d.length);for(var i=0;i<d.length;i++)a[i]=d.charCodeAt(i);return new TextDecoder().decode(a);}

  function saveMetadata(p, path, status, err) {
    if (typeof chrome==="undefined"||!chrome.storage||!chrome.storage.local) return;
    chrome.storage.local.get(["fika_submissions_map"],function(r){
      var m=r.fika_submissions_map||{};
      var k=p.platform+":"+p.problemId;
      m[k]={key:k,platform:p.platform,problemId:p.problemId,title:p.title,difficulty:p.difficulty,
        topics:p.topics||[],language:p.language,acceptedAt:p.acceptedAt||new Date().toISOString(),
        githubPath:path,syncStatus:status,error:err||""};
      chrome.storage.local.set({fika_submissions_map:m});
    });
  }

  // ── GitHub push ────────────────────────────────────────────
  async function syncToGitHub(problem, creds) {
    var filePath = generateFilePath(problem);
    console.log("[Fika Sync] Target:", filePath);
    var encoded = filePath.split("/").map(encodeURIComponent).join("/");
    var url = "https://api.github.com/repos/"+creds.owner+"/"+creds.repo+"/contents/"+encoded;
    var hdrs = {
      Authorization:"Bearer "+creds.token,
      Accept:"application/vnd.github+json",
      "Content-Type":"application/json",
      "X-GitHub-Api-Version":"2022-11-28"
    };

    var existing="", sha=null;
    try {
      var gr = await fetch(url,{method:"GET",headers:hdrs});
      if (gr.ok) { var gd=await gr.json(); sha=gd.sha; existing=base64ToUtf8(gd.content||""); }
      else if (gr.status!==404) { saveMetadata(problem,filePath,"failed","GET "+gr.status); return {success:false,error:"GitHub GET "+gr.status}; }
    } catch(e) { saveMetadata(problem,filePath,"failed","Network GET"); return {success:false,error:"Network error (GET)"}; }

    var det = processDuplicateDetection(existing,problem);
    if (det.action==="skipped") { console.log("[Fika Sync] Identical → skip"); saveMetadata(problem,filePath,"synced"); return {success:true,action:"skipped"}; }

    var body = {message:(det.action==="created"?"Add":"Update")+" "+problem.platform+" "+problem.problemId+": "+problem.title+" ["+problem.difficulty+"]",content:utf8ToBase64(det.content)};
    if (sha) body.sha=sha;
    try {
      var pr = await fetch(url,{method:"PUT",headers:hdrs,body:JSON.stringify(body)});
      if (!pr.ok) { var et=await pr.text(); saveMetadata(problem,filePath,"failed","PUT "+pr.status); return {success:false,error:"PUT "+pr.status+": "+et}; }
      var pd=await pr.json(); saveMetadata(problem,filePath,"synced");
      console.log("[Fika Sync] 🎉 SUCCESS →", filePath);
      return {success:true,action:det.action,commitSha:pd.commit&&pd.commit.sha};
    } catch(e){ saveMetadata(problem,filePath,"failed","Network PUT"); return {success:false,error:"Network error (PUT)"}; }
  }

  // ── Core sync pipeline (called by adapters) ────────────────
  async function runSyncPipeline(problem) {
    var key = problem.platform+":"+problem.problemId+":"+(problem.code||"").slice(0,60);
    if (key===lastSyncedKey) { console.log("[Fika] Duplicate sync suppressed"); return; }
    lastSyncedKey = key;

    console.log("[Fika] 🚀 Syncing:", problem.platform, "#"+problem.problemId, problem.title);
    showToast('Fika: 🚀 Syncing "'+problem.title+'" to GitHub…', "info");

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

  // ── Code extraction (works for Monaco, CodeMirror 6, Ace) ──
  function extractCodeFromEditor() {
    // Monaco (.view-line)
    var els = document.querySelectorAll(".view-lines .view-line");
    if (els.length > 0) {
      var lines = [];
      els.forEach(function(el){ lines.push((el.textContent||"").replace(/\u00A0/g," ")); });
      return lines.join("\n").replace(/\n+$/,"");
    }
    // CodeMirror 6 (.cm-line)
    els = document.querySelectorAll(".cm-line");
    if (els.length > 0) {
      var lines2 = [];
      els.forEach(function(el){ lines2.push((el.textContent||"").replace(/\u00A0/g," ")); });
      return lines2.join("\n").replace(/\n+$/,"");
    }
    // Ace (.ace_line)
    els = document.querySelectorAll(".ace_line");
    if (els.length > 0) {
      var lines3 = [];
      els.forEach(function(el){ lines3.push((el.textContent||"").replace(/\u00A0/g," ")); });
      return lines3.join("\n").replace(/\n+$/,"");
    }
    return "";
  }

  // ================================================================
  // LEETCODE ADAPTER
  // Strategy: Monkey-patch window.fetch to intercept LeetCode's own
  // submission API response. When /check/ returns status_msg "Accepted"
  // we know for certain the submission was accepted — no DOM guessing.
  // ================================================================
  function initLeetCode() {
    console.log("[Fika] Initializing LeetCode adapter (fetch-intercept strategy)");

    function extractLeetCodeProblem() {
      var problemId = "Unknown", title = "Unknown";
      var m = document.title.match(/(\d+)\.\s*(.+?)\s*[-–—]\s*LeetCode/);
      if (m) { problemId = m[1]; title = m[2].trim(); }
      else {
        var hdgs = document.querySelectorAll("[class*='title'], h1, h2, h3");
        for (var h of hdgs) {
          var hm = h.textContent.trim().match(/^(\d+)\.\s*(.+)/);
          if (hm) { problemId = hm[1]; title = hm[2].trim(); break; }
        }
      }

      var um = window.location.href.match(/leetcode\.com\/problems\/([a-z0-9-]+)/i);
      var slug = um ? um[1] : "unknown";
      if (title === "Unknown") title = slug.split("-").map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(" ");

      var difficulty = "Easy";
      var diffs = ["Easy","Medium","Hard"];
      var allEls = document.querySelectorAll("div, span");
      for (var el of allEls) {
        if (el.children.length > 0) continue;
        var t = (el.textContent||"").trim();
        if (diffs.indexOf(t) !== -1) { difficulty = t; break; }
      }

      var topics = [];
      document.querySelectorAll('a[href*="/tag/"]').forEach(function(el){
        var tt = el.textContent.trim();
        if (tt && topics.indexOf(tt)===-1) topics.push(tt);
      });

      var statement = "";
      var descSel = ['[data-track-load="description_content"]','div[class*="elfjS"]','div[class*="question-content"]','div[class*="description"]'];
      for (var sel of descSel) {
        try { var de = document.querySelector(sel);
          if (de && de.textContent.trim().length > 50) { statement = de.textContent.trim(); break; }
        } catch(e){}
      }

      var testCases = [];
      if (statement) {
        var tp = /Input:\s*([\s\S]*?)Output:\s*([\s\S]*?)(?=Example|Input:|Explanation|Constraints|Note:|\n\n|$)/gi;
        var tcm;
        while ((tcm = tp.exec(statement)) !== null) {
          if (tcm[1].trim() || tcm[2].trim()) testCases.push({input:tcm[1].trim(),output:tcm[2].trim()});
        }
      }

      var language = "C++";
      var knownLangs = ["C++","Java","Python","Python3","C","C#","JavaScript","TypeScript","PHP","Swift","Kotlin","Dart","Go","Ruby","Scala","Rust"];
      document.querySelectorAll("button").forEach(function(btn){
        if (language !== "C++") return;
        var bt = btn.textContent.trim();
        if (knownLangs.indexOf(bt) !== -1) language = bt;
      });

      var code = extractCodeFromEditor();

      return {
        problemId: problemId, title: title, slug: slug, platform: "LeetCode",
        difficulty: difficulty, topics: topics,
        primaryTopic: topics.length > 0 ? topics[0] : "General",
        statement: statement, testCases: testCases, language: language,
        code: code, acceptedAt: new Date().toISOString()
      };
    }

    // ── Monkey-patch fetch to intercept submission check responses ──
    var originalFetch = window.fetch;
    var pendingSubmissionId = null;

    window.fetch = function() {
      var fetchUrl = arguments[0];
      var opts = arguments[1] || {};

      // Detect the submission POST → /submit/
      if (typeof fetchUrl === "string" && /\/problems\/[^/]+\/submit\/?$/i.test(fetchUrl) && (opts.method||"").toUpperCase() === "POST") {
        console.log("[Fika] 📤 LeetCode submission POST detected:", fetchUrl);
        showToast("Fika: ⏳ Submission detected, watching for result…", "info");

        return originalFetch.apply(this, arguments).then(function(response) {
          // Clone so we can read the body without consuming it
          var cloned = response.clone();
          cloned.json().then(function(data) {
            if (data && data.submission_id) {
              pendingSubmissionId = String(data.submission_id);
              console.log("[Fika] 📝 Got submission_id:", pendingSubmissionId);
            }
          }).catch(function(){});
          return response;
        });
      }

      // Detect the check poll → /submissions/detail/{id}/check/
      if (typeof fetchUrl === "string" && /\/submissions\/detail\/\d+\/check\/?/i.test(fetchUrl)) {
        return originalFetch.apply(this, arguments).then(function(response) {
          var cloned = response.clone();
          cloned.json().then(function(data) {
            if (data && data.state === "SUCCESS" && data.status_msg === "Accepted") {
              console.log("[Fika] ✅ LeetCode API confirmed ACCEPTED! submission_id:", data.submission_id || "unknown");

              // Small delay so LeetCode finishes rendering (and we can read the code editor)
              setTimeout(function() {
                var problem = extractLeetCodeProblem();
                console.log("[Fika] Extracted problem:", problem);
                runSyncPipeline(problem);
              }, 1500);
            }
          }).catch(function(){});
          return response;
        });
      }

      return originalFetch.apply(this, arguments);
    };

    console.log("[Fika] ✅ LeetCode fetch-intercept active. Waiting for submissions…");
  }

  // ================================================================
  // GEEKSFORGEEKS ADAPTER
  // Strategy: Listen for Submit click, then poll DOM for result text.
  // ================================================================
  function initGFG() {
    console.log("[Fika] Initializing GeeksforGeeks adapter (click + DOM poll strategy)");

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
      document.querySelectorAll('a[href*="category"], a[href*="tag"], [class*="topic-tag"]').forEach(function(el){
        var t = (el.textContent||"").trim();
        if (t && t.length < 30 && topics.indexOf(t)===-1) topics.push(t);
      });

      var statement = "";
      var dSel = ["[class*='problem-statement']","[class*='problemDescription']","[class*='mark-down']"];
      for (var s of dSel) {
        var e = document.querySelector(s);
        if (e && e.textContent && e.textContent.trim().length > 30) { statement = e.textContent.trim(); break; }
      }

      var testCases = [];
      if (statement) {
        var tp = /Input:\s*([\s\S]*?)Output:\s*([\s\S]*?)(?=Example|Input:|Explanation|Constraints|Note:|\n\n|$)/gi;
        var tcm;
        while ((tcm = tp.exec(statement)) !== null) {
          if (tcm[1].trim()||tcm[2].trim()) testCases.push({input:tcm[1].trim(),output:tcm[2].trim()});
        }
      }

      var language = "C++";
      var knownLangs = ["C++","Java","Python3","Python","JavaScript","C#"];
      var langSels = ["[class*='language-select']","button[class*='lang']","div[class*='editor'] button"];
      for (var ls of langSels) {
        var le = document.querySelector(ls);
        if (le && le.textContent) {
          var lt = le.textContent.trim();
          var ml = knownLangs.find(function(l){return l.toLowerCase()===lt.toLowerCase();});
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

    // Watch for Submit click → then poll DOM for "Correct Answer"
    var isWaitingForResult = false;

    document.addEventListener("click", function(e) {
      var el = e.target;
      if (!el) return;
      var btn = el.closest("button, [role='button']");
      if (!btn) return;
      var text = (btn.textContent || "").trim().toLowerCase();
      if (text.indexOf("submit") !== -1 || btn.id === "run-and-submit-btn" ||
          (btn.className && typeof btn.className === "string" && btn.className.toLowerCase().indexOf("submit") !== -1)) {
        console.log("[Fika] 📤 GFG Submit button clicked");
        showToast("Fika: ⏳ Submission detected, watching for result…", "info");
        isWaitingForResult = true;
        pollForGFGResult();
      }
    }, true);

    document.addEventListener("keydown", function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        console.log("[Fika] 📤 GFG Submit via Ctrl+Enter");
        isWaitingForResult = true;
        pollForGFGResult();
      }
    }, true);

    function pollForGFGResult() {
      var attempts = 0;
      var maxAttempts = 40; // 40 × 500ms = 20 seconds
      var interval = setInterval(function() {
        attempts++;
        if (attempts > maxAttempts) {
          clearInterval(interval);
          isWaitingForResult = false;
          console.log("[Fika] ⏱ GFG result poll timed out after 20s");
          return;
        }

        // Scan for success text
        var allText = document.body.innerText || "";
        if (/Correct Answer|Problem Solved Successfully/i.test(allText)) {
          clearInterval(interval);
          isWaitingForResult = false;
          console.log("[Fika] ✅ GFG Correct Answer detected!");

          setTimeout(function() {
            var problem = extractGFGProblem();
            console.log("[Fika] Extracted GFG problem:", problem);
            runSyncPipeline(problem);
          }, 1000);
        }
      }, 500);
    }

    // Also try intercepting GFG's fetch/XHR for compile results
    var origFetch = window.fetch;
    window.fetch = function() {
      var fetchUrl = arguments[0];
      if (typeof fetchUrl === "string" && /api\/latest\/problems-auth\/submit/i.test(fetchUrl)) {
        console.log("[Fika] 📤 GFG submission API call detected:", fetchUrl);
        isWaitingForResult = true;
        showToast("Fika: ⏳ Submission detected, watching for result…", "info");
      }
      return origFetch.apply(this, arguments);
    };

    console.log("[Fika] ✅ GFG adapter active. Watching for Submit clicks…");
  }

  // ================================================================
  // ROUTER — pick the right adapter based on hostname
  // ================================================================
  var host = window.location.hostname;

  if (host.indexOf("leetcode.com") !== -1 && /\/problems\/[a-z0-9-]+/i.test(window.location.pathname)) {
    initLeetCode();
  } else if (host.indexOf("geeksforgeeks.org") !== -1 && /\/problems\/[a-z0-9-]+/i.test(window.location.pathname)) {
    initGFG();
  } else {
    console.log("[Fika] Not a supported problem page:", window.location.href);
  }
})();
