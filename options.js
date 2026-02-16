// ============================================================
// LeetCode Lock-In — Options Page Logic
// ============================================================

// ── Theme Management ────────────────────────────

function getTheme() {
    return localStorage.getItem("lockin-theme") || "dark";
}

function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("lockin-theme", theme);
}

function toggleTheme() {
    setTheme(getTheme() === "dark" ? "light" : "dark");
}

setTheme(getTheme());

document.getElementById("themeToggle").addEventListener("click", toggleTheme);

// ── Constants & State ───────────────────────────

const DEFAULT_BLOCKED_DOMAINS = [
    "youtube.com", "twitter.com", "x.com", "reddit.com",
    "instagram.com", "facebook.com", "tiktok.com",
    "netflix.com", "twitch.tv", "discord.com",
    "snapchat.com", "pinterest.com"
];

let currentSettings = null;

// ── DOM Elements ────────────────────────────────

const els = {
    enabledToggle: document.getElementById("enabledToggle"),
    syncStatus: document.getElementById("syncStatus"),
    syncButton: document.getElementById("syncButton"),
    problemCount: document.getElementById("problemCount"),
    problemCountValue: document.getElementById("problemCountValue"),
    accessDuration: document.getElementById("accessDuration"),
    accessDurationValue: document.getElementById("accessDurationValue"),
    diffEasy: document.getElementById("diffEasy"),
    diffMedium: document.getElementById("diffMedium"),
    diffHard: document.getElementById("diffHard"),
    sourceNeetcode: document.getElementById("sourceNeetcode"),
    sourceStriver: document.getElementById("sourceStriver"),
    tagsContainer: document.getElementById("tagsContainer"),
    newDomain: document.getElementById("newDomain"),
    addDomainBtn: document.getElementById("addDomainBtn"),
    saveBtn: document.getElementById("saveBtn"),
    saveStatus: document.getElementById("saveStatus")
};

// ── Load Settings ───────────────────────────────

async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get("settings", (data) => {
            if (data.settings) {
                resolve(data.settings);
            } else {
                resolve({
                    enabled: true,
                    requiredCount: 3,
                    accessDurationHours: 1,
                    difficultyFilter: ["Easy", "Medium", "Hard"],
                    problemSource: "neetcode150",
                    blockedDomains: DEFAULT_BLOCKED_DOMAINS
                });
            }
        });
    });
}

async function init() {
    currentSettings = await loadSettings();
    renderSettings(currentSettings);
    loadSyncStatus();
}

function renderSettings(settings) {
    els.enabledToggle.checked = settings.enabled;
    els.problemCount.value = settings.requiredCount;
    els.problemCountValue.textContent = settings.requiredCount;

    const hours = settings.accessDurationHours || 1;
    els.accessDuration.value = hours;
    els.accessDurationValue.textContent = hours + "h";

    els.diffEasy.checked = settings.difficultyFilter.includes("Easy");
    els.diffMedium.checked = settings.difficultyFilter.includes("Medium");
    els.diffHard.checked = settings.difficultyFilter.includes("Hard");

    if (settings.problemSource === "striver") {
        els.sourceStriver.checked = true;
    } else {
        els.sourceNeetcode.checked = true;
    }

    renderTags(settings.blockedDomains);
}

// ── Tags ────────────────────────────────────────

function renderTags(domains) {
    els.tagsContainer.innerHTML = "";
    domains.forEach(domain => {
        const tag = document.createElement("div");
        tag.className = "tag";
        tag.innerHTML = `
      <span>${domain}</span>
      <button class="tag-remove" data-domain="${domain}">✕</button>
    `;
        els.tagsContainer.appendChild(tag);
    });

    // Attach remove handlers
    els.tagsContainer.querySelectorAll(".tag-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            const domain = btn.dataset.domain;
            currentSettings.blockedDomains = currentSettings.blockedDomains.filter(d => d !== domain);
            renderTags(currentSettings.blockedDomains);
        });
    });
}

function addDomain() {
    let domain = els.newDomain.value.trim().toLowerCase();
    if (!domain) return;

    // Clean up domain input
    domain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

    if (currentSettings.blockedDomains.includes(domain)) {
        els.newDomain.value = "";
        return;
    }

    currentSettings.blockedDomains.push(domain);
    renderTags(currentSettings.blockedDomains);
    els.newDomain.value = "";
}

// ── LeetCode Sync Status ────────────────────────

function loadSyncStatus() {
    chrome.storage.local.get(["leetcodeUsername", "leetcodeLastSync", "leetcodeSolvedProblems"], (data) => {
        if (data.leetcodeUsername && data.leetcodeLastSync) {
            const ago = getTimeAgo(data.leetcodeLastSync);
            const count = data.leetcodeSolvedProblems ? data.leetcodeSolvedProblems.length : 0;
            els.syncStatus.textContent = `${data.leetcodeUsername} — ${count} solved — synced ${ago}`;
            els.syncStatus.style.color = "var(--green)";
        } else {
            els.syncStatus.textContent = "Not synced. Visit leetcode.com to sync.";
            els.syncStatus.style.color = "var(--text-muted)";
        }
    });
}

function getTimeAgo(timestamp) {
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// ── Save ────────────────────────────────────────

function gatherSettings() {
    const difficulties = [];
    if (els.diffEasy.checked) difficulties.push("Easy");
    if (els.diffMedium.checked) difficulties.push("Medium");
    if (els.diffHard.checked) difficulties.push("Hard");

    return {
        enabled: els.enabledToggle.checked,
        requiredCount: parseInt(els.problemCount.value),
        accessDurationHours: parseInt(els.accessDuration.value),
        difficultyFilter: difficulties.length > 0 ? difficulties : ["Easy", "Medium", "Hard"],
        problemSource: els.sourceStriver.checked ? "striver" : "neetcode150",
        blockedDomains: currentSettings.blockedDomains
    };
}

function saveSettings() {
    const settings = gatherSettings();
    chrome.storage.sync.set({ settings }, () => {
        if (chrome.runtime.lastError) {
            showSaveStatus("✗ Save failed: " + chrome.runtime.lastError.message);
            return;
        }
        currentSettings = settings;
        showSaveStatus("✓ Settings saved!");
        console.log("[LeetCode Lock-In] Settings saved:", settings);
    });
}

function showSaveStatus(message) {
    els.saveStatus.textContent = message;
    els.saveStatus.classList.add("visible");
    setTimeout(() => {
        els.saveStatus.classList.remove("visible");
    }, 2500);
}

// ── Event Listeners ─────────────────────────────

els.problemCount.addEventListener("input", () => {
    els.problemCountValue.textContent = els.problemCount.value;
});

els.accessDuration.addEventListener("input", () => {
    els.accessDurationValue.textContent = els.accessDuration.value + "h";
});

els.addDomainBtn.addEventListener("click", addDomain);
els.newDomain.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDomain();
});

els.saveBtn.addEventListener("click", saveSettings);

els.syncButton.addEventListener("click", () => {
    // Open LeetCode to trigger sync
    chrome.tabs.create({ url: "https://leetcode.com", active: false });
    els.syncStatus.textContent = "Syncing... visit LeetCode tab.";
    els.syncStatus.style.color = "var(--accent)";
    setTimeout(loadSyncStatus, 8000);
});

// ── Init ────────────────────────────────────────

init();
