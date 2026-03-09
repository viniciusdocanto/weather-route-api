const axios = require('axios');

const BRAZIL_STATES = {
    "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM", "Bahia": "BA", "Ceará": "CE",
    "Distrito Federal": "DF", "Espírito Santo": "ES", "Goiás": "GO", "Maranhão": "MA", "Mato Grosso": "MT",
    "Mato Grosso do Sul": "MS", "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR",
    "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN",
    "Rio Grande do Sul": "RS", "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC",
    "São Paulo": "SP", "Sergipe": "SE", "Tocantins": "TO"
};

class GeocodingService {
    constructor() {
        this.MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
    }

    async getCoordinates(query) {
        try {
            console.log(`🔎 Buscando coordenadas para: "${query}"`);
            const cleanQuery = query.replace(/ - /g, ', ');

            if (this.MAPBOX_TOKEN) {
                try {
                    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cleanQuery)}.json?country=br&limit=1&access_token=${this.MAPBOX_TOKEN}`;
                    const res = await axios.get(url, { headers: { 'User-Agent': 'WeatherTripApp/1.0' }, timeout: 5000 });

                    if (res.data && res.data.features && res.data.features.length > 0) {
                        const feature = res.data.features[0];
                        console.log(`✅ Mapbox encontrou: ${feature.place_name.slice(0, 30)}...`);
                        return { lat: feature.center[1], lng: feature.center[0] };
                    }
                } catch (e) {
                    console.warn(`⚠️ Mapbox falhou (${e.message}). Tentando Nominatim como fallback...`);
                }
            }

            console.log(`🔄 Tentando Nominatim para: "${cleanQuery}"`);
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=1&countrycodes=br`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'WeatherTripApp/1.0' }, timeout: 5000 });

            if (res.data && res.data[0]) {
                console.log(`✅ Nominatim encontrou: ${res.data[0].display_name.slice(0, 30)}...`);
                return { lat: parseFloat(res.data[0].lat), lng: parseFloat(res.data[0].lon) };
            }
            return null;
        } catch (e) {
            console.error(`🔥 Erro ao buscar coordenadas: ${e.message}`);
            return null;
        }
    }

    async getCityName(lat, lng) {
        if (this.MAPBOX_TOKEN) {
            try {
                const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?limit=1&types=place,locality&access_token=${this.MAPBOX_TOKEN}`;
                const res = await axios.get(url, { headers: { 'User-Agent': 'WeatherTripApp/1.0' }, timeout: 5000 });

                if (res.data && res.data.features && res.data.features.length > 0) {
                    const feature = res.data.features[0];
                    const addrCtx = feature.context || [];
                    const isPlace = feature.id.startsWith('place');
                    const city = isPlace ? feature.text : (addrCtx.find(c => c.id.startsWith('place'))?.text || feature.text);
                    const stateCtx = addrCtx.find(c => c.id.startsWith('region'));

                    let uf = "";
                    if (stateCtx) {
                        uf = BRAZIL_STATES[stateCtx.text] || stateCtx.short_code?.replace('BR-', '')?.toUpperCase() || stateCtx.text;
                    }
                    return uf ? `${city}, ${uf}` : city;
                }
            } catch (error) {
                console.warn(`⚠️ Mapbox reverse falhou (${error.message}). Tentando Nominatim fallback...`);
            }
        }

        try {
            await new Promise(r => setTimeout(r, 600)); // Respeitar rate limit do Nominatim
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'WeatherTripApp/1.0' }, timeout: 5000 });
            const addr = res.data.address;
            const city = addr.city || addr.town || addr.village || addr.municipality || "Estrada";
            const uf = BRAZIL_STATES[addr.state] || addr.state || "";
            return uf ? `${city}, ${uf}` : city;
        } catch (error) {
            return "Estrada";
        }
    }

    async searchAddress(query) {
        if (this.MAPBOX_TOKEN) {
            try {
                const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=br&limit=5&types=place,locality,neighborhood,address&access_token=${this.MAPBOX_TOKEN}`;
                const res = await axios.get(url, { timeout: 5000 });

                if (res.data && res.data.features && res.data.features.length > 0) {
                    return res.data.features.map(f => {
                        const cityCtx = f.context?.find(c => c.id.startsWith('place'));
                        const stateCtx = f.context?.find(c => c.id.startsWith('region'));
                        let stateName = stateCtx ? stateCtx.text : '';
                        if (BRAZIL_STATES[stateName]) {
                            stateName = BRAZIL_STATES[stateName];
                        } else if (stateCtx && stateCtx.short_code) {
                            stateName = stateCtx.short_code.replace('BR-', '').toUpperCase();
                        }
                        return {
                            display_name: f.place_name,
                            address: { city: cityCtx ? cityCtx.text : f.text, state: stateName },
                            lat: f.center[1], lon: f.center[0]
                        };
                    });
                }
            } catch (e) {
                console.warn(`⚠️ Mapbox Search falhou (${e.message}). Tentando Nominatim...`);
            }
        }

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=br`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'WeatherTripApp/1.0' }, timeout: 5000 });
            return res.data || [];
        } catch (e) {
            console.error(`🔥 Erro final no Search: ${e.message}`);
            return [];
        }
    }
}

module.exports = new GeocodingService();
