/**
 * X Bookmark Resurfacer - Popup Script (v1.1)
 * Controls the extension popup UI with interval display, settings, and manual trigger
 */

const REFRESH_THRESHOLD_HOURS = 24;
const BUTTON_THROTTLE_MS = 2000;
const MANUAL_RESURFACE_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes

// DOM Elements
let elements = {};

// State
let currentScreen = null;
let countdownInterval = null;
let cooldownTimerInterval = null;

/**
 * Initialize DOM element references
 */
function initElements() {
  elements = {
    // Screens
    setupScreen: document.getElementById('setupScreen'),
    successScreen: document.getElementById('successScreen'),
    emptyScreen: document.getElementById('emptyScreen'),
    noBookmarksScreen: document.getElementById('noBookmarksScreen'),
    cooldownScreen: document.getElementById('cooldownScreen'),
    allRetiredScreen: document.getElementById('allRetiredScreen'),
    settingsScreen: document.getElementById('settingsScreen'),
    mainHeader: document.getElementById('mainHeader'),

    // Interval & Buttons
    intervalValue: document.getElementById('intervalValue'),
    resurfaceBtn: document.getElementById('resurfaceBtn'),
    openXBtn: document.getElementById('openXBtn'),
    bookmarkCount: document.getElementById('bookmarkCount'),

    // Cooldown screen elements
    cooldownTimer: document.getElementById('cooldownTimer'),

    // Settings
    settingsBtn: document.getElementById('settingsBtn'),
    settingsBackBtn: document.getElementById('settingsBackBtn'),
    intervalPresets: document.getElementById('intervalPresets')
  };
}

/**
 * Hide all screens
 */
function hideAllScreens() {
  elements.setupScreen.classList.add('hidden');
  elements.successScreen.classList.add('hidden');
  elements.emptyScreen.classList.add('hidden');
  elements.noBookmarksScreen.classList.add('hidden');
  elements.cooldownScreen.classList.add('hidden');
  elements.allRetiredScreen.classList.add('hidden');
  elements.settingsScreen.classList.add('hidden');
}

/**
 * Show a specific screen
 */
function showScreen(screenName) {
  hideAllScreens();
  currentScreen = screenName;

  switch (screenName) {
    case 'setup':
      elements.setupScreen.classList.remove('hidden');
      elements.mainHeader.classList.add('hidden');
      break;
    case 'success':
      elements.successScreen.classList.remove('hidden');
      elements.mainHeader.classList.remove('hidden');
      break;
    case 'empty':
      elements.emptyScreen.classList.remove('hidden');
      elements.mainHeader.classList.remove('hidden');
      break;
    case 'noBookmarks':
      elements.noBookmarksScreen.classList.remove('hidden');
      elements.mainHeader.classList.add('hidden');
      break;
    case 'cooldown':
      elements.cooldownScreen.classList.remove('hidden');
      elements.mainHeader.classList.remove('hidden');
      break;
    case 'allRetired':
      elements.allRetiredScreen.classList.remove('hidden');
      elements.mainHeader.classList.remove('hidden');
      break;
    case 'settings':
      elements.settingsScreen.classList.remove('hidden');
      elements.mainHeader.classList.add('hidden');
      break;
  }
}

/**
 * Format minutes as human-readable string
 */
function formatInterval(minutes) {
  if (minutes < 60) {
    return `${minutes} minutes`;
  } else if (minutes === 60) {
    return '1 hour';
  } else {
    const hours = minutes / 60;
    return `${hours} hours`;
  }
}

/**
 * Format milliseconds as countdown string (e.g., "2:45")
 */
function formatCountdown(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Start countdown timer on button
 */
function startButtonCountdown(cooldownUntil) {
  const btn = elements.resurfaceBtn;

  // Clear any existing countdown
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  const updateCountdown = () => {
    const remaining = cooldownUntil - Date.now();

    if (remaining <= 0) {
      // Countdown finished
      clearInterval(countdownInterval);
      countdownInterval = null;
      btn.disabled = false;
      btn.textContent = 'Resurface Now';
      return;
    }

    btn.disabled = true;
    btn.textContent = formatCountdown(remaining);
  };

  // Update immediately and then every second
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * Check and restore countdown state on popup open
 */
async function checkCooldownState() {
  try {
    const { resurfaceCooldownUntil } = await chrome.storage.local.get(['resurfaceCooldownUntil']);

    if (resurfaceCooldownUntil && resurfaceCooldownUntil > Date.now()) {
      startButtonCountdown(resurfaceCooldownUntil);
      return true;
    }
  } catch (error) {
    console.error('Error checking cooldown state:', error);
  }
  return false;
}

/**
 * Check bookmark availability and return status
 */
async function checkBookmarkAvailability() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_BOOKMARK_AVAILABILITY'
    });

    if (response && response.success) {
      return {
        totalCount: response.totalCount,
        eligibleCount: response.eligibleCount,
        inCooldownCount: response.inCooldownCount,
        retiredCount: response.retiredCount,
        nextAvailableAt: response.nextAvailableAt
      };
    }
  } catch (error) {
    console.error('Error checking bookmark availability:', error);
  }

  return null;
}

/**
 * Update and display cooldown screen with timer
 */
function showCooldownScreen(availability) {
  // Clear any existing timer
  if (cooldownTimerInterval) {
    clearInterval(cooldownTimerInterval);
    cooldownTimerInterval = null;
  }

  if (availability.nextAvailableAt) {
    const updateTimer = () => {
      const nextTime = new Date(availability.nextAvailableAt);
      const remaining = nextTime - Date.now();

      if (remaining <= 0) {
        clearInterval(cooldownTimerInterval);
        cooldownTimerInterval = null;
        elements.cooldownTimer.textContent = 'now!';
        // Refresh to success screen after a moment
        setTimeout(() => initPopup(), 1500);
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      elements.cooldownTimer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    updateTimer();
    cooldownTimerInterval = setInterval(updateTimer, 1000);
  } else {
    elements.cooldownTimer.textContent = 'soon';
  }

  showScreen('cooldown');
}

/**
 * Load and display current interval
 */
async function loadAndDisplayInterval() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_RESURFACE_INTERVAL'
    });

    if (response && response.success) {
      elements.intervalValue.textContent = formatInterval(response.interval);
    }
  } catch (error) {
    console.error('Error loading interval:', error);
    elements.intervalValue.textContent = '20 minutes'; // fallback
  }
}

/**
 * Handle Resurface Now button click
 */
async function handleResurfaceNow() {
  const btn = elements.resurfaceBtn;

  // Disable button to prevent spam
  btn.disabled = true;
  btn.textContent = 'Resurfacing...';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TRIGGER_RESURFACE',
      forceReplace: true
    });

    if (response && response.success && response.injected) {
      // Injection successful
      btn.textContent = 'Done!';

      // Check if more bookmarks are available after this resurface
      setTimeout(async () => {
        const availability = await checkBookmarkAvailability();

        if (availability && availability.eligibleCount === 0 && availability.inCooldownCount > 0) {
          // No more bookmarks available - show cooldown screen
          showCooldownScreen(availability);
        } else {
          // More bookmarks available - start button cooldown countdown
          const cooldownUntil = Date.now() + MANUAL_RESURFACE_COOLDOWN_MS;
          await chrome.storage.local.set({ resurfaceCooldownUntil: cooldownUntil });
          startButtonCountdown(cooldownUntil);
        }
      }, 1000);
    } else if (response && !response.success && response.reason === 'no_tabs') {
      // No X tabs found
      btn.textContent = 'No X Tab';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Resurface Now';
        showScreen('empty');
      }, 1500);
    } else {
      // Injection failed - handle based on reason
      const reason = response?.reason || 'unknown';

      // Some reasons should transition to a different screen
      if (reason === 'no_eligible_bookmarks') {
        btn.textContent = 'All in cooldown';
        setTimeout(async () => {
          const availability = await checkBookmarkAvailability();
          if (availability && availability.inCooldownCount > 0) {
            showCooldownScreen(availability);
          } else if (availability && availability.eligibleCount === 0) {
            showScreen('allRetired');
          }
        }, 1000);
        return;
      }

      // Other reasons show specific button message
      const messages = {
        'session_cap': 'Session limit reached',
        'already_visible': 'Already showing',
        'already_injecting': 'Please wait...',
        'injection_failed': 'Feed not found',
        'no_bookmarks': 'No bookmarks'
      };
      btn.textContent = messages[reason] || 'Try again';

      setTimeout(async () => {
        // Start cooldown countdown so user can try again
        const cooldownUntil = Date.now() + MANUAL_RESURFACE_COOLDOWN_MS;
        await chrome.storage.local.set({ resurfaceCooldownUntil: cooldownUntil });
        startButtonCountdown(cooldownUntil);
      }, 2000);
    }
  } catch (error) {
    console.error('Error triggering resurface:', error);
    btn.textContent = 'Error';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Resurface Now';
    }, BUTTON_THROTTLE_MS);
  }
}

/**
 * Load and display current interval setting in settings screen
 */
async function loadIntervalSetting() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_RESURFACE_INTERVAL'
    });

    if (response && response.success) {
      highlightActivePreset(response.interval);
    }
  } catch (error) {
    console.error('Error loading interval setting:', error);
  }
}

/**
 * Highlight the active interval preset button
 */
function highlightActivePreset(minutes) {
  const presets = elements.intervalPresets.querySelectorAll('.interval-preset');

  presets.forEach(preset => {
    const presetMinutes = parseInt(preset.dataset.minutes, 10);
    if (presetMinutes === minutes) {
      preset.classList.add('active');
    } else {
      preset.classList.remove('active');
    }
  });
}

/**
 * Handle interval preset click
 */
async function handleIntervalChange(minutes) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SET_RESURFACE_INTERVAL',
      interval: minutes
    });

    if (response && response.success) {
      highlightActivePreset(response.interval);
    }
  } catch (error) {
    console.error('Error setting interval:', error);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Settings button
  elements.settingsBtn.addEventListener('click', () => {
    loadIntervalSetting();
    showScreen('settings');
  });

  // Settings back button
  elements.settingsBackBtn.addEventListener('click', async () => {
    // Reload interval display in case it changed
    await loadAndDisplayInterval();

    // Return to appropriate screen
    const tabResponse = await chrome.runtime.sendMessage({ type: 'CHECK_X_TABS' });
    if (tabResponse && tabResponse.success && tabResponse.hasXTabs) {
      // Check bookmark availability
      const availability = await checkBookmarkAvailability();
      if (availability && availability.eligibleCount === 0 && availability.inCooldownCount > 0) {
        showCooldownScreen(availability);
      } else if (availability && availability.eligibleCount === 0 && availability.inCooldownCount === 0) {
        showScreen('allRetired');
      } else {
        showScreen('success');
        await checkCooldownState();
      }
    } else {
      showScreen('empty');
    }
  });

  // Resurface Now button
  elements.resurfaceBtn.addEventListener('click', handleResurfaceNow);

  // Open X button - opens X and triggers resurface after page loads
  elements.openXBtn.addEventListener('click', async () => {
    // Open X in new tab
    const tab = await chrome.tabs.create({ url: 'https://x.com' });

    // Wait for page to load, then trigger resurface
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        // Small delay to ensure content script is ready
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: 'TRIGGER_RESURFACE' })
            .catch(err => console.error('Failed to trigger resurface:', err));
        }, 1500);
      }
    });

    // Close popup
    window.close();
  });

  // Interval preset buttons
  elements.intervalPresets.addEventListener('click', (e) => {
    const preset = e.target.closest('.interval-preset');
    if (preset) {
      const minutes = parseInt(preset.dataset.minutes, 10);
      handleIntervalChange(minutes);
    }
  });
}

/**
 * Initialize popup
 */
async function initPopup() {
  initElements();

  let bookmarkCount = 0;
  let needsRefresh = false;
  let hasSynced = false;
  let hasXTabs = false;

  // Get bookmark count
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_BOOKMARK_COUNT'
    });

    if (response && response.count !== undefined) {
      bookmarkCount = response.count;
    }
  } catch (error) {
    console.error('Error getting bookmark count:', error);
  }

  // Check last sync time
  try {
    const { lastAutoFetch } = await chrome.storage.local.get(['lastAutoFetch']);
    if (lastAutoFetch) {
      hasSynced = true;
      const hoursSinceSync = (Date.now() - lastAutoFetch) / (1000 * 60 * 60);
      needsRefresh = hoursSinceSync > REFRESH_THRESHOLD_HOURS;
    }
  } catch (error) {
    console.error('Error checking sync time:', error);
  }

  // Check for X tabs
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_X_TABS'
    });

    if (response && response.success) {
      hasXTabs = response.hasXTabs;
    }
  } catch (error) {
    console.error('Error checking X tabs:', error);
  }

  // Determine which screen to show
  if (!hasSynced || needsRefresh) {
    // Never synced or sync is stale - show setup
    showScreen('setup');
  } else if (bookmarkCount === 0) {
    // Synced recently but user has no bookmarks on X
    showScreen('noBookmarks');
  } else if (!hasXTabs) {
    // Has bookmarks but no X tabs - show empty state
    showScreen('empty');
  } else {
    // Has bookmarks and X tabs - check availability
    const availability = await checkBookmarkAvailability();

    if (availability && availability.eligibleCount === 0 && availability.inCooldownCount > 0) {
      // All bookmarks in cooldown - show cooldown screen
      showCooldownScreen(availability);
    } else if (availability && availability.eligibleCount === 0 && availability.inCooldownCount === 0) {
      // All bookmarks retired (resurfaced 10+ times) - show all retired screen
      showScreen('allRetired');
    } else {
      // Has available bookmarks - show success with interval
      elements.bookmarkCount.textContent = bookmarkCount;
      await loadAndDisplayInterval();
      showScreen('success');

      // Check if we're in button cooldown and restore countdown
      await checkCooldownState();
    }
  }

  // Setup event listeners (only once)
  if (!elements.resurfaceBtn.hasAttribute('data-listeners-attached')) {
    setupEventListeners();
    elements.resurfaceBtn.setAttribute('data-listeners-attached', 'true');
  }
}

// Initialize when popup opens
initPopup();
