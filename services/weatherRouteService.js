const cacheRepo = require('./CacheRepository');
const geocodingService = require('./GeocodingService');
const routingService = require('./RoutingProviderService');
const weatherService = require('./WeatherService');

class RouteWeatherOrchestrator {
    constructor() {
        this.CHECKPOINT_INTERVAL = 3600; // 1 checkpoint por hora
    }

    /**
     * Fluxo principal: Geocoding -> Cache Check -> Routing -> Weather -> Response
     */
    async getRouteForecast(originText, destinationText, stopsTexts = [], dateString = '') {
        const departureDate = dateString ? new Date(dateString) : new Date();
        const departureIsoKey = departureDate.toISOString().slice(0, 13);

        // 1. Geocoding
        const points = [];
        const locationNames = [originText, ...stopsTexts.filter(s => s.trim() !== ""), destinationText];

        for (const name of locationNames) {
            const coord = await geocodingService.getCoordinates(name);
            if (!coord) throw new Error(`Localidade não encontrada: ${name}`);
            points.push({ ...coord, originalName: name });
        }

        // 2. Cache Check (Baseado em coordenadas e data)
        const cacheKey = points.map(p => `${Number(p.lat).toFixed(4)},${Number(p.lng).toFixed(4)}`).join('|');
        const cachedData = await cacheRepo.checkCache(cacheKey, departureIsoKey);
        if (cachedData) {
            console.log(`⚡ Cache hit: ${cacheKey}`);
            return cachedData;
        }

        // 3. Routing (Com fallbacks automáticos)
        const routeData = await routingService.getRouteWithFallback(points);

        // 4. Processar Checkpoints (Clima ao longo do tempo)
        const checkpoints = await this._processCheckpoints(routeData, departureDate, points);

        const finalResult = {
            routeGeo: routeData.path,
            checkpoints: checkpoints,
            provider: routeData.provider,
            distanceTotal: routeData.distance,
            durationTotal: routeData.duration
        };

        // 5. Salvar no Cache
        cacheRepo.saveToCache(cacheKey, departureIsoKey, finalResult);
        return finalResult;
    }

    async _processCheckpoints(routeData, departureTime, userPoints = []) {
        const checkpoints = [];
        let timeOffset = 0;
        const totalDuration = routeData.duration || 0;
        const totalDistance = routeData.distance || 0;
        const pathPoints = routeData.path || [];

        // Loop para gerar checkpoints a cada hora
        while (timeOffset <= totalDuration) {
            const futureDate = new Date(departureTime.getTime() + (timeOffset * 1000));
            const progress = totalDuration > 0 ? timeOffset / totalDuration : 0;
            let pathIndex = Math.floor(progress * (pathPoints.length - 1));
            pathIndex = Math.max(0, Math.min(pathIndex, pathPoints.length - 1));

            const point = pathPoints[pathIndex];
            if (!point) break;
            const [lng, lat] = point;

            const weather = await weatherService.getWeather(lat, lng, futureDate);
            const cityName = await geocodingService.getCityName(lat, lng);

            checkpoints.push({
                formattedTime: futureDate.toLocaleTimeString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                lat, lng,
                locationName: cityName,
                distanceFromStart: Math.floor((totalDistance * progress) / 1000),
                weather: weather,
                isStopNode: false
            });

            if (timeOffset >= totalDuration) break;
            timeOffset += this.CHECKPOINT_INTERVAL;
            if (timeOffset > totalDuration) timeOffset = totalDuration;
        }

        // Marcar pontos exatos do usuário (Partida, Paradas, Chegada)
        this._markUserNodes(checkpoints, userPoints);

        return checkpoints;
    }

    _markUserNodes(checkpoints, userPoints) {
        if (checkpoints.length === 0 || userPoints.length === 0) return;

        // Partida e Chegada
        checkpoints[0].locationName = userPoints[0].originalName;
        checkpoints[0].isStopNode = true;

        const lastIdx = checkpoints.length - 1;
        checkpoints[lastIdx].locationName = userPoints[userPoints.length - 1].originalName;
        checkpoints[lastIdx].isStopNode = true;

        // Paradas intermediárias
        if (userPoints.length > 2) {
            const stops = userPoints.slice(1, -1);
            for (const stop of stops) {
                let closestIdx = 0;
                let minDist = Infinity;

                for (let i = 1; i < checkpoints.length - 1; i++) {
                    const c = checkpoints[i];
                    const dist = Math.pow(c.lat - stop.lat, 2) + Math.pow(c.lng - stop.lng, 2);
                    if (dist < minDist) {
                        minDist = dist;
                        closestIdx = i;
                    }
                }

                if (closestIdx > 0 && closestIdx < checkpoints.length - 1) {
                    checkpoints[closestIdx].locationName = stop.originalName;
                    checkpoints[closestIdx].isStopNode = true;
                }
            }
        }
    }

    async searchAddress(query) {
        return await geocodingService.searchAddress(query);
    }
}

module.exports = new RouteWeatherOrchestrator();
