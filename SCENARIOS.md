# X Bookmark Resurfacer - Scenarios & Use Cases

This document covers all scenarios, use cases, and edge cases handled by the extension.

---

## 1. Bookmark Syncing

### 1.1 First-Time Sync
- **Scenario**: User visits `/i/bookmarks` for the first time
- **Behavior**: API interceptor captures bookmarks, stores in IndexedDB, shows "XX bookmarks synced" toast with "Scroll for more" button
- **Toast**: Blue toast with **total** bookmark count (not batch count) and scroll button
- **Count**: Displays total bookmarks in database, updates as user scrolls and more are captured

### 1.2 Scroll for More Bookmarks
- **Scenario**: User clicks "Scroll for more" on bookmarks page
- **Behavior**: Page scrolls down 25,000px to trigger X's infinite scroll, loading more bookmarks
- **Batch Size**: X returns ~20 bookmarks per API page
- **Toast**: Only shows once per page visit (first batch), displays total in database

### 1.3 Subsequent Syncs
- **Scenario**: User returns to bookmarks page after initial sync
- **Behavior**: New bookmarks are added, existing ones updated, toast shows total count
- **Deduplication**: Bookmarks are stored by ID, no duplicates

### 1.4 Auto-Fetch (Background Sync)
- **Scenario**: User has cached query ID, visits any X page
- **Behavior**: If >1 hour since last fetch, auto-fetches up to 50 bookmarks silently
- **Requirement**: Must have visited bookmarks page at least once to cache query ID

---

## 2. Resurfacing

### 2.1 Automatic Resurfacing (Alarm-Based)
- **Scenario**: User is on X home feed, alarm fires
- **Behavior**: Random eligible bookmark injected at top of feed with "Resurfaced" chip
- **Timing**: First at 5 minutes after sync, then every 20 minutes (configurable)

### 2.2 Manual Resurfacing ("Resurface Now" Button)
- **Scenario**: User clicks "Resurface Now" in popup
- **Behavior**: Immediately injects bookmark, shows toast if scrolled down
- **Cooldown**: 3-minute cooldown between manual resurfaces

### 2.3 Multi-Tab Resurfacing
- **Scenario**: User has multiple X home feed tabs open, clicks "Resurface Now"
- **Behavior**: Different bookmarks injected into ALL home feed tabs simultaneously
- **Note**: Each tab gets a unique bookmark

### 2.4 Resurfacing While Scrolled Down
- **Scenario**: User triggers resurface while scrolled down in feed
- **Behavior**: Bookmark injected at top, "Bookmark resurfaced at top" toast with "View" button
- **View Button**: Smooth scrolls to top of page

### 2.5 No Home Feed Open (Manual)
- **Scenario**: User clicks "Resurface Now" but no home feed tab open
- **Behavior**: Bookmark stored as pending, "Go to Home" toast shown on current X tab
- **Deferred Injection**: When user navigates to home feed, pending bookmark injected (1.5s after load)

### 2.6 No Home Feed Open (Alarm-Based)
- **Scenario**: Alarm fires but user is on a post page (not home feed)
- **Behavior**: Bookmark stored as pending silently (no toast)
- **Deferred Injection**: When user navigates to home feed, pending bookmark injected automatically (1.5s after load)
- **Note**: Unlike manual resurface, no notification is shown to avoid being intrusive

---

## 3. Toast Notifications

### 3.1 Toast Types
| Toast | Message | Button | Action |
|-------|---------|--------|--------|
| Sync (bookmarks page) | "XX bookmarks synced" | "Scroll for more" | Scrolls 25,000px |
| Sync (other tabs) | "Bookmarks synced! Reload to start resurfacing." | "Reload" | Reloads page |
| Resurface | "Bookmark resurfaced at top" | "View" | Scrolls to top |
| Go to Home | "Bookmark resurfaced in your home feed" | "Go to Home" | Navigates to home |

### 3.2 Unified Toast UI
- **Style**: Blue background (#1d9bf0), white pill-shaped buttons
- **Animation**: Slide up from bottom
- **Duration**: 10 seconds auto-dismiss
- **Hover**: Button background changes to light blue (#e8f5fd)

### 3.3 Background Tab Toast Handling
- **Scenario**: Toast triggered while tab is in background
- **Behavior**: Toast waits for `visibilitychange` event, shows when tab becomes visible
- **Prevents**: Toasts disappearing before user sees them

### 3.4 Duplicate Toast Prevention
- **Scenario**: User clicks "Reload" on sync toast, page reloads
- **Behavior**: `syncToastAcknowledgedAt` stored, prevents showing same toast again
- **Prevents**: Duplicate "Bookmarks synced" toast after reload

### 3.5 New Tab Toast Prevention
- **Scenario**: User syncs bookmarks, then opens NEW X tab
- **Behavior**: New tab tracks `scriptInitTime`, skips toast if sync happened before tab opened
- **Prevents**: Toast showing on tabs that weren't open during sync

---

## 4. Multi-Tab Scenarios

### 4.1 Cross-Tab Sync Notification
- **Scenario**: User syncs on bookmarks page, has other X tabs open
- **Behavior**: All other X tabs show "Bookmarks synced! Reload..." toast
- **Method**: `chrome.scripting.executeScript` injects toast directly

### 4.2 Stale Content Scripts
- **Scenario**: Extension reloaded, user has old X tabs open
- **Behavior**: Scripting API bypasses stale content scripts, toast still works
- **Technical**: Self-contained `showSyncToast()` function injected

### 4.3 Tab Filtering for Sync Toast
- **Tabs that GET toast**: Any X tab (home, post pages, profile, etc.)
- **Tabs that DON'T get toast**: Bookmarks page (source of sync), discarded tabs, incomplete tabs

### 4.4 Pending Bookmark Across Tabs
- **Scenario**: User on post page, clicks "Resurface Now", no home feed open
- **Behavior**: Bookmark stored, user navigates to home feed in ANY tab, bookmark injected

---

## 5. Interval Settings

### 5.1 Available Intervals
- 10 minutes
- 20 minutes (default)
- 30 minutes
- 1 hour
- 2 hours

### 5.2 Interval Change Behavior
- **Scenario**: User changes interval from any value to any other value
- **Behavior**:
  1. New interval saved to storage
  2. Alarm reset to 3 minutes (quick resurface)
  3. After that resurface, new interval takes effect
- **Prevents**: User waiting remainder of old long interval

### 5.3 First Resurface Timing
- **Scenario**: Fresh sync, no resurface yet
- **Behavior**: First resurface at 5 minutes regardless of interval setting
- **Subsequent**: Uses configured interval

---

## 6. Cooldowns & Limits

### 6.1 Per-Bookmark Cooldown
- **Duration**: 1 hour between resurfaces of same bookmark
- **Purpose**: Prevents seeing same bookmark repeatedly

### 6.2 Session Limit
- **Limit**: 5 resurfaced posts per browser session
- **Reset**: On page navigation or browser restart
- **Purpose**: Prevents feed from being overwhelmed

### 6.3 Minimum Time Between Resurfaces
- **Duration**: 3 minutes between any resurfaced posts
- **Bypass**: "Resurface Now" button bypasses this for manual triggers

### 6.4 Bookmark Retirement
- **Threshold**: 10 resurfaces per bookmark
- **Behavior**: Bookmark marked as "retired", no longer eligible
- **Screen**: "All Retired" popup screen when all bookmarks retired

### 6.5 All Bookmarks in Cooldown
- **Scenario**: All eligible bookmarks recently resurfaced
- **Behavior**: "All Caught Up!" screen with countdown to next available
- **Timer**: Shows live countdown to earliest cooldown expiry

---

## 7. Popup Screens

### 7.1 Setup Screen
- **When**: Never synced bookmarks
- **Shows**: Instructions to visit bookmarks page

### 7.2 Success Screen
- **When**: Have synced bookmarks, X tab open
- **Shows**: Bookmark count, interval, "Resurface Now" button

### 7.3 Empty Screen (No X Tabs)
- **When**: Have bookmarks but no X tabs open
- **Shows**: "Open X" button

### 7.4 No Bookmarks Screen
- **When**: Synced but zero bookmarks on X
- **Shows**: Message explaining user has no bookmarks saved

### 7.5 Cooldown Screen
- **When**: All bookmarks in 1-hour cooldown
- **Shows**: "All Caught Up!" with countdown timer

### 7.6 All Retired Screen
- **When**: All bookmarks resurfaced 10+ times
- **Shows**: Message that all bookmarks fully resurfaced

### 7.7 Settings Screen
- **Access**: Gear icon from success screen
- **Shows**: Interval presets (10m, 20m, 30m, 1h, 2h)

---

## 8. Edge Cases

### 8.1 Extension Reload with Open Tabs
- **Problem**: Content scripts become stale, can't receive messages
- **Solution**: Scripting API injects toast directly, bypasses stale scripts

### 8.2 "Show XX posts" Button Click
- **Scenario**: User clicks "Show 33 posts" in feed
- **Behavior**: Resurfaced post removed (would be pushed down anyway)
- **Detection**: Regex matches "Show/Mostrar" + number + "posts/publicaciones"

### 8.3 URL Navigation (SPA)
- **Scenario**: User navigates within X (SPA navigation)
- **Behavior**: Resurfaced posts cleared, session counters reset
- **Prevents**: Stale resurfaced posts on wrong pages

### 8.4 Extension Context Invalidated
- **Scenario**: Extension updated/reloaded while X tab open
- **Behavior**: Graceful error handling, console message to refresh page

### 8.5 No Query ID Cached
- **Scenario**: User never visited bookmarks page
- **Behavior**: Auto-fetch skipped, user guided to bookmarks page first

### 8.6 Query ID Expired
- **Duration**: 7-day cache expiry
- **Behavior**: Re-discovered on next bookmarks page visit
- **Fallback**: Multiple hardcoded query IDs tried if cached one fails

### 8.7 Dark Mode Detection
- **Method**: Checks body background color RGB values
- **Threshold**: R, G, B all < 128 = dark mode
- **Fallback**: Defaults to light mode if detection fails

### 8.8 Virtualized Timeline (X's DOM)
- **Challenge**: X uses virtual scrolling, DOM changes dynamically
- **Solution**: Find tweet cells, navigate to virtual container, insert bookmark cell
- **Position**: After "Show XX posts" button if present, otherwise before first tweet

### 8.9 Grace Period (No X Tab)
- **Scenario**: Alarm fires but no X tab open
- **Behavior**: 5-minute grace period, resurface queued
- **Resolution**: If X tab opened during grace, resurface happens; otherwise skipped

### 8.10 Already Visible Resurfaced Post
- **Scenario**: Alarm fires but resurfaced post already on page
- **Behavior**: Skipped (unless force replace via "Resurface Now")
- **Prevents**: Multiple resurfaced posts stacking up

### 8.11 Bookmark Count Accuracy
- **Scenario**: User visits bookmarks page, API returns bookmarks in batches of ~20
- **Behavior**: Toast shows **total** bookmarks in database, not batch count
- **Technical**: `saveBookmarks()` calls `getBookmarkCount()` after saving to get accurate total
- **Prevents**: Confusing "20 bookmarks synced" when user has 100+ bookmarks

---

## 9. API Interception

### 9.1 Bookmark API Detection
- **Endpoint**: `/i/api/graphql/*/Bookmarks`
- **Method**: Fetch interception via early-injected script
- **Timing**: Injected at `document_start` before page loads

### 9.2 Query ID Discovery
- **Source**: Intercepted from X's own API calls
- **Storage**: Cached in `chrome.storage.local` for 7 days
- **Fallback**: Multiple hardcoded query IDs if discovery fails

### 9.3 Tweet Extraction
- **Path**: `data.bookmark_timeline_v2.timeline.instructions[].entries[].content.itemContent.tweet_results.result`
- **Handles**: Nested structures, tombstones, missing data

---

## 10. Storage Keys

| Key | Purpose |
|-----|---------|
| `bookmarksQueryId` | Cached GraphQL query ID |
| `queryIdTimestamp` | When query ID was cached |
| `lastAutoFetch` | Timestamp of last bookmark sync |
| `syncToastAcknowledgedAt` | Prevents duplicate sync toasts |
| `resurfaceInterval` | User's chosen interval (minutes) |
| `isFirstResurface` | Whether first resurface has happened |
| `nextResurfaceTimestamp` | When next alarm will fire |
| `pendingResurface` | Grace period pending flag |
| `pendingResurfaceBookmark` | Bookmark waiting for home feed |
| `enabled` | Extension on/off state |
| `totalResurfaced` | Lifetime resurface count |
| `bookmarkCount` | Total synced bookmarks |

---

## 11. Debug Commands

Run in Service Worker console (`chrome://extensions` > service worker):

```javascript
manualResurface()  // Trigger immediate resurface
showStats()        // Show bookmark statistics
resetStats()       // Clear all cooldowns and stats
checkAlarm()       // Check alarm status and timing
```

---

## 12. Permissions Used

| Permission | Purpose |
|------------|---------|
| `storage` | IndexedDB for bookmarks, chrome.storage for settings |
| `alarms` | Scheduled resurfacing |
| `tabs` | Query X tabs, detect home feed |
| `scripting` | Inject toast into tabs with stale scripts |
| `host_permissions` | x.com/*, twitter.com/* for content scripts |
