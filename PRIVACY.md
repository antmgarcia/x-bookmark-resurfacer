# Privacy Policy

**Last updated: January 9, 2026**

## Overview

X Bookmark Resurfacer is committed to protecting your privacy. This extension operates entirely on your local device and does not collect, transmit, or share any personal data.

## Data Collection

**We do not collect any data.**

The extension does not:
- Send data to external servers
- Use analytics or tracking
- Store data outside your browser
- Access any data beyond what's necessary for functionality

## Data Storage

All data is stored locally on your device using browser APIs:

### IndexedDB
- **What**: Your bookmarked tweets (ID, author, text, metrics)
- **Why**: To resurface bookmarks in your feed
- **Where**: Local browser storage only
- **Retention**: Until you uninstall the extension or clear browser data

### Chrome Storage Local
- **What**: Settings and sync timestamps
- **Why**: To track when bookmarks were last synced
- **Where**: Local browser storage only

## Permissions Explained

| Permission | Purpose |
|------------|---------|
| `storage` | Save bookmarks and settings locally |
| `alarms` | Schedule periodic bookmark resurfacing |
| `tabs` | Detect which tabs are on X/Twitter |
| `scripting` | Inject content scripts into X pages |
| `host_permissions` (x.com, twitter.com) | Operate on X/Twitter pages |

## Data Access

The extension only accesses:
- X/Twitter bookmark API responses (to capture your bookmarks)
- X/Twitter page DOM (to inject resurfaced posts)

The extension never accesses:
- Your X/Twitter password or credentials
- Your direct messages
- Your private account information
- Any other websites

## Third Parties

This extension does not:
- Use third-party analytics
- Include third-party tracking scripts
- Share data with any third parties
- Make requests to any external servers

## Data Deletion

To delete all extension data:
1. Right-click the extension icon
2. Select "Remove from Chrome"
3. All local data is automatically deleted

Alternatively, clear your browser's IndexedDB storage for x.com.

## Updates

This privacy policy may be updated occasionally. Changes will be noted in the CHANGELOG.

## Contact

For privacy concerns, please open an issue on the project repository.

## Summary

**Your data stays on your device. Period.**
