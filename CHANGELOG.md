# Changelog

## 0.1.1

### Fixed

- Only eagerly load valid Stimulus controller modules and preserve conventional controller identifiers.
- Load controllers already present in the DOM when lazy loading starts.
- Observe dynamically inserted controllers and `data-controller` attribute changes.
- Prevent duplicate eager and lazy controller registration.
- Add contextual eager and lazy import errors with the controller identifier and module path.
- Detect the controller importmap configuration precisely.
- Validate generator setup and controller paths before writing project files.

### Documentation

- Clarify the difference between lazy controller execution and lazy downloading.
- Document `preload: false` for deferred controller downloads.
- Document the optional root for the initial lazy-loading scan.

### Testing

- Add Playwright browser tests for the Stimulus loader.
- Run Crystal and JavaScript tests independently in CI.
