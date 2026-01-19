# Changelog

All notable changes to X Bookmark Resurfacer will be documented in this file.

## [1.1.2] - 2026-01-19

### Added
- **Sync Notification Toast** - Other X tabs now show a "Bookmarks synced! Reload to start resurfacing." toast when bookmarks are synced from the bookmarks page
- **Multi-Tab Resurface** - "Resurface Now" button now injects different bookmarks into ALL open X home feed tabs simultaneously
- **Background Tab Toast Support** - All toasts (sync and resurface) queue for background tabs and appear when user switches to them

### Changed
- "Resurface Now" behavior improved: injects into all home feed tabs instead of just one
- Toast notifications are now visibility-aware and won't be missed on background tabs

### Removed
- Removed unused "Too soon" error message (dead code)

### Technical
- Added `NOTIFY_SYNC` and `SYNC_COMPLETE` message types for cross-tab communication
- Added visibility change listener to handle background tab notifications
- Service worker now broadcasts sync events to all open X tabs
- `resurfaceBookmarks()` now fetches multiple bookmarks when needed for multi-tab injection
- Added `pendingResurfaceToast` flag for deferred toast display

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
