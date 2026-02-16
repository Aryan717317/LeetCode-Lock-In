// ============================================================
// LeetCode Lock-In — LeetCode GraphQL API Integration
// Runs on leetcode.com/* to fetch solved problems
// Uses the user's existing session cookies (credentials: include)
// ============================================================

(function () {
  "use strict";

  const GRAPHQL_URL = "https://leetcode.com/graphql";

  // ── GraphQL Queries ──────────────────────────

  const QUERIES = {
    // Get user profile to verify login
    userProfile: `
      query globalData {
        userStatus {
          isSignedIn
          username
        }
      }
    `,

    // Get recent accepted submissions for a user
    recentAcSubmissions: `
      query recentAcSubmissions($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          titleSlug
          title
        }
      }
    `,

    // Paginated question list with status filter
    problemsetQuestionList: `
      query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
        problemsetQuestionList: questionList(
          categorySlug: $categorySlug
          limit: $limit
          skip: $skip
          filters: $filters
        ) {
          total: totalNum
          questions: data {
            acRate
            difficulty
            status
            title
            titleSlug
          }
        }
      }
    `
  };

  // ── CSRF Token ──────────────────────────────

  function getCSRFToken() {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : "";
  }

  // ── API Functions ────────────────────────────

  function extractOperationName(query) {
    const match = query.match(/(?:query|mutation)\s+(\w+)/);
    return match ? match[1] : undefined;
  }

  async function graphqlFetch(query, variables = {}) {
    try {
      const headers = {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
        "Origin": "https://leetcode.com",
      };

      // Add CSRF token if available (LeetCode requires it)
      const csrf = getCSRFToken();
      if (csrf) {
        headers["x-csrftoken"] = csrf;
      }

      const operationName = extractOperationName(query);

      const body = { query, variables };
      if (operationName) {
        body.operationName = operationName;
      }

      const response = await fetch(GRAPHQL_URL, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.warn("[LeetCode Lock-In API] GraphQL request failed:", response.status, text);
        return null;
      }

      const data = await response.json();
      if (data.errors) {
        console.warn("[LeetCode Lock-In API] GraphQL errors:", data.errors);
      }
      return data.data;
    } catch (err) {
      console.warn("[LeetCode Lock-In API] GraphQL error:", err);
      return null;
    }
  }

  async function checkLogin() {
    const data = await graphqlFetch(QUERIES.userProfile);
    if (data && data.userStatus && data.userStatus.isSignedIn) {
      return {
        isLoggedIn: true,
        username: data.userStatus.username,
      };
    }
    return { isLoggedIn: false, username: null };
  }

  async function fetchAllSolvedSlugs(username) {
    // Strategy 1: Try recent AC submissions (fast, up to 500)
    const recentData = await graphqlFetch(QUERIES.recentAcSubmissions, {
      username,
      limit: 500,
    });
    if (recentData && recentData.recentAcSubmissionList) {
      const seen = new Set();
      const slugs = [];
      for (const s of recentData.recentAcSubmissionList) {
        if (!seen.has(s.titleSlug)) {
          seen.add(s.titleSlug);
          slugs.push({ slug: s.titleSlug, title: s.title });
        }
      }
      console.log(`[LeetCode Lock-In API] Got ${slugs.length} solved from recent submissions.`);

      // If <490 unique results, we likely have them all
      if (slugs.length < 490) return slugs;
    }

    // Strategy 2: Paginated question list (for users with 500+ solved)
    console.log("[LeetCode Lock-In API] Fetching full solved list via pagination...");
    const allSlugs = [];
    let skip = 0;
    const batchSize = 50;
    let total = Infinity;

    while (skip < total) {
      const data = await graphqlFetch(QUERIES.problemsetQuestionList, {
        categorySlug: "",
        limit: batchSize,
        skip: skip,
        filters: { status: "AC" },
      });

      if (!data || !data.problemsetQuestionList) break;

      total = data.problemsetQuestionList.total;
      const questions = data.problemsetQuestionList.questions || [];

      for (const q of questions) {
        allSlugs.push({
          slug: q.titleSlug,
          title: q.title,
          difficulty: q.difficulty,
        });
      }

      skip += batchSize;
      if (skip > 3000) break; // Safety cap
    }

    return allSlugs;
  }

  // ── Sync solved problems to extension storage ──

  async function syncSolvedProblems() {
    const loginStatus = await checkLogin();

    if (!loginStatus.isLoggedIn) {
      console.log("[LeetCode Lock-In API] User not logged in, skipping sync.");
      chrome.runtime.sendMessage({
        type: "LEETCODE_SYNC",
        success: false,
        reason: "not_logged_in",
      });
      return;
    }

    console.log(`[LeetCode Lock-In API] Syncing for user: ${loginStatus.username}`);

    const solved = await fetchAllSolvedSlugs(loginStatus.username);
    const solvedSlugs = solved.map((s) => s.slug);

    // Store in extension storage
    chrome.storage.local.set({
      leetcodeSolvedProblems: solvedSlugs,
      leetcodeUsername: loginStatus.username,
      leetcodeLastSync: Date.now(),
    });

    // Notify background
    chrome.runtime.sendMessage({
      type: "LEETCODE_SYNC",
      success: true,
      username: loginStatus.username,
      solvedCount: solvedSlugs.length,
      solvedSlugs: solvedSlugs,
    });

    console.log(
      `[LeetCode Lock-In API] Synced ${solvedSlugs.length} solved problems.`
    );
  }

  // ── Listen for sync requests from background ──

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "REQUEST_LEETCODE_SYNC") {
      syncSolvedProblems().then(() => {
        sendResponse({ success: true });
      });
      return true;
    }
  });

  // ── Auto-sync on page load ──────────────────

  // Only sync once every 10 minutes to avoid spamming
  chrome.storage.local.get("leetcodeLastSync", (data) => {
    const lastSync = data.leetcodeLastSync || 0;
    const tenMinutes = 10 * 60 * 1000;

    if (Date.now() - lastSync > tenMinutes) {
      // Delay sync slightly to avoid impacting page load
      setTimeout(syncSolvedProblems, 3000);
    }
  });

  console.log("[LeetCode Lock-In API] GraphQL integration active.");
})();
