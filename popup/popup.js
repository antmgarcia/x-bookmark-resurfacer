/**
 * X Bookmark Resurfacer - Popup Script
 * Controls the extension popup UI
 */

const REFRESH_THRESHOLD_HOURS = 24;

/**
 * Initialize popup
 */
async function initPopup() {
  let bookmarkCount = 0;
  let needsRefresh = false;

  // Get bookmark count and last sync time
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_BOOKMARK_COUNT'
    });

    if (response && response.count !== undefined) {
      bookmarkCount = response.count;
    }

    // Check last sync time
    const { lastAutoFetch } = await chrome.storage.local.get(['lastAutoFetch']);
    if (lastAutoFetch) {
      const hoursSinceSync = (Date.now() - lastAutoFetch) / (1000 * 60 * 60);
      needsRefresh = hoursSinceSync > REFRESH_THRESHOLD_HOURS;
    }
  } catch (error) {
    console.error('Error getting bookmark status:', error);
  }

  // Show appropriate screen:
  // - No bookmarks OR needs refresh = setup screen
  // - Has bookmarks AND recent sync = success screen
  if (bookmarkCount === 0 || needsRefresh) {
    showSetupScreen();
  } else {
    showSuccessScreen(bookmarkCount);
  }
}

/**
 * Show setup screen for new users
 */
function showSetupScreen() {
  document.getElementById('setupScreen').classList.remove('hidden');
  document.getElementById('successScreen').classList.add('hidden');
}

/**
 * Show success screen (permanent after sync)
 */
function showSuccessScreen(count) {
  document.getElementById('setupScreen').classList.add('hidden');
  document.getElementById('successScreen').classList.remove('hidden');
  document.getElementById('successBookmarkCount').textContent = count;
}

// Initialize when popup opens
initPopup();
