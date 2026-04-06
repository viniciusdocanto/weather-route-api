const axios = require('axios');
const logger = require('../config/logger');

class RoutingProviderService {
    constructor() {
        this.GRAPHHOPPER_KEY = process.env.GRAPHHOPPER_KEY;
        this.MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
    }

    async getRouteWithFallback(points, alternatives = false) {
        try {
            logger.info("Tentando OSRM...");
            return await this._getOSRMRoute(points, alternatives);
        } catch (e) {
            logger.warn("OSRM falhou, tentando GraphHopper", { error: e.message });
        }

        try {
            if (!this.GRAPHHOPPER_KEY) throw new Error("Chave GraphHopper ausente");
            return await this._getGraphHopperRoute(points, alternatives);
        } catch (e) {
            logger.warn("GraphHopper falhou, tentando Mapbox", { error: e.message });
        }

        try {
            if (!this.MAPBOX_TOKEN) throw new Error("Token Mapbox ausente");
            return await this._getMapboxRoute(points, alternatives);
        } catch (e) {
            logger.error("Todos os provedores de rota falharam", { error: e.message });
            throw new Error("Serviços de mapas indisponíveis. Tente novamente mais tarde.");
        }
    }

    async _getOSRMRoute(points, alternatives = false) {
        const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
        const altParam = alternatives ? '&alternatives=true' : '';
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson${altParam}`;
        const res = await axios.get(url, { timeout: 8000 });
        
        if (!res.data.routes || res.data.routes.length === 0) throw new Error("Rota não encontrada");

        return res.data.routes.map((route, index) => ({
            id: `route-${index}`,
            name: index === 0 ? "Rota Principal" : `Alternativa ${index}`,
            duration: route.duration,
            distance: route.distance,
            path: route.geometry.coordinates,
            provider: 'OSRM'
        }));
    }

    async _getGraphHopperRoute(points, alternatives = false) {
        // GraphHopper alternatives require ch.disable=true which affects performance. 
        // For now, we return only the main route for GH unless specifically needed.
        const query = points.map(p => `point=${p.lat},${p.lng}`).join('&');
        const url = `https://graphhopper.com/api/1/route?${query}&profile=car&locale=pt&points_encoded=false&key=${this.GRAPHHOPPER_KEY}`;
        const res = await axios.get(url, { timeout: 8000 });
        const route = res.data.paths[0];
        
        return [{
            id: 'route-0',
            name: "Rota Principal",
            duration: route.time / 1000,
            distance: route.distance,
            path: route.points.coordinates,
            provider: 'GraphHopper'
        }];
    }

    async _getMapboxRoute(points, alternatives = false) {
        const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
        const altParam = alternatives ? '&alternatives=true' : '';
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full${altParam}&access_token=${this.MAPBOX_TOKEN}`;
        const res = await axios.get(url, { timeout: 8000 });
        
        if (!res.data.routes || res.data.routes.length === 0) throw new Error("Rota não encontrada");

        return res.data.routes.map((route, index) => ({
            id: `route-${index}`,
            name: index === 0 ? "Rota Principal" : `Alternativa ${index}`,
            duration: route.duration,
            distance: route.distance,
            path: route.geometry.coordinates,
            provider: 'Mapbox'
        }));
    }
}

module.exports = RoutingProviderService;
