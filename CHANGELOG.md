# Changelog

All notable changes to this project will be documented in this file.

## [1.6.9] - 2026-03-16

### Fixed
- **CORS**: Simplified and strengthened CORS policy in `server.js` to resolve persistent production blocks from `sites.docanto.net`.

## [1.6.8] - 2026-03-16

### Fixed
- **API**: Resolved `ReferenceError: process is not defined` in browser environment.
- **Weather Service**: Implemented `WeatherAPI.com` fallback and increased cache TTL to 24h to mitigate production rate limits.
- **UI**: Maintained 1h weather precision as requested.

## [1.6.7] - 2026-03-16

### Fixed
- **Weather Service**: Added robust logging and a retry mechanism for Open-Meteo requests to diagnose and mitigate production connection issues.

## [1.6.6] - 2026-03-16

### Fixed
- **API**: Resolved CORS loopback error by ensuring `API_BASE_URL` is correctly prioritized during build and clinical logging added to `build.js`.

## [1.6.5] - 2026-03-16

### Changed
- **Config**: Fully migrated API URL configuration to environment variables. The frontend now strictly uses the `API_BASE_URL` defined in `.env` during the build process, facilitating decoupled hosting.

## [1.6.4] - 2026-03-16

### Changed
- **Architecture**: Separated Frontend and Backend concerns. The frontend now defaults to pointing directly to the Render-hosted API, allowing hosting the static files in different providers (like Hostinger) without path resolution issues.

## [1.6.3] - 2026-03-16

### Fixed
- **API**: Improved dynamic backend URL resolution to correctly handle subdirectory deployments (e.g., `sites.docanto.net/weathertrip/`).

## [1.6.2] - 2026-03-16

### Fixed
- **API**: Implemented dynamic backend URL resolution in frontend to support various production domains and subdirectories.
- **Weather Service**: Resolved "429 Too Many Requests" by implementing batch request support for Open-Meteo.
- **Map**: Fixed "403 Forbidden" errors on map tiles by switching from OSM volunteer servers to CartoDB Voyager.
- **UI**: Added better feedback and visual indicators for missing or unavailable weather data.

## [1.6.1] - 2026-03-09

### Fixed
- **Build System**: Downgraded `chokidar` to `v3` to fix CommonJS/ESM compatibility issue (`ERR_REQUIRE_ESM`) in `build.js`.

## [1.6.0] - 2026-03-09

### Added
- **Dependency Injection (DI)**: Refactored `RouteWeatherOrchestrator` and all services to support DI, improving testability and decoupling.
- **Professional Logging**: Integrated `winston` for structured logging (Console, File).
- **In-Memory Mocking**: Added `tests/orchestrator-di.test.js` using mocks for unit testing.

### Changed
- Refactored all services from singleton exports to class exports.
- Centralized service instantiation in `routes/api.js`.

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
