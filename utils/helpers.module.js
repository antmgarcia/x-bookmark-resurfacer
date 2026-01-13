/**
 * X Bookmark Resurfacer - Helper Functions (ES Module)
 * Utility functions for the service worker
 */

/**
 * Log message with extension prefix
 */
export function log(...args) {
  console.log('[X Bookmark Resurfacer]', ...args);
}

/**
 * Log error with extension prefix
 */
export function logError(...args) {
  console.error('[X Bookmark Resurfacer]', ...args);
}

/**
 * Check if enough time has passed since last resurface
 */
export function canResurface(lastResurfacedAt, minHours) {
  if (!lastResurfacedAt) return true;
  const lastTime = new Date(lastResurfacedAt);
  const now = new Date();
  const hoursPassed = (now - lastTime) / (1000 * 60 * 60);
  return hoursPassed >= minHours;
}

/**
 * Generate random integer between min and max (inclusive)
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
