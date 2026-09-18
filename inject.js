// ============================================================
// Fika — Main-World Interceptor (inject.js)
//
// This file runs in the PAGE's main JavaScript world via
// manifest.json "world": "MAIN".  It patches the real
// window.fetch and XMLHttpRequest to detect LeetCode / GFG
// submission results, then fires CustomEvents on `document`
// that the content script (isolated world) listens for.
// ============================================================

(function () {
  if (window.__fikaInjected) return;
  window.__fikaInjected = true;

  var originalFetch = window.fetch;

  window.fetch = function () {
    var url = (typeof arguments[0] === "string")
      ? arguments[0]
      : (arguments[0] && arguments[0].url ? arguments[0].url : "");
    var opts = arguments[1] || {};
    var method = (opts.method || "GET").toUpperCase();

    // ── LeetCode REST: submission POST ──
    if (/\/problems\/[^/]+\/submit\/?$/i.test(url) && method === "POST") {
      console.log("[Fika-inject] 📤 Submission POST detected:", url);
      document.dispatchEvent(new CustomEvent("__fika_submit_detected"));

      return originalFetch.apply(this, arguments).then(function (response) {
        var cloned = response.clone();
        cloned.json().then(function (data) {
          if (data && data.submission_id) {
            console.log("[Fika-inject] 📝 submission_id:", data.submission_id);
          }
        }).catch(function () {});
        return response;
      });
    }

    // ── LeetCode REST: check-result poll ──
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
        }).catch(function () {});
        return response;
      });
    }

    // ── LeetCode GraphQL ──
    if (/\/graphql\/?$/i.test(url) && method === "POST") {
      return originalFetch.apply(this, arguments).then(function (response) {
        var cloned = response.clone();
        cloned.text().then(function (text) {
          try {
            var json = JSON.parse(text);
            if (json && json.data && json.data.submissionId) {
              console.log("[Fika-inject] 📝 GraphQL submission_id:", json.data.submissionId);
            }
            if (json && json.data && json.data.submissionDetails &&
                json.data.submissionDetails.statusDisplay === "Accepted") {
              console.log("[Fika-inject] ✅ GraphQL Accepted confirmed!");
              document.dispatchEvent(new CustomEvent("__fika_accepted", {
                detail: { submissionId: json.data.submissionDetails.id }
              }));
            }
            // Also check for submit mutation response
            if (json && json.data && json.data.submit && json.data.submit.submission_id) {
              console.log("[Fika-inject] 📝 GraphQL submit mutation id:", json.data.submit.submission_id);
              document.dispatchEvent(new CustomEvent("__fika_submit_detected"));
            }
          } catch (e) {}
        }).catch(function () {});
        return response;
      });
    }

    // ── GFG submission ──
    if (/geeksforgeeks/i.test(window.location.hostname) && /submit|run/i.test(url) && method === "POST") {
      console.log("[Fika-inject] 📤 GFG submission detected:", url);
      document.dispatchEvent(new CustomEvent("__fika_submit_detected"));
    }

    return originalFetch.apply(this, arguments);
  };

  // ── Also intercept XMLHttpRequest ──
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
      } catch (e) {}
    });

    return origXHRSend.apply(this, arguments);
  };

  console.log("[Fika-inject] ✅ Main-world fetch/XHR interceptors active");
})();
