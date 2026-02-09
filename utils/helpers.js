/**
 * X Bookmark Resurfacer - Helper Functions
 * Utility functions used throughout the extension
 */

/**
 * Log message with extension prefix
 */
function log(...args) {
  console.log('[X Bookmark Resurfacer]', ...args);
}

/**
 * Log error with extension prefix
 */
function logError(...args) {
  console.error('[X Bookmark Resurfacer]', ...args);
}

/**
 * Generate random integer between min and max (inclusive)
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Check if enough time has passed since last resurface
 */
function canResurface(lastResurfacedAt, minHours) {
  if (!lastResurfacedAt) return true;
  const lastTime = new Date(lastResurfacedAt);
  const now = new Date();
  const hoursPassed = (now - lastTime) / (1000 * 60 * 60);
  return hoursPassed >= minHours;
}

/**
 * Format timestamp to relative time (e.g., "2h", "3d")
 */
function formatRelativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 0) return '0s';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(days / 365);
  return `${years}y`;
}

/**
 * Wait for element to appear in DOM
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) return resolve(element);

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Extract tweets from X's GraphQL bookmarks response
 */
function extractTweetsFromBookmarksResponse(data) {
  try {
    const instructions = data?.data?.bookmark_timeline_v2?.timeline?.instructions || [];
    const tweets = [];

    for (const instruction of instructions) {
      if (instruction.type !== 'TimelineAddEntries') continue;

      const entries = instruction.entries || [];

      for (const entry of entries) {
        if (!entry.entryId?.startsWith('tweet-')) continue;

        const tweetResult = entry.content?.itemContent?.tweet_results?.result;
        if (!tweetResult) continue;

        const tweet = tweetResult.tweet || tweetResult;
        if (!tweet?.legacy) continue;

        const legacy = tweet.legacy;
        const userResult = tweet.core?.user_results?.result;

        if (!userResult) continue;

        const userCore = userResult.core;
        const userLegacy = userResult.legacy;

        const authorName = userCore?.name || userLegacy?.name;
        const authorScreenName = userCore?.screen_name || userLegacy?.screen_name;
        const authorId = userResult.rest_id || userLegacy?.id_str;
        const authorAvatar = userResult.avatar?.image_url || userLegacy?.profile_image_url_https;

        if (!authorName || !authorScreenName) continue;

        tweets.push({
          id: tweet.rest_id,
          text: legacy.full_text,
          created_at: legacy.created_at,
          author: {
            id: authorId,
            name: authorName,
            screen_name: authorScreenName,
            profile_image_url: authorAvatar
          },
          media: legacy.entities?.media || [],
          metrics: {
            reply_count: legacy.reply_count || 0,
            retweet_count: legacy.retweet_count || 0,
            favorite_count: legacy.favorite_count || 0,
            view_count: tweet.views?.count || 0
          },
          bookmark_added_at: new Date().toISOString(),
          last_resurfaced_at: null,
          resurfaced_count: 0
        });
      }
    }

    return tweets;
  } catch (error) {
    logError('Error extracting tweets:', error);
    return [];
  }
}

/**
 * Format count for display (e.g., 1200 -> "1.2K")
 */
function formatCount(count) {
  if (!count) return '';
  if (count < 1000) return count.toString();
  if (count < 1000000) return (count / 1000).toFixed(1).replace('.0', '') + 'K';
  return (count / 1000000).toFixed(1).replace('.0', '') + 'M';
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
