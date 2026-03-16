const db = require('../config/database');
const logger = require('../config/logger');

class CacheRepository {
    constructor() {
        this.CACHE_TTL = 24 * 3600 * 1000; // 24 horas de TTL
    }

    checkCache(routeKey, dateKey) {
        return new Promise((resolve) => {
            db.get(
                `SELECT data FROM route_cache WHERE origin_text = ? AND trip_date = ? AND created_at > ?`,
                [routeKey, dateKey, Date.now() - this.CACHE_TTL],
                (err, row) => {
                    if (!err && row) {
                        try {
                            logger.debug("Cache validado", { routeKey, dateKey });
                            return resolve(JSON.parse(row.data));
                        } catch (e) {
                            logger.error("Erro ao parsear JSON do cache", { error: e.message, routeKey });
                        }
                    }
                    resolve(null);
                }
            );
        });
    }

    saveToCache(routeKey, dateKey, data) {
        db.run(
            `INSERT INTO route_cache (origin_text, trip_date, data, created_at) VALUES (?, ?, ?, ?)`,
            [routeKey, dateKey, JSON.stringify(data), Date.now()],
            (err) => {
                if (err) {
                    logger.error("Erro ao salvar no cache", { error: err.message, routeKey });
                } else {
                    logger.debug("Rota salva no cache", { routeKey });
                }
            }
        );
    }
}

module.exports = CacheRepository;
