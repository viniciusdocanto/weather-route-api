const axios = require('axios');

class RoutingProviderService {
    constructor() {
        this.GRAPHHOPPER_KEY = process.env.GRAPHHOPPER_KEY;
        this.MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
    }

    async getRouteWithFallback(points) {
        try {
            console.log("🔄 Tentando OSRM...");
            return await this._getOSRMRoute(points);
        } catch (e) {
            console.warn("⚠️ OSRM falhou. Tentando GraphHopper...");
        }

        try {
            if (!this.GRAPHHOPPER_KEY) throw new Error("Chave GraphHopper ausente");
            return await this._getGraphHopperRoute(points);
        } catch (e) {
            console.warn(`⚠️ GraphHopper falhou (${e.message}). Tentando Mapbox...`);
        }

        try {
            if (!this.MAPBOX_TOKEN) throw new Error("Token Mapbox ausente");
            return await this._getMapboxRoute(points);
        } catch (e) {
            console.error("❌ Todos os provedores de rota falharam.");
            throw new Error("Serviços de mapas indisponíveis. Tente novamente mais tarde.");
        }
    }

    async _getOSRMRoute(points) {
        const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
        const res = await axios.get(url, { timeout: 8000 });
        if (!res.data.routes[0]) throw new Error("Rota não encontrada");
        return {
            duration: res.data.routes[0].duration,
            distance: res.data.routes[0].distance,
            path: res.data.routes[0].geometry.coordinates,
            provider: 'OSRM'
        };
    }

    async _getGraphHopperRoute(points) {
        const query = points.map(p => `point=${p.lat},${p.lng}`).join('&');
        const url = `https://graphhopper.com/api/1/route?${query}&profile=car&locale=pt&points_encoded=false&key=${this.GRAPHHOPPER_KEY}`;
        const res = await axios.get(url, { timeout: 8000 });
        const route = res.data.paths[0];
        return {
            duration: route.time / 1000,
            distance: route.distance,
            path: route.points.coordinates,
            provider: 'GraphHopper'
        };
    }

    async _getMapboxRoute(points) {
        const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${this.MAPBOX_TOKEN}`;
        const res = await axios.get(url, { timeout: 8000 });
        const route = res.data.routes[0];
        return {
            duration: route.duration,
            distance: route.distance,
            path: route.geometry.coordinates,
            provider: 'Mapbox'
        };
    }
}

module.exports = new RoutingProviderService();
