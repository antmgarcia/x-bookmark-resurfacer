/**
 * X Bookmark Resurfacer - API Interceptor
 * Runs in page context to intercept X's GraphQL API calls
 */

(function() {
  'use strict';

  const BOOKMARKS_ENDPOINT = '/Bookmarks';
  const log = (...args) => console.log('[X Bookmark Resurfacer - Interceptor]', ...args);

  /**
   * Extract query ID from GraphQL URL
   */
  function extractQueryId(url) {
    try {
      const match = url.match(/\/i\/api\/graphql\/([a-zA-Z0-9_-]+)\//);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  // Store original fetch
  const originalFetch = window.fetch;

  // Override fetch to intercept bookmark API calls
  window.fetch = async function(...args) {
    const [url, options] = args;
    const urlString = typeof url === 'string' ? url : url?.url || '';

    // Call original fetch
    const response = await originalFetch.apply(this, args);

    // Check if this is a bookmarks API call
    if (urlString && urlString.includes(BOOKMARKS_ENDPOINT)) {
      log('Detected Bookmarks API call');

      // Extract and send query ID
      const queryId = extractQueryId(urlString);
      if (queryId) {
        log('Query ID:', queryId);
        window.postMessage({
          type: 'BOOKMARK_QUERY_ID_DISCOVERED',
          queryId: queryId
        }, '*');
      }

      // Clone and process response
      const clonedResponse = response.clone();

      try {
        const data = await clonedResponse.json();

        window.postMessage({
          type: 'BOOKMARKS_INTERCEPTED',
          data: data,
          queryId: queryId
        }, '*');

        log('Bookmark data sent to content script');
      } catch (error) {
        console.error('[X Bookmark Resurfacer - Interceptor] Parse error:', error);
      }
    }

    return response;
  };

  // Also intercept XMLHttpRequest for compatibility
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._interceptedUrl = url;
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    if (this._interceptedUrl && this._interceptedUrl.includes(BOOKMARKS_ENDPOINT)) {
      this.addEventListener('load', function() {
        try {
          const data = JSON.parse(this.responseText);
          const queryId = extractQueryId(this._interceptedUrl);

          if (queryId) {
            window.postMessage({
              type: 'BOOKMARK_QUERY_ID_DISCOVERED',
              queryId: queryId
            }, '*');
          }

          window.postMessage({
            type: 'BOOKMARKS_INTERCEPTED',
            data: data,
            queryId: queryId
          }, '*');

          log('Bookmark data (XHR) sent to content script');
        } catch (error) {
          console.error('[X Bookmark Resurfacer - Interceptor] XHR parse error:', error);
        }
      });
    }

    return originalXHRSend.apply(this, args);
  };

  log('API interception ready');
})();
