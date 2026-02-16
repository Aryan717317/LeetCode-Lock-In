// ============================================================
// LeetCode Lock-In — Content Script (Gatekeeper)
// Runs on <all_urls> at document_start
// ============================================================

(function () {
    "use strict";

    // Don't run on extension pages or LeetCode
    const url = window.location.href;
    if (
        url.startsWith("chrome://") ||
        url.startsWith("chrome-extension://") ||
        url.startsWith("about:") ||
        url.startsWith("edge://") ||
        url.includes("leetcode.com")
    ) {
        return;
    }

    // Notify the background worker about this page visit
    chrome.runtime.sendMessage(
        { type: "PAGE_VISIT", url: url },
        (response) => {
            if (chrome.runtime.lastError) {
                // Extension context invalidated, ignore
                return;
            }

            if (response && response.action === "BLOCK") {
                // Show a brief blocking overlay before the redirect happens
                showBlockOverlay();
            }
        }
    );

    function showBlockOverlay() {
        // Create a full-page overlay to indicate blocking
        const overlay = document.createElement("div");
        overlay.id = "leetcode-lockin-overlay";
        overlay.innerHTML = `
      <div style="
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
        color: #fff;
        opacity: 0;
        transition: opacity 0.3s ease;
      ">
        <div style="font-size: 64px; margin-bottom: 16px;">🔒</div>
        <div style="
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(135deg, #fbbf24, #f59e0b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
        ">LeetCode Lock-In</div>
        <div style="font-size: 14px; color: #94a3b8;">Redirecting to your problems...</div>
      </div>
    `;

        if (document.body) {
            document.body.appendChild(overlay);
        } else {
            document.documentElement.appendChild(overlay);
        }

        // Fade in
        requestAnimationFrame(() => {
            const inner = overlay.querySelector("div");
            if (inner) inner.style.opacity = "1";
        });
    }
})();
