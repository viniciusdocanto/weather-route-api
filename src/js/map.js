export let map = null;
export let routeLayer = null;
export let markersLayer = null;

export function initMap() {
    map = L.map('map').setView([-14.235, -51.925], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
}

export function updateMapRoute(routeGeoJSON, isFirstSearch) {
    if (routeLayer) map.removeLayer(routeLayer);

    routeLayer = L.geoJSON(routeGeoJSON, {
        style: { color: '#1a73e8', weight: 5, opacity: 0.8 }
    }).addTo(map);

    map.invalidateSize();

    try {
        const bounds = routeLayer.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], animate: !isFirstSearch });
        }
    } catch (e) {
        console.warn("Erro ao calcular bounds:", e);
    }
}

export function clearMarkers() {
    markersLayer.clearLayers();
}

export function addMarker(lat, lng, title, locationName, temp, condition) {
    const marker = L.marker([lat, lng]).addTo(markersLayer);
    marker.bindPopup(`
        <div style="text-align:center;">
            <strong>${title}</strong><br>
            ${locationName}<br>
            <span style="font-size:1.2em">${condition} ${temp}°C</span>
        </div>
    `);
}
