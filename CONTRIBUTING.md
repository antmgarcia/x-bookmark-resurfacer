# Contributing to X Bookmark Resurfacer

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites
- Google Chrome browser
- Basic knowledge of JavaScript and Chrome Extension APIs
- Familiarity with X/Twitter's web interface

### Development Setup

1. Clone or download the repository
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project folder
5. Make changes and reload the extension to test

## How to Contribute

### Reporting Bugs

Before submitting a bug report:
1. Check existing issues to avoid duplicates
2. Try to reproduce the bug with the latest version
3. Collect relevant console logs

When reporting, include:
- Chrome version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Console logs (both page and Service Worker)

### Suggesting Features

Feature suggestions are welcome! Please:
1. Check if the feature has already been suggested
2. Explain the use case and benefit
3. Consider how it fits with the extension's philosophy (non-intrusive, privacy-focused)

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`feature/your-feature-name`)
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Code Guidelines

### Style
- Use consistent indentation (2 spaces)
- Add meaningful comments for complex logic
- Use descriptive variable and function names
- Follow existing code patterns

### Architecture
- Keep content scripts minimal - delegate to background when possible
- Use message passing for cross-context communication
- Handle errors gracefully with user-friendly messages
- Respect the privacy-first approach

### Testing Checklist
- [ ] Works on x.com home feed
- [ ] Works on twitter.com (if still accessible)
- [ ] Dark mode displays correctly
- [ ] Light mode displays correctly
- [ ] Alarm fires reliably
- [ ] Badge/icon updates correctly
- [ ] No console errors during normal operation
- [ ] Extension survives browser restart

## Project Structure

```
Key files for contributors:

background/service-worker.js  - Main background logic, alarms
content/content-script.js     - Content script orchestration
content/post-injector.js      - UI rendering for resurfaced posts
content/api-interceptor.js    - Bookmark API capture
utils/constants.module.js     - Configuration values
```

## Commit Messages

Use clear, descriptive commit messages:
- `fix: resolve dark mode detection issue`
- `feat: add keyboard navigation support`
- `docs: update installation instructions`
- `refactor: simplify alarm handling logic`

## Questions?

Feel free to open an issue for any questions about contributing.

Thank you for helping improve X Bookmark Resurfacer!
