// --- 1. Inicialização do Mapa ---
let map = null;
let routeLayer = null;
let markersLayer = null;

// Em ambiente de Build com ESBuild, env variables de deploy.yml/Netlify são injetadas estaticamente aqui
let API_BASE = process.env.API_BASE_URL;



function initMap() {
    // Cria o mapa centrado no Brasil (zoom level baixo)
    map = L.map('map').setView([-14.235, -51.925], 4);

    // Adiciona os "Tiles" do OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
}

// --- 2. Utilitários (Autocomplete e Data) ---
window.onload = function () {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('trip-date').value = now.toISOString().slice(0, 16);
    initMap(); // Inicia o mapa (vazio)

    // Injeta a versão no footer fisicamente compilada
    if (process.env.APP_VERSION) {
        const verEl = document.getElementById('app-version');
        if (verEl) verEl.textContent = `v${process.env.APP_VERSION}`;
    }
};


async function searchAddress(query) {
    if (!query || query.length < 3) return [];

    // Tira a "/" final caso já venha na variável do Node e adiciona a respectiva barra
    const safeBase = API_BASE.replace(/\/$/, '');
    const url = `${safeBase}/search?q=${encodeURIComponent(query)}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        return await response.json();
    } catch (e) {
        return [];
    }
}

function setupAutocomplete(inputId, listId) {
    let debounceTimer;
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    input.addEventListener('input', function () {
        const value = this.value;
        clearTimeout(debounceTimer);
        if (!value) { list.classList.add('hidden'); return; }
        debounceTimer = setTimeout(async () => {
            const places = await searchAddress(value);
            list.innerHTML = '';
            if (places.length > 0) {
                list.classList.remove('hidden');
                places.forEach(place => {
                    const item = document.createElement('div');
                    item.className = 'px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0 transition-colors';
                    const addr = place.address;
                    const main = addr.city || addr.town || addr.village || place.display_name.split(',')[0];
                    const state = addr.state || '';
                    const txt = state ? `${main} - ${state}` : main;
                    const strong = document.createElement('strong');
                    strong.className = 'block text-slate-700 dark:text-slate-200 font-semibold text-sm';
                    strong.textContent = txt;
                    const small = document.createElement('small');
                    small.className = 'block text-slate-400 dark:text-slate-500 text-xs mt-0.5 truncate';
                    small.textContent = place.display_name;
                    item.appendChild(strong);
                    item.appendChild(small);
                    item.addEventListener('click', () => { input.value = txt; list.classList.add('hidden'); });
                    list.appendChild(item);
                });
            } else list.classList.add('hidden');
        }, 500);
    });
    document.addEventListener('click', (e) => { if (e.target !== input) list.classList.add('hidden'); });
}
setupAutocomplete('origin', 'origin-list');
setupAutocomplete('destination', 'destination-list');



// --- 2.5 Lógica de Paradas ---
let stopCount = 0;
window.adicionarParada = function adicionarParada() {
    stopCount++;
    const id = `stop-${stopCount}`;
    const listId = `stop-list-${stopCount}`;

    const container = document.getElementById('stops-container');
    const div = document.createElement('div');
    div.className = 'relative group bg-white/50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl p-4 transition-all hover:border-indigo-300 dark:hover:border-indigo-600';
    div.id = `group-${id}`;

    div.innerHTML = `
        <label for="${id}" class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5 ml-1">Parada</label>
        <div class="relative">
            <span class="absolute left-4 top-3.5 text-teal-500">📌</span>
            <input type="text" id="${id}" placeholder="Cidade intermediária..." autocomplete="off" aria-label="Cidade intermediária"
                class="w-full pl-11 pr-12 py-3.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-900/50 rounded-xl outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 font-medium text-slate-700 dark:text-slate-200">
            <button class="absolute right-3 top-3.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded-md transition-colors" onclick="removerParada('${id}')" aria-label="Remover parada">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>
        <div id="${listId}" class="autocomplete-list absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 max-h-60 overflow-y-auto hidden"></div>
    `;

    container.appendChild(div);
    setupAutocomplete(id, listId);
}

window.removerParada = function removerParada(id) {
    const div = document.getElementById(`group-${id}`);
    div.classList.add('opacity-0', 'scale-95');
    setTimeout(() => div.remove(), 200);
}

// --- 3. Lógica Principal ---
let isFirstSearch = true;

window.calcularRota = async function calcularRota() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    const date = document.getElementById('trip-date').value;

    // Coletar paradas
    const stops = Array.from(document.querySelectorAll('#stops-container input'))
        .map(input => input.value)
        .filter(val => val.trim() !== "");

    const resultsDiv = document.getElementById('results');
    const mapDiv = document.getElementById('map');
    const mapContainer = document.getElementById('map-container');
    const mapOverlay = document.getElementById('map-overlay');

    const safeBase = API_BASE.replace(/\/$/, '');
    const API_URL = `${safeBase}/forecast`;

    if (!origin || !destination) { alert("Preencha origem e destino!"); return; }

    // --- PASSO 1: ESTADO DE CARREGAMENTO ---
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
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin, destination, stops, date })
        });

        const data = await response.json();

        if (!response.ok && !data.error) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

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

        // --- PASSO 2: ATUALIZAR MAPA ---
        if (isFirstSearch) {
            mapContainer.classList.remove('hidden');
            // Pequeno delay para a transição de opacidade funcionar
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }

        // Limpa camadas antigas
        if (routeLayer) map.removeLayer(routeLayer);
        markersLayer.clearLayers();

        // Desenha a linha da rota
        const routeGeoJSON = {
            "type": "LineString",
            "coordinates": data.routeGeo
        };

        routeLayer = L.geoJSON(routeGeoJSON, {
            style: { color: '#1a73e8', weight: 5, opacity: 0.8 } // Azul Google Maps
        }).addTo(map);

        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] }); // Ajusta zoom com margem

        // Remove o estado de carregamento
        setTimeout(() => {
            if (!isFirstSearch) {
                mapOverlay.classList.remove('opacity-100');
                mapOverlay.classList.add('opacity-0', 'pointer-events-none');
            }
            map.invalidateSize();
            isFirstSearch = false; // A partir de agora, o mapa já foi revelado
        }, 300);

        // --- PASSO 3: LISTA E MARCADORES (INICIAL/FINAL/PARADAS) ---
        data.checkpoints.forEach((item, index) => {

            const isStart = index === 0;
            const isEnd = index === data.checkpoints.length - 1;

            // NOVA LÓGICA: O Backend agora injeta a flag isStopNode
            const isIntermediateStop = !isStart && !isEnd && item.isStopNode;

            // Adiciona marcador para Início, Fim E Paradas marcadas
            if (isStart || isEnd || isIntermediateStop) {
                const marker = L.marker([item.lat, item.lng]).addTo(markersLayer);

                let title = "📍 Parada";
                if (isStart) title = "🚩 Partida";
                if (isEnd) title = "🏁 Chegada";

                marker.bindPopup(`
                    <div style="text-align:center;">
                        <strong>${title}</strong><br>
                        ${item.locationName}<br>
                        <span style="font-size:1.2em">${item.weather.condition} ${item.weather.temp}°C</span>
                    </div>
                `);

                if (isEnd) marker.openPopup();
            }

            // Lista detalhada (Textual)
            let kmText = (item.distanceFromStart === 0) ? "📍 Partida" : `🚗 Km ${item.distanceFromStart || '--'}`;

            // Destaca a parada na timeline
            const stopLabel = isIntermediateStop ? '<span class="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1 inline-block">Parada Programada</span>' : '';

            resultsDiv.innerHTML += `
                <div class="relative pl-6 pb-8 border-l-2 ${isIntermediateStop ? 'border-teal-400' : 'border-indigo-200'} last:border-0 last:pb-0 group">
                    <div class="absolute left-[-9px] top-1 w-4 h-4 rounded-full ${isIntermediateStop ? 'bg-teal-400 ring-4 ring-teal-50' : 'bg-indigo-400 ring-4 ring-indigo-50'} shadow-sm transition-transform group-hover:scale-125"></div>
                    
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                        <div class="flex-1">
                            ${stopLabel}
                            <h3 class="text-slate-800 dark:text-slate-100 font-bold text-lg">${item.locationName}</h3>
                            <div class="flex items-center text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 gap-3">
                                <span class="flex items-center"><svg class="w-4 h-4 mr-1 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>${item.formattedTime}</span>
                                <span class="flex items-center"><svg class="w-4 h-4 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>${kmText}</span>
                            </div>
                        </div>
                        
                        <div class="flex flex-col items-end min-w-[100px] p-3 bg-gradient-to-br from-indigo-50 to-blue-50/50 dark:from-indigo-900/30 dark:to-blue-900/20 rounded-xl border border-indigo-100/50 dark:border-indigo-800/50">
                            <span class="text-2xl font-bold text-indigo-700 dark:text-indigo-300 tracking-tight">${item.weather.temp}°C</span>
                            <span class="text-xs font-semibold text-indigo-500/80 dark:text-indigo-400 uppercase tracking-wide mt-0.5">${item.weather.condition}</span>
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
