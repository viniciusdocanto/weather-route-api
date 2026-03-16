const axios = require('axios');
const logger = require('../config/logger');

class WeatherService {
    async getWeather(lat, lng, date) {
        const results = await this.getBatchWeather([{ lat, lng, date }]);
        return results[0];
    }

    async getBatchWeather(points) {
        if (!points || points.length === 0) return [];

        // Agrupar por data para otimizar chamadas (Open-Meteo batch suporta múltiplas coordenadas para o mesmo período)
        const dateGroups = {};
        points.forEach((p, idx) => {
            const isoDate = p.date.toISOString().split('T')[0];
            if (!dateGroups[isoDate]) dateGroups[isoDate] = [];
            dateGroups[isoDate].push({ ...p, originalIdx: idx });
        });

        const finalResults = new Array(points.length);

        for (const [isoDate, groupPoints] of Object.entries(dateGroups)) {
            let attempts = 0;
            const maxAttempts = 2;
            let success = false;

            while (attempts < maxAttempts && !success) {
                try {
                    attempts++;
                    const lats = groupPoints.map(p => p.lat).join(',');
                    const lngs = groupPoints.map(p => p.lng).join(',');
                    
                    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&hourly=temperature_2m,weathercode&start_date=${isoDate}&end_date=${isoDate}&timezone=auto`;
                    
                    logger.debug(`Buscando clima em lote (Tentativa ${attempts})`, { date: isoDate, count: groupPoints.length });
                    const res = await axios.get(url, { 
                        timeout: 15000,
                        headers: { 'User-Agent': 'WeatherTrip/1.6.7' }
                    });
                    
                    const dataArray = Array.isArray(res.data) ? res.data : [res.data];

                    groupPoints.forEach((gp, i) => {
                        const data = dataArray[i]?.hourly;
                        const hour = gp.date.getHours();
                        
                        if (data && data.temperature_2m && data.temperature_2m[hour] !== undefined) {
                            finalResults[gp.originalIdx] = {
                                temp: data.temperature_2m[hour],
                                condition: this.translateWMO(data.weathercode[hour])
                            };
                        } else {
                            finalResults[gp.originalIdx] = { temp: "--", condition: "Sem dados" };
                        }
                    });
                    success = true;

                } catch (e) {
                    const status = e.response ? e.response.status : 'TIMEOUT/NETWORK';
                    const errorMsg = e.response ? JSON.stringify(e.response.data) : e.message;
                    
                    logger.error(`Erro ao buscar clima em lote (Tentativa ${attempts})`, { 
                        status, 
                        error: errorMsg,
                        url: attempts === 1 ? e.config?.url : undefined 
                    });

                    if (attempts >= maxAttempts) {
                        const detail = status === 429 ? "Limite excedido" : "Erro de conexão";
                        
                        // Tentativa de Fallback para WeatherAPI se tivermos a Key e for erro de limit
                        const weatherApiKey = process.env.WEATHER_API_KEY;
                        if (status === 429 && weatherApiKey) {
                            logger.warn("Limite do Open-Meteo excedido. Tentando fallback para WeatherAPI...");
                            try {
                                await this._fetchFromWeatherAPI(groupPoints, finalResults, weatherApiKey);
                                success = true;
                                continue; // Vai para o próximo grupo (mas este já deu sucesso)
                            } catch (fallbackError) {
                                logger.error("Fallback para WeatherAPI também falhou", { error: fallbackError.message });
                            }
                        }

                        groupPoints.forEach(gp => {
                            finalResults[gp.originalIdx] = { temp: "--", condition: detail };
                        });
                    } else {
                        // Espera um pouco antes da próxima tentativa (500ms)
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }
        }

        return finalResults;
    }

    async _fetchFromWeatherAPI(points, results, apiKey) {
        for (const p of points) {
            const isoDate = p.date.toISOString().split('T')[0];
            const url = `https://api.weatherapi.com/v1/history.json?key=${apiKey}&q=${p.lat},${p.lng}&dt=${isoDate}`;
            
            try {
                const res = await axios.get(url, { timeout: 10000 });
                const hourIdx = p.date.getHours();
                const dayData = res.data.forecast.forecastday[0].hour[hourIdx];

                results[p.originalIdx] = {
                    temp: dayData.temp_c,
                    condition: dayData.condition.text
                };
            } catch (e) {
                logger.error("Erro individual no fallback WeatherAPI", { lat: p.lat, error: e.message });
                throw e; // Propaga para o loop principal decidir o que fazer
            }
        }
    }

    translateWMO(code) {
        const table = {
            0: "Céu Limpo ☀️", 1: "Predom. Limpo 🌤️", 2: "Parcial. Nublado ⛅", 3: "Encoberto ☁️",
            45: "Nevoeiro 🌫️", 48: "Nevoeiro c/ Geada 🌫️", 51: "Garoa Leve 🌧️", 53: "Garoa Moderada 🌧️",
            55: "Garoa Densa 🌧️", 61: "Chuva Fraca ☔", 63: "Chuva Moderada ☔", 65: "Chuva Forte ⛈️",
            80: "Pancadas de Chuva 🌦️", 81: "Pancadas Fortes ⛈️", 95: "Tempestade ⚡", 96: "Tempestade c/ Granizo ❄️⚡"
        };
        return table[code] || `Clima (${code})`;
    }
}

module.exports = WeatherService;
