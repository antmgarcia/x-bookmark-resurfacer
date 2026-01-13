/**
 * X Bookmark Resurfacer - Storage Manager
 * IndexedDB wrapper for bookmark storage
 */

import { STORAGE_CONFIG, INJECTION_CONFIG } from '../utils/constants.module.js';
import { canResurface, log, logError } from '../utils/helpers.module.js';

class StorageManager {
  constructor() {
    this.db = null;
    this.dbReady = this.initDatabase();
  }

  /**
   * Initialize IndexedDB database
   */
  async initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(STORAGE_CONFIG.DB_NAME, STORAGE_CONFIG.DB_VERSION);

      request.onerror = () => {
        logError('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        log('IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORAGE_CONFIG.BOOKMARKS_STORE)) {
          const store = db.createObjectStore(STORAGE_CONFIG.BOOKMARKS_STORE, {
            keyPath: 'id'
          });

          store.createIndex('bookmark_added_at', 'bookmark_added_at', { unique: false });
          store.createIndex('last_resurfaced_at', 'last_resurfaced_at', { unique: false });
          store.createIndex('resurfaced_count', 'resurfaced_count', { unique: false });

          log('Bookmarks store created');
        }
      };
    });
  }

  /**
   * Ensure database is ready
   */
  async ensureReady() {
    if (!this.db) {
      await this.dbReady;
    }
  }

  /**
   * Save bookmarks to database
   */
  async saveBookmarks(bookmarks) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORAGE_CONFIG.BOOKMARKS_STORE], 'readwrite');
      const store = transaction.objectStore(STORAGE_CONFIG.BOOKMARKS_STORE);

      let savedCount = 0;

      bookmarks.forEach((bookmark) => {
        const request = store.put(bookmark);
        request.onsuccess = () => savedCount++;
      });

      transaction.oncomplete = () => {
        log(`Saved ${savedCount} bookmarks`);
        resolve(savedCount);
      };

      transaction.onerror = () => {
        logError('Error saving bookmarks:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Get all bookmarks
   */
  async getAllBookmarks() {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORAGE_CONFIG.BOOKMARKS_STORE], 'readonly');
      const store = transaction.objectStore(STORAGE_CONFIG.BOOKMARKS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        logError('Error getting bookmarks:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get random bookmarks eligible for resurfacing
   */
  async getRandomBookmarks(count = 1) {
    await this.ensureReady();

    const allBookmarks = await this.getAllBookmarks();

    // Filter eligible bookmarks (not in cooldown, not retired)
    const eligible = allBookmarks.filter((bookmark) => {
      const resurfaceCount = bookmark.resurfaced_count || 0;
      if (resurfaceCount >= INJECTION_CONFIG.MAX_RESURFACE_COUNT) {
        return false;
      }

      return canResurface(
        bookmark.last_resurfaced_at,
        INJECTION_CONFIG.MIN_TIME_BETWEEN_RESURFACES_HOURS
      );
    });

    if (eligible.length === 0) {
      log('No eligible bookmarks for resurfacing');
      return [];
    }

    // Shuffle and select
    const shuffled = eligible.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));

    log(`Selected ${selected.length} bookmarks (${eligible.length} eligible, ${allBookmarks.length} total)`);
    return selected;
  }

  /**
   * Update resurface stats for a bookmark
   */
  async updateResurfaceStats(bookmarkId) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORAGE_CONFIG.BOOKMARKS_STORE], 'readwrite');
      const store = transaction.objectStore(STORAGE_CONFIG.BOOKMARKS_STORE);
      const getRequest = store.get(bookmarkId);

      getRequest.onsuccess = () => {
        const bookmark = getRequest.result;
        if (!bookmark) {
          return reject(new Error('Bookmark not found'));
        }

        bookmark.last_resurfaced_at = new Date().toISOString();
        bookmark.resurfaced_count = (bookmark.resurfaced_count || 0) + 1;

        const putRequest = store.put(bookmark);

        putRequest.onsuccess = () => {
          log(`Updated stats for bookmark ${bookmarkId}`);
          resolve();
        };

        putRequest.onerror = () => {
          logError('Error updating stats:', putRequest.error);
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Get bookmark count
   */
  async getBookmarkCount() {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORAGE_CONFIG.BOOKMARKS_STORE], 'readonly');
      const store = transaction.objectStore(STORAGE_CONFIG.BOOKMARKS_STORE);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all bookmarks
   */
  async clearAllBookmarks() {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORAGE_CONFIG.BOOKMARKS_STORE], 'readwrite');
      const store = transaction.objectStore(STORAGE_CONFIG.BOOKMARKS_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        log('All bookmarks cleared');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Reset resurface stats for all bookmarks (for testing)
   */
  async resetAllStats() {
    await this.ensureReady();

    const allBookmarks = await this.getAllBookmarks();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORAGE_CONFIG.BOOKMARKS_STORE], 'readwrite');
      const store = transaction.objectStore(STORAGE_CONFIG.BOOKMARKS_STORE);

      let resetCount = 0;
      allBookmarks.forEach((bookmark) => {
        bookmark.last_resurfaced_at = null;
        bookmark.resurfaced_count = 0;
        const request = store.put(bookmark);
        request.onsuccess = () => resetCount++;
      });

      transaction.oncomplete = () => {
        log(`Reset stats for ${resetCount} bookmarks`);
        resolve(resetCount);
      };

      transaction.onerror = () => {
        logError('Error resetting stats:', transaction.error);
        reject(transaction.error);
      };
    });
  }
}

export const storageManager = new StorageManager();
