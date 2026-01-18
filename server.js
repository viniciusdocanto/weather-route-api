const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const app = express();

app.use(cors());
app.use(express.json());

// --- 1. CONFIGURAÇÃO DO BANCO DE DADOS (CACHE) ---
const db = new sqlite3.Database('./weather_trip.db', (err) => {
    if (err) console.error("Erro DB:", err.message);
    else console.log("💾 Banco conectado localmente.");
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
        this.CHECKPOINT_INTERVAL = 3600; // 1 hora entre pontos
        this.CACHE_TTL = 3600 * 1000;    // 1 hora de validade do cache
        
        // --- ADICIONE SUAS CHAVES AQUI ---
        this.GRAPHHOPPER_KEY = 'SUA_CHAVE_GRAPHHOPPER_AQUI'; 
        this.MAPBOX_TOKEN = 'SEU_TOKEN_MAPBOX_AQUI';
    }

    async getRouteForecast(originText, destinationText, dateString) {
        const normOrigin = originText.trim().toLowerCase();
        const normDest = destinationText.trim().toLowerCase();
        const departureDate = dateString ? new Date(dateString) : new Date();
        const departureIsoKey = departureDate.toISOString().slice(0, 13);

        // 1. Verificar Cache
        const cachedData = await this._checkCache(normOrigin, normDest, departureIsoKey);
        if (cachedData) {
            console.log(`⚡ Cache hit: ${originText} -> ${destinationText}`);
            return cachedData;
        }

        // 2. Obter Coordenadas (Geocoding)
        const origin = await this._getCoordinates(originText);
        const destination = await this._getCoordinates(destinationText);

        if (!origin || !destination) throw new Error("Cidades não encontradas.");

        // 3. Obter Rota com Sistema de Cascata (Failover)
        const routeData = await this._getRouteWithFallback(origin, destination);

        // 4. Processar Clima nos Checkpoints
        const checkpoints = await this._processCheckpoints(routeData, departureDate);

        const finalResult = {
            routeGeo: routeData.path,
            checkpoints: checkpoints,
            provider: routeData.provider,
            distanceTotal: routeData.distance,
            durationTotal: routeData.duration
        };

        // 5. Salvar em Cache
        this._saveToCache(normOrigin, normDest, departureIsoKey, finalResult);
        return finalResult;
    }

    // --- LÓGICA DE FALLBACK (CASCATA) ---
    async _getRouteWithFallback(start, end) {
        // Tentativa 1: OSRM (Demo gratuito)
        try {
            console.log("🔄 Tentando OSRM...");
            return await this._getOSRMRoute(start, end);
        } catch (e) {
            console.warn("⚠️ OSRM falhou ou está offline. Tentando GraphHopper...");
        }

        // Tentativa 2: GraphHopper
        try {
            if (!this.GRAPHHOPPER_KEY || this.GRAPHHOPPER_KEY.includes('AQUI')) throw new Error("Key ausente");
            return await this._getGraphHopperRoute(start, end);
        } catch (e) {
            console.warn("⚠️ GraphHopper falhou. Tentando Mapbox...");
        }

        // Tentativa 3: Mapbox
        try {
            if (!this.MAPBOX_TOKEN || this.MAPBOX_TOKEN.includes('AQUI')) throw new Error("Token ausente");
            return await this._getMapboxRoute(start, end);
        } catch (e) {
            console.error("❌ Todos os provedores de rota falharam.");
            throw new Error("Serviços de mapas indisponíveis no momento.");
        }
    }

    // --- PROVEDORES DE ROTA ---

    async _getOSRMRoute(start, end) {
        const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
        const res = await axios.get(url, { timeout: 8000 });
        if (!res.data.routes[0]) throw new Error("Rota não encontrada no OSRM");
        return {
            duration: res.data.routes[0].duration,
            distance: res.data.routes[0].distance,
            path: res.data.routes[0].geometry.coordinates,
            provider: 'OSRM'
        };
    }

    async _getGraphHopperRoute(start, end) {
        const url = `https://graphhopper.com/api/1/route?point=${start.lat},${start.lng}&point=${end.lat},${end.lng}&profile=car&locale=pt&points_encoded=false&key=${this.GRAPHHOPPER_KEY}`;
        const res = await axios.get(url, { timeout: 8000 });
        const route = res.data.paths[0];
        return {
            duration: route.time / 1000,
            distance: route.distance,
            path: route.points.coordinates,
            provider: 'GraphHopper'
        };
    }

    async _getMapboxRoute(start, end) {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start.lng},${start.lat};${end.lng},${end.lat}?geometries=geojson&overview=full&access_token=${this.MAPBOX_TOKEN}`;
        const res = await axios.get(url, { timeout: 8000 });
        const route = res.data.routes[0];
        return {
            duration: route.duration,
            distance: route.distance,
            path: route.geometry.coordinates,
            provider: 'Mapbox'
        };
    }

    // --- UTILITÁRIOS E CLIMA ---

    async _getCoordinates(query) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'WeatherTripApp/1.0' } });
            return res.data[0] ? { lat: res.data[0].lat, lng: res.data[0].lon } : null;
        } catch (e) { return null; }
    }

    async _getCityName(lat, lng) {
        try {
            // Delay para respeitar rate limit do Nominatim gratuito
            await new Promise(r => setTimeout(r, 600));
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'WeatherTripApp/1.0' } });
            const addr = res.data.address;
            const city = addr.city || addr.town || addr.village || addr.municipality || "Estrada";
            const uf = BRAZIL_STATES[addr.state] || addr.state || "";
            return uf ? `${city}, ${uf}` : city;
        } catch (error) { return "Trajeto"; }
    }

    async _getWeather(lat, lng, date) {
        const isoDate = date.toISOString().split('T')[0];
        const hour = date.getHours();
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weathercode&start_date=${isoDate}&end_date=${isoDate}&timezone=auto`;
        try {
            const res = await axios.get(url);
            const data = res.data.hourly;
            return {
                temp: data.temperature_2m[hour],
                code: data.weathercode[hour]
            };
        } catch (e) { return { temp: "--", code: 0 }; }
    }

    async _processCheckpoints(routeData, departureTime) {
        // BLINDAGEM 1: Verifica se path existe e é um array
        if (!routeData || !routeData.path || !Array.isArray(routeData.path) || routeData.path.length === 0) {
            console.error("❌ Erro: O provedor de rota não retornou coordenadas (path vazio).");
            // Retorna um checkpoint único de "Origem" para não quebrar o app
            return [{
                formattedTime: departureTime.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
                locationName: "Local de Partida",
                distanceFromStart: 0,
                weather: { temp: "--", condition: "Dados indisponíveis" }
            }];
        }

        const checkpoints = [];
        let timeOffset = 0;
        const totalDuration = routeData.duration || 0; // Garante que não é undefined
        const totalDistance = routeData.distance || 0;
        const pathPoints = routeData.path;

        while (timeOffset <= totalDuration) {
            const futureDate = new Date(departureTime.getTime() + (timeOffset * 1000));
            
            // Evita divisão por zero se a duração for 0
            const progress = totalDuration > 0 ? timeOffset / totalDuration : 0;
            
            // BLINDAGEM 2: Garante que o índice existe no array
            let pathIndex = Math.floor(progress * (pathPoints.length - 1));
            if (pathIndex < 0) pathIndex = 0;
            if (pathIndex >= pathPoints.length) pathIndex = pathPoints.length - 1;

            // BLINDAGEM 3: Verifica se o ponto específico existe antes de desestruturar
            const point = pathPoints[pathIndex];
            if (!point) {
                console.warn(`⚠️ Ponto inválido no índice ${pathIndex}`);
                break; // Sai do loop para não quebrar
            }

            const [lng, lat] = point; // Agora é seguro fazer isso

            // Busca clima e nome da cidade (com try/catch interno para não parar tudo)
            let weather = { temp: "--", code: 0 };
            let cityName = "Estrada";
            
            try {
                weather = await this._getWeather(lat, lng, futureDate);
                cityName = await this._getCityName(lat, lng);
            } catch (err) {
                console.warn("Falha leve ao obter clima/nome:", err.message);
            }

            checkpoints.push({
                formattedTime: futureDate.toLocaleTimeString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                lat, lng,
                locationName: cityName,
                distanceFromStart: Math.floor((totalDistance * progress) / 1000),
                weather: {
                    temp: weather.temp,
                    condition: this._translateWMO(weather.code)
                }
            });

            if (timeOffset >= totalDuration) break;
            
            // Se o intervalo for maior que a duração total, ajusta para terminar o loop
            timeOffset += this.CHECKPOINT_INTERVAL;
            if (timeOffset > totalDuration && timeOffset - this.CHECKPOINT_INTERVAL < totalDuration) {
                timeOffset = totalDuration;
            }
        }
        return checkpoints;
    }

    _translateWMO(code) {
        const table = {
            0: "Céu Limpo ☀️", 1: "Predom. Limpo 🌤️", 2: "Parcial. Nublado ⛅", 3: "Encoberto ☁️",
            45: "Nevoeiro 🌫️", 48: "Nevoeiro c/ Geada 🌫️", 51: "Garoa Leve 🌧️", 53: "Garoa Moderada 🌧️",
            55: "Garoa Densa 🌧️", 61: "Chuva Fraca ☔", 63: "Chuva Moderada ☔", 65: "Chuva Forte ⛈️",
            80: "Pancadas de Chuva 🌦️", 81: "Pancadas Fortes ⛈️", 95: "Tempestade ⚡", 96: "Tempestade c/ Granizo ❄️⚡"
        };
        return table[code] || `Clima (${code})`;
    }

    // --- CACHE ---
    _checkCache(origin, dest, dateKey) {
        return new Promise((resolve) => {
            db.get(`SELECT data FROM route_cache WHERE origin_text = ? AND dest_text = ? AND trip_date = ?`, 
            [origin, dest, dateKey], (err, row) => {
                if (!err && row) return resolve(JSON.parse(row.data));
                resolve(null);
            });
        });
    }

    _saveToCache(origin, dest, dateKey, data) {
        db.run(`INSERT INTO route_cache (origin_text, dest_text, trip_date, data, created_at) VALUES (?, ?, ?, ?, ?)`,
        [origin, dest, dateKey, JSON.stringify(data), Date.now()]);
    }
}

// --- ROTAS API ---
const service = new RouteWeatherService();

app.post('/api/forecast', async (req, res) => {
    try {
        const { origin, destination, date } = req.body;
        if (!origin || !destination) return res.status(400).json({ error: "Origem e destino são obrigatórios." });
        
        const data = await service.getRouteForecast(origin, destination, date);
        res.json(data);
    } catch (error) {
        console.error("ERRO CRÍTICO:", error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend rodando na porta ${PORT}`));
