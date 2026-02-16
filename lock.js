// ============================================================
// LeetCode Lock-In — Lock Page Logic
// ============================================================

const QUOTES = [
    { text: "The only way to learn programming is by writing programs.", author: "Dennis Ritchie" },
    { text: "First, solve the problem. Then, write the code.", author: "John Johnson" },
    { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
    { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
    { text: "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", author: "Martin Fowler" },
    { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
    { text: "Successful people do what unsuccessful people are not willing to do.", author: "Jim Rohn" },
    { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
    { text: "Don't wish it were easier. Wish you were better.", author: "Jim Rohn" },
    { text: "Consistency is what transforms average into excellence.", author: "Unknown" },
    { text: "Every expert was once a beginner.", author: "Helen Hayes" }
];

// ── DOM Elements ────────────────────────────────

const els = {
    subtitle: document.getElementById("subtitle"),
    blockedUrl: document.getElementById("blockedUrl"),
    progressCount: document.getElementById("progressCount"),
    progressFill: document.getElementById("progressFill"),
    progressGlow: document.getElementById("progressGlow"),
    progressSteps: document.getElementById("progressSteps"),
    problemNumber: document.getElementById("problemNumber"),
    problemTitle: document.getElementById("problemTitle"),
    problemCategory: document.getElementById("problemCategory"),
    difficultyBadge: document.getElementById("difficultyBadge"),
    solveButton: document.getElementById("solveButton"),
    queueList: document.getElementById("queueList"),
    queueSection: document.getElementById("queueSection"),
    quote: document.getElementById("quote"),
    quoteAuthor: document.getElementById("quoteAuthor"),
    lockIcon: document.getElementById("lockIcon")
};

// ── Particles ───────────────────────────────────

function createParticles() {
    const container = document.getElementById("particles");
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement("div");
        particle.className = "particle";
        particle.style.left = Math.random() * 100 + "%";
        particle.style.animationDuration = (8 + Math.random() * 12) + "s";
        particle.style.animationDelay = Math.random() * 10 + "s";
        particle.style.width = (2 + Math.random() * 4) + "px";
        particle.style.height = particle.style.width;
        container.appendChild(particle);
    }
}

// ── Random Quote ────────────────────────────────

function setRandomQuote() {
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    els.quote.textContent = `"${q.text}"`;
    els.quoteAuthor.textContent = `— ${q.author}`;
}

// ── Render State ────────────────────────────────

function renderStatus(data) {
    const { lockState } = data;

    if (!lockState || !lockState.isLocked) {
        els.subtitle.textContent = "You're free! No active lock.";
        els.blockedUrl.textContent = "None";
        els.progressCount.textContent = "✓";
        els.progressFill.style.width = "100%";
        els.progressGlow.style.width = "100%";
        els.lockIcon.classList.add("unlocked");
        return;
    }

    // Blocked URL
    try {
        const urlObj = new URL(lockState.originalUrl);
        els.blockedUrl.textContent = urlObj.hostname + urlObj.pathname;
    } catch {
        els.blockedUrl.textContent = lockState.originalUrl;
    }

    // Progress
    const solved = lockState.solvedCount || 0;
    const required = lockState.requiredCount || 1;
    const pct = (solved / required) * 100;

    els.progressCount.textContent = `${solved}/${required}`;
    els.progressFill.style.width = pct + "%";
    els.progressGlow.style.width = pct + "%";

    // Progress steps
    els.progressSteps.innerHTML = "";
    for (let i = 0; i < required; i++) {
        const step = document.createElement("div");
        step.className = "progress-step";
        if (i < solved) {
            step.classList.add("solved");
            step.innerHTML = "✓";
        } else if (i === solved) {
            step.classList.add("current");
            step.textContent = i + 1;
        } else {
            step.textContent = i + 1;
        }
        els.progressSteps.appendChild(step);
    }

    // Current problem
    const problem = lockState.currentProblem;
    if (problem) {
        els.problemNumber.textContent = `Problem #${solved + 1}`;
        els.problemTitle.textContent = problem.title;
        els.problemCategory.textContent = problem.category || "";

        const diff = (problem.difficulty || "Easy").toLowerCase();
        els.difficultyBadge.textContent = problem.difficulty;
        els.difficultyBadge.className = "difficulty-badge " + diff;

        els.solveButton.href = `https://leetcode.com/problems/${problem.slug}/`;
    }

    // Queue
    renderQueue(lockState);
}

function renderQueue(lockState) {
    const { assignedProblems, solvedProblems, solvedCount } = lockState;
    els.queueList.innerHTML = "";

    if (!assignedProblems || assignedProblems.length <= 1) {
        els.queueSection.style.display = "none";
        return;
    }

    els.queueSection.style.display = "block";

    assignedProblems.forEach((problem, i) => {
        const isSolved = solvedProblems && solvedProblems.includes(problem.slug);
        const isCurrent = i === solvedCount;

        const item = document.createElement("div");
        item.className = "queue-item" + (isSolved ? " solved" : "");

        const statusClass = isSolved ? "done" : isCurrent ? "active" : "pending";
        const statusContent = isSolved ? "✓" : isCurrent ? "→" : (i + 1);

        const diff = (problem.difficulty || "Easy").toLowerCase();
        const diffColors = {
            easy: "#22c55e",
            medium: "#fbbf24",
            hard: "#ef4444"
        };

        item.innerHTML = `
      <div class="queue-item-status ${statusClass}">${statusContent}</div>
      <div class="queue-item-info">
        <div class="queue-item-title">${problem.title}</div>
        <div class="queue-item-difficulty" style="color: ${diffColors[diff]}">${problem.difficulty}</div>
      </div>
    `;
        els.queueList.appendChild(item);
    });
}

// ── Fetch & Poll ────────────────────────────────

function fetchStatus() {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn("[Lock Page] Error fetching status:", chrome.runtime.lastError);
            return;
        }
        if (response) {
            renderStatus(response);
        }
    });
}

// ── Init ────────────────────────────────────────

createParticles();
setRandomQuote();
fetchStatus();

// Poll every 3 seconds
setInterval(fetchStatus, 3000);
