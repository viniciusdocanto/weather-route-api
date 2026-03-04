const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
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

app.use(helmet({
    contentSecurityPolicy: false, // Desabilitado para não bloquear o Leaflet/Mapbox Tiles
    crossOriginEmbedderPolicy: false
}));

const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['https://sites.docanto.net', 'https://weather-route-api.onrender.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
app.use(express.json());

// Servir arquivos estáticos da pasta assets
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
    maxAge: '365d' // Cache longo para assets (JS, CSS, Imagens)
}));

// Servir os arquivos html na raiz
app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 2. ROTAS DA API ---
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`🚀 Backend rodando na porta ${PORT}`));
