const db = require('../config/database');

class CacheRepository {
    constructor() {
        this.CACHE_TTL = 3600 * 1000; // 1 hora de TTL
    }

    /**
     * Verifica se existe uma rota válida no cache.
     * @param {string} routeKey Chave única da rota (ex: coordenadas combinadas)
     * @param {string} dateKey Chave da data de partida (ISO hora)
     * @returns {Promise<Object|null>}
     */
    checkCache(routeKey, dateKey) {
        return new Promise((resolve) => {
            db.get(
                `SELECT data FROM route_cache WHERE origin_text = ? AND trip_date = ? AND created_at > ?`,
                [routeKey, dateKey, Date.now() - this.CACHE_TTL],
                (err, row) => {
                    if (!err && row) {
                        try {
                            return resolve(JSON.parse(row.data));
                        } catch (e) {
                            console.error("❌ Erro ao parsear JSON do cache:", e);
                        }
                    }
                    resolve(null);
                }
            );
        });
    }

    /**
     * Salva o resultado de uma rota no cache.
     * @param {string} routeKey 
     * @param {string} dateKey 
     * @param {Object} data 
     */
    saveToCache(routeKey, dateKey, data) {
        db.run(
            `INSERT INTO route_cache (origin_text, trip_date, data, created_at) VALUES (?, ?, ?, ?)`,
            [routeKey, dateKey, JSON.stringify(data), Date.now()],
            (err) => {
                if (err) console.error("❌ Erro ao salvar no cache:", err.message);
            }
        );
    }
}

module.exports = new CacheRepository();
