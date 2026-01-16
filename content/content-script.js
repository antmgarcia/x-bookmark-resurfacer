/**
 * X Bookmark Resurfacer - Content Script
 * Main orchestration script for the extension
 */

log('Content script loading v1.1.0');
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

    // Wait for timeline
    this.setupInjectionObserver();

    // Schedule auto-fetch
    this.scheduleAutoFetch();

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

    // Handle query ID discovery
    if (message.type === 'BOOKMARK_QUERY_ID_DISCOVERED') {
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
      log('Received intercepted bookmarks data');
      log('Data structure:', Object.keys(message.data || {}));

      const tweets = extractTweetsFromBookmarksResponse(message.data);
      log(`Extracted ${tweets.length} tweets from response`);

      if (tweets.length > 0) {
        try {
          const response = await chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.STORE_BOOKMARKS,
            bookmarks: tweets
          });

          log(`Bookmarks stored successfully! Count: ${response?.count || tweets.length}`);

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

        case 'RESET_SESSION':
          this.sessionResurfaceCount = 0;
          this.injectedBookmarks.clear();
          log('Session reset');
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
    // Listen for URL changes (SPA navigation) - just reset counters, don't re-inject
    let lastUrl = window.location.href;
    this.urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        log('URL changed, removing resurfaced posts and resetting session');
        this.removeResurfacedPosts();
        this.sessionResurfaceCount = 0;
        this.injectedBookmarks.clear();
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

    // Check session cap
    if (this.sessionResurfaceCount >= this.maxResurfacesPerSession) {
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
        const success = await this.injector.injectBookmark(bookmark);

        if (success) {
          this.injectedBookmarks.add(bookmark.id);
          this.sessionResurfaceCount++;
          this.lastResurfaceTime = Date.now(); // Track when we last showed a resurfaced post
          log(`Injected bookmark ${bookmark.id} (session: ${this.sessionResurfaceCount})`);
          injectionSuccess = true;

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
