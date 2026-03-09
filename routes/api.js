const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const service = require('../services/weatherRouteService');
router.post('/forecast', async (req, res) => {
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

router.get('/search', async (req, res) => {
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

router.get('/version', (req, res) => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
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

module.exports = router;
