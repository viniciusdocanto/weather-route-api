const axios = require('axios');

class WeatherService {
    async getWeather(lat, lng, date) {
        const isoDate = date.toISOString().split('T')[0];
        const hour = date.getHours();
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weathercode&start_date=${isoDate}&end_date=${isoDate}&timezone=auto`;
        try {
            const res = await axios.get(url);
            const data = res.data.hourly;
            return {
                temp: data.temperature_2m[hour],
                condition: this.translateWMO(data.weathercode[hour])
            };
        } catch (e) {
            return { temp: "--", condition: "Dados indisponíveis" };
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

module.exports = new WeatherService();
