import { fetchRouteForecast, fetchRouteOptions } from './api.js';
import { initMap, updateMapRoute, clearMarkers, addMarker, map } from './map.js';
import { 
    setupAutocomplete, 
    bindStopsUI, 
    renderCheckpoint, 
    showToast, 
    renderRouteOptions, 
    formatDuration, 
    formatDistance, 
    updateNavigationLinks 
} from './ui.js';

let isFirstSearch = true;
let currentRouteOptions = null;

window.onload = function () {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minDateTime = now.toISOString().slice(0, 16);

    const maxDate = new Date(now.getTime() + (15 * 24 * 60 * 60 * 1000));
    const maxDateTime = maxDate.toISOString().slice(0, 16);

    const dateInput = document.getElementById('trip-date');
    if (dateInput) {
        dateInput.min = minDateTime;
        dateInput.max = maxDateTime;
        dateInput.value = minDateTime;
        dateInput.addEventListener('change', enforceDateLimits);
        dateInput.addEventListener('blur', enforceDateLimits);
    }

    function enforceDateLimits(e) {
        if (!e.target.value) return;
        const selected = new Date(e.target.value);
        const currentNow = new Date();
        const currentMax = new Date(currentNow.getTime() + (16 * 24 * 60 * 60 * 1000));

        if (selected < new Date(currentNow.getTime() - 60000)) {
            currentNow.setMinutes(currentNow.getMinutes() - currentNow.getTimezoneOffset());
            e.target.value = currentNow.toISOString().slice(0, 16);
        } else if (selected > currentMax) {
            currentMax.setMinutes(currentMax.getMinutes() - currentMax.getTimezoneOffset());
            e.target.value = currentMax.toISOString().slice(0, 16);
        }
    }

    initMap();

    if (process.env.APP_VERSION) {
        const verEl = document.getElementById('app-version');
        if (verEl) verEl.textContent = `v${process.env.APP_VERSION}`;
    }

    setupAutocomplete('origin', 'origin-list');
    setupAutocomplete('destination', 'destination-list');
    bindStopsUI();
    setupHistory();
};

function setupHistory() {
    const historyBtn = document.getElementById('history-btn');
    if (!historyBtn) return;

    const history = JSON.parse(localStorage.getItem('wt_history') || '[]');
    if (history.length > 0) {
        historyBtn.classList.remove('hidden');
        historyBtn.onclick = () => {
            const last = history[0];
            document.getElementById('origin').value = last.origin;
            document.getElementById('destination').value = last.destination;
            showToast("Trip Recuperada", "Última busca carregada com sucesso!", "🕒", "indigo");
        };
    }
}

function saveToHistory(origin, destination) {
    let history = JSON.parse(localStorage.getItem('wt_history') || '[]');
    // Evitar duplicados consecutivos
    if (history.length > 0 && history[0].origin === origin && history[0].destination === destination) return;
    
    history.unshift({ origin, destination, timestamp: Date.now() });
    history = history.slice(0, 5); // Manter as 5 últimas
    localStorage.setItem('wt_history', JSON.stringify(history));
    
    const historyBtn = document.getElementById('history-btn');
    if (historyBtn) historyBtn.classList.remove('hidden');
}

window.calcularRota = async function calcularRota() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    const dateInput = document.getElementById('trip-date');

    if (!origin || !destination) {
        showToast("Quase lá!", "Por favor, preencha a cidade de origem e de destino.", "📍", "amber");
        return;
    }

    const stops = Array.from(document.querySelectorAll('#stops-container input'))
        .map(input => input.value)
        .filter(val => val.trim() !== "");

    const mapOverlay = document.getElementById('map-overlay');
    const resultsDiv = document.getElementById('results');
    const resultsPlaceholder = document.getElementById('results-placeholder');
    const routeSelector = document.getElementById('route-selector-container');
    const resultsContent = document.getElementById('results-content');

    // Feedback visual de carregamento
    if (!isFirstSearch) {
        mapOverlay.classList.remove('opacity-0', 'pointer-events-none');
        mapOverlay.classList.add('opacity-100');
    }

    try {
        // Passo 1: Buscar Opções de Rota
        const data = await fetchRouteOptions(origin, destination, stops);
        currentRouteOptions = data;

        if (isFirstSearch) {
            document.getElementById('map-container').classList.remove('hidden');
        }

        // Mostrar seletor de rotas
        renderRouteOptions(data.routes, (index) => selecionarRota(index));

        // Preview da primeira rota no mapa
        updateMapRoute(data.routes[0].path, isFirstSearch);
        
        setTimeout(() => {
            if (map) map.invalidateSize();
            isFirstSearch = false;
            
            if (mapOverlay) {
                mapOverlay.classList.remove('opacity-100');
                mapOverlay.classList.add('opacity-0', 'pointer-events-none');
            }
        }, 300);

        // Esconder resultados anteriores e seletor
        if (resultsDiv) resultsDiv.classList.add('hidden');
        if (resultsPlaceholder) resultsPlaceholder.classList.add('hidden');
        resultsContent.classList.add('hidden');
        
        saveToHistory(origin, destination);

    } catch (error) {
        console.error(error);
        showToast("Erro na Rota", error.message, "❌", "amber");
    }
};

async function selecionarRota(index) {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    const dateInput = document.getElementById('trip-date');
    const stops = Array.from(document.querySelectorAll('#stops-container input'))
        .map(input => input.value)
        .filter(val => val.trim() !== "");

    const timeline = document.getElementById('timeline');
    const resultsDiv = document.getElementById('results');
    const resultsPlaceholder = document.getElementById('results-placeholder');
    const resultsContent = document.getElementById('results-content');
    const mapOverlay = document.getElementById('map-overlay');

    // Exibir container de resultados e esconder placeholder
    if (resultsDiv) resultsDiv.classList.remove('hidden');
    if (resultsPlaceholder) resultsPlaceholder.classList.add('hidden');
    
    // Feedback de carregamento específico para o clima
    mapOverlay.classList.remove('opacity-0', 'pointer-events-none');
    mapOverlay.classList.add('opacity-100');

    try {
        const data = await fetchRouteForecast(origin, destination, stops, dateInput.value, index);
        
        timeline.innerHTML = '';
        resultsContent.classList.remove('hidden');

        // Atualizar Resumo
        document.getElementById('total-duration').textContent = formatDuration(data.durationTotal);
        document.getElementById('total-distance').textContent = formatDistance(data.distanceTotal);

        // Atualizar Mapa
        updateMapRoute(data.routeGeo, false);
        clearMarkers();

        data.checkpoints.forEach((item, idx) => {
            const isStart = idx === 0;
            const isEnd = idx === data.checkpoints.length - 1;
            const isIntermediateStop = !isStart && !isEnd && item.isStopNode;

            if (isStart || isEnd || isIntermediateStop) {
                let title = isStart ? "🚩 Partida" : (isEnd ? "🏁 Chegada" : "📌 Parada");
                addMarker(item.lat, item.lng, title, item.locationName, item.weather.temp, item.weather.condition);
            }

            timeline.innerHTML += renderCheckpoint(item, idx, data.checkpoints.length);
        });

        // Atualizar Links de Navegação
        updateNavigationLinks(data);

        showToast("Clima Atualizado", `Previsão carregada para: ${data.routeName}`, "🌤️", "indigo");

    } catch (error) {
        console.error(error);
        showToast("Erro no Clima", "Não foi possível carregar a previsão para este trajeto.", "❌", "amber");
    } finally {
        mapOverlay.classList.remove('opacity-100');
        mapOverlay.classList.add('opacity-0', 'pointer-events-none');
    }
}
