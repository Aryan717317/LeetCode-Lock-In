// ============================================================
// LeetCode Lock-In — Background Service Worker (Brain 🧠)
// ============================================================

const DEFAULT_BLOCKED_DOMAINS = [
  "youtube.com",
  "twitter.com",
  "x.com",
  "reddit.com",
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "netflix.com",
  "twitch.tv",
  "discord.com",
  "snapchat.com",
  "pinterest.com"
];

const WHITELISTED_PATTERNS = [
  "leetcode.com",
  "chrome://",
  "chrome-extension://",
  "about:",
  "edge://"
];

const DEFAULT_SETTINGS = {
  enabled: true,
  requiredCount: 3,
  accessDurationHours: 1,
  difficultyFilter: ["Easy", "Medium", "Hard"],
  problemSource: "neetcode150",
  blockedDomains: DEFAULT_BLOCKED_DOMAINS
};

// ── Initialization ──────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get("settings");
  if (!data.settings) {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
  }
  // Clear any stale lock state on install
  await chrome.storage.local.remove("lockState");
  console.log("[LeetCode Lock-In] Extension installed & initialized.");
});

// ── Helpers ─────────────────────────────────────────────────

function isWhitelisted(url) {
  if (!url) return true;
  return WHITELISTED_PATTERNS.some(pattern => url.includes(pattern));
}

function isBlocked(url, blockedDomains) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return blockedDomains.some(domain => {
      const cleanDomain = domain.replace(/^www\./, "");
      return hostname === cleanDomain || hostname.endsWith("." + cleanDomain);
    });
  } catch {
    return false;
  }
}

function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

async function getSettings() {
  const data = await chrome.storage.sync.get("settings");
  return data.settings || DEFAULT_SETTINGS;
}

async function getLockState() {
  const data = await chrome.storage.local.get("lockState");
  return data.lockState || null;
}

async function setLockState(state) {
  await chrome.storage.local.set({ lockState: state });
}

async function clearLockState() {
  await chrome.storage.local.remove("lockState");
}

async function setGracePeriod() {
  const settings = await getSettings();
  const hours = settings.accessDurationHours || 1;
  const durationMs = hours * 60 * 60 * 1000;
  await chrome.storage.local.set({ unlockGraceUntil: Date.now() + durationMs });
  console.log(`[LeetCode Lock-In] Access granted for ${hours} hour(s).`);
}

async function isInGracePeriod() {
  const data = await chrome.storage.local.get("unlockGraceUntil");
  return data.unlockGraceUntil && Date.now() < data.unlockGraceUntil;
}

async function loadProblems(source) {
  const filename = source === "striver" ? "striver.json" : "neetcode150.json";
  const url = chrome.runtime.getURL(`problems/${filename}`);
  const response = await fetch(url);
  return await response.json();
}

function filterByDifficulty(problems, difficulties) {
  if (!difficulties || difficulties.length === 0) return problems;
  return problems.filter(p => difficulties.includes(p.difficulty));
}

function pickRandomProblems(problems, count) {
  const shuffled = [...problems].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function getSolvedSlugs() {
  const data = await chrome.storage.local.get("leetcodeSolvedProblems");
  return data.leetcodeSolvedProblems || [];
}

function filterOutSolved(problems, solvedSlugs) {
  if (!solvedSlugs || solvedSlugs.length === 0) return problems;
  const solvedSet = new Set(solvedSlugs);
  return problems.filter(p => !solvedSet.has(p.slug));
}

// ── Core Lock Logic ─────────────────────────────────────────

async function initiateLock(originalUrl, tabId) {
  const settings = await getSettings();
  const existingLock = await getLockState();

  // If already locked, just redirect
  if (existingLock && existingLock.isLocked) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL("lock.html")
    });
    return;
  }

  // Skip if within grace period (just unlocked)
  if (await isInGracePeriod()) {
    console.log("[LeetCode Lock-In] In grace period, allowing access.");
    return;
  }

  // Load problems, filter by difficulty, then filter out already-solved
  const allProblems = await loadProblems(settings.problemSource);
  const byDifficulty = filterByDifficulty(allProblems, settings.difficultyFilter);
  const solvedSlugs = await getSolvedSlugs();
  const filtered = filterOutSolved(byDifficulty, solvedSlugs);
  const selected = pickRandomProblems(
    filtered.length > 0 ? filtered : byDifficulty,
    settings.requiredCount
  );

  const lockState = {
    isLocked: true,
    originalUrl: originalUrl,
    requiredCount: settings.requiredCount,
    solvedCount: 0,
    currentProblemIndex: 0,
    currentProblem: selected[0],
    assignedProblems: selected,
    solvedProblems: [],
    sessionId: generateSessionId(),
    lockedAt: Date.now()
  };

  await setLockState(lockState);

  chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL("lock.html")
  });

  console.log(`[LeetCode Lock-In] Locked! Must solve ${settings.requiredCount} problems.`);
}

async function handleSolved(slug) {
  const lockState = await getLockState();
  if (!lockState || !lockState.isLocked) return { success: false };

  // Don't double count
  if (lockState.solvedProblems.includes(slug)) {
    return { success: false, reason: "already_solved" };
  }

  lockState.solvedCount++;
  lockState.solvedProblems.push(slug);

  // Check if all problems are solved
  if (lockState.solvedCount >= lockState.requiredCount) {
    const originalUrl = lockState.originalUrl;
    await clearLockState();
    await setGracePeriod();
    console.log(`[LeetCode Lock-In] All problems solved! Unlocking → ${originalUrl}`);
    return { success: true, allSolved: true, originalUrl };
  }

  // Move to next problem
  lockState.currentProblemIndex = lockState.solvedCount;
  if (lockState.currentProblemIndex < lockState.assignedProblems.length) {
    lockState.currentProblem = lockState.assignedProblems[lockState.currentProblemIndex];
  }

  await setLockState(lockState);
  console.log(`[LeetCode Lock-In] Solved ${lockState.solvedCount}/${lockState.requiredCount}`);
  return { success: true, allSolved: false, lockState };
}

// ── Message Handling ────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    switch (message.type) {
      case "PAGE_VISIT": {
        const settings = await getSettings();
        if (!settings.enabled) {
          return { action: "ALLOW" };
        }

        const url = message.url;

        if (isWhitelisted(url)) {
          return { action: "ALLOW" };
        }

        if (!isBlocked(url, settings.blockedDomains)) {
          return { action: "ALLOW" };
        }

        // Check grace period (just unlocked)
        if (await isInGracePeriod()) {
          return { action: "ALLOW" };
        }

        // Check existing lock
        const lockState = await getLockState();
        if (lockState && lockState.isLocked) {
          // Already locked — redirect to lock page
          if (sender.tab) {
            chrome.tabs.update(sender.tab.id, {
              url: chrome.runtime.getURL("lock.html")
            });
          }
          return { action: "BLOCK" };
        }

        // Initiate new lock
        if (sender.tab) {
          await initiateLock(url, sender.tab.id);
        }
        return { action: "BLOCK" };
      }

      case "SOLVED": {
        const result = await handleSolved(message.slug);
        if (result.allSolved && result.originalUrl) {
          // Redirect all lock page tabs to original URL
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (tab.url && tab.url.includes(chrome.runtime.id) && tab.url.includes("lock.html")) {
              chrome.tabs.update(tab.id, { url: result.originalUrl });
            }
          }
          // Also redirect the sender tab if it's on LeetCode
          if (sender.tab) {
            chrome.tabs.update(sender.tab.id, { url: result.originalUrl });
          }
        }
        return result;
      }

      case "GET_STATUS": {
        const lockState = await getLockState();
        const settings = await getSettings();
        return {
          lockState,
          settings,
          isLocked: lockState ? lockState.isLocked : false
        };
      }

      case "GET_SETTINGS": {
        const settings = await getSettings();
        return { settings };
      }

      case "SETTINGS_UPDATED":
      case "SAVE_SETTINGS": {
        // 1. Persist settings if provided
        let newSettings = message.settings;
        if (newSettings) {
           await chrome.storage.sync.set({ settings: newSettings });
        } else {
           newSettings = await getSettings();
        }

        // 2. Apply to current active lock if exists
        const lockState = await getLockState();
        if (lockState && lockState.isLocked) {
           lockState.requiredCount = newSettings.requiredCount;
           
           // If the new count is met by what we've already solved, UNLOCK immediately
           if (lockState.solvedCount >= lockState.requiredCount) {
              const originalUrl = lockState.originalUrl;
              await clearLockState();
              await setGracePeriod();
              
              // Redirect all lock tabs
              const tabs = await chrome.tabs.query({});
              for (const tab of tabs) {
                 if (tab.url && tab.url.includes("lock.html")) {
                    chrome.tabs.update(tab.id, { url: originalUrl });
                 }
              }
           } else {
              // Otherwise just save the updated requirement so the UI updates on refresh
              await setLockState(lockState);
           }
        }
        return { success: true };
      }

      case "TOGGLE_ENABLED": {
        const settings = await getSettings();
        settings.enabled = message.enabled;
        await chrome.storage.sync.set({ settings });
        if (!message.enabled) {
          await clearLockState();
        }
        return { success: true, enabled: settings.enabled };
      }

      case "FORCE_UNLOCK": {
        await clearLockState();
        return { success: true };
      }

      case "LEETCODE_SYNC": {
        // Received sync data from leetcode-api.js
        if (message.success) {
          console.log(`[LeetCode Lock-In] Synced ${message.solvedCount} solved problems for ${message.username}`);
        }
        return { received: true };
      }

      default:
        return { error: "Unknown message type" };
    }
  };

  handler().then(sendResponse);
  return true; // Keep message channel open for async response
});

// ── Tab Navigation Interception ─────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading" || !tab.url) return;
  if (isWhitelisted(tab.url)) return;

  const settings = await getSettings();
  if (!settings.enabled) return;

  const lockState = await getLockState();

  if (lockState && lockState.isLocked && isBlocked(tab.url, settings.blockedDomains)) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL("lock.html")
    });
  }
});

console.log("[LeetCode Lock-In] Background service worker started.");
