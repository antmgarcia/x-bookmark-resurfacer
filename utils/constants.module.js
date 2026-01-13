/**
 * X Bookmark Resurfacer - Constants (ES Module)
 * Configuration and constants for the service worker
 */

// Storage configuration for IndexedDB
export const STORAGE_CONFIG = {
  DB_NAME: 'XBookmarkResurfacerDB',
  DB_VERSION: 1,
  BOOKMARKS_STORE: 'bookmarks'
};

// Injection timing and behavior
export const INJECTION_CONFIG = {
  ALARM_NAME: 'resurfaceBookmarks',
  ALARM_DELAY_MINUTES: 0.5,        // First trigger after 30 seconds
  ALARM_PERIOD_MINUTES: 5,         // Then every 5 minutes
  POSTS_PER_INJECTION: 1,
  MIN_TIME_BETWEEN_RESURFACES_HOURS: 1, // 1 hour cooldown per bookmark
  MAX_RESURFACE_COUNT: 10,         // Can resurface same bookmark up to 10 times
  MAX_RESURFACES_PER_SESSION: 5,   // Up to 5 per browser session
  INSERTION_POSITION_MIN: 8,
  INSERTION_POSITION_MAX: 10,
  INSERTION_GAP: 25
};

// Visual styling constants
export const VISUAL_CONFIG = {
  RESURFACED_CLASS: 'bookmark-resurfaced',
  INDICATOR_CLASS: 'bookmark-indicator',
  INDICATOR_TEXT: 'Resurfaced',
  PRIMARY_COLOR: '#1d9bf0'
};

// Message types for extension communication
export const MESSAGE_TYPES = {
  BOOKMARKS_INTERCEPTED: 'BOOKMARKS_INTERCEPTED',
  INJECT_BOOKMARKS: 'INJECT_BOOKMARKS',
  STORE_BOOKMARKS: 'STORE_BOOKMARKS',
  GET_RANDOM_BOOKMARKS: 'GET_RANDOM_BOOKMARKS',
  UPDATE_RESURFACE_STATS: 'UPDATE_RESURFACE_STATS',
  GET_BOOKMARK_COUNT: 'GET_BOOKMARK_COUNT',
  SET_ENABLED: 'SET_ENABLED',
  GET_ENABLED: 'GET_ENABLED',
  TRIGGER_RESURFACE: 'TRIGGER_RESURFACE'
};

// DOM selectors for X/Twitter
export const SELECTORS = {
  TIMELINE: '[aria-label*="Timeline"]',
  TWEET: '[data-testid="tweet"]',
  CELL_INNER_DIV: '[data-testid="cellInnerDiv"]'
};
