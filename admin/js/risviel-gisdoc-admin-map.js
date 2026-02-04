/**
 * File: risviel-gisdoc-admin-map.js
 * Gestione della mappa e dei punti sulla mappa per GisDoc
 */

(function($) {
    'use strict';

    // Variabili globali
    let map = null;
    let markers = {};
    let currentPointId = null;
    let tempMarker = null;
    let panoramaPreviewTimeout = null;
    let mapInitialized = false;
    let editMode = false;
    let allPoints = []; // Conserva tutti i punti per i filtri
    // Configurazione
    const mapConfig = {
        defaultLat: parseFloat(risviel_gisdoc_admin.map_center_lat) || 0,
        defaultLng: parseFloat(risviel_gisdoc_admin.map_center_lng) || 0,
        defaultZoom: parseInt(risviel_gisdoc_admin.map_zoom) || 13
    };

    // Definizione delle icone dei marker
    const markerIcons = {
        default: L.icon({
            iconUrl: risviel_gisdoc_admin.plugin_url + 'assets/leaflet/images/marker-icon.png',
            shadowUrl: risviel_gisdoc_admin.plugin_url + 'assets/leaflet/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        }),
        active: L.icon({
            iconUrl: risviel_gisdoc_admin.plugin_url + 'assets/leaflet/images/marker-icon-red.png',
            shadowUrl: risviel_gisdoc_admin.plugin_url + 'assets/leaflet/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        }),
        invisible: L.icon({
            iconUrl: risviel_gisdoc_admin.plugin_url + 'assets/leaflet/images/marker-icon-gray.png',
            shadowUrl: risviel_gisdoc_admin.plugin_url + 'assets/leaflet/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        }),
        editable: L.icon({
            iconUrl: risviel_gisdoc_admin.plugin_url + 'assets/leaflet/images/marker-icon-green.png',
            shadowUrl: risviel_gisdoc_admin.plugin_url + 'assets/leaflet/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        })
    };

    // Esponi le funzioni globalmente
    window.risvielMapFunctions = {
        initMap: initMap,
        loadAllPoints: loadAllPoints,
        loadPanoramasList: loadPanoramasList,
        clearPointForm: clearPointForm,
        savePoint: savePoint,
        deletePoint: deletePoint,
        loadMapPoints: loadMapPoints,
        setEditMode: setEditMode,
        selectPoint: selectPoint,
        applyFilters: applyFilters,
        currentPointId: () => currentPointId
    };

    // Inizializza al caricamento della pagina
    $(document).ready(function() {
        if ($('#risviel-admin-map').length > 0 && !mapInitialized) {
            initMap();
            loadAllPoints();
            loadPanoramasList();
            setupEventListeners();
        }
    });

    /**
     * Configura gli event listeners
     */
    function setupEventListeners() {
        // Gestione delle tab
        $('.risviel-tab-header').on('click', function() {
            const tab = $(this).data('tab');
            $('.risviel-tab-header').removeClass('active');
            $('.risviel-tab-content').removeClass('active');
            $(this).addClass('active');
            $('.risviel-tab-content[data-tab="' + tab + '"]').addClass('active');
        });

        // Pulsanti principali
        $('#risviel-new-point').on('click', clearPointForm);
        $('#risviel-save-point').on('click', savePoint);
        $('#risviel-delete-point').on('click', function() {
            if (confirm('Sei sicuro di voler eliminare questo punto?')) {
                deletePoint();
            }
        });
        $('#risviel-edit-point').on('click', function() {
            setEditMode(true);
        });
        $('#risviel-cancel-edit').on('click', function() {
            if (currentPointId) {
                selectPoint(currentPointId);
            } else {
                clearPointForm();
            }
        });

        // Ricerca e filtri
        $('#risviel-points-search').on('input', applyFilters);
        $('#risviel-filter-visible, #risviel-filter-with-panorama').on('change', applyFilters);

        // Gestione selezione panorama
        $('#risviel-point-panorama-id').on('change', function() {
            const panoramaId = $(this).val();
            if (panoramaId) {
                showPanoramaPreview(panoramaId);
            } else {
                hidePanoramaPreview();
            }
        });

        // Gestione icona personalizzata
        setupIconSelector();

        // Gestione file audio per tutte le lingue
        setupAudioSelectors();

        // Gestione coordinate input
        $('#risviel-point-lat, #risviel-point-lng').on('change', function() {
            const lat = parseFloat($('#risviel-point-lat').val());
            const lng = parseFloat($('#risviel-point-lng').val());

            if (!isNaN(lat) && !isNaN(lng)) {
                updateMarkerPosition(lat, lng);
            }
        });
    }

    /**
     * Applica filtri su lista e mappa
     */
    function applyFilters() {
        const searchTerm = $('#risviel-points-search').val().toLowerCase();
        const visibleOnly = $('#risviel-filter-visible').is(':checked');
        const withPanoramaOnly = $('#risviel-filter-with-panorama').is(':checked');

        const filteredPoints = allPoints.filter(function(point) {
            // Filtro ricerca testuale
            const title = (point.title_it || point.title_en || point.title_sa || '').toLowerCase();
            const matchesSearch = !searchTerm || title.includes(searchTerm);

            // Filtro visibilità
            const matchesVisible = !visibleOnly || (point.visible == 't' || point.visible == true || point.visible == 1);

            // Filtro panorama
            const matchesPanorama = !withPanoramaOnly || (point.panorama_id && point.panorama_id != '' && point.panorama_id != '0');

            return matchesSearch && matchesVisible && matchesPanorama;
        });

        // Aggiorna lista
        updatePointsList(filteredPoints);

        // Aggiorna mappa
        updateMapMarkers(filteredPoints);
    }

    /**
     * Aggiorna marker sulla mappa in base ai filtri
     */
    function updateMapMarkers(filteredPoints) {
        // Nascondi tutti i marker
        Object.values(markers).forEach(function(marker) {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });

        // Mostra solo i marker filtrati
        filteredPoints.forEach(function(point) {
            if (markers[point.id] && !map.hasLayer(markers[point.id])) {
                map.addLayer(markers[point.id]);
            }
        });
    }

    /**
     * Inizializza la mappa
     */
    function initMap() {
        if (mapInitialized || map !== null) return;

        const mapContainer = document.getElementById('risviel-admin-map');
        if (!mapContainer) {
            console.error('Container mappa non trovato');
            return;
        }

        if (typeof L === 'undefined') {
            console.error('Leaflet non disponibile');
            return;
        }

        if (mapContainer._leaflet_id) {
            if (map) {
                map.remove();
                map = null;
            }
            mapContainer._leaflet_id = null;
            mapContainer.innerHTML = '';
        }

        try {
            map = L.map('risviel-admin-map', {
                center: [mapConfig.defaultLat, mapConfig.defaultLng],
                zoom: mapConfig.defaultZoom
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            L.control.scale().addTo(map);

            // Evento click sulla mappa
            map.on('click', function(e) {
                const latlng = e.latlng;
                $('#risviel-point-lat').val(latlng.lat.toFixed(6));
                $('#risviel-point-lng').val(latlng.lng.toFixed(6));

                // Se non c'è un punto selezionato, crea un nuovo punto
                if (!currentPointId) {
                    clearPointForm();
                    $('#risviel-point-lat').val(latlng.lat.toFixed(6));
                    $('#risviel-point-lng').val(latlng.lng.toFixed(6));

                    if (tempMarker) {
                        map.removeLayer(tempMarker);
                    }

                    tempMarker = L.marker(latlng, {
                        icon: markerIcons.active,
                        draggable: true
                    }).addTo(map);

                    tempMarker.on('dragend', function(e) {
                        const position = e.target.getLatLng();
                        $('#risviel-point-lat').val(position.lat.toFixed(6));
                        $('#risviel-point-lng').val(position.lng.toFixed(6));
                    });

                    setEditMode(true);
                }
            });

            mapInitialized = true;
            console.log('Mappa inizializzata con successo');

        } catch (error) {
            console.error('Errore nell\'inizializzazione della mappa:', error);
        }
    }

    /**
     * Carica tutti i punti
     */
    function loadAllPoints() {
        if (!map) {
            console.log('Mappa non ancora inizializzata per loadAllPoints');
            return;
        }

        $.ajax({
            url: risviel_gisdoc_admin.ajax_url,
            type: 'POST',
            dataType: 'json', // forza il parsing JSON
            data: {
                action: 'risviel_gisdoc_get_all_map_points',
                nonce: risviel_gisdoc_admin.nonce
            },
            success: function (response) {
                // Se per qualche motivo arriva come stringa, prova a fare il parse
                if (typeof response === 'string') {
                    try {
                        response = JSON.parse(response);
                    } catch (e) {
                        console.error('Parsing JSON fallito', e);
                        allPoints = [];
                        updatePointsList([]);
                        return;
                    }
                }

                if (response && response.success === true && Array.isArray(response.data)) {
                    allPoints = response.data;
                    addMarkersToMap(allPoints);
                    applyFilters();
                } else {
                    console.error('Errore nel caricamento dei punti:', response);
                    allPoints = [];
                    updatePointsList([]);
                }
            },
            error: function (xhr, status, error) {
                console.error('Errore AJAX nel caricamento punti:', error, xhr.responseText);
                allPoints = [];
                updatePointsList([]);
            }
        });
    }

    /**
     * Carica lista panorami
     */
    function loadPanoramasList() {
        $.ajax({
            url: risviel_gisdoc_admin.ajax_url,
            type: 'POST',
            data: {
                action: 'risviel_gisdoc_get_all_panoramas',
                nonce: risviel_gisdoc_admin.nonce
            },
            success: function(response) {
                if (response.success && response.data) {
                    updatePanoramasSelect(response.data);
                } else {
                    console.error('Errore nel caricamento panorami:', response);
                }
            },
            error: function(xhr, status, error) {
                console.error('Errore AJAX nel caricamento panorami:', error);
            }
        });
    }

    /**
     * Aggiorna select panorami
     */
    function updatePanoramasSelect(panoramas) {
        const $select = $('#risviel-point-panorama-id');
        const currentValue = $select.val();

        $select.find('option:not(:first)').remove();

        if (panoramas && panoramas.length > 0) {
            panoramas.forEach(function(panorama) {
                const name = panorama.name || panorama.title_it || panorama.title_en || panorama.title_sa || 'Panorama senza nome';
                $select.append('<option value="' + panorama.id + '">' + escapeHtml(name) + '</option>');
            });
        }

        if (currentValue && $select.find('option[value="' + currentValue + '"]').length > 0) {
            $select.val(currentValue);
        }
    }

    /**
     * Aggiorna lista punti
     */
    function updatePointsList(points) {
        const $list = $('#risviel-points-list');
        $list.empty();

        if (!points || points.length === 0) {
            $list.append('<li class="empty">Nessun punto trovato</li>');
            return;
        }

        points.forEach(function(point) {
            if (!point.id) return;

            const $item = $('<li>').attr('data-point-id', point.id);
            const title = point.title_it || point.title_en || point.title_sa || 'Punto senza titolo';

            // Le coordinate arrivano dal backend come lat/lng direttamente
            const lat = parseFloat(point.lat) || 0;
            const lng = parseFloat(point.lng) || 0;

            // Icona di stato
            let statusIcon = '●'; // Punto visibile
            let statusColor = '#28a745'; // Verde
            if (!(point.visible == 't' || point.visible == true || point.visible == 1)) {
                statusIcon = '●';
                statusColor = '#9ba2b6'; // Grigio
            }
            if (point.panorama_id && point.panorama_id != '' && point.panorama_id != '0') {
                statusIcon += '📷'; // Ha panorama
            }

            $item.html(
                '<div class="point-info">' +
                '<div class="point-title">' +
                '<span style="color: ' + statusColor + '; margin-right: 10px; font-size: 2em;">' + statusIcon + '</span>' +
                escapeHtml(title) +
                '</div>' +
                '<div class="point-coords">' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</div>' +
                '</div>'
            );

            $item.on('click', function() {
                selectPoint(point.id);
            });

            $list.append($item);
        });
    }

    /**
     * Aggiunge marker alla mappa
     */
    function addMarkersToMap(points) {
        // Rimuovi marker esistenti
        Object.values(markers).forEach(function(marker) {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });
        markers = {};

        // Aggiungi nuovi marker
        if (points && points.length > 0) {
            points.forEach(function(point) {
                addMarkerToMap(point);
            });
        }
    }

    /**
     * Aggiunge singolo marker
     */
    function addMarkerToMap(point) {
        if (!map || !point.id) return;

        // Le coordinate arrivano dal backend come lat/lng direttamente
        const lat = parseFloat(point.lat) || 0;
        const lng = parseFloat(point.lng) || 0;

        if (lat === 0 && lng === 0) return;

        let icon = markerIcons.default;
        if (point.custom_icon) {
            icon = L.icon({
                iconUrl: point.custom_icon,
                shadowUrl: risviel_gisdoc_admin.plugin_url + 'assets/leaflet/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
        } else if (!(point.visible == 't' || point.visible == true || point.visible == 1)) {
            icon = markerIcons.invisible;
        }

        const marker = L.marker([lat, lng], { icon: icon }).addTo(map);
        const title = point.title_it || point.title_en || point.title_sa || 'Punto senza titolo';
        marker.bindPopup('<b>' + escapeHtml(title) + '</b><br>ID: ' + point.id);

        marker.on('click', function() {
            selectPoint(point.id);
        });

        markers[point.id] = marker;
    }

    /**
     * Seleziona punto
     */
    function selectPoint(pointId) {
        if (!pointId) return;

        $.ajax({
            url: risviel_gisdoc_admin.ajax_url,
            type: 'POST',
            dataType: 'json',
            data: {
                action: 'risviel_gisdoc_get_map_point',
                nonce: risviel_gisdoc_admin.nonce,
                point_id: pointId
            },
            success: function (response) {
                // Se arriva come stringa, prova a fare il parse
                if (typeof response === 'string') {
                    try {
                        response = JSON.parse(response);
                    } catch (e) {
                        console.error('Parsing JSON fallito per il punto:', e);
                        return;
                    }
                }

                // Accetta success come boolean o stringa "true"
                if (response && (response.success === true || response.success === 'true') && response.data) {
                    try {
                        zoomToPoint(response.data);
                        fillPointForm(response.data);
                        highlightPointInList(pointId);
                        highlightMarkerOnMap(pointId);
                    } catch (err) {
                        console.error('Errore durante il riempimento del form punto:', err);
                    }
                } else {
                    console.error('Errore nel caricamento del punto:', response);
                }
            },
            error: function (xhr, status, error) {
                console.error('Errore AJAX nel caricamento punto:', error, xhr.responseText);
            }
        });
    }

    /**
     * Zoom su punto
     */
    function zoomToPoint(point) {
        if (!map || !point) return;

        // Le coordinate arrivano dal backend come lat/lng direttamente
        const lat = parseFloat(point.lat) || 0;
        const lng = parseFloat(point.lng) || 0;

        if (lat !== 0 || lng !== 0) {
            map.setView([lat, lng], 18);
        }
    }

/**
 * Riempie form con dati punto
 */
function fillPointForm(point) {
    currentPointId = point.id;

    // Le coordinate arrivano dal backend come lat/lng direttamente
    const lat = parseFloat(point.lat) || 0;
    const lng = parseFloat(point.lng) || 0;


    // Categorie: reset e set
    $('input[name="point_categories[]"]').prop('checked', false);
    if (point.category_ids && Array.isArray(point.category_ids)) {
        point.category_ids.forEach(function (catId) {
            $('input[name="point_categories[]"][value="' + catId + '"]').prop('checked', true);
        });
    }

    // Dati base
    $('#risviel-point-id').val(point.id);
    $('#risviel-point-lat').val(lat.toFixed(6));
    $('#risviel-point-lng').val(lng.toFixed(6));
    $('#risviel-point-visible').prop('checked', point.visible == 't' || point.visible == true || point.visible == 1);
    $('#risviel-point-custom-icon').val(point.custom_icon || '');
    $('#risviel-point-panorama-id').val(point.panorama_id || '');

    // Titoli
    $('#risviel-point-title-it').val(point.title_it || '');
    $('#risviel-point-title-en').val(point.title_en || '');
    $('#risviel-point-title-sa').val(point.title_sa || '');

    // Descrizioni con TinyMCE - gestione migliorata
    const editors = [
        {id: 'risviel-point-description-it', field: 'description_it'},
        {id: 'risviel-point-description-en', field: 'description_en'},
        {id: 'risviel-point-description-sa', field: 'description_sa'}
    ];

    if (typeof tinyMCE !== 'undefined') {
        editors.forEach(function(editorInfo) {
            const content = point[editorInfo.field] || '';

            // Prima imposta il valore nel textarea
            $('#' + editorInfo.id).val(content);

            // Poi cerca di aggiornare l'editor TinyMCE
            const waitForEditor = function(attempts) {
                if (attempts > 50) { // Limite tentativi
                    console.log('Timeout: editor ' + editorInfo.id + ' non disponibile, usando textarea');
                    return;
                }

                const editor = tinyMCE.get(editorInfo.id);
                if (editor && editor.initialized) {
                    editor.setContent(content);
                    console.log('Contenuto impostato per editor ' + editorInfo.id + ':', content.substring(0, 100));
                } else {
                    // Riprova dopo 100ms
                    setTimeout(function() {
                        waitForEditor(attempts + 1);
                    }, 100);
                }
            };

            waitForEditor(0);
        });
    } else {
        // Fallback senza TinyMCE
        editors.forEach(function(editorInfo) {
            const content = point[editorInfo.field] || '';
            $('#' + editorInfo.id).val(content);
        });
    }

    // File audio
    $('#risviel-point-audio-it').val(point.audio_it || '');
    $('#risviel-point-audio-en').val(point.audio_en || '');
    $('#risviel-point-audio-sa').val(point.audio_sa || '');

    // Anteprima icona personalizzata
    updateIconPreview(point.custom_icon);

    // Anteprima file audio
    updateAudioPreviews({
        'it': point.audio_it,
        'en': point.audio_en,
        'sa': point.audio_sa
    });

    // Anteprima panorama se selezionato
    if (point.panorama_id) {
        showPanoramaPreview(point.panorama_id);
    } else {
        hidePanoramaPreview();
    }

    // Rimuovi marker temporaneo se esiste
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }

    setEditMode(false);
}


/**
 * Cancella selezione e ripristina marker
 */
function clearPointForm() {
    // Ripristina marker del punto precedentemente selezionato
    if (currentPointId && markers[currentPointId]) {
        const originalPoint = allPoints.find(p => p.id == currentPointId);
        if (originalPoint) {
            let icon = markerIcons.default;
            if (originalPoint.custom_icon) {
                icon = L.icon({
                    iconUrl: originalPoint.custom_icon,
                    shadowUrl: risviel_gisdoc_admin.plugin_url + 'assets/leaflet/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                });
            } else if (!(originalPoint.visible == 't' || originalPoint.visible == true || originalPoint.visible == 1)) {
                icon = markerIcons.invisible;
            }
            markers[currentPointId].setIcon(icon);
            markers[currentPointId].dragging.disable();
            markers[currentPointId].off('dragend');
        }
    }

    currentPointId = null;

    // Campi base
    $('#risviel-point-id').val('');
    $('#risviel-point-lat').val('');
    $('#risviel-point-lng').val('');
    $('#risviel-point-visible').prop('checked', true);
    $('#risviel-point-custom-icon').val('');
    $('#risviel-point-panorama-id').val('');

    // Titoli
    $('#risviel-point-title-it').val('');
    $('#risviel-point-title-en').val('');
    $('#risviel-point-title-sa').val('');

    // Descrizioni con TinyMCE
    const editors = ['risviel-point-description-it', 'risviel-point-description-en', 'risviel-point-description-sa'];

    if (typeof tinyMCE !== 'undefined') {
        editors.forEach(function(editorId) {
            // Prima svuota il textarea
            $('#' + editorId).val('');

            // Poi l'editor TinyMCE se disponibile
            const editor = tinyMCE.get(editorId);
            if (editor && editor.initialized) {
                editor.setContent('');
            }
        });
    } else {
        // Fallback senza TinyMCE
        editors.forEach(function(editorId) {
            $('#' + editorId).val('');
        });
    }

    // File audio
    $('#risviel-point-audio-it').val('');
    $('#risviel-point-audio-en').val('');
    $('#risviel-point-audio-sa').val('');

    // Pulisci anteprime
    updateIconPreview('');
    updateAudioPreviews({});
    hidePanoramaPreview();

    // Deseleziona nella lista
    $('#risviel-points-list li').removeClass('selected');

    // Rimuovi marker temporaneo
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }

    setEditMode(true);
}


/**
 * Salva punto con gestione migliorata di TinyMCE
 */
function savePoint() {
    // Verifica dati richiesti
    const lat = $('#risviel-point-lat').val();
    const lng = $('#risviel-point-lng').val();
    const titleIt = $('#risviel-point-title-it').val();

    if (!lat || !lng) {
        alert('Latitudine e longitudine sono obbligatorie');
        return;
    }

    if (!titleIt.trim()) {
        alert('Il titolo in italiano è obbligatorio');
        return;
    }

    // Forza il salvataggio del contenuto di TinyMCE
    if (typeof tinyMCE !== 'undefined') {
        tinyMCE.triggerSave();
    }
    // Raccogli categorie selezionate
    const selectedCategories = [];
    $('input[name="point_categories[]"]:checked').each(function () {
        selectedCategories.push($(this).val());
    });

    const pointData = {
        action: 'risviel_gisdoc_save_map_point',
        nonce: risviel_gisdoc_admin.nonce,
        point_id: $('#risviel-point-id').val() || '',
        lat: lat,
        lng: lng,
        visible: $('#risviel-point-visible').is(':checked') ? 1 : 0,
        custom_icon: $('#risviel-point-custom-icon').val() || '',
        panorama_id: $('#risviel-point-panorama-id').val() || '',
        title_it: titleIt,
        title_en: $('#risviel-point-title-en').val() || '',
        title_sa: $('#risviel-point-title-sa').val() || '',
        audio_it: $('#risviel-point-audio-it').val() || '',
        audio_en: $('#risviel-point-audio-en').val() || '',
        audio_sa: $('#risviel-point-audio-sa').val() || '',
        point_categories: selectedCategories
    };

    // Recupera contenuto TinyMCE con metodo più robusto
    const editors = [
        {id: 'risviel-point-description-it', field: 'description_it'},
        {id: 'risviel-point-description-en', field: 'description_en'},
        {id: 'risviel-point-description-sa', field: 'description_sa'}
    ];

    if (typeof tinyMCE !== 'undefined') {
        editors.forEach(function(editorInfo) {
            const editor = tinyMCE.get(editorInfo.id);
            let content = '';

            if (editor) {
                if (editor.initialized) {
                    // Editor completamente inizializzato
                    content = editor.getContent();
                } else {
                    // Editor non ancora inizializzato, prova dal textarea
                    content = $('#' + editorInfo.id).val() || '';
                }
            } else {
                // Nessun editor trovato, usa il textarea direttamente
                content = $('#' + editorInfo.id).val() || '';
            }

            pointData[editorInfo.field] = content;
            console.log('Contenuto editor ' + editorInfo.id + ':', content.substring(0, 100) + (content.length > 100 ? '...' : ''));
        });
    } else {
        // Fallback senza TinyMCE
        editors.forEach(function(editorInfo) {
            pointData[editorInfo.field] = $('#' + editorInfo.id).val() || '';
        });
    }

    // Debug: log dei dati che stiamo inviando
    console.log('Dati punto da salvare:', pointData);

    $.ajax({
        url: risviel_gisdoc_admin.ajax_url,
        type: 'POST',
        data: pointData,
        dataType: 'json',
        success: function (response) {

            // Se la risposta è stringa, prova il parse
            if (typeof response === 'string') {
                try {
                    response = JSON.parse(response);
                } catch (e) {
                }
            }

            if (response && (response.success === true || response.success === 'true')) {
                // Ricarica punti
                loadAllPoints();

                // Aggiorna ID se nuovo
                if (!currentPointId && response.data && response.data.point_id) {
                    currentPointId = response.data.point_id;
                    $('#risviel-point-id').val(currentPointId);
                }

                // Rimuovi marker temporaneo
                if (tempMarker) {
                    map.removeLayer(tempMarker);
                    tempMarker = null;
                }

                setEditMode(false);
                alert(response.data && response.data.message ? response.data.message : 'Punto salvato con successo!');
            } else {
                console.error('Errore nel salvataggio:', response);
                alert('Errore nel salvataggio del punto: ' + (response && response.data && response.data.message ? response.data.message : 'Errore sconosciuto'));
            }
        },
        error: function (xhr, status, error) {
            console.error('Errore AJAX nel salvataggio:', error);
            alert('Errore di connessione durante il salvataggio: ' + error);
        }
    });
}

    /**
     * Elimina punto
     */
    function deletePoint() {
        if (!currentPointId) {
            alert('Nessun punto selezionato da eliminare');
            return;
        }

        $.ajax({
            url: risviel_gisdoc_admin.ajax_url,
            type: 'POST',
            data: {
                action: 'risviel_gisdoc_delete_map_point',
                nonce: risviel_gisdoc_admin.nonce,
                point_id: currentPointId
            },
            success: function(response) {
                if (response.success) {
                    loadAllPoints();
                    clearPointForm();
                    alert('Punto eliminato con successo!');
                } else {
                    alert('Errore nell\'eliminazione del punto: ' + (response.data && response.data.message ? response.data.message : 'Errore sconosciuto'));
                }
            },
            error: function(xhr, status, error) {
                alert('Errore di connessione durante l\'eliminazione: ' + error);
            }
        });
    }

    /**
 * Imposta modalità edit
 */
function setEditMode(isEdit) {
    editMode = isEdit;

    if (isEdit) {
        $('#risviel-save-point').show();
        $('#risviel-cancel-edit').show();
        $('#risviel-edit-point').hide();
        $('#risviel-delete-point').hide();
        $('#risviel-point-form input, #risviel-point-form select, #risviel-point-form textarea').prop('disabled', false);

        // Se c'è un punto selezionato, rendilo verde e trascinabile
        if (currentPointId && markers[currentPointId]) {
            markers[currentPointId].setIcon(markerIcons.editable);
            markers[currentPointId].dragging.enable();

            // Aggiungi event listener per il trascinamento
            markers[currentPointId].off('dragend'); // Rimuovi listener precedenti
            markers[currentPointId].on('dragend', function(e) {
                const position = e.target.getLatLng();
                $('#risviel-point-lat').val(position.lat.toFixed(6));
                $('#risviel-point-lng').val(position.lng.toFixed(6));
                console.log('Marker trascinato a:', position.lat.toFixed(6), position.lng.toFixed(6));
            });
        }

    } else {
        $('#risviel-save-point').hide();
        $('#risviel-cancel-edit').hide();

        if (currentPointId) {
            $('#risviel-edit-point').show();
            $('#risviel-delete-point').show();

            // Ripristina icona normale e disabilita trascinamento
            if (markers[currentPointId]) {
                const originalPoint = allPoints.find(p => p.id == currentPointId);
                if (originalPoint) {
                    let icon = markerIcons.active; // Mantieni rosso per indicare selezione
                    if (originalPoint.custom_icon) {
                        icon = L.icon({
                            iconUrl: originalPoint.custom_icon,
                            shadowUrl: risviel_gisdoc_admin.plugin_url + 'assets/leaflet/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        });
                    }
                    markers[currentPointId].setIcon(icon);
                }
                markers[currentPointId].dragging.disable();
                markers[currentPointId].off('dragend'); // Rimuovi listener del trascinamento
            }
        } else {
            $('#risviel-edit-point').hide();
            $('#risviel-delete-point').hide();
        }

        $('#risviel-point-form input, #risviel-point-form select, #risviel-point-form textarea').prop('disabled', true);
    }
}


    /**
     * Evidenzia punto in lista
     */
    function highlightPointInList(pointId) {
        $('#risviel-points-list li').removeClass('selected');
        $('#risviel-points-list li[data-point-id="' + pointId + '"]').addClass('selected');

        // Scroll per rendere visibile l'elemento selezionato
        const $selected = $('#risviel-points-list li[data-point-id="' + pointId + '"]');
        if ($selected.length > 0) {
            const container = $('#risviel-points-list')[0];
            const element = $selected[0];
            const containerTop = container.scrollTop;
            const containerBottom = containerTop + container.clientHeight;
            const elementTop = element.offsetTop;
            const elementBottom = elementTop + element.clientHeight;

            if (elementTop < containerTop) {
                container.scrollTop = elementTop;
            } else if (elementBottom > containerBottom) {
                container.scrollTop = elementBottom - container.clientHeight;
            }
        }
    }

/**
 * Evidenzia marker sulla mappa
 */
function highlightMarkerOnMap(pointId) {
    // Ripristina tutte le icone
    Object.keys(markers).forEach(function(id) {
        if (markers[id] && map.hasLayer(markers[id])) {
            const originalPoint = allPoints.find(p => p.id == id);
            if (originalPoint) {
                let icon = markerIcons.default;
                if (originalPoint.custom_icon) {
                    icon = L.icon({
                        iconUrl: originalPoint.custom_icon,
                        shadowUrl: risviel_gisdoc_admin.plugin_url + 'assets/leaflet/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    });
                } else if (!(originalPoint.visible == 't' || originalPoint.visible == true || originalPoint.visible == 1)) {
                    icon = markerIcons.invisible;
                }
                markers[id].setIcon(icon);

                // Rimuovi trascinabilità da tutti i marker
                markers[id].dragging.disable();
            }
        }
    });

    // Evidenzia il marker selezionato
    if (pointId && markers[pointId]) {
        markers[pointId].setIcon(markerIcons.active);
    }
}


/**
 * Aggiorna posizione marker quando cambiano le coordinate nei campi input
 */
function updateMarkerPosition(lat, lng) {
    if (editMode && currentPointId && markers[currentPointId]) {
        // Sposta il marker esistente
        markers[currentPointId].setLatLng([lat, lng]);
        map.setView([lat, lng], map.getZoom()); // Centra la mappa sul nuovo punto
    } else if (editMode && tempMarker) {
        // Sposta il marker temporaneo
        tempMarker.setLatLng([lat, lng]);
        map.setView([lat, lng], map.getZoom());
    }
}


    /**
     * Mostra anteprima panorama
     */
    function showPanoramaPreview(panoramaId) {
        if (!panoramaId) {
            hidePanoramaPreview();
            return;
        }

        // Cancella timeout precedente
        if (panoramaPreviewTimeout) {
            clearTimeout(panoramaPreviewTimeout);
        }

        panoramaPreviewTimeout = setTimeout(function() {
            $.ajax({
                url: risviel_gisdoc_admin.ajax_url,
                type: 'POST',
                data: {
                    action: 'risviel_gisdoc_admin_get_panorama',
                    nonce: risviel_gisdoc_admin.nonce,
                    panorama_id: panoramaId
                },
                success: function(response) {
                    if (response.success && response.data) {
                        displayPanoramaPreview(response.data);
                    } else {
                        console.log('Nessun dato panorama ricevuto:', response);
                        hidePanoramaPreview();
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Errore nel caricamento panorama:', error);
                    hidePanoramaPreview();
                }
            });
        }, 300);
    }

    /**
     * Visualizza anteprima panorama
     */
    function displayPanoramaPreview(panorama) {
        const $preview = $('#risviel-point-panorama-preview');

        if (!$preview.length) {
            return;
        }

        let previewHtml = '<div class="panorama-preview-container" style="margin-top: 10px; padding: 15px; border: 1px solid #ddd; background: #f9f9f9; border-radius: 4px;">';
        previewHtml += '<h4 style="margin: 0 0 10px 0; color: #333;">📷 Anteprima Panorama</h4>';

        const name = panorama.name || panorama.title_it || panorama.title_en || panorama.title_sa || 'Panorama senza nome';
        previewHtml += '<p style="margin: 5px 0;"><strong>Nome:</strong> ' + escapeHtml(name) + '</p>';

        if (panorama.description_it || panorama.description_en || panorama.description_sa) {
            const desc = panorama.description_it || panorama.description_en || panorama.description_sa || '';
            const shortDesc = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
            previewHtml += '<p style="margin: 5px 0;"> ' + shortDesc + '</p>';
        }

        // Mostra anteprima immagine se disponibile
        if (panorama.image_url) {
            previewHtml += '<div style="margin: 10px 0; text-align: center;">';
            previewHtml += '<img src="' + escapeHtml(panorama.image_url) + '" style="max-width: 250px; max-height: 150px; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" alt="Anteprima panorama">';
            previewHtml += '</div>';
        }

        previewHtml += '</div>';

        $preview.html(previewHtml).show();
    }

    /**
     * Nasconde anteprima panorama
     */
    function hidePanoramaPreview() {
        const $preview = $('#risviel-point-panorama-preview');
        if ($preview.length) {
            $preview.hide().empty();
        }
    }

    /**
     * Setup selettore icona
     */
    function setupIconSelector() {
        $('#risviel-point-custom-icon-select').on('click', function(e) {
            e.preventDefault();

            if (typeof wp !== 'undefined' && typeof wp.media !== 'undefined') {
                const mediaUploader = wp.media({
                    title: 'Seleziona icona personalizzata',
                    button: { text: 'Usa questa icona' },
                    multiple: false,
                    library: { type: 'image' }
                });

                mediaUploader.on('select', function() {
                    const attachment = mediaUploader.state().get('selection').first().toJSON();
                    $('#risviel-point-custom-icon').val(attachment.url);
                    updateIconPreview(attachment.url);
                });

                mediaUploader.open();
            }
        });

        $('#risviel-point-custom-icon-remove').on('click', function(e) {
            e.preventDefault();
            $('#risviel-point-custom-icon').val('');
            updateIconPreview('');
        });

        $('#risviel-point-custom-icon').on('change', function() {
            updateIconPreview($(this).val());
        });
    }

    /**
     * Aggiorna anteprima icona
     */
    function updateIconPreview(iconUrl) {
        const $preview = $('#risviel-point-custom-icon-preview');

        if (iconUrl) {
            $preview.html('<img src="' + escapeHtml(iconUrl) + '" style="max-width: 50px; max-height: 50px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px;" alt="Anteprima icona">').show();
        } else {
            $preview.hide().empty();
        }
    }

    /**
     * Setup selettori audio
     */
    function setupAudioSelectors() {
        const languages = ['it', 'en', 'sa'];

        languages.forEach(function(lang) {
            // Seleziona file
            $('#risviel-point-audio-' + lang + '-select').on('click', function(e) {
                e.preventDefault();

                if (typeof wp !== 'undefined' && typeof wp.media !== 'undefined') {
                    const mediaUploader = wp.media({
                        title: 'Seleziona file audio',
                        button: { text: 'Usa questo audio' },
                        multiple: false,
                        library: { type: 'audio' }
                    });

                    mediaUploader.on('select', function() {
                        const attachment = mediaUploader.state().get('selection').first().toJSON();
                        $('#risviel-point-audio-' + lang).val(attachment.url);
                        updateAudioPreview(lang, attachment.url);
                    });

                    mediaUploader.open();
                }
            });

            // Rimuovi file
            $('#risviel-point-audio-' + lang + '-remove').on('click', function(e) {
                e.preventDefault();
                $('#risviel-point-audio-' + lang).val('');
                updateAudioPreview(lang, '');
            });

            // Cambio manuale URL
            $('#risviel-point-audio-' + lang).on('change', function() {
                updateAudioPreview(lang, $(this).val());
            });
        });
    }

    /**
     * Aggiorna anteprima audio
     */
    function updateAudioPreview(lang, audioUrl) {
        const $preview = $('#risviel-point-audio-' + lang + '-preview');

        if (audioUrl) {
            $preview.html('<audio controls style="width: 100%; margin-top: 5px;"><source src="' + escapeHtml(audioUrl) + '" type="audio/mpeg">Il tuo browser non supporta l\'elemento audio.</audio>').show();
        } else {
            $preview.hide().empty();
        }
    }

    /**
     * Aggiorna tutte le anteprime audio
     */
    function updateAudioPreviews(audioFiles) {
        const languages = ['it', 'en', 'sa'];
        languages.forEach(function(lang) {
            updateAudioPreview(lang, audioFiles[lang] || '');
        });
    }

    /**
     * Compatibilità frontend
     */
    function loadMapPoints(mapId) {
        if (!map) return;
        loadAllPoints();
    }

    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
    }

})(jQuery);