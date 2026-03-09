# Changelog

All notable changes to this project will be documented in this file.

## [1.5.0] - 2026-03-09

### Added
- **Modular Architecture**: Refactored `WeatherRouteService` into specialized services: `CacheRepository`, `GeocodingService`, `WeatherService`, and `RoutingProviderService`.
- **Unit Testing**: Introduced a basic test suite using Node.js native test runner in `tests/test-core.js`.
- **Frontend UI Components**: Created `renderCheckpoint` helper in `ui.js` to modularize result rendering and clean up `script.js`.
- **Routing Fallbacks**: Improved resilience with multiple routing providers (OSRM, GraphHopper, Mapbox).

### Changed
- Improved `README.md` with new architectural details and testing instructions.
- Centralized rate limiting in `server.js` for better global protection.

## [1.4.0] - 2026-03-05

### Added
- Automated cache busting by injecting `package.json` version into `index.html`.
- Improved watch mode using `chokidar` for better stability on Windows.
- Global rate limiting middleware.
- SQLite persistence warning in `README.md`.
