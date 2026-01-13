/**
 * X Bookmark Resurfacer - Service Worker
 * Background script for scheduling and orchestration
 */

import { storageManager } from './storage-manager.js';
import { MESSAGE_TYPES, INJECTION_CONFIG } from '../utils/constants.module.js';
import { log, logError } from '../utils/helpers.module.js';

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
 * Ensure alarm exists (create if missing)
 */
async function ensureAlarmExists() {
  const existingAlarm = await chrome.alarms.get(INJECTION_CONFIG.ALARM_NAME);

  if (existingAlarm) {
    log(`Alarm exists, next fire in ${((existingAlarm.scheduledTime - Date.now()) / 60000).toFixed(1)}min`);
    return;
  }

  log('Alarm not found, creating...');
  await chrome.alarms.create(INJECTION_CONFIG.ALARM_NAME, {
    delayInMinutes: INJECTION_CONFIG.ALARM_DELAY_MINUTES,
    periodInMinutes: INJECTION_CONFIG.ALARM_PERIOD_MINUTES
  });

  log(`Alarm created: first in ${INJECTION_CONFIG.ALARM_DELAY_MINUTES}min, then every ${INJECTION_CONFIG.ALARM_PERIOD_MINUTES}min`);
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
 * Handle alarm events
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === INJECTION_CONFIG.ALARM_NAME) {
    log('=== ALARM FIRED ===');
    // Ensure initialized (service worker may have woken up from sleep)
    await ensureInitialized();
    await updateBadge(); // Check if refresh is needed
    await resurfaceBookmarks();
  }
});

/**
 * Main resurface function
 */
async function resurfaceBookmarks() {
  try {
    log('=== RESURFACE TRIGGERED ===');

    // Check if enabled
    const { enabled = true } = await chrome.storage.local.get(['enabled']);

    if (!enabled) {
      log('Extension disabled, skipping resurface');
      return;
    }

    // Log bookmark stats
    const totalCount = await storageManager.getBookmarkCount();
    log(`Total bookmarks in database: ${totalCount}`);

    // Get random bookmarks
    const bookmarks = await storageManager.getRandomBookmarks(
      INJECTION_CONFIG.POSTS_PER_INJECTION
    );

    log(`Eligible bookmarks found: ${bookmarks.length}`);

    if (bookmarks.length === 0) {
      log('No bookmarks available to resurface - all may be in cooldown');
      log('Run resetStats() in this console to clear cooldowns');
      return;
    }

    log(`Selected bookmark: ${bookmarks[0]?.id} by @${bookmarks[0]?.author?.screen_name}`);

    // Find X/Twitter tabs
    const tabs = await chrome.tabs.query({
      url: ['*://x.com/*', '*://twitter.com/*']
    });

    if (tabs.length === 0) {
      log('No X/Twitter tabs found');
      return;
    }

    // Send to home feed tabs only
    let successCount = 0;
    for (const tab of tabs) {
      try {
        if (!tab.id || tab.discarded || tab.status !== 'complete') continue;

        const url = tab.url || '';
        const isHomeFeed = /^https:\/\/(x|twitter)\.com\/(home)?(\?.*)?$/.test(url);

        if (!isHomeFeed) continue;

        await chrome.tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPES.INJECT_BOOKMARKS,
          bookmarks: bookmarks
        });

        successCount++;
        log(`Sent bookmarks to tab ${tab.id}`);
      } catch (error) {
        // Tab not ready, skip silently
      }
    }

    if (successCount > 0) {
      log(`Injected into ${successCount} tab(s)`);
    }
  } catch (error) {
    logError('Error in resurfaceBookmarks:', error);
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
          await resurfaceBookmarks();
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

// Self-initialize on script load (handles service worker wake-up)
ensureInitialized().catch(err => logError('Init error:', err));
