# Changelog

All notable changes to X Bookmark Resurfacer will be documented in this file.

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
