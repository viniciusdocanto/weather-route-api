export let map = null;
export let routeLayer = null;
export let markersLayer = null;

export function initMap() {
    map = L.map('map').setView([-14.235, -51.925], 4);

    // Provedor CartoDB Voyager (mais estável e visual premium)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
}

export function updateMapRoute(routeGeoJSON, isFirstSearch) {
    if (routeLayer) map.removeLayer(routeLayer);

    routeLayer = L.geoJSON({
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates: routeGeoJSON
        }
    }, {
        style: { color: '#6366f1', weight: 6, opacity: 0.8 }
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
