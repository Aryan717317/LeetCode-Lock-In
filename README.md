# 🔒 LeetCode Lock-In

> Block distracting websites until you solve LeetCode problems. Stay disciplined, stay sharp.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## How It Works

```
User opens distracting site → Intercepted → Redirected to Lock Page
     → Solve N LeetCode problems → Accepted! → Original site unlocked
```

1. **Navigate** to a blocked site (YouTube, Reddit, Twitter, etc.)
2. **Redirected** to a sleek lock page showing your assigned problems
3. **Solve** the required number of LeetCode problems
4. **Unlocked** — automatically redirected back to your original destination

## Features

- 🧠 **Smart Problem Selection** — Filters out already-solved problems via LeetCode GraphQL API
- 📊 **Two Curated Sheets** — NeetCode 150 and Striver SDE Sheet
- 🎯 **Difficulty Filter** — Choose Easy, Medium, Hard or any combination
- 🔢 **Configurable Count** — Set 1–10 problems required per lock
- 🛡️ **Anti-Cheat** — All tabs blocked while locked, state persisted across refreshes
- 🔗 **LeetCode Sync** — Reads your solved problems to avoid duplicates
- 🎨 **Premium Dark UI** — Glassmorphism, animations, progress tracking
- ⚡ **Zero External Calls** — Everything runs locally in your browser

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in top-right)
4. Click **"Load unpacked"**
5. Select the `leetcode-lockin` folder
6. Pin the extension from the toolbar

## Architecture

```
leetcode-lockin/
├── manifest.json          # MV3 manifest
├── background.js          # Service worker — lock logic, state, redirects
├── content.js             # Global gatekeeper — detects blocked sites
├── leetcode-detector.js   # Solve detection — polls for "Accepted"
├── leetcode-api.js        # GraphQL sync — fetches solved problems
├── lock.html/css/js       # Lock page UI — progress, problem cards
├── options.html/css/js    # Settings page — domains, count, difficulty
├── popup.html/css/js      # Toolbar popup — quick status & toggle
├── problems/
│   ├── neetcode150.json   # NeetCode 150 problem list
│   └── striver.json       # Striver SDE Sheet
├── icons/                 # Extension icons (16, 48, 128px)
└── generate-icons.js      # Icon generator script
```

## Configuration

Click the extension icon → **Settings** to configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Problems Required | 3 | Number of problems to solve per lock |
| Difficulty | All | Filter by Easy/Medium/Hard |
| Problem Source | NeetCode 150 | Choose curated sheet |
| Blocked Sites | 12 popular sites | Add/remove domains |

## Default Blocked Sites

YouTube, Twitter/X, Reddit, Instagram, Facebook, TikTok, Netflix, Twitch, Discord, Snapchat, Pinterest

## LeetCode Account Integration

When you visit `leetcode.com` while logged in, the extension automatically syncs your solved problems. This ensures you **never get assigned a problem you've already solved**.

> 🔐 **Privacy:** All data stays local. No cookies are stored or sent externally. The extension only reads your public solve status via GraphQL.

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript (no frameworks)
- Chrome Storage API
- LeetCode GraphQL API
- CSS3 with glassmorphism & animations

## License

MIT
