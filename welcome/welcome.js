/**
 * X Bookmark Resurfacer - Welcome Page Script
 * Detects sync state and transitions to "all set" screen
 */

const elements = {
  header: document.querySelector('.header'),
  setupSteps: document.getElementById('setupSteps'),
  syncedScreen: document.getElementById('syncedScreen'),
  setupAction: document.getElementById('setupAction'),
  syncedAction: document.getElementById('syncedAction'),
  syncedCount: document.getElementById('syncedCount'),
  welcomeFlag: document.querySelector('.welcome-flag')
};

/**
 * Show the synced state
 */
function showSyncedState(count) {
  elements.header.classList.add('hidden');
  elements.setupSteps.classList.add('hidden');
  elements.setupAction.classList.add('hidden');
  elements.syncedScreen.classList.remove('hidden');
  elements.syncedAction.classList.remove('hidden');
  elements.syncedCount.textContent = count;
  if (elements.welcomeFlag) {
    elements.welcomeFlag.textContent = 'READY';
  }
}

/**
 * Check sync state and update UI
 */
async function checkSyncState() {
  try {
    const { lastAutoFetch, bookmarkCount } = await chrome.storage.local.get([
      'lastAutoFetch',
      'bookmarkCount'
    ]);

    if (lastAutoFetch && bookmarkCount > 0) {
      showSyncedState(bookmarkCount);
    }
  } catch (error) {
    // Extension context may not be available, keep showing setup steps
  }
}

// Check on load
checkSyncState();

// Listen for storage changes (sync happening in another tab)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.bookmarkCount && changes.bookmarkCount.newValue > 0) {
    showSyncedState(changes.bookmarkCount.newValue);
  }
});
