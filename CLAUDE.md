# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

X Bookmark Resurfacer is a Chrome extension (Manifest V3) that resurfaces bookmarked X/Twitter posts into the user's home feed as reminders. It uses API interception to capture bookmarks and injects styled post cards into the timeline.

## Development

This is a Chrome extension with no build step. To develop:
1. Load unpacked extension at `chrome://extensions` (enable Developer mode)
2. Point to the `0. source/XBookmarkResurfacer` folder
3. Reload extension after changes

Debug commands (run in Service Worker console):
```javascript
manualResurface()  // Trigger immediate resurface
showStats()        // Show bookmark statistics
resetStats()       // Clear cooldowns
checkAlarm()       // Check alarm status
```

## Architecture

### Dual Module System
The extension maintains two versions of shared code due to Chrome's content script limitations:
- `utils/constants.js` + `utils/helpers.js` - For content scripts (no ES modules)
- `utils/constants.module.js` + `utils/helpers.module.js` - For service worker (ES modules)

**Important**: Keep both versions synchronized when modifying constants or helpers.

### Message Flow
Communication uses `MESSAGE_TYPES` constants for all cross-context messaging:
- Content scripts ↔ Service worker via `chrome.runtime.sendMessage`
- Page script ↔ Content script via `window.postMessage`
- Cross-tab toast injection via `chrome.scripting.executeScript` (for stale content scripts)

### Key Components

**Service Worker** (`background/service-worker.js`)
- Orchestrates all background operations
- Manages Chrome alarms for scheduled resurfacing
- Handles all message types from popup and content scripts
- Controls badge icon state (red dot for stale sync)
- Injects sync toast into other X tabs via `chrome.scripting.executeScript`

**Storage Manager** (`background/storage-manager.js`)
- IndexedDB wrapper for bookmark persistence
- Tracks resurface stats (count, cooldowns, retirement)
- Provides eligibility filtering for bookmark selection

**Content Script** (`content/content-script.js`)
- Main orchestrator on X pages
- Coordinates API interception, bookmark fetching, and injection
- Manages session limits and visibility-aware toast queuing
- Tracks `scriptInitTime` to prevent toasts on tabs opened after sync

**Post Injector** (`content/post-injector.js`)
- Creates native-looking post cards with full styling
- Handles timeline DOM manipulation (virtual list aware)
- Manages toast notifications (View, Reload, Go to Home, Scroll for more)

**Bookmark Fetcher** (`content/bookmark-fetcher.js`)
- Direct GraphQL API calls to X's bookmark endpoint
- Query ID discovery and caching (7-day expiry)
- Fallback query IDs for resilience

**API Interceptor** (`content/api-interceptor.js`, `content/early-injector.js`)
- Injected at `document_start` to intercept fetch responses
- Captures bookmark data when user visits `/i/bookmarks`
- Discovers and caches working query IDs

### Toast System
Unified toast UI with blue background (#1d9bf0) and white pill-shaped buttons:
- **View**: Scrolls to top when bookmark resurfaced while scrolled down
- **Reload**: Prompts page reload after sync (saves `syncToastAcknowledgedAt` to prevent duplicates)
- **Go to Home**: Navigates to home feed when bookmark resurfaced elsewhere
- **Scroll for more**: On bookmarks page, scrolls down 25000px to trigger loading more bookmarks

Toast display is visibility-aware: if tab is hidden, toast waits for `visibilitychange` event.

### Timing Configuration
Defined in `TIMING_CONFIG` and `INJECTION_CONFIG`:
- First resurface: 5 minutes after sync
- Default interval: 20 minutes (user configurable: 10min-2hr)
- Per-bookmark cooldown: 1 hour
- Max resurface count: 10 per bookmark (then retired)
- Session limit: 5 resurfaced posts

### Multi-Tab Support
- Sync notifications broadcast to all X tabs via `chrome.scripting.executeScript`
- Works even with stale content scripts after extension reload
- Only shows sync toast on tabs that were open during sync (via `scriptInitTime` check)
- "Resurface Now" injects different bookmarks into each home feed tab
- Pending bookmark storage for deferred injection when navigating to home feed

### Storage Keys
Key chrome.storage.local entries:
- `lastAutoFetch`: Timestamp of last bookmark sync
- `syncToastAcknowledgedAt`: Timestamp when user acknowledged sync toast (prevents duplicates)
- `bookmarksQueryId`: Cached GraphQL query ID for bookmarks endpoint
- `queryIdTimestamp`: When query ID was cached (7-day expiry)
- `pendingResurfaceBookmark`: Bookmark waiting to be injected when user navigates to home feed

## Release Process

Zip files for Chrome Web Store are stored in `1. releases/` with naming pattern `XBookmarkResurfacer-v{version}.zip`. Update `manifest.json` version, then create zip excluding `.git`, `node_modules`, and dev files.
