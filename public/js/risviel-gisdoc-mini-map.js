/**
 * File: risviel-gisdoc-mini-map.js
 * Mini-mappa SEMPLIFICATA con navigazione senza refresh
 */

(function($) {
    'use strict';

    // Configurazione della mini-mappa
    const miniMapConfig = {
        enabled: true,
        size: 220,
        position: 'bottom-right',
        opacity: 0.9,
        borderRadius: 12,
        zoomLevel: 20,
        searchRadius: 5000,
        debug: true
    };

    // Stato della mini-mappa
    let miniMapInitialized = false;
    let panoramaContainers = [];
    let mapInstance = null;
    let currentPanoramaData = null;
    let allNearbyPoints = [];
    let currentPanoramaId = null;

    // Esposizione globale
    window.risvielMiniMap = {
        config: miniMapConfig,
        instance: mapInstance,
        initialized: false,
        updateCurrentPanorama: updateCurrentPanorama
    };

    // Inizializza al caricamento della pagina
    $(document).ready(function() {
        setTimeout(initializeMiniMap, 1000);
    });

    /**
     * Inizializza la mini-mappa per la vista panorama
     */
    function initializeMiniMap() {
        if (miniMapInitialized) return;

        findPanoramaContainers();
        if (panoramaContainers.length === 0) {
            if (miniMapConfig.debug) {
                console.log('🗺️ Nessun panorama trovato, riprovo...');
            }
            setTimeout(initializeMiniMap, 1000);
            return;
        }

        currentPanoramaId = getCurrentPanoramaId();
        if (!currentPanoramaId) {
            if (miniMapConfig.debug) {
                console.log('🗺️ Nessun ID panorama trovato, riprovo...');
            }
            setTimeout(initializeMiniMap, 1000);
            return;
        }

        if (miniMapConfig.debug) {
            console.log('🗺️ Inizializzando mini-mappa per panorama ID:', currentPanoramaId);
        }

        addMiniMapStyles();
        loadPanoramaPointsDirectly(currentPanoramaId);

        miniMapInitialized = true;
        window.risvielMiniMap.initialized = true;
        console.log("🗺️ Mini-mappa panorama inizializzata!");
    }

    /**
     * Carica i punti direttamente come fa la mappa principale
     */
    function loadPanoramaPointsDirectly(panoramaId) {
        if (!window.risviel_gisdoc_public) {
            console.error('🗺️ risviel_gisdoc_public non disponibile');
            return;
        }

        const defaultLat = parseFloat(risviel_gisdoc_public.map_center_lat) || 41.9028;
        const defaultLng = parseFloat(risviel_gisdoc_public.map_center_lng) || 12.4964;
        const searchRadius = 50000;

        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const language = urlParams.get('lang') || 'it';

        if (miniMapConfig.debug) {
            console.log('🗺️ Caricando punti con centro di default:', defaultLat, defaultLng);
            console.log('🗺️ Cercando panorama con ID:', panoramaId);
        }
 
        $.ajax({
            url: risviel_gisdoc_public.ajax_url,
            type: 'POST',
            data: {
                action: 'risviel_gisdoc_get_map_points',
                nonce: risviel_gisdoc_public.nonce,
                lat: defaultLat,
                lng: defaultLng,
                radius: searchRadius,
                language: language
            },
            success: function(response) {
                if (miniMapConfig.debug) {
                    console.log('🗺️ Risposta completa endpoint:', response);
                }

                if (response.success && response.data && response.data.length > 0) {
                    allNearbyPoints = response.data;

                    if (miniMapConfig.debug && allNearbyPoints.length > 0) {
                        console.log('🔍 Struttura del primo punto ricevuto:', allNearbyPoints[0]);
                        console.log('🔍 Tutte le chiavi disponibili:', Object.keys(allNearbyPoints[0]));
                    }

                    const currentPoint = findCurrentPanorama(allNearbyPoints, panoramaId);

                    if (currentPoint) {
                        const lat = parseFloat(currentPoint.lat);
                        const lng = parseFloat(currentPoint.lng);

                        if (!isNaN(lat) && !isNaN(lng)) {
                            if (miniMapConfig.debug) {
                                console.log('✅ Trovato panorama corrente:', currentPoint.title, lat, lng);
                            }

                            currentPanoramaData = {
                                title: currentPoint.title,
                                description: currentPoint.description,
                                lat: lat,
                                lng: lng
                            };

                            createMiniMap(lat, lng);
                            addAllMapMarkers();
                        }
                    } else {
                        console.error('🗺️ Panorama corrente NON TROVATO nei punti caricati');

                        if (allNearbyPoints.length > 0) {
                            const firstPoint = allNearbyPoints[0];
                            const lat = parseFloat(firstPoint.lat);
                            const lng = parseFloat(firstPoint.lng);

                            if (!isNaN(lat) && !isNaN(lng)) {
                                console.log('🔄 FALLBACK: Usando il primo punto disponibile:', firstPoint.title);

                                currentPanoramaData = {
                                    title: firstPoint.title,
                                    description: firstPoint.description,
                                    lat: lat,
                                    lng: lng
                                };
                                createMiniMap(lat, lng);
                                addAllMapMarkers();
                            }
                        }
                    }
                }
            },
            error: function(xhr, status, error) {
                console.error('❌ Errore caricamento punti mappa:', error);
            }
        });
    }

    /**
     * Funzione di ricerca panorama corrente
     */
    function findCurrentPanorama(points, searchId) {
        if (!points || !searchId) return null;

        const searchIdStr = String(searchId);
        const searchIdNum = parseInt(searchId, 10);

        for (const point of points) {
            if (point.panorama_id && (
                point.panorama_id === searchId ||
                point.panorama_id === searchIdStr ||
                point.panorama_id === searchIdNum ||
                String(point.panorama_id) === searchIdStr ||
                parseInt(point.panorama_id, 10) === searchIdNum
            )) {
                return point;
            }

            if (point.id && (
                point.id === searchId ||
                point.id === searchIdStr ||
                point.id === searchIdNum ||
                String(point.id) === searchIdStr ||
                parseInt(point.id, 10) === searchIdNum
            )) {
                return point;
            }
        }

        return null;
    }

    /**
     * Crea la mini-mappa
     */
    function createMiniMap(centerLat, centerLng) {
        const miniMapElement = $(`
            <div id="risviel-minimap-panorama" class="risviel-mini-map ${miniMapConfig.position}">
                <div class="minimap-title">📍 La tua posizione</div>
            </div>
        `);

        $('body').append(miniMapElement);

        const map = L.map('risviel-minimap-panorama', {
            center: [centerLat, centerLng],
            zoom: miniMapConfig.zoomLevel,
            minZoom: 10,
            maxZoom: 18,
            zoomControl: false,
            attributionControl: false,
            dragging: true,
            touchZoom: true,
            doubleClickZoom: false,
            scrollWheelZoom: true
        });

        L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google',
            maxZoom: 20
        }).addTo(map);

        mapInstance = {
            leafletMap: map,
            markers: [],
            center: { lat: centerLat, lng: centerLng }
        };
    }

    /**
     * Aggiunge marker alla mappa
     */
    function addAllMapMarkers() {
        if (!mapInstance || !allNearbyPoints.length) return;

        const map = mapInstance.leafletMap;

        allNearbyPoints.forEach(point => {
            const lat = parseFloat(point.lat);
            const lng = parseFloat(point.lng);

            if (isNaN(lat) || isNaN(lng)) return;

            const isCurrent = isCurrentPanorama(point, currentPanoramaId);
            let marker;

            if (isCurrent) {
                marker = L.circleMarker([lat, lng], {
                    radius: 8,
                    fillColor: '#ff4444',
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9,
                    className: 'current-position-dot'
                }).addTo(map);
            } else {
                marker = L.circleMarker([lat, lng], {
                    radius: 5,
                    fillColor: '#4488ff',
                    color: '#ffffff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8,
                    className: 'nearby-panorama-dot'
                }).addTo(map);

                const panoramaIdToNavigate = point.panorama_id || point.id;
                if (panoramaIdToNavigate) {
                    marker.on('click', function(e) {
                        e.originalEvent.preventDefault();
                        e.originalEvent.stopPropagation();
                        navigateToPanoramaWithoutRefresh(panoramaIdToNavigate);
                    });
                }
            }

            mapInstance.markers.push(marker);
        });
    }

    /**
     * Controlla se un punto è corrente
     */
    function isCurrentPanorama(point, searchId) {
        if (!point || !searchId) return false;

        const searchIdStr = String(searchId);
        const searchIdNum = parseInt(searchId, 10);

        return (
            (point.panorama_id && (
                point.panorama_id === searchId ||
                String(point.panorama_id) === searchIdStr ||
                parseInt(point.panorama_id, 10) === searchIdNum
            )) ||
            (point.id && (
                point.id === searchId ||
                String(point.id) === searchIdStr ||
                parseInt(point.id, 10) === searchIdNum
            ))
        );
    }

    /**
     * ✅ NAVIGAZIONE SEMPLIFICATA - Usa la funzione globale esposta
     */
    function navigateToPanoramaWithoutRefresh(panoramaId) {
        if (miniMapConfig.debug) {
            console.log('🚀 Navigando al panorama senza refresh:', panoramaId);
        }

        // ✅ CONTROLLA se la funzione è disponibile
        if (typeof window.loadPanoramaData !== 'function') {
            console.error('❌ Sistema panorama non disponibile per navigazione senza refresh');
            // Fallback: ricarica la pagina
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('id', panoramaId);
            window.location.href = currentUrl.toString();
            return;
        }

        // 1. Aggiorna l'URL senza ricaricare la pagina
        const currentUrl = new URL(window.location.href);
        const language = currentUrl.searchParams.get('lang') || 'it';
        currentUrl.searchParams.set('id', panoramaId);

        window.history.pushState(
            { panoramaId: panoramaId, language: language },
            '',
            currentUrl.toString()
        );

        // 2. Trova il primo container del panorama
        const firstViewer = Object.keys(window.panoramaViewers || {})[0];
        if (!firstViewer) {
            console.error('🗺️ Nessun viewer panorama trovato');
            return;
        }

        // 3. ✅ USA LA FUNZIONE GLOBALE ESPOSTA
        try {
            if (miniMapConfig.debug) {
                console.log('✅ Chiamando loadPanoramaData globale');
            }

            window.loadPanoramaData(firstViewer, panoramaId, language);

            // 4. Aggiorna la mini-mappa
            updateCurrentPanorama(panoramaId);

        } catch (error) {
            console.error('❌ Errore durante il caricamento panorama:', error);

            // Fallback in caso di errore
            const fallbackUrl = new URL(window.location.href);
            fallbackUrl.searchParams.set('id', panoramaId);
            window.location.href = fallbackUrl.toString();
        }
    }

    /**
     * Aggiorna panorama corrente nella mini-mappa
     */
    function updateCurrentPanorama(newPanoramaId) {
        if (!mapInstance || !allNearbyPoints.length) return;

        currentPanoramaId = newPanoramaId;

        if (miniMapConfig.debug) {
            console.log('🗺️ Aggiornando mini-mappa per nuovo panorama:', newPanoramaId);
        }

        // Rimuovi tutti i marker esistenti
        mapInstance.markers.forEach(marker => {
            mapInstance.leafletMap.removeLayer(marker);
        });
        mapInstance.markers = [];

        // Trova il nuovo punto corrente
        const newCurrentPoint = findCurrentPanorama(allNearbyPoints, newPanoramaId);

        if (newCurrentPoint) {
            const lat = parseFloat(newCurrentPoint.lat);
            const lng = parseFloat(newCurrentPoint.lng);

            if (!isNaN(lat) && !isNaN(lng)) {
                // Aggiorna i dati del panorama corrente
                currentPanoramaData = {
                    title: newCurrentPoint.title,
                    description: newCurrentPoint.description,
                    lat: lat,
                    lng: lng
                };

                // Centra la mappa sulla nuova posizione
                mapInstance.leafletMap.setView([lat, lng], miniMapConfig.zoomLevel);
                mapInstance.center = { lat: lat, lng: lng };

                // Ri-aggiungi tutti i marker
                addAllMapMarkers();

                if (miniMapConfig.debug) {
                    console.log('🗺️ Mini-mappa aggiornata per:', newCurrentPoint.title);
                }
            }
        }
    }

    /**
     * Trova container panorami
     */
    function findPanoramaContainers() {
        panoramaContainers = [];
        $('.risviel-panorama').each(function() {
            panoramaContainers.push(this);
        });
    }

    /**
     * Ottiene ID panorama corrente
     */
    function getCurrentPanoramaId() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlPanoramaId = urlParams.get('id');
        if (urlPanoramaId) return urlPanoramaId;

        for (const container of panoramaContainers) {
            if (container.dataset.id) {
                return container.dataset.id;
            }
        }

        return null;
    }

    /**
     * Aggiunge stili CSS
     */
    function addMiniMapStyles() {
        if (document.getElementById('risviel-minimap-panorama-styles')) return;

        const css = `
            .risviel-mini-map {
                position: fixed;
                width: ${miniMapConfig.size}px;
                height: ${miniMapConfig.size}px;
                border-radius: ${miniMapConfig.borderRadius}px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                z-index: 10000;
                opacity: ${miniMapConfig.opacity};
                transition: all 0.3s ease;
                border: 3px solid rgba(64, 200, 255, 0.8);
                backdrop-filter: blur(10px);
                background: rgba(0, 0, 0, 0.1);
            }
            
            .risviel-mini-map:hover {
                opacity: 1;
                border-color: rgba(64, 200, 255, 1);
            }
            
            .risviel-mini-map.bottom-right {
                bottom: 20px;
                right: 20px;
            }
            
            .minimap-title {
                position: absolute;
                top: 5px;
                left: 5px;
                right: 5px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                font-size: 11px;
                font-weight: bold;
                text-align: center;
                padding: 4px;
                border-radius: 6px;
                z-index: 1000;
                border: 1px solid rgba(64, 200, 255, 0.5);
            }
            
            .current-position-dot {
                animation: pulse-red 2s infinite;
                cursor: default !important;
            }

            @keyframes pulse-red {
                0% {
                    box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7);
                }
                70% {
                    box-shadow: 0 0 0 10px rgba(255, 68, 68, 0);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(255, 68, 68, 0);
                }
            }

            .nearby-panorama-dot {
                cursor: pointer !important;
                transition: none !important;
            }

            .nearby-panorama-dot:hover {
                fill-opacity: 1 !important;
                stroke-width: 2 !important;
            }

            .risviel-mini-map .leaflet-control-container {
                display: none !important;
            }
            
            .risviel-mini-map .leaflet-control-attribution {
                display: none !important;
            }

            .risviel-mini-map .leaflet-control-zoom {
                display: none !important;
            }

            .risviel-mini-map .leaflet-popup {
                display: none !important;
            }

            .risviel-mini-map .leaflet-tooltip {
                display: none !important;
            }

            .risviel-mini-map .leaflet-interactive {
                pointer-events: auto !important;
            }
        `;

        const style = document.createElement('style');
        style.id = 'risviel-minimap-panorama-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

})(jQuery);