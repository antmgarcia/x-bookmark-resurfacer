/**
 * X Bookmark Resurfacer - Service Worker
 * Background script for scheduling and orchestration
 */

import { storageManager } from './storage-manager.js';
import { MESSAGE_TYPES, INJECTION_CONFIG, TIMING_CONFIG } from '../utils/constants.module.js';
import { log, logError } from '../utils/helpers.module.js';

// Alarm names
const MAIN_ALARM = INJECTION_CONFIG.ALARM_NAME;
const GRACE_ALARM = 'graceResurfaceAlarm';

// Track initialization state
let isInitialized = false;

// Refresh threshold in hours
const REFRESH_THRESHOLD_HOURS = 24;

/**
 * Ensure service worker is fully initialized
 */
async function ensureInitialized() {
  if (isInitialized) return;

  log('Initializing service worker...');
  await storageManager.ensureReady();
  await ensureAlarmExists();
  await updateBadge();
  isInitialized = true;
  log('Service worker initialized');
}

/**
 * Update icon based on sync status (adds red dot when refresh needed)
 */
async function updateBadge() {
  try {
    const { lastAutoFetch } = await chrome.storage.local.get(['lastAutoFetch']);
    const bookmarkCount = await storageManager.getBookmarkCount();

    log(`updateBadge: bookmarkCount=${bookmarkCount}, lastAutoFetch=${lastAutoFetch ? new Date(lastAutoFetch).toLocaleString() : 'never'}`);

    // Show dot if no bookmarks OR sync is stale
    let needsDot = bookmarkCount === 0;

    if (lastAutoFetch && bookmarkCount > 0) {
      const hoursSinceSync = (Date.now() - lastAutoFetch) / (1000 * 60 * 60);
      log(`updateBadge: hoursSinceSync=${hoursSinceSync.toFixed(2)}, threshold=${REFRESH_THRESHOLD_HOURS}`);
      needsDot = hoursSinceSync > REFRESH_THRESHOLD_HOURS;
    }

    log(`updateBadge: needsDot=${needsDot}`);

    if (needsDot) {
      await setIconWithDot();
      log('Icon set: with red dot (refresh needed)');
    } else {
      await setNormalIcon();
      log('Icon set: normal (sync is fresh)');
    }
  } catch (error) {
    logError('Error updating icon:', error);
  }
}

/**
 * Set normal icon (no dot)
 */
async function setNormalIcon() {
  try {
    // Load and set original icons using imageData (same approach as setIconWithDot)
    const sizes = [16, 48, 128];
    const imageData = {};

    for (const size of sizes) {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');

      const response = await fetch(chrome.runtime.getURL(`icons/icon${size}.png`));
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      ctx.drawImage(bitmap, 0, 0, size, size);
      imageData[size] = ctx.getImageData(0, 0, size, size);
    }

    await chrome.action.setIcon({ imageData });
    await chrome.action.setBadgeText({ text: '' });
  } catch (error) {
    logError('Error setting normal icon:', error);
    // At least clear the badge
    await chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Set icon with red notification dot
 */
async function setIconWithDot() {
  try {
    const sizes = [16, 48, 128];
    const imageData = {};

    for (const size of sizes) {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');

      // Load original icon
      const response = await fetch(chrome.runtime.getURL(`icons/icon${size}.png`));
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      // Draw original icon
      ctx.drawImage(bitmap, 0, 0, size, size);

      // Draw red dot in top-right corner
      const dotRadius = Math.max(size * 0.18, 2);
      const dotX = size - dotRadius - 1;
      const dotY = dotRadius + 1;

      // White border
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius + 1, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Red dot
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#F4212E';
      ctx.fill();

      imageData[size] = ctx.getImageData(0, 0, size, size);
    }

    await chrome.action.setIcon({ imageData });
  } catch (error) {
    logError('Error setting icon with dot:', error);
    // Fallback to badge
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#F4212E' });
  }
}

/**
 * Get user's configured interval or default
 */
async function getResurfaceInterval() {
  const { resurfaceInterval, isFirstResurface = true } = await chrome.storage.local.get([
    'resurfaceInterval',
    'isFirstResurface'
  ]);

  if (resurfaceInterval !== undefined) {
    return resurfaceInterval;
  }

  // Use first interval if no resurface has happened yet
  return isFirstResurface
    ? TIMING_CONFIG.DEFAULT_FIRST_INTERVAL_MINUTES
    : TIMING_CONFIG.DEFAULT_INTERVAL_MINUTES;
}

/**
 * Create or reset the main resurface alarm
 */
async function createResurfaceAlarm(delayMinutes = null) {
  // Clear existing alarm
  await chrome.alarms.clear(MAIN_ALARM);

  // Get interval if not specified
  if (delayMinutes === null) {
    delayMinutes = await getResurfaceInterval();
  }

  // Create alarm (non-repeating, we recreate after each fire for dynamic intervals)
  await chrome.alarms.create(MAIN_ALARM, {
    delayInMinutes: delayMinutes
  });

  // Store next resurface timestamp for countdown display
  const nextResurfaceTimestamp = Date.now() + (delayMinutes * 60 * 1000);
  await chrome.storage.local.set({ nextResurfaceTimestamp });

  log(`Alarm created: fires in ${delayMinutes}min at ${new Date(nextResurfaceTimestamp).toLocaleTimeString()}`);
}

/**
 * Ensure alarm exists (create if missing)
 */
async function ensureAlarmExists() {
  const existingAlarm = await chrome.alarms.get(MAIN_ALARM);

  if (existingAlarm) {
    log(`Alarm exists, next fire in ${((existingAlarm.scheduledTime - Date.now()) / 60000).toFixed(1)}min`);
    return;
  }

  log('Alarm not found, creating...');
  await createResurfaceAlarm();
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  log('Extension installed:', details.reason);

  // Force recreate alarm on install/update
  await chrome.alarms.clear(INJECTION_CONFIG.ALARM_NAME);
  isInitialized = false;
  await ensureInitialized();

  if (details.reason === 'install') {
    log('Opening welcome page');
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html') });
  }
});

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  log('Browser starting up');
  isInitialized = false;
  await ensureInitialized();
});

/**
 * Check if any X/Twitter tabs are open
 */
async function hasXTabs() {
  const tabs = await chrome.tabs.query({
    url: ['*://x.com/*', '*://twitter.com/*']
  });
  return tabs.length > 0;
}

/**
 * Handle alarm events
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Ensure initialized (service worker may have woken up from sleep)
  await ensureInitialized();

  if (alarm.name === MAIN_ALARM) {
    log('=== MAIN ALARM FIRED ===');
    await updateBadge();

    // Check for X tabs
    const hasXTab = await hasXTabs();

    if (hasXTab) {
      // X tab exists - inject and reset timer
      await resurfaceBookmarks();
      await chrome.storage.local.set({ isFirstResurface: false });
      await createResurfaceAlarm();
    } else {
      // No X tab - enter grace period
      log('No X tabs found, starting grace period...');
      await chrome.storage.local.set({ pendingResurface: true });
      await chrome.alarms.create(GRACE_ALARM, {
        delayInMinutes: TIMING_CONFIG.GRACE_PERIOD_MINUTES
      });
    }
  } else if (alarm.name === GRACE_ALARM) {
    log('=== GRACE ALARM FIRED ===');
    const { pendingResurface } = await chrome.storage.local.get(['pendingResurface']);

    if (pendingResurface) {
      const hasXTab = await hasXTabs();

      if (hasXTab) {
        // X tab opened during grace period
        log('X tab found during grace period, injecting...');
        await resurfaceBookmarks();
        await chrome.storage.local.set({ pendingResurface: false, isFirstResurface: false });
      } else {
        // Grace period expired with no X tab
        log('Grace period expired, no X tab found. Skipping resurface.');
        await chrome.storage.local.set({ pendingResurface: false });
      }

      // Reset main timer for next cycle
      await createResurfaceAlarm();
    }
  }
});

/**
 * Main resurface function
 * @param {boolean} forceReplace - If true, replace existing resurfaced post
 * @returns {Object} Result with injected status
 */
async function resurfaceBookmarks(forceReplace = false) {
  try {
    log('=== RESURFACE TRIGGERED ===');

    // Check if enabled
    const { enabled = true } = await chrome.storage.local.get(['enabled']);

    if (!enabled) {
      log('Extension disabled, skipping resurface');
      return { injected: false, reason: 'disabled' };
    }

    // Log bookmark stats
    const totalCount = await storageManager.getBookmarkCount();
    log(`Total bookmarks in database: ${totalCount}`);

    // Find X/Twitter home feed tabs first to know how many bookmarks we need
    const allTabs = await chrome.tabs.query({
      url: ['*://x.com/*', '*://twitter.com/*']
    });

    const homeFeedTabs = allTabs.filter(tab => {
      if (!tab.id || tab.discarded || tab.status !== 'complete') return false;
      const url = tab.url || '';
      return /^https:\/\/(x|twitter)\.com\/(home)?(\?.*)?$/.test(url);
    });

    if (homeFeedTabs.length === 0) {
      log('No X/Twitter home feed tabs found');

      // Check if there are other X tabs (post-dedicated pages) to notify
      const otherXTabs = allTabs.filter(tab =>
        tab.id && !tab.discarded && tab.status === 'complete'
      );

      if (otherXTabs.length > 0 && forceReplace) {
        // User clicked "Resurface Now" but no home feed open
        // Select a bookmark and store it as pending, then notify other tabs
        const pendingBookmarks = await storageManager.getRandomBookmarks(1);

        if (pendingBookmarks.length > 0) {
          const pendingBookmark = pendingBookmarks[0];
          await chrome.storage.local.set({ pendingResurfaceBookmark: pendingBookmark });
          log('Stored pending bookmark:', pendingBookmark.id);

          // Notify other X tabs to show "go to home" toast
          for (const tab of otherXTabs) {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                type: MESSAGE_TYPES.NOTIFY_NO_HOME_FEED
              });
            } catch {
              // Tab might not have content script ready
            }
          }

          return { injected: false, reason: 'no_home_feed_notified', pendingBookmarkId: pendingBookmark.id };
        }
      }

      return { injected: false, reason: 'no_tabs' };
    }

    log(`Found ${homeFeedTabs.length} home feed tab(s)`);

    // Get enough random bookmarks for all tabs (one per tab)
    const bookmarksNeeded = forceReplace ? homeFeedTabs.length : INJECTION_CONFIG.POSTS_PER_INJECTION;
    const bookmarks = await storageManager.getRandomBookmarks(bookmarksNeeded);

    log(`Eligible bookmarks found: ${bookmarks.length}`);

    if (bookmarks.length === 0) {
      log('No bookmarks available to resurface - all may be in cooldown');
      return { injected: false, reason: 'no_eligible_bookmarks' };
    }

    // Send to all home feed tabs, each gets a different bookmark if available
    let successCount = 0;
    let lastFailReason = null;

    for (let i = 0; i < homeFeedTabs.length; i++) {
      const tab = homeFeedTabs[i];
      // Use different bookmark for each tab, or cycle if not enough bookmarks
      const bookmark = bookmarks[i % bookmarks.length];

      try {
        log(`Injecting bookmark ${bookmark.id} into tab ${tab.id}`);

        const response = await chrome.tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPES.INJECT_BOOKMARKS,
          bookmarks: [bookmark],
          forceReplace: forceReplace
        });

        log(`Tab ${tab.id} response:`, response);

        if (response && response.injected) {
          successCount++;
        } else {
          lastFailReason = response?.reason;
        }
      } catch (error) {
        // Tab not ready, skip silently
        log(`Tab ${tab.id} error:`, error.message);
        lastFailReason = 'tab_error';
      }
    }

    if (successCount > 0) {
      log(`Injection successful: ${successCount}/${homeFeedTabs.length} tabs`);

      // If this was a manual resurface, notify non-home-feed tabs so they see a toast
      if (forceReplace) {
        const nonHomeFeedTabs = allTabs.filter(tab => {
          if (!tab.id || tab.discarded || tab.status !== 'complete') return false;
          // Exclude home feed tabs (they already got the injection)
          const url = tab.url || '';
          return !/^https:\/\/(x|twitter)\.com\/(home)?(\?.*)?$/.test(url);
        });

        if (nonHomeFeedTabs.length > 0) {
          // Store the bookmark as pending so if user navigates to home feed, they'll see it
          // (The existing home feed tabs already have it, but user might open a new one)
          const bookmarkForPending = bookmarks[0];
          await chrome.storage.local.set({ pendingResurfaceBookmark: bookmarkForPending });
          log('Stored pending bookmark for non-home-feed tabs:', bookmarkForPending.id);

          for (const tab of nonHomeFeedTabs) {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                type: MESSAGE_TYPES.NOTIFY_NO_HOME_FEED
              });
            } catch {
              // Tab might not have content script ready
            }
          }
        }
      }

      return { injected: true, tabsInjected: successCount };
    } else {
      log('Injection failed on all tabs:', lastFailReason || 'unknown');
      return { injected: false, reason: lastFailReason || 'injection_failed' };
    }
  } catch (error) {
    logError('Error in resurfaceBookmarks:', error);
    return { injected: false, reason: 'error' };
  }
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('Message received:', message.type);

  (async () => {
    // Ensure initialized before handling any message
    await ensureInitialized();

    try {
      switch (message.type) {
        case MESSAGE_TYPES.STORE_BOOKMARKS:
          const savedCount = await storageManager.saveBookmarks(message.bookmarks);
          // Update last sync time and clear the dot
          await chrome.storage.local.set({
            lastAutoFetch: Date.now(),
            bookmarkCount: savedCount
          });
          await updateBadge(); // Clear dot after successful sync
          sendResponse({ success: true, count: savedCount });
          break;

        case MESSAGE_TYPES.GET_RANDOM_BOOKMARKS:
          const bookmarks = await storageManager.getRandomBookmarks(message.count || 1);
          sendResponse({ success: true, bookmarks });
          break;

        case MESSAGE_TYPES.UPDATE_RESURFACE_STATS:
          await storageManager.updateResurfaceStats(message.bookmarkId);
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.GET_BOOKMARK_COUNT:
          const count = await storageManager.getBookmarkCount();
          sendResponse({ success: true, count });
          break;

        case MESSAGE_TYPES.SET_ENABLED:
          await chrome.storage.local.set({ enabled: message.enabled });
          log(`Extension ${message.enabled ? 'enabled' : 'disabled'}`);
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.GET_ENABLED:
          const { enabled = true } = await chrome.storage.local.get(['enabled']);
          sendResponse({ success: true, enabled });
          break;

        case MESSAGE_TYPES.TRIGGER_RESURFACE:
          log('Manual resurface triggered');
          const hasTab = await hasXTabs();
          if (hasTab) {
            const injectionResult = await resurfaceBookmarks(message.forceReplace || false);
            await chrome.storage.local.set({ isFirstResurface: false });
            await createResurfaceAlarm(); // Reset timer after manual trigger
            sendResponse({ success: true, ...injectionResult });
          } else {
            sendResponse({ success: false, error: 'No X tabs found', injected: false, reason: 'no_tabs' });
          }
          break;

        case MESSAGE_TYPES.GET_NEXT_RESURFACE_TIME:
          const { nextResurfaceTimestamp } = await chrome.storage.local.get(['nextResurfaceTimestamp']);
          const remainingMs = nextResurfaceTimestamp ? nextResurfaceTimestamp - Date.now() : 0;
          sendResponse({
            success: true,
            nextResurfaceTimestamp,
            remainingMs: Math.max(0, remainingMs)
          });
          break;

        case MESSAGE_TYPES.SET_RESURFACE_INTERVAL:
          const newInterval = Math.min(
            Math.max(message.interval, TIMING_CONFIG.MIN_INTERVAL_MINUTES),
            TIMING_CONFIG.MAX_INTERVAL_MINUTES
          );
          await chrome.storage.local.set({ resurfaceInterval: newInterval });
          log(`Resurface interval set to ${newInterval} minutes`);
          // Trigger a resurface in 3 minutes, then new interval applies
          await createResurfaceAlarm(3);
          sendResponse({ success: true, interval: newInterval });
          break;

        case MESSAGE_TYPES.GET_RESURFACE_INTERVAL:
          const currentInterval = await getResurfaceInterval();
          const { resurfaceInterval: savedInterval } = await chrome.storage.local.get(['resurfaceInterval']);
          sendResponse({
            success: true,
            interval: savedInterval || currentInterval,
            isDefault: savedInterval === undefined
          });
          break;

        case MESSAGE_TYPES.CHECK_X_TABS:
          const xTabsExist = await hasXTabs();
          sendResponse({ success: true, hasXTabs: xTabsExist });
          break;

        case MESSAGE_TYPES.GET_BOOKMARK_AVAILABILITY:
          const availability = await storageManager.getBookmarkAvailability();
          sendResponse({ success: true, ...availability });
          break;

        case MESSAGE_TYPES.INJECT_PENDING_BOOKMARK:
          // Check if there's a pending bookmark to inject
          const { pendingResurfaceBookmark } = await chrome.storage.local.get(['pendingResurfaceBookmark']);
          if (pendingResurfaceBookmark) {
            // Clear immediately to prevent re-injection on page reload
            await chrome.storage.local.remove('pendingResurfaceBookmark');
            log('Returning and clearing pending bookmark:', pendingResurfaceBookmark.id);
            sendResponse({ success: true, bookmark: pendingResurfaceBookmark });
          } else {
            sendResponse({ success: false, reason: 'no_pending' });
          }
          break;

        case MESSAGE_TYPES.NOTIFY_SYNC:
          // Broadcast sync notification to all X tabs except the sender
          const xTabs = await chrome.tabs.query({
            url: ['*://x.com/*', '*://twitter.com/*']
          });

          // Filter tabs that should receive the toast
          const targetTabs = xTabs.filter(tab => {
            if (tab.id === sender.tab?.id) return false; // Skip sender
            if (!tab.id || tab.discarded || tab.status !== 'complete') return false;
            if (tab.url?.includes('/i/bookmarks')) return false; // Skip bookmarks page
            return true;
          });

          log(`Injecting sync toast into ${targetTabs.length} tabs`);

          // Inject into all tabs in parallel
          await Promise.all(targetTabs.map(async (tab) => {
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: showSyncToast
              });
              log(`Injected sync toast into tab ${tab.id}`);
            } catch (err) {
              log(`Could not inject toast into tab ${tab.id}:`, err.message);
            }
          }));

          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      logError('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep channel open for async response
});

/**
 * Manual resurface for testing (accessible from service worker console)
 */
globalThis.manualResurface = async function() {
  log('Manual resurface triggered from console');
  await resurfaceBookmarks();
};

/**
 * Show bookmark stats (for debugging)
 */
globalThis.showStats = async function() {
  const all = await storageManager.getAllBookmarks();
  console.table(all.map(b => ({
    id: b.id,
    author: b.author?.screen_name,
    count: b.resurfaced_count || 0,
    last: b.last_resurfaced_at ? new Date(b.last_resurfaced_at).toLocaleString() : 'never'
  })));
};

/**
 * Reset all resurface stats (for testing)
 */
globalThis.resetStats = async function() {
  const count = await storageManager.resetAllStats();
  log(`Reset stats for ${count} bookmarks - they can now be resurfaced again`);
  return count;
};

/**
 * Check alarm status (for debugging)
 */
globalThis.checkAlarm = async function() {
  const alarm = await chrome.alarms.get(INJECTION_CONFIG.ALARM_NAME);
  if (alarm) {
    const nextIn = ((alarm.scheduledTime - Date.now()) / 60000).toFixed(1);
    log(`Alarm scheduled, next fire in ${nextIn}min`);
    return { exists: true, nextFireInMinutes: parseFloat(nextIn) };
  } else {
    log('No alarm found! Creating one...');
    await ensureAlarmExists();
    return { exists: false, created: true };
  }
};

/**
 * Function to inject into tabs to show sync toast
 * Must be self-contained (no external dependencies)
 * Visibility-aware: waits to show until tab is visible
 */
function showSyncToast() {
  // Check if toast already exists or is pending
  if (document.querySelector('.resurfacer-sync-toast') || window._resurfacerSyncToastPending) return;

  function displayToast() {
    // Double-check toast doesn't already exist
    if (document.querySelector('.resurfacer-sync-toast')) return;

    const toast = document.createElement('div');
    toast.className = 'resurfacer-sync-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #1d9bf0;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: transform 0.3s ease;
    `;

    const messageSpan = document.createElement('span');
    messageSpan.textContent = 'Bookmarks synced! Reload to start resurfacing.';

    const reloadButton = document.createElement('button');
    reloadButton.textContent = 'Reload';
    reloadButton.style.cssText = `
      background: white;
      color: #1d9bf0;
      border: none;
      padding: 6px 12px;
      border-radius: 9999px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      transition: background-color 0.2s;
    `;
    reloadButton.addEventListener('mouseenter', () => {
      reloadButton.style.background = '#e8f5fd';
    });
    reloadButton.addEventListener('mouseleave', () => {
      reloadButton.style.background = 'white';
    });
    reloadButton.addEventListener('click', () => {
      // Mark this sync as acknowledged to prevent duplicate toast after reload
      chrome.storage.local.set({ syncToastAcknowledgedAt: Date.now() })
        .catch(() => {})
        .finally(() => {
          // Hard reload bypassing cache
          window.location.href = window.location.href;
        });
    });

    toast.appendChild(messageSpan);
    toast.appendChild(reloadButton);
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      toast.style.transform = 'translateX(-50%) translateY(100px)';
      setTimeout(() => toast.remove(), 300);
    }, 10000);

    window._resurfacerSyncToastPending = false;
  }

  // If tab is visible, show immediately
  if (!document.hidden) {
    displayToast();
  } else {
    // Tab is hidden - wait for it to become visible
    window._resurfacerSyncToastPending = true;
    const onVisible = () => {
      if (!document.hidden) {
        document.removeEventListener('visibilitychange', onVisible);
        displayToast();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
  }
}

// Self-initialize on script load (handles service worker wake-up)
ensureInitialized().catch(err => logError('Init error:', err));
