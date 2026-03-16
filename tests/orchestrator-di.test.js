/**
 * Teste Unitário com Mocks (Injeção de Dependência)
 * Rodar com: node tests/orchestrator-di.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const RouteWeatherOrchestrator = require('../services/weatherRouteService');

// MOCKS: Criamos versões "falsas" dos serviços que não dependem de rede ou banco
class MockCache {
    async checkCache() { return null; }
    saveToCache() { }
}

class MockGeocoding {
    async getCoordinates(name) {
        return { lat: -23, lng: -46 };
    }
    async getCityName() { return "Cidade Teste"; }
}

class MockRouting {
    async getRouteWithFallback() {
        return {
            path: [[-46, -23], [-46.1, -23.1]],
            duration: 3600,
            distance: 50000,
            provider: 'MockProvider'
        };
    }
}

class MockWeather {
    async getWeather() {
        return { temp: 25, condition: "Sol" };
    }
    async getBatchWeather(points) {
        return points.map(() => ({ temp: 25, condition: "Sol" }));
    }
}

test('Orchestrator - Fluxo completo com Mocks (DI)', async (t) => {
    // Injetamos os mocks no orquestrador
    const orchestrator = new RouteWeatherOrchestrator(
        new MockCache(),
        new MockGeocoding(),
        new MockRouting(),
        new MockWeather()
    );

    const result = await orchestrator.getRouteForecast("SP", "RJ");

    assert.strictEqual(result.provider, 'MockProvider');
    assert.strictEqual(result.checkpoints.length > 0, true);
    assert.strictEqual(result.checkpoints[0].locationName, "SP"); // Nome original preservado na partida
    assert.strictEqual(result.checkpoints[0].weather.temp, 25);

    console.log('✅ Orquestrador validado com sucesso usando Injeção de Dependência!');
});
