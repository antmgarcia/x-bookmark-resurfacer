# X Bookmark Resurfacer

A Chrome extension that automatically resurfaces your X/Twitter bookmarks in your feed as gentle reminders, helping you rediscover saved content you might have forgotten.

## Features

- **Automatic Bookmark Sync**: Captures your bookmarks when you visit the X bookmarks page
- **Smart Resurfacing**: Periodically injects bookmarked posts into your home feed
- **Customizable Interval**: Choose how often bookmarks appear (10min to 2 hours)
- **Multi-Tab Support**: Resurfaces across all open home feed tabs simultaneously
- **Toast Notifications**: X-style toasts notify you when bookmarks are synced or resurfaced
- **Non-Intrusive**: Respects your browsing with cooldowns and session limits
- **Native Look & Feel**: Resurfaced posts match X's design with a subtle "Resurfaced" indicator
- **Three-Theme Support**: Automatically adapts to X's Light, Dim, and Dark themes
- **Notification Dot**: Shows when bookmarks need to be refreshed (after 24 hours)

## Installation

### From Source (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `XBookmarkResurfacer` folder
6. Pin the extension for easy access

### First-Time Setup

1. After installation, a welcome page will open automatically
2. Click "Go to Bookmarks" to sync your bookmarks
3. Return to your home feed - bookmarks will start appearing periodically

## How It Works

### Bookmark Capture
The extension intercepts X's bookmark API responses when you visit your bookmarks page. This captures your bookmarks without requiring any API keys or authentication setup.

### Resurfacing Logic
- Bookmarks are stored locally in IndexedDB
- At your chosen interval (default: 20 minutes), the extension shows a resurfaced post
- Posts appear at the top of your feed with a blue left border and "Resurfaced" chip
- Each bookmark has a 1-hour cooldown after being shown
- Maximum 5 resurfaced posts per browser session
- Use the "Resurface Now" button to manually trigger a resurface anytime

### Refresh Indicator
- A red notification dot appears on the extension icon when:
  - No bookmarks have been synced, OR
  - Last sync was more than 24 hours ago
- Visit your bookmarks page to refresh and clear the dot

## Privacy

- **No external servers**: All data stays on your device
- **No API keys required**: Works by observing X's existing API calls
- **Local storage only**: Bookmarks stored in browser's IndexedDB
- **No tracking**: No analytics or telemetry

## Configuration

The extension works out of the box with sensible defaults. Access settings via the gear icon in the popup.

| Setting | Default | Options | Description |
|---------|---------|---------|-------------|
| Resurface Interval | 20 minutes | 10min, 20min, 30min, 1hr, 2hr | How often bookmarks appear in your feed |
| Session Limit | 5 posts | - | Max auto-resurfaced posts per session ("Resurface Now" always works) |
| Bookmark Cooldown | 1 hour | - | Time before same bookmark can reappear |
| Refresh Threshold | 24 hours | - | When to show refresh notification dot |
| Max Resurface Count | 10 times | - | Bookmark retires after being shown 10 times |

## File Structure

```
XBookmarkResurfacer/
├── manifest.json           # Extension configuration
├── background/
│   ├── service-worker.js   # Background orchestration & alarms
│   └── storage-manager.js  # IndexedDB operations
├── content/
│   ├── early-injector.js   # Injects API interceptor at document_start
│   ├── api-interceptor.js  # Captures bookmark API responses
│   ├── content-script.js   # Main content script orchestration
│   ├── post-injector.js    # Creates and injects resurfaced posts
│   └── bookmark-fetcher.js # Fetches bookmarks from API
├── popup/
│   ├── popup.html          # Extension popup UI
│   └── popup.js            # Popup logic
├── welcome/
│   └── welcome.html        # Onboarding page
├── styles/
│   └── resurfaced.css      # Styles for resurfaced posts
├── utils/
│   ├── constants.js        # Shared constants (content scripts)
│   ├── constants.module.js # Shared constants (ES modules)
│   ├── helpers.js          # Helper functions (content scripts)
│   └── helpers.module.js   # Helper functions (ES modules)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Troubleshooting

### Bookmarks not syncing
1. Make sure you're on `x.com/i/bookmarks`
2. Refresh the page after installing/updating the extension
3. Check the console for "Bookmarks stored successfully" message

### Resurfaced posts not appearing
1. Make sure you're on the home feed (`x.com` or `x.com/home`)
2. Wait at least 30 seconds after page load
3. Check Service Worker console for alarm logs

### "Extension context invalidated" error
This happens when the extension is reloaded while X tabs are open. Simply refresh the X page.

### Red dot won't go away
Visit your bookmarks page to trigger a fresh sync. The dot clears when bookmarks are successfully captured.

## Debug Commands

Open the Service Worker console (`chrome://extensions` → Service Worker) and use:

```javascript
manualResurface()  // Trigger immediate resurface
showStats()        // Show all bookmark statistics
resetStats()       // Clear cooldowns (allows re-resurfacing)
checkAlarm()       // Check alarm status
```

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## License

MIT License - See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
