const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// A URL da API é injetada estaticamente durante o build (__INJECTED_API_BASE_URL__)
// Sem usar 'process' para evitar ReferenceError no navegador
export const API_BASE = isLocalhost ? '/api' : (typeof __INJECTED_API_BASE_URL__ !== 'undefined' ? __INJECTED_API_BASE_URL__ : '/api');

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
