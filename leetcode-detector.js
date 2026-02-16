// ============================================================
// LeetCode Lock-In — LeetCode Solve Detector
// Runs on leetcode.com/problems/* at document_idle
// ============================================================

(function () {
    "use strict";

    let hasDetected = false;
    let pollInterval = null;

    // Extract problem slug from URL
    function getProblemSlug() {
        const match = window.location.pathname.match(/\/problems\/([^/]+)/);
        return match ? match[1] : null;
    }

    // Check if an "Accepted" result is visible on the page
    function checkForAccepted() {
        // Strategy 1: Check data-e2e-locator attribute
        const e2eResult = document.querySelector('[data-e2e-locator="submission-result"]');
        if (e2eResult && e2eResult.textContent.trim().toLowerCase() === "accepted") {
            return true;
        }

        // Strategy 2: Check common green-text class patterns used by LeetCode
        const greenSelectors = [
            ".text-green-s",
            ".text-green-60",
            '[class*="success"]',
            '[class*="accepted"]',
            '[data-cy="submission-accepted"]'
        ];

        for (const sel of greenSelectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim().toLowerCase().includes("accepted")) {
                return true;
            }
        }

        // Strategy 3: Broad search for "Accepted" in submission result areas
        const allElements = document.querySelectorAll(
            '[class*="result"], [class*="status"], [class*="submission"], [class*="Result"], [class*="Status"]'
        );
        for (const el of allElements) {
            const text = el.textContent.trim().toLowerCase();
            if (text === "accepted" || text.startsWith("accepted")) {
                return true;
            }
        }

        // Strategy 4: Check for the specific submission detail pattern
        const spans = document.querySelectorAll("span");
        for (const span of spans) {
            if (
                span.textContent.trim() === "Accepted" &&
                span.closest('[class*="submission"], [class*="result"], [class*="detail"]')
            ) {
                return true;
            }
        }

        return false;
    }

    function onAccepted() {
        if (hasDetected) return;
        hasDetected = true;

        const slug = getProblemSlug();
        if (!slug) return;

        console.log(`[LeetCode Lock-In] ✅ Accepted detected for: ${slug}`);

        // Notify background
        chrome.runtime.sendMessage(
            { type: "SOLVED", slug: slug },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("[LeetCode Lock-In] Could not notify background:", chrome.runtime.lastError);
                    return;
                }

                if (response && response.allSolved) {
                    // Show celebration before redirect
                    showCelebration();
                } else if (response && response.success) {
                    showProgress(response.lockState);
                }
            }
        );

        // Stop polling
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    function showCelebration() {
        const overlay = document.createElement("div");
        overlay.innerHTML = `
      <div style="
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(0,0,0,0.85);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', system-ui, sans-serif;
        color: #fff;
        animation: fadeIn 0.3s ease;
      ">
        <div style="font-size: 80px; animation: bounce 0.6s ease infinite alternate;">🎉</div>
        <div style="
          font-size: 28px;
          font-weight: 800;
          margin-top: 16px;
          background: linear-gradient(135deg, #22c55e, #10b981);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        ">All Problems Solved!</div>
        <div style="font-size: 16px; color: #94a3b8; margin-top: 8px;">
          Redirecting you back...
        </div>
      </div>
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bounce { from { transform: scale(1); } to { transform: scale(1.2); } }
      </style>
    `;
        document.body.appendChild(overlay);
    }

    function showProgress(lockState) {
        if (!lockState) return;

        const toast = document.createElement("div");
        toast.innerHTML = `
      <div style="
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        background: linear-gradient(135deg, #1e293b, #334155);
        border: 1px solid #475569;
        border-radius: 16px;
        padding: 20px 24px;
        font-family: 'Inter', system-ui, sans-serif;
        color: #fff;
        box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        animation: slideIn 0.4s ease;
        max-width: 320px;
      ">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
          <span style="font-size: 24px;">✅</span>
          <span style="font-weight: 700; font-size: 16px;">Problem Solved!</span>
        </div>
        <div style="
          background: #1e1e3f;
          border-radius: 8px;
          height: 8px;
          overflow: hidden;
          margin-bottom: 8px;
        ">
          <div style="
            height: 100%;
            width: ${(lockState.solvedCount / lockState.requiredCount) * 100}%;
            background: linear-gradient(90deg, #fbbf24, #f59e0b);
            border-radius: 8px;
            transition: width 0.5s ease;
          "></div>
        </div>
        <div style="font-size: 13px; color: #94a3b8;">
          ${lockState.solvedCount}/${lockState.requiredCount} complete — keep going!
        </div>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
        document.body.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.style.transition = "opacity 0.5s ease";
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 500);
        }, 5000);
    }

    // ── Start Polling ─────────────────────────────
    function startPolling() {
        // Check immediately
        if (checkForAccepted()) {
            onAccepted();
            return;
        }

        // Then poll every 2 seconds
        pollInterval = setInterval(() => {
            if (checkForAccepted()) {
                onAccepted();
            }
        }, 2000);
    }

    // Also watch for DOM mutations for faster detection
    const observer = new MutationObserver(() => {
        if (!hasDetected && checkForAccepted()) {
            onAccepted();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // Start
    startPolling();

    // Cleanup on navigation
    window.addEventListener("beforeunload", () => {
        if (pollInterval) clearInterval(pollInterval);
        observer.disconnect();
        hasDetected = false;
    });

    // Re-check on URL changes (SPA navigation)
    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            hasDetected = false;
            startPolling();
        }
    });
    urlObserver.observe(document.querySelector("head > title") || document.head, {
        childList: true,
        subtree: true,
        characterData: true
    });

    console.log("[LeetCode Lock-In] Detector active on:", getProblemSlug());
})();
