# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current State (v1.1.5)

- **Version**: 1.1.5 (on `main` branch)
- **Chrome Web Store**: v1.1.3 approved, v1.1.5 pending submission
- **GitHub**: https://github.com/antmgarcia/x-bookmark-resurfacer

### Recent Session Work
- v1.1.2 (Jan 2026): Multi-tab sync, cross-tab toasts, three-theme support (Light/Dim/Dark)
- v1.1.3 (Jan 2026): Fixed persistent resurfaced post bug, reload button, incremental scroll (4×3000px)
- v1.1.4 (Jan-Feb 2026): Pending bookmark for alarm-based resurfaces; comprehensive audit fixing data-loss bug, race conditions, security hardening, and dead code cleanup

### Pending Items
- Promo video for Chrome Web Store (screen recordings + CapCut editing)

## Project Overview

X Bookmark Resurfacer is a Chrome extension (Manifest V3) that resurfaces bookmarked X/Twitter posts into the user's home feed as reminders. It uses API interception to capture bookmarks and injects styled post cards into the timeline.

**Core Insight**: Bookmarks are where content goes to be forgotten. Instead of expecting users to visit their bookmarks, this extension brings bookmarks to the user, right in the feed where attention already lives.

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
- Page script ↔ Content script via `window.postMessage` (validated: type must be string, queryId must match `[a-zA-Z0-9_-]+`, data must be object)
- Cross-tab toast injection via `chrome.scripting.executeScript` (for stale content scripts)
- `STORE_BOOKMARKS` validates input is an array with valid `id` fields before writing to IndexedDB

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
- `saveBookmarks()` preserves existing resurface stats (cooldowns, counts, `bookmark_added_at`) via get-then-put pattern
- `saveBookmarks()` returns total database count (not batch count) for accurate toast display
- Handles unexpected IndexedDB connection close with automatic reconnection on next operation

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
- Session limit: 5 resurfaced posts (bypassed by manual "Resurface Now")
- Interval change: Triggers 3-minute quick resurface, then new interval applies

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
- `resurfaceInterval`: User's chosen interval in minutes (default: 20)
- `bookmarkCount`: Total synced bookmarks in database
- `enabled`: Extension on/off state

## Release Process

Zip files for Chrome Web Store are stored in `1. releases/` with naming pattern `XBookmarkResurfacer-v{version}.zip`. Update `manifest.json` version, then create zip excluding `.git`, `node_modules`, and dev files.

### Version Checklist
When bumping version, update in **5 places**:
1. `manifest.json` - `"version": "x.x.x"`
2. `popup/popup.js` - comment header `(vx.x.x)`
3. `popup/popup.html` - footer `<span>vx.x.x</span>`
4. `welcome/welcome.html` - footer `v.x.x.x`
5. `content/content-script.js` - log line `Content script loading vx.x.x`

### Git Branch Strategy
- `main` - released/approved versions
- `feat/v{version}-{description}` - feature branches (merge to main when ready)

## Key Implementation Details

### Theme Detection (X has 3 themes, not 2)
X uses three distinct themes, detected via `getComputedStyle(document.body).backgroundColor`:
- **Light**: RGB > 200 → white background
- **Dim**: RGB ~21,32,43 → `#15202b` (dark blue)
- **Dark**: RGB < 30 → `#000000` (true black)

CSS-based dark mode selectors (`prefers-color-scheme`, `data-theme`) do NOT work for X. All theme-aware styling must be applied **inline via JavaScript**. The CSS file `resurfaced.css` only contains toast styles and base classes — no dark mode CSS rules.

### Pending Bookmark Flow
When resurface is triggered but user isn't on home feed:
1. Bookmark stored in `chrome.storage.local` as `pendingResurfaceBookmark`
2. Manual resurface: shows "Go to Home" toast
3. Alarm-based resurface: stores silently (no toast)
4. On navigation to home feed: `checkAndInjectPendingBookmark()` runs after 1.5s
5. Pending bookmark injected and cleared from storage

### Interval Change Behavior
When user changes resurface interval in settings:
1. New interval saved to storage
2. Alarm reset to **3 minutes** (quick resurface so user doesn't wait out old interval)
3. After that resurface, new interval takes effect

### Bookmarks Page Scroll
Single large scrolls don't trigger X's lazy loading reliably. Use incremental scrolling:
- 4 scrolls × 3000px with 1.5s delays between each

### Reload Button Pattern
`chrome.storage.local.set()` can fail silently. Always use `.finally()` for critical operations:
```javascript
chrome.storage.local.set({ ... })
  .catch(() => {})
  .finally(() => {
    window.location.reload();
  });
```

## Privacy Justifications (Chrome Web Store)

For `scripting` permission:
> Required to inject sync notification toasts into other open X/Twitter tabs when bookmarks are synced. This enables cross-tab communication even when content scripts become stale after extension reload.

Single purpose:
> Resurfaces bookmarked X/Twitter posts into the user's home feed as periodic reminders.
