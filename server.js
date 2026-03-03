const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs'); // Necessário para verificar o arquivo de segredos
const path = require('path');


// --- 1. CONFIGURAÇÃO DE VARIÁVEIS DE AMBIENTE ---
// Tenta carregar do caminho de segredos do Render (Produção)
if (fs.existsSync('/etc/secrets/.env')) {
    require('dotenv').config({ path: '/etc/secrets/.env' });
    console.log("🔒 Carregando variáveis de /etc/secrets/.env");
} else {
    // Caso contrário, carrega do arquivo local .env (Desenvolvimento)
    require('dotenv').config();
    console.log("💻 Carregando variáveis locais");
}

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// --- 1.5. CONFIGURAÇÃO DE RATE LIMIT (SEGURANÇA) ---
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 15, // Limite de 15 requisições por IP por janela
    message: { error: "Muitas requisições vindas deste IP. Tente novamente em 15 minutos." },
    standardHeaders: true, // Retorna info de limite no header `RateLimit-*`
    legacyHeaders: false, // Desativa os headers `X-RateLimit-*`
});

// --- 2. BANCO DE DADOS ---
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
        this.CHECKPOINT_INTERVAL = 3600;
        this.CACHE_TTL = 3600 * 1000;

        // --- CHAVES PUXADAS DO ENV ---
        this.GRAPHHOPPER_KEY = process.env.GRAPHHOPPER_KEY;
        this.MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

        // Log de segurança (mostra apenas se as chaves existem, sem revelar o valor)
        console.log("🔑 Status das Chaves:");
        console.log(`- GraphHopper: ${this.GRAPHHOPPER_KEY ? 'Carregada ✅' : 'Ausente ❌'}`);
        console.log(`- Mapbox: ${this.MAPBOX_TOKEN ? 'Carregada ✅' : 'Ausente ❌'}`);
    }

    async getRouteForecast(originText, destinationText, stopsTexts = [], dateString = '') {
        const normOrigin = originText.trim().toLowerCase();
        const normDest = destinationText.trim().toLowerCase();
        const normStops = stopsTexts.map(s => s.trim().toLowerCase()).filter(s => s !== "");

        const departureDate = dateString ? new Date(dateString) : new Date();
        const departureIsoKey = departureDate.toISOString().slice(0, 13);

        // Resolve coordinates for all points first, so we can save them in cache and use in checkpoints
        const points = [];
        const originalNames = [originText, ...stopsTexts.filter(s => s.trim() !== ""), destinationText];

        for (const name of originalNames) {
            const coord = await this._getCoordinates(name);
            if (!coord) throw new Error(`Localidade não encontrada: ${name}`);
            points.push({ ...coord, originalName: name });
        }

        // NOVO: Usar as coordenadas (truncadas para 4 casas decimais) como chave de cache
        // Evita que "São Paulo" e "Sao Paulo" gerem requisições duplicadas de rotas
        const cacheKey = points.map(p => `${Number(p.lat).toFixed(4)},${Number(p.lng).toFixed(4)}`).join('|');
        const cachedData = await this._checkCache(cacheKey, departureIsoKey);
        if (cachedData) {
            console.log(`⚡ Cache hit: ${cacheKey}`);
            return cachedData;
        }

        const routeData = await this._getRouteWithFallback(points);
        const checkpoints = await this._processCheckpoints(routeData, departureDate, points);

        const finalResult = {
            routeGeo: routeData.path,
            checkpoints: checkpoints,
            provider: routeData.provider,
            distanceTotal: routeData.distance,
            durationTotal: routeData.duration
        };

        this._saveToCache(cacheKey, departureIsoKey, finalResult);
        return finalResult;
    }

    async _getRouteWithFallback(points) {
        // Tentativa 1: OSRM
        try {
            console.log("🔄 Tentando OSRM...");
            return await this._getOSRMRoute(points);
        } catch (e) {
            console.warn("⚠️ OSRM falhou. Tentando GraphHopper...");
        }

        // Tentativa 2: GraphHopper
        try {
            if (!this.GRAPHHOPPER_KEY) throw new Error("Chave GraphHopper não configurada no .env");
            return await this._getGraphHopperRoute(points);
        } catch (e) {
            console.warn(`⚠️ GraphHopper falhou (${e.message}). Tentando Mapbox...`);
        }

        // Tentativa 3: Mapbox
        try {
            if (!this.MAPBOX_TOKEN) throw new Error("Token Mapbox não configurado no .env");
            return await this._getMapboxRoute(points);
        } catch (e) {
            console.error("❌ Todos os provedores falharam.");
            throw new Error("Serviços de mapas indisponíveis. Verifique as chaves de API no servidor.");
        }
    }

    async _getOSRMRoute(points) {
        const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
        const res = await axios.get(url, { timeout: 8000 });
        if (!res.data.routes[0]) throw new Error("Rota não encontrada no OSRM");
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

    async _getCoordinates(query) {
        try {
            // 1. LOG DE DEBUG: Para ver o que chegou do Frontend
            console.log(`🔎 Buscando coordenadas para: "${query}"`);

            // 2. LIMPEZA: Troca os hífens " - " por vírgulas ", "
            const cleanQuery = query.replace(/ - /g, ', ');

            // 3. TENTA MAPBOX PRIMEIRO
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

            // 4. FALLBACK: NOMINATIM
            console.log(`🔄 Tentando Nominatim para: "${cleanQuery}"`);
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=1&countrycodes=br`;

            const res = await axios.get(url, {
                headers: { 'User-Agent': 'WeatherTripApp/1.0' },
                timeout: 5000
            });

            if (res.data && res.data[0]) {
                console.log(`✅ Nominatim encontrou: ${res.data[0].display_name.slice(0, 30)}...`);
                return { lat: res.data[0].lat, lng: res.data[0].lon };
            } else {
                console.warn(`❌ Nenhum serviço encontrou: "${cleanQuery}"`);
                return null;
            }

        } catch (e) {
            console.error(`🔥 Erro ao buscar coordenadas: ${e.message}`);
            return null;
        }
    }

    async _getCityName(lat, lng) {
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
                console.warn(`⚠️ Mapbox reverse falhou (${error.message}). Tentando Nominatim como fallback...`);
            }
        }

        // FALLBACK: NOMINATIM
        try {
            await new Promise(r => setTimeout(r, 600)); // Rate limit respiro
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

    async _processCheckpoints(routeData, departureTime, userPoints = []) {
        if (!routeData || !routeData.path || !Array.isArray(routeData.path) || routeData.path.length === 0) {
            console.error("❌ Erro: O provedor de rota não retornou coordenadas (path vazio).");
            return [{
                formattedTime: departureTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                locationName: "Local de Partida",
                distanceFromStart: 0,
                weather: { temp: "--", condition: "Dados indisponíveis" }
            }];
        }

        const checkpoints = [];
        let timeOffset = 0;
        const totalDuration = routeData.duration || 0;
        const totalDistance = routeData.distance || 0;
        const pathPoints = routeData.path;

        while (timeOffset <= totalDuration) {
            const futureDate = new Date(departureTime.getTime() + (timeOffset * 1000));
            const progress = totalDuration > 0 ? timeOffset / totalDuration : 0;
            let pathIndex = Math.floor(progress * (pathPoints.length - 1));
            if (pathIndex < 0) pathIndex = 0;
            if (pathIndex >= pathPoints.length) pathIndex = pathPoints.length - 1;

            const point = pathPoints[pathIndex];
            if (!point) { break; }
            const [lng, lat] = point;

            let weather = { temp: "--", code: 0 };
            let cityName = "Estrada";

            try {
                weather = await this._getWeather(lat, lng, futureDate);
                cityName = await this._getCityName(lat, lng);
            } catch (err) { }

            checkpoints.push({
                formattedTime: futureDate.toLocaleTimeString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
                lat, lng,
                locationName: cityName,
                distanceFromStart: Math.floor((totalDistance * progress) / 1000),
                weather: {
                    temp: weather.temp,
                    condition: this._translateWMO(weather.code)
                },
                isStopNode: false // flag auxiliar
            });

            if (timeOffset >= totalDuration) break;
            timeOffset += this.CHECKPOINT_INTERVAL;
            if (timeOffset > totalDuration && timeOffset - this.CHECKPOINT_INTERVAL < totalDuration) {
                timeOffset = totalDuration;
            }
        }

        // AGORA, FORÇAMOS A INJEÇÃO FÍSICA DAS PARADAS CASO ELAS TENHAM SE PERDIDO NO ALGORITMO DE TEMPO
        // Isso garante que o frontend sempre receba as coordenadas exatas da origem, destino e de cada parada

        // 1. Substituir o primeiro checkpoint pela Origem exata
        if (checkpoints.length > 0 && userPoints.length > 0) {
            const firstUserPoint = userPoints[0];
            checkpoints[0].lat = firstUserPoint.lat;
            checkpoints[0].lng = firstUserPoint.lng;
            checkpoints[0].locationName = firstUserPoint.originalName;
            checkpoints[0].isStopNode = true;
        }

        // 2. Substituir o último checkpoint pelo Destino exato
        if (checkpoints.length > 1 && userPoints.length > 1) {
            const lastUserPoint = userPoints[userPoints.length - 1];
            const maxIdx = checkpoints.length - 1;
            checkpoints[maxIdx].lat = lastUserPoint.lat;
            checkpoints[maxIdx].lng = lastUserPoint.lng;
            checkpoints[maxIdx].locationName = lastUserPoint.originalName;
            checkpoints[maxIdx].isStopNode = true;
        }

        // 3. Injetar as Paradas intermediárias caso o frontend precise encontrá-las exatas
        // userPoints[1] até userPoints.length - 2 são as paradas
        if (userPoints.length > 2) {
            const stops = userPoints.slice(1, userPoints.length - 1);

            for (const stop of stops) {
                // Encontrar o checkpoint mais próximo dessa parada
                let closestIdx = 0;
                let minDist = Infinity;

                for (let i = 1; i < checkpoints.length - 1; i++) {
                    const c = checkpoints[i];
                    // Formula simples de distancia euclidiana porxima para achar o index na linha do tempo
                    const dist = Math.pow(c.lat - stop.lat, 2) + Math.pow(c.lng - stop.lng, 2);
                    if (dist < minDist) {
                        minDist = dist;
                        closestIdx = i;
                    }
                }

                if (closestIdx > 0 && closestIdx < checkpoints.length - 1) {
                    // Nós forçamos o checkpoint mais próximo a herdar os dados da parada para não quebrar a timeline
                    const oldDist = checkpoints[closestIdx].distanceFromStart;
                    const oldTime = checkpoints[closestIdx].formattedTime;
                    const oldWeather = checkpoints[closestIdx].weather;

                    // Cria ou atualiza um objeto bem formatado exatamente na posição temporal
                    checkpoints[closestIdx] = {
                        formattedTime: oldTime,
                        lat: stop.lat,
                        lng: stop.lng,
                        locationName: stop.originalName, // Garanto locationName correto (no script.js isso vai pro card)
                        distanceFromStart: oldDist,
                        weather: oldWeather,
                        isStopNode: true
                    };
                }
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

    _checkCache(routeKey, dateKey) {
        return new Promise((resolve) => {
            db.get(
                `SELECT data FROM route_cache WHERE origin_text = ? AND trip_date = ? AND created_at > ?`,
                [routeKey, dateKey, Date.now() - this.CACHE_TTL],
                (err, row) => {
                    if (!err && row) return resolve(JSON.parse(row.data));
                    resolve(null);
                }
            );
        });
    }

    _saveToCache(routeKey, dateKey, data) {
        db.run(`INSERT INTO route_cache (origin_text, trip_date, data, created_at) VALUES (?, ?, ?, ?)`,
            [routeKey, dateKey, JSON.stringify(data), Date.now()]);
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
                            address: {
                                city: cityCtx ? cityCtx.text : f.text,
                                state: stateName
                            },
                            lat: f.center[1],
                            lon: f.center[0]
                        };
                    });
                }
            } catch (e) {
                console.warn(`⚠️ Mapbox Search falhou (${e.message}). Tentando Nominatim...`);
            }
        }

        // FALLBACK: NOMINATIM
        try {
            console.log(`🔄 Search Fallback Nominatim para: "${query}"`);
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=br`;
            const res = await axios.get(url, { headers: { 'User-Agent': 'WeatherTripApp/1.0' }, timeout: 5000 });
            return res.data || [];
        } catch (e) {
            console.error(`🔥 Erro final no Search: ${e.message}`);
            return [];
        }
    }
}

const service = new RouteWeatherService();

app.post('/api/forecast', apiLimiter, async (req, res) => {
    try {
        const { origin, destination, stops, date } = req.body;

        // --- VALIDAÇÃO DE INPUT (SEGURANÇA) ---
        if (typeof origin !== 'string' || origin.length > 200 || origin.trim() === '') {
            return res.status(400).json({ error: "Origem inválida ou muito longa (máx 200 caracteres)." });
        }
        if (typeof destination !== 'string' || destination.length > 200 || destination.trim() === '') {
            return res.status(400).json({ error: "Destino inválido ou muito longo (máx 200 caracteres)." });
        }

        if (stops) {
            if (!Array.isArray(stops) || stops.length > 10) {
                return res.status(400).json({ error: "As paradas devem ser um array com no máximo 10 itens." });
            }
            if (stops.some(s => typeof s !== 'string' || s.length > 200)) {
                return res.status(400).json({ error: "Uma ou mais paradas são inválidas ou muito longas (máx 200 caracteres per item)." });
            }
        }

        if (date && isNaN(Date.parse(date))) {
            return res.status(400).json({ error: "Data fornecida é inválida." });
        }

        const data = await service.getRouteForecast(origin, destination, stops || [], date);
        res.json(data);
    } catch (error) {
        console.error("ERRO CRÍTICO:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/search', apiLimiter, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);
        const data = await service.searchAddress(q);
        res.json(data);
    } catch (error) {
        console.error("ERRO SEARCH:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/version', (req, res) => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
        // Pega a URL base da API do .env ou usa o padrão relativo
        const apiBaseUrl = process.env.API_BASE_URL || '/api';
        res.json({
            version: pkg.version,
            apiBaseUrl: apiBaseUrl
        });
    } catch (error) {
        res.status(500).json({ error: "Erro ao ler versão" });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`🚀 Backend rodando na porta ${PORT}`));

// --- 3. LIMPEZA PERIÓDICA DO CACHE ---
// Remove registros expirados a cada 24h para evitar crescimento indefinido do banco
const CLEANUP_INTERVAL = 24 * 3600 * 1000; // 24 horas
setInterval(() => {
    const cutoff = Date.now() - service.CACHE_TTL;
    db.run(`DELETE FROM route_cache WHERE created_at < ?`, [cutoff], function (err) {
        if (err) {
            console.error('❌ Erro na limpeza do cache:', err.message);
        } else {
            console.log(`🧹 Limpeza do cache: ${this.changes} registro(s) expirado(s) removido(s).`);
        }
    });
}, CLEANUP_INTERVAL);
