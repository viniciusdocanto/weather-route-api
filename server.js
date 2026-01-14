const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO DO BANCO DE DADOS (SQLite) ---
const db = new sqlite3.Database('./weather_trip.db', (err) => {
    if (err) console.error("Erro ao criar banco:", err.message);
    else console.log("💾 Banco de dados conectado (SQLite).");
});

// Cria a tabela se não existir
db.run(`CREATE TABLE IF NOT EXISTS route_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin_text TEXT,
    dest_text TEXT,
    data TEXT,
    created_at INTEGER
)`);

// --- CLASSE DE SERVIÇO ---
class RouteWeatherService {
    constructor() {
        this.CHECKPOINT_INTERVAL = 3600;
        this.CACHE_TTL = 3600 * 1000; // 1 Hora em milissegundos
    }

    // --- ORQUESTRADOR PRINCIPAL ---
    async getRouteForecast(originText, destinationText) {
        // 1. Normaliza o texto (tudo minúsculo para evitar duplicidade "SP" vs "sp")
        const normOrigin = originText.trim().toLowerCase();
        const normDest = destinationText.trim().toLowerCase();

        // 2. VERIFICA O CACHE (BANCO DE DADOS)
        const cachedData = await this._checkCache(normOrigin, normDest);
        if (cachedData) {
            console.log(`⚡ Usando dados do CACHE para: ${originText} -> ${destinationText}`);
            return cachedData;
        }

        console.log(`🌍 Consultando APIs Externas para: ${originText} -> ${destinationText}`);

        // 3. Se não tem no cache, faz todo o processo pesado...
        const origin = await this._getCoordinates(originText);
        const destination = await this._getCoordinates(destinationText);

        if (!origin || !destination) throw new Error("Cidades não encontradas.");

        const routeData = await this._getOSRMRoute(origin, destination);
        const result = await this._processCheckpoints(routeData, new Date());

        // 4. SALVA NO BANCO PARA A PRÓXIMA VEZ
        this._saveToCache(normOrigin, normDest, result);

        return result;
    }

    // --- MÉTODOS DE BANCO DE DADOS (Promisified) ---
    _checkCache(origin, dest) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM route_cache WHERE origin_text = ? AND dest_text = ? ORDER BY created_at DESC LIMIT 1`;
            db.get(query, [origin, dest], (err, row) => {
                if (err) return reject(err);

                if (row) {
                    const agora = Date.now();
                    // Verifica se o cache ainda é válido (menos de 1 hora)
                    if (agora - row.created_at < this.CACHE_TTL) {
                        return resolve(JSON.parse(row.data)); // Retorna o JSON pronto
                    } else {
                        console.log("Old cache encontrado, mas expirado. Buscando novo...");
                    }
                }
                resolve(null); // Nada no cache ou expirado
            });
        });
    }

    _saveToCache(origin, dest, data) {
        const query = `INSERT INTO route_cache (origin_text, dest_text, data, created_at) VALUES (?, ?, ?, ?)`;
        const jsonStr = JSON.stringify(data);
        const now = Date.now();

        db.run(query, [origin, dest, jsonStr, now], function (err) {
            if (err) console.error("Erro ao salvar cache:", err.message);
            else console.log("💾 Rota salva no banco de dados!");
        });
    }

    // --- APIs EXTERNAS (Mesma lógica anterior) ---
    async _getCoordinates(query) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'WeatherTripApp/1.0' } });
            return res.data[0] ? { lat: res.data[0].lat, lng: res.data[0].lon } : null;
        } catch (e) { return null; }
    }

    async _getOSRMRoute(start, end) {
        const url = `http://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
        const res = await axios.get(url);
        return {
            duration: res.data.routes[0].duration,
            distance: res.data.routes[0].distance,
            path: res.data.routes[0].geometry.coordinates
        };
    }

    async _getCityName(lat, lng) {
        try {
            // Pequeno delay para respeitar o Nominatim
            await new Promise(r => setTimeout(r, 800));
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'WeatherTripApp/1.0' } });
            const addr = res.data.address;
            return addr.city || addr.town || addr.village || addr.municipality || addr.state || "Estrada";
        } catch (error) { return "Local desconhecido"; }
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
        const pathPoints = routeData.path;

        while (timeOffset <= totalDuration) {
            const futureDate = new Date(departureTime.getTime() + (timeOffset * 1000));
            const progress = timeOffset / totalDuration;
            const pathIndex = Math.floor(progress * (pathPoints.length - 1));
            const rawCoords = pathPoints[pathIndex];
            const lat = rawCoords[1];
            const lng = rawCoords[0];

            const weather = await this._getWeather(lat, lng, futureDate);
            const cityName = await this._getCityName(lat, lng);

            checkpoints.push({
                formattedTime: futureDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                lat: lat,
                lng: lng,
                locationName: cityName,
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
            0: "Céu Limpo ☀️", 1: "Ensolarado 🌤️", 2: "Parcialmente Nublado ⛅", 3: "Nublado ☁️",
            45: "Nevoeiro 🌫️", 51: "Garoa 🌧️", 61: "Chuva Fraca ☔", 63: "Chuva ☔",
            65: "Chuva Forte ⛈️", 80: "Pancadas 🌦️", 95: "Tempestade ⚡"
        };
        return table[code] || "Desconhecido";
    }
}

const service = new RouteWeatherService();

app.post('/api/forecast', async (req, res) => {
    try {
        // Envia para o serviço (que agora decide se pega do cache ou da web)
        const data = await service.getRouteForecast(req.body.origin, req.body.destination);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Erro: " + error.message });
    }
});

app.listen(3000, () => {
    console.log('🚀 Servidor rodando com Banco de Dados SQLite');
});