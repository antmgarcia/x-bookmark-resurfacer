# Changelog

All notable changes to X Bookmark Resurfacer will be documented in this file.

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
