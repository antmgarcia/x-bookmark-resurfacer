/**
 * X Bookmark Resurfacer - Content Script
 * Main orchestration script for the extension
 */

log('Content script loading v1.1.4');
log('Page URL:', window.location.href);

class BookmarkResurfacerContent {
  constructor() {
    this.injectedBookmarks = new Set();
    this.isInjecting = false;
    this.isFetching = false;
    this.injector = null;
    this.sessionResurfaceCount = 0;
    this.maxResurfacesPerSession = 5;
    this.lastResurfaceTime = 0;
    this.minTimeBetweenResurfacesMs = 3 * 60 * 1000; // 3 minutes minimum between resurfaced posts
    this.urlCheckInterval = null; // Store interval ID for cleanup
    this.pendingSyncToast = false; // Flag for showing sync toast when tab becomes visible
    this.pendingResurfaceToast = false; // Flag for showing resurface toast when tab becomes visible
    this.pendingGoToHomeToast = false; // Flag for showing go-to-home toast when tab becomes visible
    this.hasShownScrollToast = false; // Flag to show "scroll for more" toast only once per page
    this.acknowledgedSyncTimestamp = 0; // Track which sync we've shown toast for (per-tab)
    this.scriptInitTime = Date.now(); // Track when this content script started
    this.init();
  }

  /**
   * Initialize content script
   */
  init() {
    log('Initializing on', window.location.href);

    // API interceptor is now injected early by early-injector.js (at document_start)

    // Listen for messages from page (intercepted bookmarks)
    window.addEventListener('message', this.handlePageMessage.bind(this));

    // Listen for messages from background (inject commands)
    chrome.runtime.onMessage.addListener(this.handleExtensionMessage.bind(this));

    // Listen for tab visibility changes (to show pending toasts)
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Wait for timeline
    this.setupInjectionObserver();

    // Schedule auto-fetch
    this.scheduleAutoFetch();

    // Check for pending bookmark to inject (from "Resurface Now" when no home feed was open)
    setTimeout(() => this.checkAndInjectPendingBookmark(), 1500);

    // Check for recent sync (handles extension reload scenario)
    setTimeout(() => this.checkForRecentSync(), 2000);

    log('Content script initialized');
  }

  /**
   * Schedule auto-fetch with smart timing
   */
  async scheduleAutoFetch() {
    try {
      await new Promise(r => setTimeout(r, 2000));

      const { enabled = true } = await chrome.storage.local.get(['enabled']);
      if (!enabled) {
        log('Extension disabled, skipping auto-fetch');
        return;
      }

      const shouldFetch = await this.shouldAutoFetch();
      if (shouldFetch) {
        await this.autoFetchBookmarks();
      }
    } catch (error) {
      logError('Error in scheduleAutoFetch:', error);
    }
  }

  /**
   * Determine if auto-fetch should run
   */
  async shouldAutoFetch() {
    try {
      const result = await chrome.storage.local.get(['lastAutoFetch', 'bookmarksQueryId']);

      // Only auto-fetch if we have a cached query ID
      if (!result.bookmarksQueryId) {
        log('No cached query ID - visit bookmarks page first');
        return false;
      }

      const lastFetch = result.lastAutoFetch || 0;
      const hoursSinceLastFetch = (Date.now() - lastFetch) / (1000 * 60 * 60);

      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_BOOKMARK_COUNT
      });
      const count = response?.count || 0;

      if (count === 0) {
        log('No bookmarks in database - will auto-fetch');
        return true;
      }

      if (hoursSinceLastFetch > 1) {
        log(`Last fetch ${hoursSinceLastFetch.toFixed(1)}h ago - will refresh`);
        return true;
      }

      log(`Have ${count} bookmarks, last fetch ${hoursSinceLastFetch.toFixed(1)}h ago - skipping`);
      return false;
    } catch (error) {
      logError('Error checking auto-fetch status:', error);
      return false;
    }
  }

  /**
   * Auto-fetch bookmarks from API
   */
  async autoFetchBookmarks() {
    if (this.isFetching) {
      log('Already fetching, skipping');
      return;
    }

    this.isFetching = true;

    try {
      log('Auto-fetching bookmarks...');

      if (typeof BookmarkFetcher === 'undefined') {
        logError('BookmarkFetcher not available');
        return;
      }

      const fetcher = new BookmarkFetcher();
      const bookmarks = await fetcher.fetchBookmarks(50);

      if (bookmarks.length > 0) {
        log(`Auto-fetched ${bookmarks.length} bookmarks`);

        const response = await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.STORE_BOOKMARKS,
          bookmarks: bookmarks
        });

        await chrome.storage.local.set({
          lastAutoFetch: Date.now(),
          bookmarkCount: response?.count || bookmarks.length
        });

        log('Bookmarks stored successfully');
      } else {
        log('Auto-fetch returned no bookmarks');
      }
    } catch (error) {
      logError('Error during auto-fetch:', error);
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Check if extension context is still valid
   */
  isContextValid() {
    try {
      return chrome.runtime?.id != null;
    } catch {
      return false;
    }
  }

  /**
   * Handle messages from injected script
   */
  async handlePageMessage(event) {
    if (event.source !== window) return;

    // Check if extension context is still valid
    if (!this.isContextValid()) {
      console.warn('[X Bookmark Resurfacer] Extension was reloaded. Please refresh this page.');
      return;
    }

    const message = event.data;

    // Validate message structure
    if (!message || typeof message.type !== 'string') return;

    // Handle query ID discovery
    if (message.type === 'BOOKMARK_QUERY_ID_DISCOVERED') {
      if (typeof message.queryId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(message.queryId)) return;
      log('Query ID discovered:', message.queryId);
      try {
        await chrome.storage.local.set({ bookmarksQueryId: message.queryId });
        log('Query ID saved');
      } catch (error) {
        if (error.message?.includes('Extension context invalidated')) {
          console.warn('[X Bookmark Resurfacer] Extension was reloaded. Please refresh this page.');
        } else {
          logError('Error saving query ID:', error);
        }
      }
    }

    // Handle intercepted bookmarks
    if (message.type === 'BOOKMARKS_INTERCEPTED') {
      if (!message.data || typeof message.data !== 'object') return;
      log('Received intercepted bookmarks data');
      log('Data structure:', Object.keys(message.data));

      const tweets = extractTweetsFromBookmarksResponse(message.data);
      log(`Extracted ${tweets.length} tweets from response`);

      if (tweets.length > 0) {
        try {
          const response = await chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.STORE_BOOKMARKS,
            bookmarks: tweets
          });

          const totalCount = response?.count || tweets.length;
          log(`Bookmarks stored successfully! Count: ${totalCount}`);

          // On bookmarks page, show "scroll for more" toast (only once)
          if (this.isBookmarksPage() && !this.hasShownScrollToast) {
            this.hasShownScrollToast = true;
            this.showScrollForMoreToast(totalCount);
          }

          // Notify other X tabs about the sync
          try {
            await chrome.runtime.sendMessage({
              type: MESSAGE_TYPES.NOTIFY_SYNC
            });
          } catch {
            // Non-critical, continue
          }

          try {
            await chrome.runtime.sendMessage({
              type: MESSAGE_TYPES.TRIGGER_RESURFACE
            });
          } catch {
            // Will resurface on next alarm
          }
        } catch (error) {
          if (error.message?.includes('Extension context invalidated')) {
            console.warn('[X Bookmark Resurfacer] Extension was reloaded. Please refresh this page.');
          } else {
            logError('Error storing bookmarks:', error);
          }
        }
      } else {
        log('No tweets extracted from bookmarks response');
      }
    }
  }

  /**
   * Handle messages from background
   */
  handleExtensionMessage(message, sender, sendResponse) {
    log('Received message:', message.type);

    // Handle async message processing
    (async () => {
      switch (message.type) {
        case MESSAGE_TYPES.INJECT_BOOKMARKS:
          log(`Received ${message.bookmarks?.length || 0} bookmarks to inject`);
          log(`Session: ${this.sessionResurfaceCount}/${this.maxResurfacesPerSession}`);
          log(`Force replace: ${message.forceReplace || false}`);
          const result = await this.injectBookmarksIntoFeed(message.bookmarks, message.forceReplace || false);
          sendResponse({ success: true, ...result });
          break;

        case MESSAGE_TYPES.SYNC_COMPLETE:
          // Show reload toast if we're not on the bookmarks page (where sync happened)
          if (!this.isBookmarksPage()) {
            if (document.hidden) {
              // Tab is not visible, queue the toast for when it becomes visible
              this.pendingSyncToast = true;
            } else {
              this.showReloadToast();
            }
          }
          sendResponse({ success: true });
          break;

        case MESSAGE_TYPES.NOTIFY_NO_HOME_FEED:
          // Show toast directing user to home feed (where bookmark will be injected)
          if (document.hidden) {
            // Tab is not visible, queue the toast for when it becomes visible
            this.pendingGoToHomeToast = true;
          } else {
            this.showGoToHomeToast();
          }
          sendResponse({ success: true });
          break;

        default:
          log('Unknown message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    })();

    return true; // Keep channel open for async response
  }

  /**
   * Set up timeline observer for persistence
   * Watches for timeline changes (like "Show new posts" clicks) and re-injects
   */
  async setupInjectionObserver() {
    setTimeout(() => {
      const timeline = this.findTimeline();
      if (timeline) {
        log('Timeline found, setting up persistence observer');
        this.setupPersistenceObserver(timeline);
      } else {
        log('Timeline not found, retrying...');
        setTimeout(() => this.setupInjectionObserver(), 3000);
      }
    }, 2000);
  }

  /**
   * Set up observer for URL changes and "Show posts" clicks
   * We DON'T re-inject immediately - let the background alarm handle it naturally
   * This prevents the extension from being annoying/intrusive
   */
  setupPersistenceObserver(timeline) {
    // Clear any existing interval from a previous setup
    if (this.urlCheckInterval) {
      clearInterval(this.urlCheckInterval);
    }

    // Listen for URL changes (SPA navigation) - just reset counters, don't re-inject
    let lastUrl = window.location.href;
    this.urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        log('URL changed, removing resurfaced posts and resetting session');
        this.removeResurfacedPosts();
        this.sessionResurfaceCount = 0;
        this.injectedBookmarks.clear();

        // Check for pending bookmark when navigating TO home feed
        if (this.isHomeFeed()) {
          log('Navigated to home feed, checking for pending bookmark');
          setTimeout(() => this.checkAndInjectPendingBookmark(), 1500);
        }
      }
    }, 1000);

    // Listen for clicks on "Show XX posts" button
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-testid="cellInnerDiv"]');
      if (!target) return;

      // Must NOT contain a tweet (the Show posts button is not a tweet)
      if (target.querySelector('article[data-testid="tweet"]')) return;

      // Must be a small element (Show posts is typically short text)
      const text = (target.textContent || '').trim();
      if (text.length > 100) return; // Skip large elements

      // Match specific patterns: "Show 33 posts", "Mostrar 33 publicaciones", etc.
      if (text.match(/^(show|mostrar|ver)\s+\d+/i) || text.match(/^\d+\s+(new\s+)?(posts?|publicaciones?)/i)) {
        log('"Show posts" clicked, removing resurfaced posts');
        setTimeout(() => {
          this.removeResurfacedPosts();
        }, 100);
      }
    }, true);

    log('Session observer active (non-intrusive mode)');
  }

  /**
   * Remove all resurfaced posts from the DOM
   */
  removeResurfacedPosts() {
    const resurfaced = document.querySelectorAll('[data-resurfaced-cell]');
    resurfaced.forEach(el => el.remove());
    log(`Removed ${resurfaced.length} resurfaced post(s)`);
  }

  /**
   * Handle tab visibility changes
   */
  handleVisibilityChange() {
    if (!document.hidden) {
      // Show pending sync toast
      if (this.pendingSyncToast) {
        this.pendingSyncToast = false;
        this.showReloadToast();
      }
      // Show pending resurface toast
      if (this.pendingResurfaceToast) {
        this.pendingResurfaceToast = false;
        if (!this.injector) {
          this.injector = new PostInjector();
        }
        this.injector.showToast('Bookmark resurfaced at top');
      }
      // Show pending go-to-home toast
      if (this.pendingGoToHomeToast) {
        this.pendingGoToHomeToast = false;
        this.showGoToHomeToast();
      }
      // Check for recent sync (handles extension reload or missed SYNC_COMPLETE)
      this.checkForRecentSync();
    }
  }

  /**
   * Check if current page is the bookmarks page
   */
  isBookmarksPage() {
    return window.location.href.includes('/i/bookmarks');
  }

  /**
   * Check if current page is the home feed
   */
  isHomeFeed() {
    const url = window.location.href;
    return /^https:\/\/(x|twitter)\.com\/(home)?(\?.*)?$/.test(url);
  }

  /**
   * Check for and inject any pending bookmark (from no-home-feed scenario)
   */
  async checkAndInjectPendingBookmark() {
    if (!this.isHomeFeed()) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.INJECT_PENDING_BOOKMARK
      });

      if (response && response.success && response.bookmark) {
        log('Found pending bookmark to inject:', response.bookmark.id);
        // Give timeline a moment to fully load, then inject (don't force replace)
        setTimeout(async () => {
          await this.injectBookmarksIntoFeed([response.bookmark], false);
        }, 1500);
      }
    } catch (error) {
      logError('Error checking pending bookmark:', error);
    }
  }

  /**
   * Check for recent sync and show toast if needed
   * Fallback for cases where scripting API injection didn't work
   * Only shows toast if sync happened AFTER this tab was opened
   */
  async checkForRecentSync() {
    // Skip if on bookmarks page (that's where sync happens)
    if (this.isBookmarksPage()) return;

    try {
      const { lastAutoFetch, syncToastAcknowledgedAt } = await chrome.storage.local.get(['lastAutoFetch', 'syncToastAcknowledgedAt']);
      if (!lastAutoFetch) return;

      // Skip if sync happened BEFORE this tab was opened (new tab after sync)
      if (lastAutoFetch < this.scriptInitTime) {
        this.acknowledgedSyncTimestamp = lastAutoFetch;
        return;
      }

      // Skip if the sync was already acknowledged (user clicked Reload on toast)
      if (syncToastAcknowledgedAt && lastAutoFetch <= syncToastAcknowledgedAt) {
        this.acknowledgedSyncTimestamp = lastAutoFetch;
        return;
      }

      // Check if this is a sync we haven't acknowledged yet
      if (lastAutoFetch > this.acknowledgedSyncTimestamp) {
        // Only show toast for syncs in the last 5 minutes
        const syncAge = Date.now() - lastAutoFetch;
        const fiveMinutes = 5 * 60 * 1000;

        if (syncAge < fiveMinutes) {
          log('Recent sync detected, showing reload toast');
          this.acknowledgedSyncTimestamp = lastAutoFetch;
          this.showReloadToast();
        } else {
          // Sync is older, just acknowledge it silently
          this.acknowledgedSyncTimestamp = lastAutoFetch;
        }
      }
    } catch (error) {
      // Extension context may be invalid, ignore
    }
  }

  /**
   * Show reload toast notification
   */
  showReloadToast() {
    // Ensure injector exists for toast functionality
    if (!this.injector) {
      this.injector = new PostInjector();
    }
    this.injector.showReloadToast('Bookmarks synced! Reload to start resurfacing.');
  }

  /**
   * Show go-to-home toast notification
   */
  showGoToHomeToast() {
    // Ensure injector exists for toast functionality
    if (!this.injector) {
      this.injector = new PostInjector();
    }
    this.injector.showGoToHomeToast('Bookmark resurfaced in your home feed');
  }

  /**
   * Show "scroll for more" toast on bookmarks page
   */
  showScrollForMoreToast(count) {
    // Ensure injector exists for toast functionality
    if (!this.injector) {
      this.injector = new PostInjector();
    }
    this.injector.showScrollForMoreToast(count);
  }

  /**
   * Find timeline element
   */
  findTimeline() {
    const selectors = [
      '[aria-label*="Timeline"]',
      '[data-testid="primaryColumn"]',
      'section[role="region"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    return null;
  }

  /**
   * Inject bookmarks into feed
   * @param {Array} bookmarks - Bookmarks to inject
   * @param {boolean} forceReplace - If true, replace existing resurfaced post and skip cooldown
   * @returns {Object} Result with injected status and reason if failed
   */
  async injectBookmarksIntoFeed(bookmarks, forceReplace = false) {
    if (!bookmarks || bookmarks.length === 0) {
      log('No bookmarks to inject');
      return { injected: false, reason: 'no_bookmarks' };
    }

    // Check if there's already a resurfaced post visible
    const existingResurfaced = document.querySelectorAll('[data-resurfaced-cell]');
    if (existingResurfaced.length > 0) {
      if (forceReplace) {
        // Remove existing resurfaced posts when force replacing
        log('Force replacing existing resurfaced post(s)');
        existingResurfaced.forEach(el => el.remove());
      } else {
        log('Resurfaced post already visible, skipping');
        return { injected: false, reason: 'already_visible' };
      }
    }

    // Check minimum time between resurfaces (prevents being annoying)
    // Skip this check if forceReplace is true (user explicitly requested)
    if (!forceReplace) {
      const timeSinceLastResurface = Date.now() - this.lastResurfaceTime;
      if (this.lastResurfaceTime > 0 && timeSinceLastResurface < this.minTimeBetweenResurfacesMs) {
        const waitMinutes = ((this.minTimeBetweenResurfacesMs - timeSinceLastResurface) / 60000).toFixed(1);
        log(`Too soon since last resurface, wait ${waitMinutes} more minutes`);
        return { injected: false, reason: 'cooldown' };
      }
    }

    // Check session cap (skip for manual resurface)
    if (!forceReplace && this.sessionResurfaceCount >= this.maxResurfacesPerSession) {
      log(`Session cap reached (${this.sessionResurfaceCount}/${this.maxResurfacesPerSession})`);
      return { injected: false, reason: 'session_cap' };
    }

    if (this.isInjecting) {
      log('Already injecting, skipping');
      return { injected: false, reason: 'already_injecting' };
    }

    this.isInjecting = true;
    log(`Injecting ${bookmarks.length} bookmarks`);

    if (!this.injector) {
      this.injector = new PostInjector();
    }

    let injectionSuccess = false;

    for (const bookmark of bookmarks) {
      if (this.injectedBookmarks.has(bookmark.id)) {
        log(`Bookmark ${bookmark.id} already injected`);
        continue;
      }

      if (this.sessionResurfaceCount >= this.maxResurfacesPerSession) {
        log('Session cap reached during injection');
        break;
      }

      try {
        // Check if scrolled down before injection (for toast decision)
        const wasScrolledDown = this.injector.isScrolledDown();

        const success = await this.injector.injectBookmark(bookmark);

        if (success) {
          this.injectedBookmarks.add(bookmark.id);
          this.sessionResurfaceCount++;
          this.lastResurfaceTime = Date.now(); // Track when we last showed a resurfaced post
          log(`Injected bookmark ${bookmark.id} (session: ${this.sessionResurfaceCount})`);
          injectionSuccess = true;

          // Show toast if this was a manual resurface and user is scrolled down
          if (forceReplace && wasScrolledDown) {
            if (document.hidden) {
              // Tab is in background, queue toast for when it becomes visible
              this.pendingResurfaceToast = true;
            } else {
              this.injector.showToast('Bookmark resurfaced at top');
            }
          }

          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.UPDATE_RESURFACE_STATS,
            bookmarkId: bookmark.id
          }).catch(err => logError('Failed to update resurface stats:', err));

          const { totalResurfaced = 0 } = await chrome.storage.local.get(['totalResurfaced']);
          await chrome.storage.local.set({ totalResurfaced: totalResurfaced + 1 });

          // Only inject one at a time, wait for next alarm cycle for more
          break;
        }
      } catch (error) {
        logError('Error injecting bookmark:', error);
      }
    }

    this.isInjecting = false;
    log('Injection complete');

    return { injected: injectionSuccess, reason: injectionSuccess ? null : 'injection_failed' };
  }
}

// Initialize
const bookmarkResurfacer = new BookmarkResurfacerContent();

log('Extension ready');
