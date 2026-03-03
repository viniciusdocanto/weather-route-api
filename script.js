// --- 1. Inicialização do Mapa ---
let map = null;
let routeLayer = null;
let markersLayer = null;
let API_BASE = '/api';



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
    updateVersion(); // Busca e exibe a versão do app
};


async function searchAddress(query) {
    if (!query || query.length < 3) return [];

    const url = `${API_BASE}/search?q=${encodeURIComponent(query)}`;
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
        if (!value) { list.classList.remove('active'); return; }
        debounceTimer = setTimeout(async () => {
            const places = await searchAddress(value);
            list.innerHTML = '';
            if (places.length > 0) {
                list.classList.add('active');
                places.forEach(place => {
                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    const addr = place.address;
                    const main = addr.city || addr.town || addr.village || place.display_name.split(',')[0];
                    const state = addr.state || '';
                    const txt = state ? `${main} - ${state}` : main;
                    const strong = document.createElement('strong');
                    strong.textContent = txt;
                    const small = document.createElement('small');
                    small.textContent = place.display_name;
                    item.appendChild(strong);
                    item.appendChild(small);
                    item.addEventListener('click', () => { input.value = txt; list.classList.remove('active'); });
                    list.appendChild(item);
                });
            } else list.classList.remove('active');
        }, 500);
    });
    document.addEventListener('click', (e) => { if (e.target !== input) list.classList.remove('active'); });
}
setupAutocomplete('origin', 'origin-list');
setupAutocomplete('destination', 'destination-list');

async function updateVersion() {
    try {
        const res = await fetch(`${API_BASE}/version`);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const data = await res.json();
        if (data.version) {
            document.getElementById('app-version').textContent = `v${data.version}`;
        }
        if (data.apiBaseUrl) {
            API_BASE = data.apiBaseUrl;
            console.log(`📡 API configurada para: ${API_BASE}`);
        }
    } catch (e) {
        console.warn("Não foi possível carregar a versão ou configuração.");
    }
}

// --- 2.5 Lógica de Paradas ---
let stopCount = 0;
function adicionarParada() {
    stopCount++;
    const id = `stop-${stopCount}`;
    const listId = `stop-list-${stopCount}`;

    const container = document.getElementById('stops-container');
    const div = document.createElement('div');
    div.className = 'stop-group';
    div.id = `group-${id}`;

    div.innerHTML = `
        <div class="form-group">
            <label for="${id}">Parada:</label>
            <input type="text" id="${id}" placeholder="Cidade intermediária..." autocomplete="off" aria-label="Cidade intermediária">
            <div id="${listId}" class="autocomplete-list"></div>
        </div>
        <button class="btn-remove" onclick="removerParada('${id}')" aria-label="Remover parada">×</button>
    `;

    container.appendChild(div);
    setupAutocomplete(id, listId);
}

function removerParada(id) {
    const div = document.getElementById(`group-${id}`);
    div.classList.add('removing'); // Opcional: adicionar animação de saída no CSS
    setTimeout(() => div.remove(), 100);
}

// --- 3. Lógica Principal ---
let isFirstSearch = true;

async function calcularRota() {
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

    const API_URL = `${API_BASE}/forecast`;

    if (!origin || !destination) { alert("Preencha origem e destino!"); return; }

    // --- PASSO 1: ESTADO DE CARREGAMENTO ---
    if (!isFirstSearch) {
        mapOverlay.classList.add('active');
        mapDiv.classList.add('loading');
    }

    resultsDiv.innerHTML = `
        <div style="text-align:center; padding: 40px; color: #666;">
            <div class="spinner" style="margin: 0 auto 20px;"></div>
            <strong>Calculando rota e clima...</strong><br>
            <small>Aguarde um momento</small>
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
            errorElement.style.color = 'red';
            errorElement.style.textAlign = 'center';
            errorElement.textContent = data.error;
            resultsDiv.appendChild(errorElement);

            if (!isFirstSearch) {
                mapOverlay.classList.remove('active');
                mapDiv.classList.remove('loading');
            }
            return;
        }

        // --- PASSO 2: ATUALIZAR MAPA ---
        if (isFirstSearch) {
            mapContainer.style.display = 'block';
            // Pequeno delay para a transição de opacidade funcionar
            setTimeout(() => {
                mapContainer.classList.add('visible');
                map.invalidateSize();
            }, 10);
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
                mapOverlay.classList.remove('active');
                mapDiv.classList.remove('loading');
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
            const stopClass = isIntermediateStop ? 'stop-highlight' : '';
            const stopLabel = isIntermediateStop ? '<span style="color:#e67c73; font-weight:bold; font-size:0.8rem; display:block">📍 Parada Programada</span>' : '';

            resultsDiv.innerHTML += `
                <div class="timeline-item ${stopClass}" ${isIntermediateStop ? 'style="border-left: 4px solid #e67c73;"' : ''}>
                    <div class="time-badge">
                        ${item.formattedTime.split(' ')[0]}<br>
                        <small>${item.formattedTime.split(' ')[1] || ''}</small>
                    </div>
                    <div class="info">
                        ${stopLabel}
                        <span class="city-name">${item.locationName}</span>
                        <span class="city-meta">${kmText}</span>
                    </div>
                    <div class="weather-box">
                        <span class="weather-temp">${item.weather.temp}°C</span>
                        <span class="weather-cond">${item.weather.condition}</span>
                    </div>
                </div>`;
        });

    } catch (error) {
        console.error(error);
        resultsDiv.innerHTML = '<p style="color:red; text-align:center">Erro ao conectar com o servidor.</p>';
        if (!isFirstSearch) {
            mapOverlay.classList.remove('active');
            mapDiv.classList.remove('loading');
        }
    }
}
