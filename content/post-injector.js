/**
 * X Bookmark Resurfacer - Post Injector
 * Creates and injects bookmark cards into the timeline
 */

class PostInjector {
  constructor() {
    this.injectedBookmarkIds = new Set();
    this.isInjecting = false;
    this.lastInjectionTime = 0;
    this.activeToast = null;
  }

  /**
   * Check if user is scrolled down from the top
   */
  isScrolledDown() {
    return window.scrollY > 300;
  }

  /**
   * Scroll to top of the page smoothly
   */
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Show toast notification with "View" button
   */
  showToast(message = 'Post resurfaced at top') {
    // Remove any existing toast
    if (this.activeToast) {
      this.activeToast.remove();
      this.activeToast = null;
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'resurfacer-toast';

    const messageSpan = document.createElement('span');
    messageSpan.className = 'resurfacer-toast-message';
    messageSpan.textContent = message;

    const viewButton = document.createElement('button');
    viewButton.className = 'resurfacer-toast-button';
    viewButton.textContent = 'View';
    viewButton.addEventListener('click', () => {
      this.scrollToTop();
      this.hideToast(toast);
    });

    toast.appendChild(messageSpan);
    toast.appendChild(viewButton);
    document.body.appendChild(toast);

    this.activeToast = toast;

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      this.hideToast(toast);
    }, 5000);
  }

  /**
   * Show reload toast notification with "Reload" button
   */
  showReloadToast(message = 'Bookmarks synced! Reload to start resurfacing.') {
    // Remove any existing toast
    if (this.activeToast) {
      this.activeToast.remove();
      this.activeToast = null;
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'resurfacer-toast';

    const messageSpan = document.createElement('span');
    messageSpan.className = 'resurfacer-toast-message';
    messageSpan.textContent = message;

    const reloadButton = document.createElement('button');
    reloadButton.className = 'resurfacer-toast-button';
    reloadButton.textContent = 'Reload';
    reloadButton.addEventListener('click', () => {
      window.location.reload();
    });

    toast.appendChild(messageSpan);
    toast.appendChild(reloadButton);
    document.body.appendChild(toast);

    this.activeToast = toast;

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    // Auto-dismiss after 8 seconds (longer than regular toast)
    setTimeout(() => {
      this.hideToast(toast);
    }, 8000);
  }

  /**
   * Hide and remove toast
   */
  hideToast(toast) {
    if (!toast) return;

    toast.classList.remove('visible');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
      if (this.activeToast === toast) {
        this.activeToast = null;
      }
    }, 300);
  }

  /**
   * Clean up any broken/empty resurfaced elements
   */
  cleanupBrokenInjections() {
    const resurfaced = document.querySelectorAll('[data-resurfaced-cell]');
    let removed = 0;

    resurfaced.forEach(el => {
      const rect = el.getBoundingClientRect();
      // If element is off-screen (too far down) or has no height, remove it
      if (rect.height < 50 || rect.top > 10000) {
        el.remove();
        removed++;
      }
    });

    // Also clean up old wrappers if any exist
    const wrappers = document.querySelectorAll('[data-resurfaced-wrapper]');
    wrappers.forEach(wrapper => {
      wrapper.remove();
      removed++;
    });

    if (removed > 0) {
      log(`Cleaned up ${removed} broken element(s)`);
    }
  }

  /**
   * Inject a bookmark into the timeline
   */
  async injectBookmark(bookmark) {
    try {
      // Clean up any broken injections first
      this.cleanupBrokenInjections();

      // Prevent simultaneous injections
      if (this.isInjecting) {
        log('Injection already in progress');
        return false;
      }

      // Prevent rapid injections (min 2 seconds apart)
      const now = Date.now();
      if (now - this.lastInjectionTime < 2000) {
        log('Too soon since last injection');
        return false;
      }

      this.isInjecting = true;
      log('Injecting bookmark:', bookmark.id);

      const timeline = await this.findTimeline();
      if (!timeline) {
        logError('Timeline not found');
        this.isInjecting = false;
        return false;
      }

      const success = await this.insertBookmark(timeline, bookmark);

      if (success) {
        this.injectedBookmarkIds.add(bookmark.id);
        this.lastInjectionTime = Date.now();
        log('Successfully injected bookmark');
      }

      this.isInjecting = false;
      return success;
    } catch (error) {
      logError('Error in injectBookmark:', error);
      this.isInjecting = false;
      return false;
    }
  }

  /**
   * Find the timeline element - the actual container with tweet cells
   */
  async findTimeline() {
    log('Finding timeline...');

    // First find the timeline section
    const timelineSection = document.querySelector('[aria-label*="Timeline"]');
    if (!timelineSection) {
      log('Timeline section not found, waiting...');
      try {
        await waitForElement('[aria-label*="Timeline"]', 5000);
      } catch {
        logError('Timeline never appeared');
        return null;
      }
    }

    // Find the container that actually holds tweet cells
    // X structure: Timeline > div > div > div (with cellInnerDiv children)
    const possibleContainers = document.querySelectorAll('[aria-label*="Timeline"] > div > div');

    for (const container of possibleContainers) {
      // Check if this container has tweet cells
      const hasTweets = container.querySelector('[data-testid="tweet"]');
      if (hasTweets) {
        log('Found timeline container with tweets');
        return container;
      }
    }

    // Fallback: find any container with cellInnerDiv
    const cellContainer = document.querySelector('[data-testid="cellInnerDiv"]')?.parentElement?.parentElement;
    if (cellContainer) {
      log('Found timeline via cellInnerDiv parent');
      return cellContainer;
    }

    // Last fallback: use the timeline section itself
    log('Using timeline section as fallback');
    return document.querySelector('[aria-label*="Timeline"]');
  }

  /**
   * Insert bookmark into timeline
   */
  async insertBookmark(timeline, bookmark) {
    // Check if already in DOM
    if (document.querySelector(`[data-bookmark-id="${bookmark.id}"]`)) {
      log('Bookmark already in DOM');
      return true;
    }

    // Count existing resurfaced posts
    const existingResurfaced = document.querySelectorAll('[data-resurfaced-cell]');
    if (existingResurfaced.length >= 1) {
      log('Already have a resurfaced post visible, skipping');
      return false;
    }

    // Find the first tweet to use as reference - wait if not found
    let firstTweet = document.querySelector('article[data-testid="tweet"]');
    if (!firstTweet) {
      log('No tweet found, waiting for tweets to load...');
      // Wait up to 5 seconds for tweets to appear
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 500));
        firstTweet = document.querySelector('article[data-testid="tweet"]');
        if (firstTweet) {
          log('Tweets loaded after waiting');
          break;
        }
      }
      if (!firstTweet) {
        log('No tweets found after waiting');
        return false;
      }
    }

    // Navigate up to find the virtualized container (the div with position: relative that contains all tweets)
    // This is typically 3-4 levels up from the tweet article
    let virtualContainer = firstTweet.closest('[data-testid="cellInnerDiv"]');
    if (virtualContainer) {
      // Go up to the parent that has position: relative (the virtual list container)
      let parent = virtualContainer.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        if (style.position === 'relative' && parent.children.length > 1) {
          virtualContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }
    }

    log('Found virtual container');

    // Create the bookmark cell
    const bookmarkCell = this.createBookmarkCell(bookmark);
    if (!bookmarkCell) {
      logError('Failed to create bookmark cell');
      return false;
    }

    // Mark the cell
    bookmarkCell.setAttribute('data-resurfaced-cell', 'true');
    bookmarkCell.setAttribute('data-bookmark-id', bookmark.id);

    // Style to appear properly - use static positioning to flow in document
    const borderColor = this.isDarkMode() ? '#2f3336' : '#eff3f4';
    bookmarkCell.style.cssText += `
      position: static !important;
      display: block !important;
      transform: none !important;
      z-index: 1 !important;
      width: 100% !important;
      margin: 0 !important;
    `;

    log('Created bookmark cell');

    // Insert in the timeline - after "Show XX posts" if present, otherwise before first tweet
    try {
      let inserted = false;

      // Find the first tweet's cellInnerDiv
      const firstCellInner = firstTweet.closest('[data-testid="cellInnerDiv"]');

      if (firstCellInner) {
        // In X's virtualized timeline, each cellInnerDiv is inside a wrapper div
        // We need to find the wrapper and check ITS siblings
        const firstCellWrapper = firstCellInner.parentElement;
        let showPostsWrapper = null;

        // Method 1: Search for "Show posts" in ALL cellInnerDivs before the first tweet
        const allCells = document.querySelectorAll('[data-testid="cellInnerDiv"]');

        for (const cell of allCells) {
          // Skip cells that contain tweets
          if (cell.querySelector('article[data-testid="tweet"]')) continue;
          // Skip our own resurfaced cells
          if (cell.closest('[data-resurfaced-cell]')) continue;

          const text = cell.textContent || '';

          // Check if this is a "Show posts" cell
          if (text.match(/\d+\s*(new\s+)?(posts?|publicaciones?)|\d+\s*nuevas?|mostrar.*\d+|show.*\d+/i)) {
            // Check if this cell comes BEFORE the first tweet in DOM order
            const position = firstCellInner.compareDocumentPosition(cell);
            if (position & Node.DOCUMENT_POSITION_PRECEDING) {
              showPostsWrapper = cell.parentElement;
              log('Found "Show posts" via cell scan:', text.substring(0, 60));
              break;
            }
          }
        }

        // Method 2: Fallback - check wrapper siblings
        if (!showPostsWrapper && firstCellWrapper) {
          let prevWrapper = firstCellWrapper.previousElementSibling;
          while (prevWrapper) {
            const text = prevWrapper.textContent || '';
            if (!prevWrapper.querySelector('article[data-testid="tweet"]')) {
              if (text.match(/\d+\s*(new\s+)?(posts?|publicaciones?)|\d+\s*nuevas?|mostrar|show/i)) {
                showPostsWrapper = prevWrapper;
                log('Found "Show posts" via sibling scan:', text.substring(0, 60));
                break;
              }
            }
            prevWrapper = prevWrapper.previousElementSibling;
          }
        }

        // If found, insert after "Show posts" wrapper
        if (showPostsWrapper) {
          showPostsWrapper.insertAdjacentElement('afterend', bookmarkCell);
          log('Inserted AFTER "Show posts" wrapper');
          inserted = true;
        } else {
          // Insert before the first tweet's wrapper
          log('No "Show posts" found - inserting before first tweet');
          if (firstCellWrapper) {
            firstCellWrapper.insertAdjacentElement('beforebegin', bookmarkCell);
            log('Inserted before first tweet wrapper');
          } else {
            firstCellInner.insertAdjacentElement('beforebegin', bookmarkCell);
            log('Inserted before first cellInnerDiv');
          }
          inserted = true;
        }
      }

      if (!inserted) {
        log('Insertion failed - no valid insertion point found');
        return false;
      }

      log('Insertion complete');

      return true;
    } catch (error) {
      logError('Insert failed:', error);
      return false;
    }
  }

  /**
   * Get tweet cells from timeline
   */
  getTweetCells(timeline) {
    const tweetCells = [];

    // Find all cellInnerDiv elements that contain tweets
    const allCells = timeline.querySelectorAll('[data-testid="cellInnerDiv"]');

    allCells.forEach((cell) => {
      // Skip our resurfaced cells
      const parent = cell.closest('[data-resurfaced-cell]');
      if (parent) return;

      // Check if this cell contains a tweet
      const tweet = cell.querySelector('[data-testid="tweet"]');
      if (tweet) {
        // Get the outermost container for this cell
        let container = cell;
        while (container.parentElement && container.parentElement !== timeline) {
          container = container.parentElement;
        }
        // Avoid duplicates
        if (!tweetCells.includes(container)) {
          tweetCells.push(container);
        }
      }
    });

    log(`Found ${tweetCells.length} tweet cells`);
    return tweetCells;
  }

  /**
   * Broader search for tweet cells across entire document
   * Returns cellInnerDiv elements directly for accurate counting
   */
  getTweetCellsBroad() {
    const tweetCells = [];

    // Find ALL tweets on the page
    const allTweets = document.querySelectorAll('[data-testid="tweet"]');
    log(`Broad search: found ${allTweets.length} tweet elements`);

    allTweets.forEach((tweet) => {
      // Skip if inside our resurfaced cell
      if (tweet.closest('[data-resurfaced-cell]')) return;

      // Find the cellInnerDiv parent - this is the insertable unit
      const cellInner = tweet.closest('[data-testid="cellInnerDiv"]');
      if (!cellInner || tweetCells.includes(cellInner)) return;

      // Filter out spacer elements - real tweets have significant height
      const rect = cellInner.getBoundingClientRect();
      if (rect.height < 50) {
        log(`Skipping spacer element: height=${rect.height}`);
        return;
      }

      tweetCells.push(cellInner);
    });

    // Sort by vertical position to ensure correct order
    tweetCells.sort((a, b) => {
      return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
    });

    log(`Broad search returning ${tweetCells.length} real tweet cells`);
    return tweetCells;
  }

  /**
   * Get positions of existing resurfaced posts
   */
  getResurfacedPositions(timeline, tweetCells) {
    const positions = [];
    const resurfacedCells = timeline.querySelectorAll('[data-resurfaced-cell="true"]');

    resurfacedCells.forEach(resurfaced => {
      for (let i = 0; i < tweetCells.length; i++) {
        const comparison = tweetCells[i].compareDocumentPosition(resurfaced);
        if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
          positions.push(i);
          break;
        }
      }
    });

    return positions.sort((a, b) => a - b);
  }

  /**
   * Detect dark mode - check X's actual background color
   */
  isDarkMode() {
    // Most reliable: check the actual body background color
    const bg = getComputedStyle(document.body).backgroundColor;
    if (bg) {
      const rgb = bg.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const r = parseInt(rgb[0]);
        const g = parseInt(rgb[1]);
        const b = parseInt(rgb[2]);
        // X light mode: white (#fff = 255,255,255)
        // X dark mode: black (#000 = 0,0,0) or dim (#15202b = 21,32,43)
        // Check if it's dark (all values under 128)
        const isDark = r < 128 && g < 128 && b < 128;
        log(`Body background RGB: ${r},${g},${b} - isDark: ${isDark}`);
        return isDark;
      }
    }

    // Fallback: default to light mode
    log('Could not detect theme, defaulting to light mode');
    return false;
  }

  /**
   * Create bookmark cell with full UI
   */
  createBookmarkCell(bookmark) {
    log('Creating cell for bookmark:', bookmark.id);
    log('Bookmark data keys:', Object.keys(bookmark || {}));
    log('Author data:', bookmark.author ? JSON.stringify(bookmark.author) : 'NO AUTHOR');
    log('Text:', bookmark.text ? bookmark.text.substring(0, 100) : 'NO TEXT');

    // Validate and provide fallbacks
    const authorName = bookmark.author?.name || bookmark.authorName || 'Unknown';
    const authorHandle = bookmark.author?.screen_name || bookmark.authorHandle || 'unknown';
    const bookmarkText = bookmark.text || bookmark.full_text || 'No text available';

    log(`Resolved - Name: ${authorName}, Handle: ${authorHandle}, Text length: ${bookmarkText.length}`);

    if (!bookmark.id) {
      logError('Bookmark missing ID');
      return null;
    }

    const tweetUrl = `https://x.com/${authorHandle}/status/${bookmark.id}`;
    const isDark = this.isDarkMode();
    log(`Dark mode detected: ${isDark}`);

    const textColor = isDark ? '#e7e9ea' : '#0f1419';
    const secondaryColor = isDark ? '#71767b' : '#536471';
    const borderColor = isDark ? '#2f3336' : '#eff3f4';
    const bgColor = isDark ? '#000000' : '#ffffff';
    log(`Using colors - bg: ${bgColor}, text: ${textColor}`);

    const avatarUrl = bookmark.author?.profile_image_url ||
      'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
    const timeAgo = formatRelativeTime(bookmark.created_at || new Date().toISOString());

    // Create cell - must be a proper block element in document flow
    const cell = document.createElement('div');
    cell.setAttribute('data-testid', 'cellInnerDiv');
    cell.setAttribute('data-resurfaced-inner', 'true');

    // Soft gradient from left (Twitter blue at 5% opacity) fading to transparent
    const gradientBg = `linear-gradient(90deg, rgba(29, 155, 240, 0.05) 0%, rgba(29, 155, 240, 0.02) 50%, transparent 100%)`;

    cell.style.cssText = `
      background: ${gradientBg}, ${bgColor} !important;
      padding: 12px 16px 12px 13px !important;
      display: block !important;
      position: relative !important;
      visibility: visible !important;
      opacity: 1 !important;
      min-height: 100px !important;
      border-left: 3px solid #1d9bf0 !important;
      border-bottom: 1px solid ${borderColor} !important;
      margin: 0 !important;
      width: 100% !important;
      box-sizing: border-box !important;
      overflow: visible !important;
      z-index: 1 !important;
    `;
    log('Cell styles applied with gradient, bgColor:', bgColor);

    // Main container (2 columns)
    const mainContainer = document.createElement('div');
    mainContainer.style.cssText = 'display: flex; gap: 12px; cursor: pointer;';

    // Avatar column
    const avatarColumn = document.createElement('div');
    avatarColumn.style.cssText = 'flex-shrink: 0;';

    const avatarImg = document.createElement('img');
    avatarImg.src = avatarUrl;
    avatarImg.alt = authorName;
    avatarImg.style.cssText = 'width: 40px; height: 40px; border-radius: 50%; object-fit: cover;';
    avatarImg.onerror = () => { avatarImg.src = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'; };
    avatarColumn.appendChild(avatarImg);

    // Content column
    const contentColumn = document.createElement('div');
    contentColumn.style.cssText = 'flex: 1; min-width: 0;';

    // Header (name, handle, time, chip)
    const headerDiv = document.createElement('div');
    headerDiv.style.cssText = 'display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-bottom: 2px;';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = authorName;
    nameSpan.style.cssText = `font-weight: 700; font-size: 15px; color: ${textColor};`;

    const handleSpan = document.createElement('span');
    handleSpan.textContent = '@' + authorHandle;
    handleSpan.style.cssText = `font-size: 15px; color: ${secondaryColor};`;

    const dotSpan = document.createElement('span');
    dotSpan.textContent = ' · ';
    dotSpan.style.cssText = `color: ${secondaryColor};`;

    const timeSpan = document.createElement('span');
    timeSpan.textContent = timeAgo;
    timeSpan.style.cssText = `font-size: 15px; color: ${secondaryColor};`;

    const chipSpan = document.createElement('span');
    chipSpan.textContent = 'Resurfaced';
    chipSpan.style.cssText = `
      margin-left: 8px;
      padding: 2px 8px;
      background: rgba(29, 155, 240, 0.1);
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      color: #1d9bf0;
    `;

    headerDiv.appendChild(nameSpan);
    headerDiv.appendChild(handleSpan);
    headerDiv.appendChild(dotSpan);
    headerDiv.appendChild(timeSpan);
    headerDiv.appendChild(chipSpan);

    // Tweet text
    const textDiv = document.createElement('div');
    textDiv.textContent = bookmarkText;
    textDiv.style.cssText = `
      margin-top: 4px;
      font-size: 15px;
      line-height: 20px;
      color: ${textColor};
      white-space: pre-wrap;
      word-wrap: break-word;
    `;

    // Action bar with fallback metrics
    const metrics = bookmark.metrics || { reply_count: 0, retweet_count: 0, favorite_count: 0, view_count: 0 };
    const actionBar = this.createActionBar(metrics, tweetUrl, secondaryColor);

    // Assemble
    contentColumn.appendChild(headerDiv);
    contentColumn.appendChild(textDiv);
    contentColumn.appendChild(actionBar);

    mainContainer.appendChild(avatarColumn);
    mainContainer.appendChild(contentColumn);

    cell.appendChild(mainContainer);

    // Click handler - open in same tab like native X behavior
    cell.addEventListener('click', (e) => {
      if (e.target.closest('[role="button"]')) return;
      window.location.href = tweetUrl;
    });

    return cell;
  }

  /**
   * Create action bar with engagement buttons
   * Layout: [Reply, Repost, Like, Views] ... [Bookmark, Share]
   */
  createActionBar(metrics, tweetUrl, secondaryColor) {
    const bar = document.createElement('div');
    bar.setAttribute('role', 'group');
    bar.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-top: 16px; overflow: visible;';

    // Left group: Reply, Repost, Like, Views (spread out)
    const leftGroup = document.createElement('div');
    leftGroup.style.cssText = 'display: flex; align-items: center; justify-content: space-between; flex: 1; max-width: 400px; overflow: visible;';

    // Reply
    leftGroup.appendChild(this.createActionButton({
      label: 'Reply',
      count: metrics.reply_count,
      icon: 'M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z',
      hoverColor: 'rgb(29, 155, 240)',
      hoverBg: 'rgba(29, 155, 240, 0.1)',
      url: tweetUrl,
      baseColor: secondaryColor
    }));

    // Repost
    leftGroup.appendChild(this.createActionButton({
      label: 'Repost',
      count: metrics.retweet_count,
      icon: 'M4.75 3.79l4.603 4.3-1.706 1.82L6 8.38v7.37c0 .97.784 1.75 1.75 1.75H13V20H7.75c-2.347 0-4.25-1.9-4.25-4.25V8.38L1.853 9.91.147 8.09l4.603-4.3zm11.5 2.71H11V4h5.25c2.347 0 4.25 1.9 4.25 4.25v7.37l1.647-1.53 1.706 1.82-4.603 4.3-4.603-4.3 1.706-1.82L18 15.62V8.25c0-.97-.784-1.75-1.75-1.75z',
      hoverColor: 'rgb(0, 186, 124)',
      hoverBg: 'rgba(0, 186, 124, 0.1)',
      url: tweetUrl,
      baseColor: secondaryColor
    }));

    // Like
    leftGroup.appendChild(this.createActionButton({
      label: 'Like',
      count: metrics.favorite_count,
      icon: 'M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z',
      hoverColor: 'rgb(249, 24, 128)',
      hoverBg: 'rgba(249, 24, 128, 0.1)',
      url: tweetUrl,
      baseColor: secondaryColor
    }));

    // Views
    leftGroup.appendChild(this.createActionButton({
      label: 'Views',
      count: metrics.view_count,
      icon: 'M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z',
      hoverColor: 'rgb(29, 155, 240)',
      hoverBg: 'rgba(29, 155, 240, 0.1)',
      url: tweetUrl,
      baseColor: secondaryColor
    }));

    // Right group: Bookmark, Share
    const rightGroup = document.createElement('div');
    rightGroup.style.cssText = 'display: flex; align-items: center; gap: 12px; overflow: visible;';

    // Bookmark (filled)
    rightGroup.appendChild(this.createActionButton({
      label: 'Bookmark',
      icon: 'M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z',
      hoverColor: 'rgb(29, 155, 240)',
      hoverBg: 'rgba(29, 155, 240, 0.1)',
      url: tweetUrl,
      filled: true,
      baseColor: secondaryColor
    }));

    // Share
    rightGroup.appendChild(this.createActionButton({
      label: 'Share',
      icon: 'M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z',
      hoverColor: 'rgb(29, 155, 240)',
      hoverBg: 'rgba(29, 155, 240, 0.1)',
      url: tweetUrl,
      baseColor: secondaryColor
    }));

    bar.appendChild(leftGroup);
    bar.appendChild(rightGroup);

    return bar;
  }

  /**
   * Create action button
   */
  createActionButton({ label, count, icon, hoverColor, hoverBg, url, filled = false, baseColor }) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; align-items: center; overflow: visible;';

    const button = document.createElement('div');
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', count ? `${count} ${label}` : label);
    button.setAttribute('tabindex', '0');
    button.style.cssText = `
      display: flex;
      align-items: center;
      cursor: pointer;
      transition: color 0.2s;
      color: ${baseColor};
    `;

    // Icon container with hover background - sized for circular hover effect
    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
      margin: -8px;
    `;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = `width: 18px; height: 18px; fill: ${filled ? hoverColor : 'currentColor'};`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', icon);
    svg.appendChild(path);
    iconContainer.appendChild(svg);
    button.appendChild(iconContainer);

    if (count && count > 0) {
      const countSpan = document.createElement('span');
      countSpan.textContent = formatCount(count);
      countSpan.style.cssText = 'font-size: 13px; line-height: 16px; margin-left: 2px; padding-right: 8px;';
      button.appendChild(countSpan);
    }

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = url;
    });

    button.addEventListener('mouseenter', () => {
      button.style.color = hoverColor;
      iconContainer.style.backgroundColor = hoverBg;
      if (!filled) svg.style.fill = hoverColor;
    });

    button.addEventListener('mouseleave', () => {
      button.style.color = baseColor;
      iconContainer.style.backgroundColor = 'transparent';
      if (!filled) svg.style.fill = 'currentColor';
    });

    wrapper.appendChild(button);
    return wrapper;
  }
}
