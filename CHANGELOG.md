# Changelog

All notable changes to this project will be documented in this file.

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
