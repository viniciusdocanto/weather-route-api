import { searchAddress } from './api.js';

let stopCount = 0;

export function setupAutocomplete(inputId, listId) {
    let debounceTimer;
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);

    if (!input || !list) return;

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
        }, 300);
    });
    document.addEventListener('click', (e) => { if (e.target !== input) list.classList.add('hidden'); });
}

export function bindStopsUI() {
    window.adicionarParada = function () {
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
    };

    window.removerParada = function (id) {
        const div = document.getElementById(`group-${id}`);
        if (div) {
            div.classList.add('opacity-0', 'scale-95');
            setTimeout(() => div.remove(), 200);
        }
    };
}
export function renderCheckpoint(item, index, total) {
    const isStart = index === 0;
    const isEnd = index === total - 1;
    const isIntermediateStop = !isStart && !isEnd && item.isStopNode;

    let kmText = (item.distanceFromStart === 0) ? `Km 0` : `Km ${item.distanceFromStart || '--'}`;

    let statusLabel = '';
    if (isStart) {
        statusLabel = '<span class="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1 inline-block">📍 Partida</span>';
    } else if (isEnd) {
        statusLabel = '<span class="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1 inline-block">🏁 Chegada</span>';
    } else if (isIntermediateStop) {
        statusLabel = '<span class="text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1 inline-block">📌 Parada</span>';
    }

    const borderClass = isIntermediateStop ? 'border-teal-400' : 'border-indigo-200';
    const dotClass = isIntermediateStop ? 'bg-teal-400 ring-4 ring-teal-50' : 'bg-indigo-400 ring-4 ring-indigo-50';

    return `
        <div class="relative pl-6 pb-8 border-l-2 ${borderClass} last:border-0 last:pb-0 group">
            <div class="absolute left-[-9px] top-1 w-4 h-4 rounded-full ${dotClass} shadow-sm transition-transform group-hover:scale-125"></div>
            
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
}
