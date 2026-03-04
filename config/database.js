const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Resolve o caminho do banco para a raiz do projeto
const dbPath = path.resolve(__dirname, '../weather_trip.db');

const db = new sqlite3.Database(dbPath, (err) => {
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

// --- LIMPEZA PERIÓDICA DO CACHE ---
const CLEANUP_INTERVAL = 24 * 3600 * 1000; // 24 horas
const CACHE_TTL = 3600 * 1000; // 1 hora de TTL

setInterval(() => {
    const cutoff = Date.now() - CACHE_TTL;
    db.run(`DELETE FROM route_cache WHERE created_at < ?`, [cutoff], function (err) {
        if (err) {
            console.error('❌ Erro na limpeza do cache:', err.message);
        } else {
            console.log(`🧹 Limpeza do cache: ${this.changes} registro(s) expirado(s) removido(s).`);
        }
    });
}, CLEANUP_INTERVAL);

module.exports = db;
