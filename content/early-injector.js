/**
 * X Bookmark Resurfacer - Early Injector
 * Runs at document_start to inject API interceptor before X's scripts
 */

(function() {
  'use strict';

  // Inject the interceptor script immediately
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content/api-interceptor.js');
  script.type = 'text/javascript';

  // Inject as early as possible
  const target = document.head || document.documentElement;
  if (target) {
    target.insertBefore(script, target.firstChild);
  } else {
    // Fallback: wait for head/documentElement
    const observer = new MutationObserver(() => {
      const t = document.head || document.documentElement;
      if (t) {
        t.insertBefore(script, t.firstChild);
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  }
})();
