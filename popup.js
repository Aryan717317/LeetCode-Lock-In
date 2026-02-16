// ============================================================
// LeetCode Lock-In — Popup Logic (Revamped)
// ============================================================

const els = {
    quickToggle: document.getElementById("quickToggle"),
    statusDot: document.getElementById("statusDot"),
    statusLabel: document.getElementById("statusLabel"),
    statusDetail: document.getElementById("statusDetail"),
    statusCard: document.getElementById("statusCard"),
    statusIconRight: document.getElementById("statusIcon"),
    lockProgress: document.getElementById("lockProgress"),
    miniCount: document.getElementById("miniCount"),
    miniFill: document.getElementById("miniFill"),
    miniProblemTitle: document.getElementById("miniProblemTitle"),
    miniProblemDiff: document.getElementById("miniProblemDiff"),
    miniSolveBtn: document.getElementById("miniSolveBtn"),
    syncText: document.getElementById("syncText"),
    settingsBtn: document.getElementById("settingsBtn"),
    themeToggle: document.getElementById("themeToggle")
};

// ── Theme Management ────────────────────────────

function getTheme() {
    return localStorage.getItem("lockin-theme") || "dark";
}

function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("lockin-theme", theme);
}

function toggleTheme() {
    const current = getTheme();
    const next = current === "dark" ? "light" : "dark";
    setTheme(next);
}

// Apply saved theme on load
setTheme(getTheme());

els.themeToggle.addEventListener("click", toggleTheme);

// ── Status Icons (SVG helpers) ──────────────────

const SVG_CHECK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const SVG_LOCK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const SVG_PAUSE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

// ── Fetch Status ────────────────────────────────

function fetchStatus() {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
        if (chrome.runtime.lastError || !response) return;
        renderPopup(response);
    });
}

function renderPopup(data) {
    const { lockState, settings, isLocked } = data;

    // Toggle state
    els.quickToggle.checked = settings.enabled;

    if (!settings.enabled) {
        setStatusState("disabled", "Disabled", "Extension is paused", SVG_PAUSE);
        els.lockProgress.style.display = "none";
        return;
    }

    if (isLocked && lockState) {
        setStatusState("locked", "Locked", `Blocked: ${truncateUrl(lockState.originalUrl)}`, SVG_LOCK);

        // Show progress
        els.lockProgress.style.display = "block";
        const solved = lockState.solvedCount || 0;
        const required = lockState.requiredCount || 1;
        els.miniCount.textContent = `${solved} / ${required}`;
        els.miniFill.style.width = `${(solved / required) * 100}%`;

        if (lockState.currentProblem) {
            els.miniProblemTitle.textContent = lockState.currentProblem.title;
            const diff = (lockState.currentProblem.difficulty || "Easy").toLowerCase();
            els.miniProblemDiff.textContent = lockState.currentProblem.difficulty;
            els.miniProblemDiff.className = "problem-badge " + diff;
            els.miniSolveBtn.href = `https://leetcode.com/problems/${lockState.currentProblem.slug}/`;
        }
    } else {
        setStatusState("active", "Active", `Monitoring ${settings.blockedDomains.length} sites`, SVG_CHECK);
        els.lockProgress.style.display = "none";
    }
}

function setStatusState(state, title, detail, iconSvg) {
    els.statusLabel.textContent = title;
    els.statusDetail.textContent = detail;
    els.statusIconRight.innerHTML = iconSvg;

    // Reset classes
    els.statusDot.className = "status-dot";
    els.statusIconRight.className = "status-icon-right";

    if (state === "locked") {
        els.statusDot.classList.add("locked");
        els.statusIconRight.classList.add("locked");
    } else if (state === "disabled") {
        els.statusDot.classList.add("disabled");
        els.statusIconRight.classList.add("disabled");
    }
}

function truncateUrl(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return url.substring(0, 30);
    }
}

// ── Sync Info ───────────────────────────────────

function loadSyncInfo() {
    chrome.storage.local.get(["leetcodeUsername", "leetcodeSolvedProblems"], (data) => {
        if (data.leetcodeUsername) {
            const count = data.leetcodeSolvedProblems ? data.leetcodeSolvedProblems.length : 0;
            els.syncText.textContent = `${data.leetcodeUsername} — ${count} solved`;
        } else {
            els.syncText.textContent = "Not synced with LeetCode";
        }
    });
}

// ── Event Listeners ─────────────────────────────

els.quickToggle.addEventListener("change", () => {
    chrome.runtime.sendMessage({
        type: "TOGGLE_ENABLED",
        enabled: els.quickToggle.checked
    }, () => {
        fetchStatus();
    });
});

els.settingsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
});

// ── Init ────────────────────────────────────────

fetchStatus();
loadSyncInfo();
