# Changelog

All notable changes to X Bookmark Resurfacer will be documented in this file.

## [1.1.3] - 2026-01-26

### Fixed
- Fixed persistent resurfaced post reappearing on every page load (`pendingResurfaceBookmark` not cleared after injection)
- Fixed reload button on sync toast not triggering page reload (`.finally()` pattern ensures reload fires)
- Fixed bookmarks page scroll not loading more bookmarks (changed from single 25000px scroll to incremental 4 × 3000px scrolls with 1.5s delays)

### Technical
- `INJECT_PENDING_BOOKMARK` handler now clears `pendingResurfaceBookmark` from storage after retrieval
- Bookmarks page scroll uses incremental approach (4 × 3000px with 1.5s delays) for reliable lazy-load triggering

## [1.1.2] - 2026-01-22

### Added
- **Sync Notification Toast** - Other X tabs now show a "Bookmarks synced! Reload to start resurfacing." toast when bookmarks are synced from the bookmarks page
- **Multi-Tab Resurface** - "Resurface Now" button now injects different bookmarks into ALL open X home feed tabs simultaneously
- **Background Tab Toast Support** - All toasts (sync, resurface, go-to-home) queue for background tabs and appear when user switches to them
- **"Go to Home" Toast** - When clicking "Resurface Now" from a post-dedicated page, shows "Bookmark resurfaced in your home feed" toast with "Go to Home" button
- **Pending Bookmark Storage** - Bookmarks are stored for deferred injection when navigating to home feed from post-dedicated pages
- **"Scroll for more" Toast** - On bookmarks page, shows synced count with button to scroll down and load more bookmarks
- **Cross-Tab Sync via Scripting API** - Sync notifications work even with stale content scripts after extension reload
- **Quick Resurface on Interval Change** - Changing interval triggers a 3-minute resurface before new interval applies
- **CLAUDE.md Documentation** - Project documentation for Claude Code
- **SCENARIOS.md Documentation** - Comprehensive use cases and edge cases documentation

### Changed
- "Resurface Now" behavior improved: injects into all home feed tabs instead of just one
- Toast notifications are now visibility-aware and won't be missed on background tabs
- Toast duration increased from 5s/8s to 10 seconds for better visibility
- Pending bookmark injection delay reduced from 3s to 1.5s for faster UX
- Popup button shows "Waiting in Home" when bookmark is queued for home feed
- **Unified Toast UI** - All toasts now use consistent blue background (#1d9bf0) with white pill-shaped buttons and hover effects
- Sync toast only appears on tabs that were open during sync (not new tabs opened after)
- **Bookmark count shows total** - Sync toast now shows total bookmarks in database, not just batch count
- **Three-theme support** - Resurfaced post UI (gradient, chip) now adapts to X's Light, Dim (#15202b), and Dark (#000000) themes with distinct styling per mode

### Fixed
- Fixed duplicate toast appearing after clicking "Reload" on sync toast
- Fixed sync toast appearing on new tabs opened after sync completed
- Fixed bookmark count showing batch size (20) instead of total synced count

### Removed
- Removed unused "Too soon" error message (dead code)
- Removed unused `previousUrl` variable (code cleanup)

### Technical
- Added `scripting` permission for cross-tab toast injection via `chrome.scripting.executeScript`
- Added `NOTIFY_SYNC`, `SYNC_COMPLETE`, `NOTIFY_NO_HOME_FEED`, and `INJECT_PENDING_BOOKMARK` message types
- Added visibility change listener to handle background tab notifications
- Service worker now broadcasts sync events to all open X tabs via scripting API
- Service worker notifies non-home-feed tabs when manual resurface occurs
- `resurfaceBookmarks()` now fetches multiple bookmarks when needed for multi-tab injection
- Added `pendingResurfaceToast` and `pendingGoToHomeToast` flags for deferred toast display
- Added `isHomeFeed()` helper method for URL detection
- Added `checkAndInjectPendingBookmark()` for deferred bookmark injection
- Added `showGoToHomeToast()` and `showScrollForMoreToast()` methods in PostInjector
- Added `syncToastAcknowledgedAt` storage key to prevent duplicate toasts after reload
- Added `scriptInitTime` tracking to prevent toasts on tabs opened after sync
- Self-contained `showSyncToast()` function injected into tabs for stale script compatibility
- `saveBookmarks()` now returns total database count instead of batch count
- Interval change triggers 3-minute alarm before applying new interval
- Added `getThemeMode()` function detecting Light/Dim/Dark via `getComputedStyle(document.body).backgroundColor`

## [1.1.1] - 2026-01-17

### Added
- **"No Bookmarks Found" Screen** - New screen for users who synced but have zero bookmarks saved on X
- **"Fully Resurfaced" Screen** - New screen when all bookmarks have been resurfaced 10+ times
- **Toast Notification** - X-style toast with "View" button when manually resurfacing while scrolled down
- **Specific Error Messages** - Replaced vague "Not this time" with clear messages like "Session limit reached", "Feed not found", etc.

### Changed
- Improved screen flow logic to distinguish between "never synced" and "synced but empty"
- Error states now transition to appropriate screens (e.g., "All in cooldown" → Cooldown screen)
- Settings back button now correctly handles All Retired state

### Fixed
- First-time users with no bookmarks no longer get stuck in a confusing loop
- Button error messages now provide actionable feedback

## [1.1.0] - 2026-01-16

### Added
- **Settings Panel** - New settings screen accessible via gear icon
- **Customizable Resurface Interval** - Choose from 10min, 20min, 30min, 1hr, or 2hr presets
- **"Resurface Now" Button** - Manually trigger a resurface with 3-minute cooldown countdown
- **"Open X" Button** - Quick access to X when no tabs are open, auto-triggers resurface
- **Cooldown Screen** - New "All Caught Up!" state when all bookmarks are cooling down
- **Live Countdown Timer** - Shows time until next bookmark becomes available
- **Bookmark Count Display** - Shows total synced bookmarks on success screen
- **Graceful Failure Handling** - "Not this time" message with automatic retry countdown
- **Tab Detection** - Smart detection of open X tabs with empty state guidance
- **Grace Period Logic** - Queues resurface when no X tab, triggers on tab open

### Changed
- Default resurface interval changed from 5 minutes to 20 minutes
- First resurface still triggers at 5 minutes after sync
- Improved popup UI with multiple screen states (setup, success, empty, cooldown, settings)
- Enhanced message passing with injection result tracking

### Technical
- Added `GET_BOOKMARK_AVAILABILITY` message type for cooldown state queries
- Added `CHECK_X_TABS` message type for tab detection
- Added `SET_RESURFACE_INTERVAL` and `GET_RESURFACE_INTERVAL` for settings
- `resurfaceBookmarks()` now returns `{ injected, reason }` result object
- Content script tracks injection success/failure through full message chain
- Storage manager calculates eligible, cooldown, and retired bookmark counts

## [1.0.0] - 2026-01-09

### Added
- Initial release
- Automatic bookmark capture via API interception
- Smart resurfacing with configurable intervals
- Native X/Twitter post styling with "Resurfaced" chip
- Blue left border indicator for resurfaced posts
- Subtle gradient background effect
- Dark mode support (automatic detection)
- Session limits (max 5 resurfaced posts per session)
- Per-bookmark cooldown (1 hour between resurfaces)
- Minimum 3 minutes between any resurfaced posts
- Welcome/onboarding page on first install
- Popup with setup and success screens
- Red notification dot when refresh needed (24h threshold)
- Dynamic icon overlay for notification dot
- "Show XX posts" detection - removes resurfaced post on click
- URL change detection - clears resurfaced posts on navigation
- Extension context validation with helpful error messages
- Service worker alarm system for reliable scheduling
- IndexedDB storage for bookmark persistence
- Debug commands (manualResurface, showStats, resetStats, checkAlarm)

### Technical
- Manifest V3 compliant
- Early script injection for API interception
- OffscreenCanvas for dynamic icon generation
- Robust alarm system with self-initialization
- Graceful error handling throughout
