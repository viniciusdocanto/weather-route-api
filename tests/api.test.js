const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const apiRoutes = require('../routes/api');
const pkg = require('../package.json');

test('API Route - GET /version', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);

    const server = app.listen(0);
    const { port } = server.address();

    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/version`);
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(data.version, pkg.version);
        assert.ok(data.apiBaseUrl);
    } finally {
        server.close();
    }
});

test('API Route - POST /route-options (validações)', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);

    const server = app.listen(0);
    const { port } = server.address();

    try {
        // Sem origem
        let res = await fetch(`http://127.0.0.1:${port}/api/route-options`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: 'Rio de Janeiro' })
        });
        assert.strictEqual(res.status, 400);

        // Sem destino
        res = await fetch(`http://127.0.0.1:${port}/api/route-options`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin: 'São Paulo' })
        });
        assert.strictEqual(res.status, 400);

        // Paradas inválidas (> 10)
        res = await fetch(`http://127.0.0.1:${port}/api/route-options`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origin: 'São Paulo',
                destination: 'Rio de Janeiro',
                stops: Array(11).fill('Parada')
            })
        });
        assert.strictEqual(res.status, 400);
    } finally {
        server.close();
    }
});

test('API Route - POST /forecast (validações)', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);

    const server = app.listen(0);
    const { port } = server.address();

    try {
        // Validação de data inválida
        let res = await fetch(`http://127.0.0.1:${port}/api/forecast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origin: 'São Paulo',
                destination: 'Rio de Janeiro',
                date: 'invalid-date-string'
            })
        });
        assert.strictEqual(res.status, 400);

        // Validação de paradas inválidas (item não string)
        res = await fetch(`http://127.0.0.1:${port}/api/forecast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origin: 'São Paulo',
                destination: 'Rio de Janeiro',
                stops: [12345]
            })
        });
        assert.strictEqual(res.status, 400);
    } finally {
        server.close();
    }
});

test('API Route - GET /search com query vazia', async () => {
    const app = express();
    app.use('/api', apiRoutes);

    const server = app.listen(0);
    const { port } = server.address();

    try {
        const res = await fetch(`http://127.0.0.1:${port}/api/search`);
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(data, []);
    } finally {
        server.close();
    }
});
