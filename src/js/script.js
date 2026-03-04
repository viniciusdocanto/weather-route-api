import { fetchRouteForecast } from './api.js';
import { initMap, updateMapRoute, clearMarkers, addMarker, map } from './map.js';
import { setupAutocomplete, bindStopsUI } from './ui.js';

let isFirstSearch = true;

window.onload = function () {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('trip-date').value = now.toISOString().slice(0, 16);

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
    const date = document.getElementById('trip-date').value;

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
                let title = "📍 Parada";
                if (isStart) title = "🚩 Partida";
                if (isEnd) title = "🏁 Chegada";

                addMarker(item.lat, item.lng, title, item.locationName, item.weather.temp, item.weather.condition);
            }

            let kmText = (item.distanceFromStart === 0) ? `Km 0` : `Km ${item.distanceFromStart || '--'}`;

            let statusLabel = '';
            if (isStart) {
                statusLabel = '<span class="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1 inline-block">📍 Partida</span>';
            } else if (isEnd) {
                statusLabel = '<span class="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1 inline-block">🏁 Chegada</span>';
            } else if (isIntermediateStop) {
                statusLabel = '<span class="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1 inline-block">📌 Parada</span>';
            }

            resultsDiv.innerHTML += `
                <div class="relative pl-6 pb-8 border-l-2 ${isIntermediateStop ? 'border-teal-400' : 'border-indigo-200'} last:border-0 last:pb-0 group">
                    <div class="absolute left-[-9px] top-1 w-4 h-4 rounded-full ${isIntermediateStop ? 'bg-teal-400 ring-4 ring-teal-50' : 'bg-indigo-400 ring-4 ring-indigo-50'} shadow-sm transition-transform group-hover:scale-125"></div>
                    
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                        <div class="flex-1">
                            ${statusLabel}
                            <h3 class="text-slate-800 dark:text-slate-100 font-bold text-lg">${item.locationName}</h3>
                            <div class="flex items-center text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 gap-3">
                                <span class="flex items-center"><svg class="w-4 h-4 mr-1 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>${item.formattedTime}</span>
                                <span class="flex items-center"><svg class="w-4 h-4 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>🚗 ${kmText}</span>
                            </div>
                        </div>
                        
                        <div class="flex flex-col items-end min-w-[100px] p-3 bg-gradient-to-br from-indigo-50 to-blue-50/50 dark:from-indigo-900/30 dark:to-blue-900/20 rounded-xl border border-indigo-100/50 dark:border-indigo-800/50">
                            <span class="text-2xl font-bold text-indigo-700 dark:text-indigo-300 tracking-tight">${item.weather ? item.weather.temp + '°C' : '--'}</span>
                            <span class="text-xs font-semibold text-indigo-500/80 dark:text-indigo-400 uppercase tracking-wide mt-0.5">${item.weather ? item.weather.condition : 'Sem dados'}</span>
                        </div>
                    </div>
                </div>`;
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
