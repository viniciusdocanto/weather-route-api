const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Detecta o path base atual (ex: /weathertrip/) para lidar com deploys em subpastas
const getBasePath = () => {
    const path = window.location.pathname;
    if (path.match(/\.(html|php)$/)) {
        return path.substring(0, path.lastIndexOf('/') + 1);
    }
    return path.endsWith('/') ? path : path + '/';
};

// Em produção, usa a URL do ambiente ou resolve relativo ao path atual (suporta subpastas)
export const API_BASE = (typeof process !== 'undefined' && process.env.API_BASE_URL) 
    ? process.env.API_BASE_URL 
    : (isLocalhost ? 'http://localhost:3000/api' : `${window.location.origin}${getBasePath()}api`);

const searchCache = new Map();

export async function searchAddress(query) {
    if (!query || query.length < 3) return [];

    const normalizedQuery = query.toLowerCase().trim();
    if (searchCache.has(normalizedQuery)) {
        return searchCache.get(normalizedQuery);
    }

    const safeBase = API_BASE.replace(/\/$/, '');
    const url = `${safeBase}/search?q=${encodeURIComponent(query)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();

        searchCache.set(normalizedQuery, data);
        return data;
    } catch (e) {
        return [];
    }
}

export async function fetchRouteForecast(origin, destination, stops, date) {
    const safeBase = API_BASE.replace(/\/$/, '');
    const API_URL = `${safeBase}/forecast`;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, stops, date })
    });

    const data = await response.json();

    if (!response.ok && !data.error) {
        throw new Error(`Erro HTTP: ${response.status}`);
    }

    return data;
}
