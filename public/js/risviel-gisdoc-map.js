/**
 * Script per il front-end di Risviel GisDoc
 *
 * @since      1.0.0
 */

(function($) {
    'use strict';

    // Variabili globali
    let maps = {};
    let kioskTileManager = null;

    /**
     * Classe per gestire le tile offline del kiosko
     */
    class KioskOfflineTileManager {
        constructor() {
            this.dbName = 'risviel-kiosk-tiles';
            this.version = 1;
            this.db = null;
        }

        async init() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, this.version);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    this.db = request.result;
                    resolve();
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('tiles')) {
                        const store = db.createObjectStore('tiles', { keyPath: 'key' });
                        store.createIndex('layer', 'layer', { unique: false });
                    }
                };
            });
        }

        async getTile(coords, layerName) {
            if (!this.db) await this.init();

            const transaction = this.db.transaction(['tiles'], 'readonly');
            const store = transaction.objectStore('tiles');

            return new Promise((resolve, reject) => {
                const request = store.get(`${layerName}_${coords.z}_${coords.x}_${coords.y}`);

                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? result.blob : null);
                };

                request.onerror = () => reject(request.error);
            });
        }

        async storeTile(coords, blob, layerName) {
            if (!this.db) await this.init();

            const transaction = this.db.transaction(['tiles'], 'readwrite');
            const store = transaction.objectStore('tiles');

            return new Promise((resolve, reject) => {
                const request = store.put({
                    key: `${layerName}_${coords.z}_${coords.x}_${coords.y}`,
                    layer: layerName,
                    z: coords.z,
                    x: coords.x,
                    y: coords.y,
                    blob: blob,
                    timestamp: Date.now()
                });

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        // Metodo per pre-scaricare tiles in un'area specifica
        async preloadAreaTiles(bounds, layerUrl, layerName, minZoom, maxZoom, onProgress) {
            const tiles = this.generateTileList(bounds, minZoom, maxZoom);
            let downloaded = 0;

            console.log(`Scaricando ${tiles.length} tile per ${layerName}...`);

            for (const tile of tiles) {
                try {
                    const url = this.formatTileUrl(layerUrl, tile);
                    const response = await fetch(url);

                    if (response.ok) {
                        const blob = await response.blob();
                        await this.storeTile(tile, blob, layerName);
                    }

                    downloaded++;
                    if (onProgress) {
                        onProgress(downloaded, tiles.length, layerName);
                    }

                    // Piccola pausa per non sovraccaricare
                    await new Promise(resolve => setTimeout(resolve, 50));

                } catch (error) {
                    console.error(`Errore scaricando tile ${tile.x},${tile.y},${tile.z}:`, error);
                }
            }

            console.log(`Completato download per ${layerName}: ${downloaded}/${tiles.length} tile`);
        }

        generateTileList(bounds, minZoom, maxZoom) {
            const tiles = [];

            for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
                const nwPoint = this.latLngToTileCoords(bounds.getNorthWest(), zoom);
                const sePoint = this.latLngToTileCoords(bounds.getSouthEast(), zoom);

                for (let x = nwPoint.x; x <= sePoint.x; x++) {
                    for (let y = nwPoint.y; y <= sePoint.y; y++) {
                        tiles.push({ x, y, z: zoom });
                    }
                }
            }

            return tiles;
        }

        latLngToTileCoords(latlng, zoom) {
            const tileSize = 256;
            const scale = 1 << zoom;
            const worldCoordinate = this.project(latlng);

            return {
                x: Math.floor((worldCoordinate.x * scale) / tileSize),
                y: Math.floor((worldCoordinate.y * scale) / tileSize)
            };
        }

        project(latlng) {
            const siny = Math.sin((latlng.lat * Math.PI) / 180);
            const y = 0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI);
            const x = (latlng.lng + 180) / 360;
            return { x, y };
        }

        formatTileUrl(template, tile) {
            const subdomains = ['a', 'b', 'c'];
            const subdomain = subdomains[Math.abs(tile.x + tile.y) % subdomains.length];

            return template
                .replace('{s}', subdomain)
                .replace('{x}', tile.x)
                .replace('{y}', tile.y)
                .replace('{z}', tile.z);
        }
    }

    /**
     * Tile Layer offline personalizzato per kiosko
     */
    L.TileLayer.RisvielOffline = L.TileLayer.extend({
        initialize: function (urlTemplate, options) {
            L.TileLayer.prototype.initialize.call(this, urlTemplate, options);
            this.layerName = options.layerName || 'default';
            this.fallbackToOnline = options.fallbackToOnline || false;
        },

        createTile: function (coords, done) {
            const tile = document.createElement('img');

            // Prova prima a caricare dalla cache offline
            kioskTileManager.getTile(coords, this.layerName).then(cachedBlob => {
                if (cachedBlob) {
                    tile.src = URL.createObjectURL(cachedBlob);
                    done(null, tile);
                } else if (this.fallbackToOnline) {
                    // Fallback online se abilitato
                    this.loadOnlineTile(tile, coords, done);
                } else {
                    // Mostra placeholder
                    tile.src = this.createPlaceholderTile();
                    done(null, tile);
                }
            }).catch(error => {
                console.error('Errore caricando tile offline:', error);
                if (this.fallbackToOnline) {
                    this.loadOnlineTile(tile, coords, done);
                } else {
                    tile.src = this.createPlaceholderTile();
                    done(null, tile);
                }
            });

            return tile;
        },

        loadOnlineTile: function(tile, coords, done) {
            const url = this.getTileUrl(coords);

            fetch(url)
                .then(response => {
                    if (response.ok) {
                        return response.blob();
                    }
                    throw new Error('Tile non disponibile');
                })
                .then(blob => {
                    // Salva nella cache per uso futuro
                    kioskTileManager.storeTile(coords, blob, this.layerName);
                    // Mostra la tile
                    tile.src = URL.createObjectURL(blob);
                    done(null, tile);
                })
                .catch(error => {
                    console.error('Errore caricando tile online:', error);
                    tile.src = this.createPlaceholderTile();
                    done(null, tile);
                });
        },

        createPlaceholderTile: function() {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, 0, 256, 256);
            ctx.fillStyle = '#95a5a6';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Risviel GisDoc', 128, 120);
            ctx.font = '12px Arial';
            ctx.fillText('Tile non disponibile', 128, 140);

            return canvas.toDataURL();
        }
    });

    /**
     * Aggiunge il controllo filtro alla mappa come controllo Leaflet
     */
    function addFilterControl(map, language) {
        const FilterControl = L.Control.extend({
            options: {
                position: 'bottomleft'
            },

            onAdd: function(mapInstance) {
                const container = L.DomUtil.create('div', 'leaflet-legend leaflet-bar leaflet-control leaflet-legend-expanded');
                container.style.backgroundColor = 'rgb(255, 255, 255)';
                container.id = 'risviel-map-filters';
                container.setAttribute('role', 'group');
                container.setAttribute('aria-label', language === 'en' ? 'Filter points by category' : 'Filtra punti per categoria');

                // Previeni propagazione eventi alla mappa
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);

                // Placeholder durante il caricamento
                const title = language === 'en' ? 'Filter by category' : 'Filtra per categoria';
                container.innerHTML = `
                    <section class="leaflet-legend-contents">
                        <h3 class="leaflet-legend-title">${title}</h3>
                        <div class="risviel-filter-loading" style="padding: 20px; text-align: center; color: #666;">
                            ${language === 'en' ? 'Loading...' : 'Caricamento...'}
                        </div>
                    </section>
                `;

                // Carica le categorie via AJAX
                loadFilterCategories(container, language);

                return container;
            }
        });

        new FilterControl().addTo(map);
    }

    /**
     * Carica le categorie per il filtro via AJAX
     */
    function loadFilterCategories(container, language) {
        $.ajax({
            url: risviel_gisdoc_public.ajax_url,
            type: 'POST',
            dataType: 'json',
            data: {
                action: 'risviel_gisdoc_get_filter_categories',
                nonce: risviel_gisdoc_public.nonce,
                language: language
            },
            success: function(response) {
                if (response.success && response.data && response.data.length > 0) {
                    renderFilterInControl(container, response.data, language);
                } else {
                    container.querySelector('.risviel-filter-loading').textContent =
                        language === 'en' ? 'No categories available' : 'Nessuna categoria disponibile';
                }
            },
            error: function() {
                container.querySelector('.risviel-filter-loading').textContent =
                    language === 'en' ? 'Error loading filters' : 'Errore caricamento filtri';
            }
        });
    }

    /**
     * Renderizza il filtro nel controllo Leaflet
     */
    function renderFilterInControl(container, categories, language) {
        const title = language === 'en' ? 'Filter by category' : 'Filtra per categoria';
        const resetText = language === 'en' ? 'Reset' : 'Reset';
        const allText = language === 'en' ? 'All' : 'Tutti';

        let html = `
            <section class="leaflet-legend-contents">
                <div class="risviel-filters-header">
                    <h3 class="leaflet-legend-title risviel-filters-title">${title}</h3>
                    <!--div class="risviel-filters-actions">
                        <button type="button" class="risviel-filter-btn risviel-filter-btn--reset" id="risviel-filter-reset">
                            $ {resetText}
                        </button>
                        <button type="button" class="risviel-filter-btn risviel-filter-btn--all" id="risviel-filter-all">
                            $ {allText}
                        </button>
                    </div-->
                </div>
                <div class="leaflet-legend-column risviel-filters-list">
        `;

        categories.forEach(function(category) {
            const iconHtml = category.icon
                ? `<img src="${category.icon}" alt="" class="risviel-filter-icon" loading="lazy">`
                : `<span class="risviel-filter-color" style="background-color: ${category.color}"></span>`;

            html += `
                <label class="leaflet-legend-item risviel-filter-item"
                       role="checkbox"
                       aria-checked="false"
                       tabindex="0"
                       style="--category-color: ${category.color}">
                    <input type="checkbox"
                           name="risviel_category[]"
                           value="${category.id}"
                           class="risviel-filter-checkbox">
                    <span class="risviel-filter-indicator"></span>
                    ${iconHtml}
                    <span class="risviel-filter-name">${category.name}</span>
                </label>
            `;
        });

        html += `
                </div>
            </section>
        `;

        container.innerHTML = html;

        // Bind eventi direttamente qui
        bindFilterEvents(container);
    }

    /**
     * Bind eventi per il filtro integrato
     */
    function bindFilterEvents(container) {
        // Evento change sui checkbox
        container.addEventListener('change', function(event) {
            if (event.target.type !== 'checkbox') return;

            updateFilterUI(event.target);
            applyMapFilter();
        });

        // Pulsante Reset
        const resetBtn = container.querySelector('#risviel-filter-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                const checkboxes = container.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(function(cb) {
                    cb.checked = false;
                    updateFilterUI(cb);
                });
                applyMapFilter();
            });
        }

        // Pulsante Tutti
        const allBtn = container.querySelector('#risviel-filter-all');
        if (allBtn) {
            allBtn.addEventListener('click', function() {
                const checkboxes = container.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(function(cb) {
                    cb.checked = true;
                    updateFilterUI(cb);
                });
                applyMapFilter();
            });
        }

        // Touch events per mobile
        container.addEventListener('touchend', function(event) {
            const label = event.target.closest('.risviel-filter-item');
            if (!label) return;

            event.preventDefault();
            const checkbox = label.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                updateFilterUI(checkbox);
                applyMapFilter();
            }
        }, { passive: false });
    }

    /**
     * Aggiorna l'UI del checkbox
     */
    function updateFilterUI(checkbox) {
        const label = checkbox.closest('.risviel-filter-item');
        if (!label) return;

        if (checkbox.checked) {
            label.classList.add('is-active');
            label.setAttribute('aria-checked', 'true');
        } else {
            label.classList.remove('is-active');
            label.setAttribute('aria-checked', 'false');
        }
    }

    /**
     * Applica il filtro ai marker della mappa
     */
    function applyMapFilter() {
        const container = document.getElementById('risviel-map-filters');
        if (!container) return;

        const checkedBoxes = container.querySelectorAll('input[type="checkbox"]:checked');
        const selectedCategories = Array.from(checkedBoxes).map(cb => String(cb.value));

        if (!window.risvielMap || !window.risvielMap.markers) {
            console.warn('Markers not available');
            return;
        }

        const markersLayer = window.risvielMap.markersLayer;
        const allMarkers = window.risvielMap.markers;

        if (!markersLayer || !allMarkers.length) return;

        const showAll = selectedCategories.length === 0;

        allMarkers.forEach(function(markerData) {
            const marker = markerData.marker;
            const markerCategories = markerData.categories || [];

            let shouldShow = showAll;

            if (!showAll) {
                shouldShow = markerCategories.some(function(catId) {
                    return selectedCategories.includes(String(catId));
                });
            }

            if (shouldShow) {
                if (!markersLayer.hasLayer(marker)) {
                    markersLayer.addLayer(marker);
                }
                if (marker._icon) {
                    marker._icon.style.opacity = '1';
                    marker._icon.style.pointerEvents = 'auto';
                }
            } else {
                if (marker._icon) {
                    marker._icon.style.opacity = '0';
                    marker._icon.style.pointerEvents = 'none';
                }
                setTimeout(function() {
                    if (marker._icon && marker._icon.style.opacity === '0') {
                        markersLayer.removeLayer(marker);
                    }
                }, 300);
            }
        });
    }



    /**
     * Inizializza la mappa Leaflet
     *
     * @param {string} mapId - ID del container della mappa
     * @param {object} options - Opzioni della mappa
     */
    async function initMap(mapId, options) {
        const mapElement = document.getElementById(mapId);

        if (!mapElement) return;

        // Inizializza il tile manager offline se non è già stato fatto
        if (!kioskTileManager) {
            kioskTileManager = new KioskOfflineTileManager();
            await kioskTileManager.init();
        }

        const for_totem = mapElement.dataset.for_totem; //Parametro utilizzato per chiamare il panorama 360

        const language = mapElement.dataset.lang || 'it';
        const mapCenter = [
            parseFloat(risviel_gisdoc_public.map_center_lat),
            parseFloat(risviel_gisdoc_public.map_center_lng)
        ];
        const mapZoom = parseInt(risviel_gisdoc_public.map_zoom);

        // Controlla se siamo in modalità kiosko (puoi aggiungere una variabile di configurazione)
        const isKioskMode = risviel_gisdoc_public.kiosk_mode === 'true' || false;

        // Inizializza la mappa Leaflet
        const map = L.map(mapId, {
            center: mapCenter,
            zoom: mapZoom,
            minZoom: 3,
            maxZoom: 19,
            zoomControl: false
        });

        // Definisci i layer di base
        let baseLayers;
        // Crea un layerGroup per i marker
        const markersLayer = L.layerGroup().addTo(map);

        // Espone subito le reference globali per il filtro
        window.risvielMap = window.risvielMap || {};
        window.risvielMap.map = map;
        window.risvielMap.markersLayer = markersLayer;
        window.risvielMap.markers = [];

        if (isKioskMode) {
            // Usa layer offline per kiosko
            baseLayers = {
                "Mappa stradale": new L.TileLayer.RisvielOffline('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19,
                    layerName: 'osm',
                    fallbackToOnline: false // Nessun fallback online per kiosko
                }),

                "Satellitare (Google)": new L.TileLayer.RisvielOffline('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                    attribution: '&copy; Google',
                    maxZoom: 20,
                    layerName: 'satellite',
                    fallbackToOnline: false
                })
            };
        } else {
            // Usa layer online normali
            baseLayers = {
                "Mappa stradale": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19
                }),

                "Satellitare (Google)": L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                    attribution: '&copy; Google',
                    maxZoom: 20
                })
            };
        }

        // Aggiungi il layer di default (mappa stradale)
        baseLayers["Mappa stradale"].addTo(map);

        // Aggiungi il controllo dei layer
        const layerControl = L.control.layers(baseLayers, null, {
            position: 'topright',
            collapsed: false
        }).addTo(map);

        let title_legend = 'Filtra per categoria';
        if(language === 'en'){
            title_legend = 'Filter by category';
        }

        addFilterControl(map, title_legend, language);

        // Aggiungi controllo per download offline se non in modalità kiosko
        if (!isKioskMode) {
           // addOfflineDownloadControl(map);
        }

        // Salva la mappa nell'oggetto maps
        maps[mapId] = {
            leafletMap: map,
            language: language,
            for_totem: for_totem,
            markers: [],          // array di marker Leaflet
            markerObjects: [],    // array di {marker, categories}
            markersLayer: markersLayer,
            baseLayers: baseLayers,
            layerControl: layerControl,
            isKioskMode: isKioskMode
        };

        // Espone per il filtro (compatibilità)
        window.risvielMap = {
            map: map,
            markersLayer: markersLayer,
            markers: maps[mapId].markerObjects
        };

        // Carica i punti sulla mappa
        loadMapPoints(mapId);
    }


    /**
     * Aggiunge controllo per download offline
     */
    function addOfflineDownloadControl(map) {
        const downloadControl = L.control({ position: 'bottomright' });

        downloadControl.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'leaflet-control leaflet-control-custom');
            div.innerHTML = `
                <button id="risviel-download-offline" style="
                    background: #2c3e50; 
                    color: white; 
                    border: none; 
                    padding: 10px 15px; 
                    border-radius: 5px; 
                    cursor: pointer;
                    font-size: 12px;
                ">
                    📥 Scarica Offline
                </button>
            `;
            div.style.background = 'none';
            div.style.border = 'none';

            div.onclick = function() {
                downloadCurrentAreaOffline(map);
            };

            return div;
        };

        downloadControl.addTo(map);
    }

    /**
     * Scarica l'area corrente per uso offline
     */
    async function downloadCurrentAreaOffline(map) {
        const bounds = map.getBounds();
        const currentZoom = map.getZoom();
        const button = document.getElementById('risviel-download-offline');

        if (!kioskTileManager) {
            kioskTileManager = new KioskOfflineTileManager();
            await kioskTileManager.init();
        }

        // Mostra progresso
        const originalText = button.textContent;
        button.textContent = 'Scaricando...';
        button.disabled = true;

        try {
            // Scarica OSM tiles
            await kioskTileManager.preloadAreaTiles(
                bounds,
                'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'osm',
                Math.max(1, currentZoom - 2),
                Math.min(19, currentZoom + 2),
                (downloaded, total, layerName) => {
                    button.textContent = `${layerName}: ${downloaded}/${total}`;
                }
            );

            // Scarica Google Satellite tiles
            await kioskTileManager.preloadAreaTiles(
                bounds,
                'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                'satellite',
                Math.max(1, currentZoom - 2),
                Math.min(20, currentZoom + 2),
                (downloaded, total, layerName) => {
                    button.textContent = `${layerName}: ${downloaded}/${total}`;
                }
            );

            button.textContent = 'Completato!';
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('Errore durante il download:', error);
            button.textContent = 'Errore!';
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
            }, 2000);
        }
    }

    function applyFilter() {
            // Riaggancia markersLayer e markers se non ancora disponibili
            if (!state.markersLayer && window.risvielMap && window.risvielMap.markersLayer) {
                state.markersLayer = window.risvielMap.markersLayer;
            }
            if ((!state.allMarkers || !state.allMarkers.length) && window.risvielMap && window.risvielMap.markers) {
                state.allMarkers = window.risvielMap.markers;
            }

            // Se ancora non disponibili, esci senza errori
            if (!state.markersLayer || !state.allMarkers) {
                console.warn('Markers layer not available');
                return;
            }

            // Se nessuna categoria selezionata, mostra tutto
            const showAll = state.selectedCategories.length === 0;

            state.allMarkers.forEach(markerData => {
                const marker = markerData.marker;
                const markerCategories = markerData.categories || [];

                let shouldShow = showAll;

                if (!showAll) {
                    // Logica OR
                    shouldShow = markerCategories.some(catId =>
                        state.selectedCategories.includes(String(catId))
                    );
                }

                if (shouldShow) {
                    showMarker(marker);
                } else {
                    hideMarker(marker);
                }
            });

            document.dispatchEvent(new CustomEvent('risviel:filterApplied', {
                detail: {
                    selectedCategories: state.selectedCategories,
                    visibleCount: state.allMarkers.filter(m => m.visible).length
                }
            }));
        }

    /**
     * Carica i punti sulla mappa tramite AJAX
     *
     * @param {string} mapId - ID del container della mappa
     */
    function loadMapPoints(mapId) {
        const mapData = maps[mapId];

        if (!mapData) return;

        const map = mapData.leafletMap;

        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const lang = urlParams.get('lang');
        const language = (lang!== null && lang !=='') ? lang : mapData.language;

        // Ottieni il centro e il raggio visibile della mappa
        const center = map.getCenter();
        const bounds = map.getBounds();
        const radius = center.distanceTo(bounds.getNorthEast()); // Raggio in metri

        // Richiedi i punti al server
        $.ajax({
            url: risviel_gisdoc_public.ajax_url,
            type: 'POST',
            dataType: 'json', // <-- AGGIUNTO: forza il parsing JSON automatico
            data: {
                action: 'risviel_gisdoc_get_map_points',
                nonce: risviel_gisdoc_public.nonce,
                lat: center.lat,
                lng: center.lng,
                radius: radius,
                language: language
            },
            success: function(response) {
                console.log('[MAP DEBUG] AJAX response:', response);
                console.log('[MAP DEBUG] response.success:', response.success);
                console.log('[MAP DEBUG] response.data length:', response.data?.length);

                if (response.success && response.data) {
                    clearMapMarkers(mapId);
                    response.data.forEach(function(point) {
                        addMapMarker(mapId, point);
                    });

                    // riallinea per sicurezza
                    const mapData = maps[mapId];
                    window.risvielMap.markers = mapData.markerObjects;
                    window.risvielMap.markersLayer = mapData.markersLayer;

                    console.log('[MAP DEBUG] Dopo caricamento:', {
                        markerObjectsCount: mapData.markerObjects.length,
                        markersLayerCount: mapData.markersLayer.getLayers().length
                    });

                    // applica il filtro se presente
                    if (window.risvielFilter && typeof window.risvielFilter.applyFilter === 'function') {
                        console.log('[MAP DEBUG] Chiamo risvielFilter.applyFilter()');
                        window.risvielFilter.applyFilter();
                    }
                } else {
                    console.error('[MAP DEBUG] Risposta non valida:', response);
                }
            },
            error: function(xhr, status, error) {
                console.error('Errore nel caricamento dei punti:', error);
                console.error('Status:', status);
                console.error('Response:', xhr.responseText);
            }
        });
    }

    /**
     * Rimuove tutti i marker dalla mappa
     *
     * @param {string} mapId - ID del container della mappa
     */
    function clearMapMarkers(mapId) {
        const mapData = maps[mapId];
        if (!mapData) return;

        mapData.markersLayer.clearLayers();
        mapData.markers = [];        // <-- mantieni markers come array
        mapData.markerObjects = [];

        window.risvielMap.markers = mapData.markerObjects;
        window.risvielMap.markersLayer = mapData.markersLayer;
    }

    /**
     * Aggiunge un marker alla mappa
     *
     * @param {string} mapId - ID del container della mappa
     * @param {object} point - Dati del punto
     */
    function addMapMarker(mapId, point) {
        const mapData = maps[mapId];

        if (!mapData) return;

        const map = mapData.leafletMap;

        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const lang = urlParams.get('lang');
        const language = (lang!== null && lang !=='') ? lang : mapData.language;
        const for_totem = mapData.for_totem ?? true;

        // Crea un'icona personalizzata se specificata
        let markerOptions = {
            title: point.title
        };

        if (point.custom_icon) {
            markerOptions.icon = L.icon({
                iconUrl: point.custom_icon,
                shadowUrl: risviel_gisdoc_public.plugin_url + 'assets/leaflet/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
        }

        // Crea il marker
        const marker = L.marker([point.lat, point.lng], markerOptions);
        marker.addTo(mapData.markersLayer);

        // Salva il marker nell'array markers
        mapData.markers.push(marker);

        // Salva dati per il filtro (UNA SOLA VOLTA)
        const categories = (point.category_ids || []).map(String);
        mapData.markerObjects.push({ marker: marker, categories: categories, visible: true });

        // Aggiorna l'oggetto globale per il filtro
        window.risvielMap.markers = mapData.markerObjects;
        window.risvielMap.markersLayer = mapData.markersLayer;
        window.risvielMap.map = mapData.leafletMap;

        // Aggiungi popup con le informazioni del punto
        let popupContent = `<div class="risviel-map-popup">
                               <h3>${point.title}</h3>`;

        if (point.description) {
            popupContent += `<div class="description">${point.description}</div>`;
        }

        if (point.audio) {
            popupContent += `<audio controls autoplay style="width: 100%;">
                            <source src="${point.audio}" type="audio/mpeg">
                            Il tuo browser non supporta il tag audio.
                        </audio>`;
        }

        // Se c'è un panorama associato, aggiungi l'icona PULSANTE
        if (point.panorama_id) {
            popupContent += `<div class="panorama-link">
                       <img src="${risviel_gisdoc_public.plugin_url}assets/leaflet/images/virtual-tour-icon.png" 
                           class="risviel-view-panorama risviel-pulse-icon"
                           data-panorama-id="${point.panorama_id}" 
                           data-lang="${language}" 
                           data-for-totem="${for_totem}"
                           alt="Visualizza panorama"
                           title="Clicca per aprire il panorama 360°"
                           style="cursor:pointer; width:40px; height:auto; transition: all 0.3s ease;">
                     </div>`;
        }

        popupContent += '</div>';

        marker.bindPopup(popupContent);
    }

    /**
     * ✅ NUOVA: Funzione per creare gli stili CSS per l'animazione pulsante - TEMA DARK SENZA SFONDO
     */
    function addPulseAnimation() {
        // Controlla se gli stili sono già stati aggiunti
        if (document.getElementById('risviel-pulse-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'risviel-pulse-styles';
        style.textContent = `
            /* Animazione pulsante per l'icona panorama - TEMA DARK SENZA SFONDO */
            @keyframes risviel-pulse {
                0% {
                    transform: scale(1);
                    box-shadow: 0 0 0 0 rgba(64, 200, 255, 0.8);
                }
                50% {
                    transform: scale(1.05);
                    box-shadow: 0 0 0 10px rgba(64, 200, 255, 0.4);
                }
                100% {
                    transform: scale(1);
                    box-shadow: 0 0 0 0 rgba(64, 200, 255, 0);
                }
            }
    
            @keyframes risviel-glow {
                0%, 100% {
                    filter: drop-shadow(0 0 8px rgba(64, 200, 255, 0.6));
                }
                50% {
                    filter: drop-shadow(0 0 20px rgba(64, 200, 255, 0.9));
                }
            }
    
            /* Classe per l'icona pulsante - SENZA SFONDO */
            .risviel-pulse-icon {
                animation: risviel-pulse 2s infinite, risviel-glow 2s infinite;
                border-radius: 10px;
                background: transparent !important;
                padding: 5px;
                border: 2px solid rgba(64, 200, 255, 0.5);
                transition: all 0.3s ease !important;
            }
    
            /* Effetti hover - SENZA SFONDO */
            .risviel-pulse-icon:hover {
                animation-play-state: paused;
                transform: scale(1.15) !important;
                filter: drop-shadow(0 0 25px rgba(64, 200, 255, 1)) !important;
                border-color: rgba(64, 200, 255, 1) !important;
                background: transparent !important;
                box-shadow: 0 0 0 3px rgba(64, 200, 255, 0.3) !important;
            }
    
            /* Effetto click - SENZA SFONDO */
            .risviel-pulse-icon:active {
                transform: scale(0.92) !important;
                filter: drop-shadow(0 0 15px rgba(64, 200, 255, 0.8)) !important;
                box-shadow: 0 0 0 1px rgba(64, 200, 255, 0.6) !important;
                background: transparent !important;
            }
    
            /* Responsive: su mobile riduci intensità */
            @media (max-width: 768px) {
                .risviel-pulse-icon {
                    animation-duration: 2.5s;
                    padding: 4px;
                }
                
                @keyframes risviel-pulse {
                    0% {
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(64, 200, 255, 0.6);
                    }
                    50% {
                        transform: scale(1.03);
                        box-shadow: 0 0 0 8px rgba(64, 200, 255, 0.3);
                    }
                    100% {
                        transform: scale(1);
                        box-shadow: 0 0 0 0 rgba(64, 200, 255, 0);
                    }
                }
            }
    
            /* Stili per il container del popup - TEMA DARK */
            .risviel-map-popup {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center;
                min-width: 200px;
            }
    
            .risviel-map-popup h3 {
                margin: 0 0 12px 0;
                color: #e5e5e5;
                font-size: 17px;
                font-weight: 600;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            }
    
            .risviel-map-popup .description {
                margin: 12px 0;
                color: #b8b8b8;
                font-size: 14px;
                line-height: 1.5;
            }
    
            .panorama-link {
                margin-top: 18px;
                padding: 12px;
                background: transparent;
                border-radius: 14px;
                border: 1px solid rgba(64, 200, 255, 0.3);
                position: relative;
            }
    
            /* Tooltip migliorato - TEMA DARK */
            .risviel-pulse-icon[title]:hover::after {
                content: attr(title);
                position: absolute;
                bottom: -40px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(15, 15, 15, 0.95);
                color: #e5e5e5;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 12px;
                white-space: nowrap;
                z-index: 1000;
                pointer-events: none;
                border: 1px solid rgba(64, 200, 255, 0.4);
                backdrop-filter: blur(5px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            }
    
            /* Effetto shimmer per attirare l'attenzione - SOLO BORDO */
            @keyframes risviel-shimmer {
                0% {
                    border-color: rgba(64, 200, 255, 0.5);
                }
                50% {
                    border-color: rgba(64, 200, 255, 1);
                }
                100% {
                    border-color: rgba(64, 200, 255, 0.5);
                }
            }
    
            .risviel-pulse-icon {
                animation: risviel-pulse 2s infinite, risviel-glow 2s infinite, risviel-shimmer 3s infinite;
            }
    
            /* Touch feedback per mobile - SENZA SFONDO */
            .risviel-pulse-icon.touch-active {
                transform: scale(0.95);
                filter: drop-shadow(0 0 20px rgba(64, 200, 255, 1));
                border-color: rgba(64, 200, 255, 1);
                background: transparent !important;
            }
    
            /* Accessibilità per focus - SENZA SFONDO */
            .risviel-pulse-icon:focus {
                outline: none;
                box-shadow: 0 0 0 3px rgba(64, 200, 255, 0.5);
                background: transparent !important;
            }
    
            /* Audio controls styling per tema dark */
            .risviel-map-popup audio {
                filter: invert(1) hue-rotate(180deg);
                border-radius: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    // Inizializzazione quando il documento è pronto
    $(document).ready(function() {
        // ✅ AGGIUNGI: Carica gli stili per l'animazione pulsante
        addPulseAnimation();

        // Inizializza tutte le mappe
        $('.risviel-map').each(function() {
            const mapId = $(this).attr('id');
            initMap(mapId);
        });

        // Gestisci il click sul pulsante "Visualizza panorama" nei popup della mappa
        $(document).on('click', '.risviel-view-panorama', function(e) {
            e.preventDefault();

            const panoramaId = $(this).data('panorama-id');
            const language = $(this).data('lang') || 'it';
            const for_totem = $(this).data('forTotem') ?? true;

            // ✅ AGGIUNGI: Feedback visivo immediato
            const $icon = $(this);
            $icon.css({
                'transform': 'scale(0.9)',
                'filter': 'drop-shadow(0 0 15px rgba(0, 122, 255, 1))'
            });

            // Apri il panorama dopo un breve delay per mostrare l'effetto
            setTimeout(() => {
                openPanoramaModal(panoramaId, language, for_totem);
            }, 150);
        });

        // ✅ AGGIUNGI: Hover feedback per touch devices
        $(document).on('touchstart', '.risviel-view-panorama', function() {
            $(this).addClass('touch-active');
        });

        $(document).on('touchend', '.risviel-view-panorama', function() {
            $(this).removeClass('touch-active');
        });
    });


   /**
 * Apre la pagina del panorama con i parametri corretti
 *
 * @param {number} panoramaId - ID del panorama
 * @param {string} language - Lingua richiesta
 */
function openPanoramaModal(panoramaId, language, for_totem = "true") {
    // Ottieni l'URL base della pagina panorama
    const panoramaPageId = risviel_gisdoc_public.panorama_page_id || ''; // Questo valore dovrebbe essere impostato in PHP
console.log(for_totem);
    // Costruisci l'URL con i parametri
    let url = `${window.location.origin}/wp/${language}/touchscreen-foto-panoramica-360-${language}/?id=${panoramaId}&lang=${language}`;

    if(for_totem === false) {
        url = `${window.location.origin}/wp/${language}/foto-panoramica-360-${language}/?id=${panoramaId}&lang=${language}`;
    }
    /*
    if (panoramaPageId) {
        // Se è stato configurato un ID di pagina specifico
        url = `${window.location.origin}${window.location.pathname}../${panoramaPageId}?id=${panoramaId}&lang=${language}`;
    } else {
        // Altrimenti, utilizza la pagina corrente e aggiungi solo i parametri
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('id', panoramaId);
        currentUrl.searchParams.set('lang', language);
        url = currentUrl.toString();
    }
*/
    // Naviga alla pagina del panorama
    window.location.href = url;
}

    // Inizializza quando la pagina è completamente caricata
    $(window).on('load', function() {
        // Aggiorna le dimensioni di tutte le mappe
        Object.keys(maps).forEach(function(mapId) {
            if (maps[mapId] && maps[mapId].leafletMap) {
                maps[mapId].leafletMap.invalidateSize();
            }
        });
    });

})(jQuery);