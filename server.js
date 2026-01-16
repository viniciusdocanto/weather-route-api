const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(cors());
app.use(express.json());

// --- 1. BANCO DE DADOS ---
const db = new sqlite3.Database('./weather_trip.db', (err) => {
    if (err) console.error("Erro DB:", err.message);
    else console.log("💾 Banco conectado.");
});

db.run(`CREATE TABLE IF NOT EXISTS route_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin_text TEXT,
    dest_text TEXT,
    trip_date TEXT, 
    data TEXT,
    created_at INTEGER
)`);

const BRAZIL_STATES = {
    "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM", "Bahia": "BA", "Ceará": "CE",
    "Distrito Federal": "DF", "Espírito Santo": "ES", "Goiás": "GO", "Maranhão": "MA", "Mato Grosso": "MT",
    "Mato Grosso do Sul": "MS", "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR",
    "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN",
    "Rio Grande do Sul": "RS", "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC",
    "São Paulo": "SP", "Sergipe": "SE", "Tocantins": "TO"
};

class RouteWeatherService {
    constructor() {
        this.CHECKPOINT_INTERVAL = 3600;
        this.CACHE_TTL = 3600 * 1000;
    }

    async getRouteForecast(originText, destinationText, dateString) {
        const normOrigin = originText.trim().toLowerCase();
        const normDest = destinationText.trim().toLowerCase();
        const departureDate = dateString ? new Date(dateString) : new Date();
        const departureIsoKey = departureDate.toISOString().slice(0, 13);

        // Checa Cache
        const cachedData = await this._checkCache(normOrigin, normDest, departureIsoKey);
        if (cachedData) {
            console.log(`⚡ Cache hit: ${originText} -> ${destinationText}`);
            return cachedData;
        }

        console.log(`🌍 Nova busca: ${originText} -> ${destinationText}`);

        const origin = await this._getCoordinates(originText);
        const destination = await this._getCoordinates(destinationText);

        if (!origin || !destination) throw new Error("Cidades não encontradas no Brasil.");

        const routeData = await this._getOSRMRoute(origin, destination);
        const checkpoints = await this._processCheckpoints(routeData, departureDate);

        // --- MUDANÇA: Retornamos um Objeto com a Rota Completa e os Checkpoints
        const finalResult = {
            routeGeo: routeData.path, // Array completo de coordenadas para desenhar o mapa
            checkpoints: checkpoints  // Dados do clima
        };

        this._saveToCache(normOrigin, normDest, departureIsoKey, finalResult);
        return finalResult;
    }

    _checkCache(origin, dest, dateKey) {
        return new Promise((resolve) => {
            const query = `SELECT * FROM route_cache WHERE origin_text = ? AND dest_text = ? AND trip_date = ? ORDER BY created_at DESC LIMIT 1`;
            db.get(query, [origin, dest, dateKey], (err, row) => {
                if (!err && row && (Date.now() - row.created_at < this.CACHE_TTL)) {
                    return resolve(JSON.parse(row.data));
                }
                resolve(null);
            });
        });
    }

    _saveToCache(origin, dest, dateKey, data) {
        const query = `INSERT INTO route_cache (origin_text, dest_text, trip_date, data, created_at) VALUES (?, ?, ?, ?, ?)`;
        db.run(query, [origin, dest, dateKey, JSON.stringify(data), Date.now()]);
    }

    async _getCoordinates(query) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'WeatherTripApp/1.0' } });
            return res.data[0] ? { lat: res.data[0].lat, lng: res.data[0].lon } : null;
        } catch (e) { return null; }
    }

    async _getOSRMRoute(start, end) {
        const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
        const res = await axios.get(url);
        if (!res.data.routes || !res.data.routes[0]) throw new Error("Rota não encontrada");
        return {
            duration: res.data.routes[0].duration,
            distance: res.data.routes[0].distance,
            path: res.data.routes[0].geometry.coordinates // GeoJSON [lng, lat]
        };
    }

    async _getCityName(lat, lng) {
        try {
            await new Promise(r => setTimeout(r, 800));
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'WeatherTripApp/1.0' } });
            const addr = res.data.address;
            const city = addr.city || addr.town || addr.village || addr.municipality || "Local";
            const fullState = addr.state;
            const uf = BRAZIL_STATES[fullState] || fullState || "";
            return uf ? `${city}, ${uf}` : city;
        } catch (error) { return "Estrada"; }
    }

    async _getWeather(lat, lng, date) {
        const isoDate = date.toISOString().split('T')[0];
        const hour = date.getHours();
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weathercode&start_date=${isoDate}&end_date=${isoDate}&timezone=auto`;
        try {
            const res = await axios.get(url);
            const data = res.data.hourly;
            return {
                temp: data.temperature_2m[hour] || data.temperature_2m[0],
                code: data.weathercode[hour] || 0
            };
        } catch (e) { return { temp: "--", code: 0 }; }
    }

    async _processCheckpoints(routeData, departureTime) {
        const checkpoints = [];
        let timeOffset = 0;
        const totalDuration = routeData.duration;
        const totalDistance = routeData.distance;
        const pathPoints = routeData.path;

        while (timeOffset <= totalDuration) {
            const futureDate = new Date(departureTime.getTime() + (timeOffset * 1000));
            const progress = timeOffset / totalDuration;
            const currentDistKm = Math.floor((totalDistance * progress) / 1000);

            const pathIndex = Math.floor(progress * (pathPoints.length - 1));
            const rawCoords = pathPoints[pathIndex];
            const lat = rawCoords[1];
            const lng = rawCoords[0];

            const weather = await this._getWeather(lat, lng, futureDate);
            const cityName = await this._getCityName(lat, lng);

            checkpoints.push({
                formattedTime: futureDate.toLocaleTimeString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                lat: lat,
                lng: lng,
                locationName: cityName,
                distanceFromStart: currentDistKm,
                weather: {
                    temp: weather.temp,
                    condition: this._translateWMO(weather.code)
                }
            });

            if (timeOffset >= totalDuration) break;
            timeOffset += this.CHECKPOINT_INTERVAL;
            if (timeOffset > totalDuration) timeOffset = totalDuration;
        }
        return checkpoints;
    }

    _translateWMO(code) {
        const table = {
            0: "Céu Limpo ☀️", 1: "Predom. Limpo 🌤️", 2: "Parcial. Nublado ⛅", 3: "Encoberto ☁️",
            45: "Nevoeiro 🌫️", 48: "Nevoeiro c/ Geada 🌫️", 51: "Garoa Leve 🌧️", 53: "Garoa Moderada 🌧️",
            55: "Garoa Densa 🌧️", 61: "Chuva Fraca ☔", 63: "Chuva Moderada ☔", 65: "Chuva Forte ⛈️",
            80: "Pancadas de Chuva 🌦️", 81: "Pancadas Fortes ⛈️", 95: "Tempestade Trovões ⚡", 96: "Tempestade c/ Granizo ❄️⚡"
        };
        return table[code] || `Clima (${code})`;
    }
}

const service = new RouteWeatherService();

app.post('/api/forecast', async (req, res) => {
    try {
        const { origin, destination, date } = req.body;
        if (!origin || !destination) return res.status(400).json({ error: "Dados faltando" });
        const data = await service.getRouteForecast(origin, destination, date);
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro interno: " + error.message });
    }
});

app.listen(3000, () => console.log('🚀 Servidor rodando.'));
