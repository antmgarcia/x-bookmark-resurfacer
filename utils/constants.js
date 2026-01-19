/**
 * X Bookmark Resurfacer - Constants
 * Configuration and constants for the extension
 */

// Storage configuration for IndexedDB
const STORAGE_CONFIG = {
  DB_NAME: 'XBookmarkResurfacerDB',
  DB_VERSION: 1,
  BOOKMARKS_STORE: 'bookmarks'
};

// Timing configuration for v1.1 customizable intervals
const TIMING_CONFIG = {
  DEFAULT_FIRST_INTERVAL_MINUTES: 5,   // First resurface after sync
  DEFAULT_INTERVAL_MINUTES: 20,         // Subsequent resurfaces
  MIN_INTERVAL_MINUTES: 10,             // Minimum user-selectable
  MAX_INTERVAL_MINUTES: 120,            // Maximum (2 hours)
  GRACE_PERIOD_MINUTES: 5,              // Queue timeout when no X tab
  BUTTON_THROTTLE_MS: 2000              // Prevent button spam
};

// Injection timing and behavior
const INJECTION_CONFIG = {
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
const VISUAL_CONFIG = {
  RESURFACED_CLASS: 'bookmark-resurfaced',
  INDICATOR_CLASS: 'bookmark-indicator',
  INDICATOR_TEXT: 'Resurfaced',
  PRIMARY_COLOR: '#1d9bf0'
};

// Message types for extension communication
const MESSAGE_TYPES = {
  BOOKMARKS_INTERCEPTED: 'BOOKMARKS_INTERCEPTED',
  INJECT_BOOKMARKS: 'INJECT_BOOKMARKS',
  STORE_BOOKMARKS: 'STORE_BOOKMARKS',
  GET_RANDOM_BOOKMARKS: 'GET_RANDOM_BOOKMARKS',
  UPDATE_RESURFACE_STATS: 'UPDATE_RESURFACE_STATS',
  GET_BOOKMARK_COUNT: 'GET_BOOKMARK_COUNT',
  SET_ENABLED: 'SET_ENABLED',
  GET_ENABLED: 'GET_ENABLED',
  TRIGGER_RESURFACE: 'TRIGGER_RESURFACE',
  // v1.1 additions
  GET_NEXT_RESURFACE_TIME: 'GET_NEXT_RESURFACE_TIME',
  SET_RESURFACE_INTERVAL: 'SET_RESURFACE_INTERVAL',
  GET_RESURFACE_INTERVAL: 'GET_RESURFACE_INTERVAL',
  CHECK_X_TABS: 'CHECK_X_TABS',
  GET_BOOKMARK_AVAILABILITY: 'GET_BOOKMARK_AVAILABILITY',
  // v1.1.2 additions
  NOTIFY_SYNC: 'NOTIFY_SYNC',
  SYNC_COMPLETE: 'SYNC_COMPLETE'
};

// DOM selectors for X/Twitter
const SELECTORS = {
  TIMELINE: '[aria-label*="Timeline"]',
  TWEET: '[data-testid="tweet"]',
  CELL_INNER_DIV: '[data-testid="cellInnerDiv"]'
};
