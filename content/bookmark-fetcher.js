/**
 * X Bookmark Resurfacer - Bookmark Fetcher
 * Direct API calls to X's GraphQL endpoint
 */

class BookmarkFetcher {
  constructor() {
    this.fallbackQueryIds = [
      'kg_eDwF_ttJXsAaMYczXWA',
      'tmd4ifV8RHltzn8ymGg1aw',
      'gkjsKepM6gl_HmFWoWKfgg'
    ];

    this.authToken = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
    this.csrfToken = null;
    this.discoveredQueryId = null;
  }

  /**
   * Extract CSRF token from cookies
   */
  extractCsrfToken() {
    try {
      const cookies = document.cookie.split(';');
      const ct0Cookie = cookies.find(c => c.trim().startsWith('ct0='));
      if (ct0Cookie) {
        this.csrfToken = ct0Cookie.split('=')[1];
        return true;
      }
      return false;
    } catch (error) {
      logError('Error extracting CSRF token:', error);
      return false;
    }
  }

  /**
   * Get cached query ID
   */
  async getCachedQueryId() {
    try {
      const result = await chrome.storage.local.get(['bookmarksQueryId', 'queryIdTimestamp']);

      if (result.bookmarksQueryId && result.queryIdTimestamp) {
        const ageHours = (Date.now() - result.queryIdTimestamp) / (1000 * 60 * 60);
        if (ageHours < 168) { // 7 days
          return result.bookmarksQueryId;
        }
      }
      return null;
    } catch (error) {
      logError('Error getting cached query ID:', error);
      return null;
    }
  }

  /**
   * Cache a working query ID
   */
  async cacheQueryId(queryId) {
    try {
      await chrome.storage.local.set({
        bookmarksQueryId: queryId,
        queryIdTimestamp: Date.now()
      });
    } catch (error) {
      logError('Error caching query ID:', error);
    }
  }

  /**
   * Get GraphQL features object
   */
  getFeatures() {
    return {
      rweb_video_screen_enabled: false,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      responsive_web_graphql_timeline_navigation_enabled: true,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      communities_web_enable_tweet_community_results_fetch: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      longform_notetweets_consumption_enabled: true,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      freedom_of_speech_not_reach_fetch_enabled: true,
      standardized_nudges_misinfo: true,
      longform_notetweets_rich_text_read_enabled: true,
      longform_notetweets_inline_media_enabled: true,
      responsive_web_enhance_cards_enabled: false
    };
  }

  /**
   * Build GraphQL URL
   */
  buildBookmarksUrl(queryId, count = 20, cursor = null) {
    const variables = {
      count: count,
      includePromotedContent: true
    };

    if (cursor) {
      variables.cursor = cursor;
    }

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(this.getFeatures())
    });

    return `https://x.com/i/api/graphql/${queryId}/Bookmarks?${params.toString()}`;
  }

  /**
   * Test if a query ID works
   */
  async testQueryId(queryId) {
    try {
      const url = this.buildBookmarksUrl(queryId, 1);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${this.authToken}`,
          'content-type': 'application/json',
          'x-csrf-token': this.csrfToken,
          'x-twitter-active-user': 'yes',
          'x-twitter-auth-type': 'OAuth2Session'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        return !!data?.data?.bookmark_timeline_v2;
      }
      return false;
    } catch (error) {
      logError('Error testing query ID:', error);
      return false;
    }
  }

  /**
   * Find a working query ID
   */
  async findWorkingQueryId() {
    // Try cached ID first
    const cachedId = await this.getCachedQueryId();
    if (cachedId) {
      log('Using cached query ID');
      if (await this.testQueryId(cachedId)) {
        this.discoveredQueryId = cachedId;
        return cachedId;
      }
      log('Cached query ID failed, trying fallbacks');
    }

    // Try fallback IDs
    for (const queryId of this.fallbackQueryIds) {
      log(`Testing query ID: ${queryId.substring(0, 8)}...`);
      if (await this.testQueryId(queryId)) {
        log('Found working query ID');
        await this.cacheQueryId(queryId);
        this.discoveredQueryId = queryId;
        return queryId;
      }
    }

    return null;
  }

  /**
   * Fetch bookmarks from API
   */
  async fetchBookmarks(maxBookmarks = 20) {
    try {
      log('Starting bookmark fetch...');

      if (!this.csrfToken && !this.extractCsrfToken()) {
        logError('Could not extract CSRF token - may not be logged in');
        return [];
      }

      const queryId = await this.findWorkingQueryId();
      if (!queryId) {
        logError('No working query ID found');
        log('Visit https://x.com/i/bookmarks to capture bookmarks manually');
        return [];
      }

      const allBookmarks = [];
      let cursor = null;
      const maxPages = Math.ceil(maxBookmarks / 20);

      for (let page = 0; page < maxPages; page++) {
        const url = this.buildBookmarksUrl(queryId, 20, cursor);

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'authorization': `Bearer ${this.authToken}`,
              'content-type': 'application/json',
              'x-csrf-token': this.csrfToken,
              'x-twitter-active-user': 'yes',
              'x-twitter-auth-type': 'OAuth2Session'
            },
            credentials: 'include',
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            logError(`HTTP ${response.status}`);
            if (response.status === 400 || response.status === 403) {
              await chrome.storage.local.remove(['bookmarksQueryId', 'queryIdTimestamp']);
            }
            break;
          }

          const data = await response.json();
          const tweets = extractTweetsFromBookmarksResponse(data);

          if (tweets.length === 0) break;

          allBookmarks.push(...tweets);
          log(`Fetched ${tweets.length} bookmarks (total: ${allBookmarks.length})`);

          if (allBookmarks.length >= maxBookmarks) break;

          // Get next cursor
          const instructions = data?.data?.bookmark_timeline_v2?.timeline?.instructions || [];
          const cursorEntry = instructions.find(i => i.type === 'TimelineAddEntries')
            ?.entries?.find(e => e.entryId?.startsWith('cursor-bottom'));

          if (cursorEntry?.content?.value) {
            cursor = cursorEntry.content.value;
          } else {
            break;
          }

          // Rate limiting
          await new Promise(r => setTimeout(r, 500));
        } catch (error) {
          if (error.name === 'AbortError') {
            logError('Request timed out');
          } else {
            logError('Fetch error:', error.message);
          }
          break;
        }
      }

      if (allBookmarks.length > 0) {
        log(`Successfully fetched ${allBookmarks.length} bookmarks`);
      }

      return allBookmarks.slice(0, maxBookmarks);
    } catch (error) {
      logError('Error fetching bookmarks:', error);
      return [];
    }
  }
}

// Listen for query ID discovery from interceptor
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;

  if (event.data?.type === 'BOOKMARK_QUERY_ID_DISCOVERED') {
    const queryId = event.data.queryId;
    if (queryId) {
      log('Query ID discovered:', queryId);
      try {
        await chrome.storage.local.set({
          bookmarksQueryId: queryId,
          queryIdTimestamp: Date.now()
        });
      } catch (error) {
        logError('Error saving discovered query ID:', error);
      }
    }
  }
});

// Export for use in content script
window.BookmarkFetcher = BookmarkFetcher;
