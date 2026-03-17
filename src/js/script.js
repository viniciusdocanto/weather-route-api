import { fetchRouteForecast } from './api.js';
import { initMap, updateMapRoute, clearMarkers, addMarker, map } from './map.js';
import { setupAutocomplete, bindStopsUI, renderCheckpoint } from './ui.js';

let isFirstSearch = true;

window.onload = function () {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const minDateTime = now.toISOString().slice(0, 16);
    const dateInput = document.getElementById('trip-date');
    dateInput.value = minDateTime;
    dateInput.min = minDateTime;

    initMap();

    if (process.env.APP_VERSION) {
        const verEl = document.getElementById('app-version');
        if (verEl) verEl.textContent = `v${process.env.APP_VERSION}`;
    }

    setupAutocomplete('origin', 'origin-list');
    setupAutocomplete('destination', 'destination-list');
    bindStopsUI();
};

window.calcularRota = async function calcularRota() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    
    const dateInput = document.getElementById('trip-date');
    let date = dateInput.value;

    // Força a data para agora se o usuário tentar enviar uma data/hora no passado
    const selectedDate = new Date(date);
    const now = new Date();
    if (selectedDate < new Date(now.getTime() - 60000)) {
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        date = now.toISOString().slice(0, 16);
        dateInput.value = date; // Atualiza a UI visualmente para o usuário
    }

    const stops = Array.from(document.querySelectorAll('#stops-container input'))
        .map(input => input.value)
        .filter(val => val.trim() !== "");

    const resultsDiv = document.getElementById('results');
    const mapContainer = document.getElementById('map-container');
    const mapOverlay = document.getElementById('map-overlay');

    if (!origin || !destination) { alert("Preencha origem e destino!"); return; }

    if (!isFirstSearch) {
        mapOverlay.classList.remove('opacity-0', 'pointer-events-none');
        mapOverlay.classList.add('opacity-100');
    }

    resultsDiv.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-slate-500">
            <div class="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
            <strong class="text-lg text-slate-700">Calculando sua rota mágica...</strong>
            <span class="text-sm mt-1">Isso geralmente leva poucos segundos</span>
        </div>
    `;

    try {
        const data = await fetchRouteForecast(origin, destination, stops, date);

        resultsDiv.innerHTML = '';

        if (data.error) {
            const errorElement = document.createElement('p');
            errorElement.className = 'text-red-500 font-medium text-center py-8 bg-red-50 rounded-2xl border border-red-100';
            errorElement.textContent = `Atenção: ${data.error}`;
            resultsDiv.appendChild(errorElement);

            if (!isFirstSearch) {
                mapOverlay.classList.remove('opacity-100');
                mapOverlay.classList.add('opacity-0', 'pointer-events-none');
            }
            return;
        }

        if (isFirstSearch) {
            mapContainer.classList.remove('hidden');
        }

        updateMapRoute(data.routeGeo, isFirstSearch);
        clearMarkers();

        setTimeout(() => {
            if (!isFirstSearch) {
                mapOverlay.classList.remove('opacity-100');
                mapOverlay.classList.add('opacity-0', 'pointer-events-none');
            }

            if (map) map.invalidateSize();
            isFirstSearch = false;
        }, 300);

        data.checkpoints.forEach((item, index) => {
            const isStart = index === 0;
            const isEnd = index === data.checkpoints.length - 1;
            const isIntermediateStop = !isStart && !isEnd && item.isStopNode;

            if (isStart || isEnd || isIntermediateStop) {
                let title = isStart ? "🚩 Partida" : (isEnd ? "🏁 Chegada" : "📍 Parada");
                addMarker(item.lat, item.lng, title, item.locationName, item.weather.temp, item.weather.condition);
            }

            resultsDiv.innerHTML += renderCheckpoint(item, index, data.checkpoints.length);
        });

    } catch (error) {
        console.error(error);
        resultsDiv.innerHTML = '<div class="p-6 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-center font-medium">Erro crítico ao conectar com o serviço de Rotas.</div>';
        if (!isFirstSearch) {
            mapOverlay.classList.remove('opacity-100');
            mapOverlay.classList.add('opacity-0', 'pointer-events-none');
        }
    }
}
