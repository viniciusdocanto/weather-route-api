// --- 1. Inicialização do Mapa ---
let map = null;
let routeLayer = null;
let markersLayer = null;

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
};

let debounceTimer;
async function searchAddress(query) {
    if (!query || query.length < 3) return [];
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=br`;
    try { return await (await fetch(url)).json(); } catch (e) { return []; }
}

function setupAutocomplete(inputId, listId) {
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
                    item.innerHTML = `<strong>${txt}</strong><small>${place.display_name}</small>`;
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

// --- 3. Lógica Principal ---
async function calcularRota() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    const date = document.getElementById('trip-date').value;
    const resultsDiv = document.getElementById('results');
    const mapDiv = document.getElementById('map');

    // Detecta ambiente (Local vs Produção)
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_URL = isLocal ? 'http://localhost:3000/api/forecast' : 'https://weather-route-api.onrender.com/api/forecast';

    if (!origin || !destination) { alert("Preencha origem e destino!"); return; }

    // --- PASSO 1: RESETAR A TELA (FEATURE NOVA) ---
    // Esconde o mapa imediatamente para limpar a visão
    mapDiv.style.display = 'none';

    // Mostra o Loading na lista
    resultsDiv.innerHTML = `
        <div style="text-align:center; padding: 40px; color: #666;">
            <img src="https://i.gifer.com/ZZ5H.gif" width="40"><br><br>
            <strong>Calculando rota e clima...</strong><br>
            <small>Aguarde um momento</small>
        </div>
    `;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin, destination, date })
        });

        const data = await response.json();
        resultsDiv.innerHTML = '';

        if (data.error) {
            resultsDiv.innerHTML = `<p style="color:red; text-align:center">${data.error}</p>`;
            return;
        }

        // --- PASSO 2: EXIBIR O MAPA (SOMENTE AGORA) ---
        mapDiv.style.display = 'block';
        map.invalidateSize(); // Comando Vital: Ajusta o mapa ao aparecer novamente

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

        // --- PASSO 3: LISTA E MARCADORES (INICIAL/FINAL) ---
        data.checkpoints.forEach((item, index) => {

            const isStart = index === 0;
            const isEnd = index === data.checkpoints.length - 1;

            // Adiciona marcador apenas no Início e Fim
            if (isStart || isEnd) {
                const marker = L.marker([item.lat, item.lng]).addTo(markersLayer);

                // Ícone diferente ou Texto no Popup
                const title = isStart ? "🚩 Partida" : "🏁 Chegada";

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

            resultsDiv.innerHTML += `
                <div class="timeline-item">
                    <div class="time-badge">
                        ${item.formattedTime.split(' ')[0]}<br>
                        <small>${item.formattedTime.split(' ')[1] || ''}</small>
                    </div>
                    <div class="info">
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
        // Garante que o mapa continue escondido se der erro
        mapDiv.style.display = 'none';
    }
}
