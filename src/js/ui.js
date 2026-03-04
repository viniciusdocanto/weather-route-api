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
        }, 500);
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
