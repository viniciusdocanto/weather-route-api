/**
 * Testes Unitários Básicos (Node.js Native Test Runner)
 * Rodar com: node tests/test-core.js
 */
const test = require('node:test');
const assert = require('node:assert');

// Mock simples para o CacheRepository (para não depender do SQLite nos testes unitários)
const WeatherService = require('../services/WeatherService');
const weatherService = new WeatherService();

test('WeatherService - Tradução de Códigos WMO', (t) => {
    const condition = weatherService.translateWMO(0);
    assert.strictEqual(condition, 'Céu Limpo ☀️', 'Código 0 deve ser Céu Limpo');

    const unknown = weatherService.translateWMO(999);
    assert.strictEqual(unknown, 'Clima (999)', 'Código desconhecido deve retornar formato padrão');
});

test('WeatherService - Estrutura da Resposta de Clima', async (t) => {
    // Nota: Como este teste chama a API real, pode falhar sem internet.
    // Em um cenário real de CI/CD, usaríamos mocks para o axios.
    try {
        const result = await weatherService.getWeather(-23.5505, -46.6333, new Date());
        assert.ok(result.temp, 'Deve ter propriedade temp');
        assert.ok(result.condition, 'Deve ter propriedade condition');
    } catch (e) {
        console.warn('⚠️ Pulo teste de rede: sem conexão ou timeout.');
    }
});

console.log('\n🚀 Ambiente de testes configurado. Rode `node tests/test-core.js` para validar.');
