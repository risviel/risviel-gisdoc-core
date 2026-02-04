
/**
 * File: risviel-gisdoc-admin-panorama.js
 * Gestione dei panorami per GisDoc
 */

(function($) {
    'use strict';

    // Configurazione del sistema panoramico
    const panoramaConfig = {
        debug: false,
        panoramaContainer: '#risviel-admin-panorama-viewer',
        hotspotScale: 0.5,
        defaultFOV: 75
    };

    // Variabili globali per il sistema panoramico
    let scene, renderer, controls;
    // Definisci camera come una proprietà di window
    window.camera = null;
    window.renderer = null;
    let isInitialized = false;
    let currentPanoramaData = null;
    let panoramaTexture = null;
    let panoramaMesh = null;

    // Variabile per tracciare l'offset nord (senza interferenze con rotazione)
    let currentCameraRotation = 0;
    let northOffset = 0;

    // Inizializza al caricamento della pagina
    $(document).ready(function() {
        $('#risviel-delete-panorama').hide();

        // Inizializza il sistema panoramico solo se c'è il container
        if ($(panoramaConfig.panoramaContainer).length > 0) {
            loadThreeJsDependencies();
            setupEventListeners();
        }
    });

    /**
     * Carica THREE.js e le sue dipendenze
     */
    function loadThreeJsDependencies() {
        // Verifica se THREE.js è già disponibile
        if (typeof THREE !== 'undefined') {
            initSimplePanoramaSystem();
            return;
        }

        console.error('THREE.js non è disponibile. Verifica che sia caricato correttamente.');
    }

    /**
     * Inizializza il sistema panoramico semplificato
     */
    function initSimplePanoramaSystem() {
        try {
            // Ottieni il container
            const container = document.querySelector(panoramaConfig.panoramaContainer);
            if (!container) {
                console.error('Container panorama non trovato:', panoramaConfig.panoramaContainer);
                return;
            }

            // Rimuovi qualsiasi canvas precedente
            $(container).empty();

            // Crea una scena Three.js
            scene = new THREE.Scene();

            // Crea una camera
            const aspect = container.clientWidth / container.clientHeight;
            window.camera = new THREE.PerspectiveCamera(panoramaConfig.defaultFOV, aspect, 1, 1100);
            window.camera.position.set(0, 0, 0.1);

            // Crea il renderer
            window.renderer = new THREE.WebGLRenderer({ antialias: true });
            window.renderer.setPixelRatio(window.devicePixelRatio);
            window.renderer.setSize(container.clientWidth, container.clientHeight);
            container.appendChild(window.renderer.domElement);

            // Imposta il cursore a forma di mano sul canvas
            window.renderer.domElement.style.cursor = 'grab';

            // Crea un controllo semplice per la rotazione della camera
            setupSimpleControls(camera, window.renderer.domElement);

            // **CRUCIALE: Esponi il viewer per la bussola (come nel frontend)**
            if (!window.panoramaViewers) {
                window.panoramaViewers = {};
            }

            window.panoramaViewers['admin-viewer'] = {
                camera: window.camera,
                renderer: window.renderer,
                controls: controls,
                scene: scene,
                containerId: 'risviel-admin-panorama-viewer'
            };

            // **AGGIUNGI: Setup della funzione setupSimpleControls per la bussola**
            window.setupSimpleControls = function(viewer) {
                console.log('🔗 setupSimpleControls chiamato dalla bussola con viewer:', viewer);
                return {
                    camera: window.camera,
                    controls: controls,
                    scene: scene
                };
            };

            console.log('🧭 Viewer admin esposto per la bussola:', window.panoramaViewers);

            // Aggiungi event listener per il ridimensionamento
            window.addEventListener('resize', onWindowResize);

            // Avvia il loop di rendering
            animate();

            // Imposta il flag di inizializzazione
            isInitialized = true;

            // Carica la lista dei panorami
            loadPanoramasList();
        } catch (error) {
            console.error('Errore durante l\'inizializzazione del sistema panoramico:', error);
        }
    }

    /**
     * Configura controlli semplici per la rotazione della camera
     * @param {THREE.Camera} camera - La camera da controllare
     * @param {HTMLElement} element - L'elemento DOM per gli eventi mouse
     */
    function setupSimpleControls(camera, element) {
        let isMouseDown = false;
        let previousMousePosition = { x: 0, y: 0 };

        // Variabili per tracciare l'orientamento della telecamera
        window.phi = 0;    // Angolo verticale (alto-basso)
        window.theta = 0;  // Angolo orizzontale (sinistra-destra)

        // Crea l'oggetto controls
        controls = {
            enableZoom: true,
            enablePan: false,
            rotateSpeed: 0.5,
            update: function() {
                // Nessuna operazione necessaria qui
            }
        };

        // Event listener per la rotazione della camera
        element.addEventListener('mousedown', function(event) {
            isMouseDown = true;
            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        });

        element.addEventListener('mousemove', function(event) {
            updateCurrentRotationDisplay();
            if (isMouseDown) {
                const deltaMove = {
                    x: event.clientX - previousMousePosition.x,
                    y: event.clientY - previousMousePosition.y
                };

                // Calcola gli angoli di rotazione
                const rotationSpeed = 0.002 * controls.rotateSpeed;

                // Aggiorna gli angoli
                window.theta -= deltaMove.x * rotationSpeed;
                window.phi -= deltaMove.y * rotationSpeed;

                // Limita l'angolo verticale per evitare capovolgimenti
                window.phi = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, window.phi));

                // Crea un quaternione per la rotazione
                const quaternion = new THREE.Quaternion();

                // Applica prima la rotazione verticale (su asse X)
                const xQuaternion = new THREE.Quaternion();
                xQuaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), window.phi);

                // Poi applica la rotazione orizzontale (su asse Y)
                const yQuaternion = new THREE.Quaternion();
                yQuaternion.setFromAxisAngle(new THREE.Vector3(0, -1, 0), window.theta);

                // Combina le rotazioni (in ordine: prima Y, poi X)
                quaternion.multiplyQuaternions(yQuaternion, xQuaternion);

                // Applica la rotazione alla camera
                camera.quaternion.copy(quaternion);

                previousMousePosition = {
                    x: event.clientX,
                    y: event.clientY
                };
            }
        });

        document.addEventListener('mouseup', function() {
            updateCurrentRotationDisplay();
            isMouseDown = false;
        });

        // Evento per lo zoom
        element.addEventListener('wheel', function(event) {
            if (!controls.enableZoom) return;

            event.preventDefault();

            // Gestisci lo zoom
            const zoomSpeed = 5;
            const delta = Math.sign(event.deltaY);
            camera.fov += delta * zoomSpeed;
            camera.fov = Math.max(30, Math.min(90, camera.fov)); // Limita FOV
            camera.updateProjectionMatrix();
        });
    }

    /**
     * Gestisce il ridimensionamento della finestra
     */
    function onWindowResize() {
        if (!isInitialized) return;

        const container = document.querySelector(panoramaConfig.panoramaContainer);
        if (!container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        window.camera.aspect = width / height;
        window.camera.updateProjectionMatrix();
        window.renderer.setSize(width, height);
    }

    /**
     * Carica un panorama nel visualizzatore
     * @param {number} panoramaId - ID del panorama
     * @param {object} panoramaData - Dati del panorama (opzionale)
     */
    function loadPanorama(panoramaId, panoramaData = null) {
        // Se abbiamo già i dati, li usiamo direttamente
        if (panoramaData && panoramaData.image_url) {
            _setupPanorama(panoramaData);
            return;
        }

        // Altrimenti carichiamo i dati dal server
        $.ajax({
            url: risviel_gisdoc_admin.ajax_url,
            type: 'POST',
            data: {
                action: 'risviel_gisdoc_admin_get_panorama',
                nonce: risviel_gisdoc_admin.nonce,
                panorama_id: panoramaId
            },
            success: function(response) {
                if (response.success) {
                    _setupPanorama(response.data);
                } else {
                    console.error('Errore nel caricamento del panorama:', response.data.message);
                    alert('Errore nel caricamento del panorama: ' + response.data.message);
                }
            },
            error: function(xhr, status, error) {
                console.error('Errore AJAX:', error);
                alert('Errore nel caricamento del panorama. Riprova.');
            }
        });
    }

    /**
     * Configura il panorama nel visualizzatore
     * @param {object} panoramaData - Dati del panorama
     */
    function _setupPanorama(panoramaData) {
        // Memorizza i dati del panorama corrente
        currentPanoramaData = panoramaData;

        // Estrai l'offset nord dai dati del panorama
        if (panoramaData && panoramaData.north_offset !== undefined) {
            northOffset = parseFloat(panoramaData.north_offset) || 0;
            $('#risviel-north-offset-info strong').text(Math.round(northOffset) + '°');
        }

        // Nascondi le istruzioni
        $('.risviel-panorama-instructions').hide();

        // Carica l'immagine come texture
        const loader = new THREE.TextureLoader();
        loader.load(
            panoramaData.image_url,
            function(texture) {
                // Rimuovi la sfera panoramica precedente se esiste
                if (panoramaMesh) {
                    scene.remove(panoramaMesh);
                }

                // Salva la texture
                panoramaTexture = texture;

                // Crea la geometria sferica per il panorama (interno della sfera)
                const geometry = new THREE.SphereGeometry(500, 60, 40);

                // La normale della sfera deve puntare verso l'interno
                geometry.scale(-1, 1, 1);

                // Crea il materiale con la texture
                const material = new THREE.MeshBasicMaterial({
                    map: texture
                });

                // Crea la mesh e aggiungila alla scena
                panoramaMesh = new THREE.Mesh(geometry, material);

                // APPLICA L'OFFSET NORD ALLA MESH INVECE CHE ALLA TEXTURE
                if (northOffset !== 0) {
                    const offsetRadians = northOffset * (Math.PI / 180);
                    panoramaMesh.rotation.y = offsetRadians;
                    $('#risviel-current-rotation strong').text(Math.round(offsetRadians) + '°');
                    console.log('North offset applicato alla mesh panorama:', northOffset + '°');
                }

                scene.add(panoramaMesh);

                // Popola il form con i dati del panorama
                $('#risviel-panorama-id').val(panoramaData.id);
                $('#risviel-panorama-title-it').val(panoramaData.title_it || '');
                $('#risviel-panorama-title-en').val(panoramaData.title_en || '');
                $('#risviel-panorama-title-sa').val(panoramaData.title_sa || '');

                // Carica le traduzioni negli editor
                setEditorContent('risviel-panorama-description-it', panoramaData.description_it || '');
                setEditorContent('risviel-panorama-description-en', panoramaData.description_en || '');
                setEditorContent('risviel-panorama-description-sa', panoramaData.description_sa || '');

                $('#risviel-panorama-audio-it').val(panoramaData.audio_url_it || '');
                $('#risviel-panorama-audio-en').val(panoramaData.audio_url_en || '');
                $('#risviel-panorama-audio-sa').val(panoramaData.audio_url_sa || '');

                // Anteprima file audio
                updateAudioPreviews({
                    'it': panoramaData.audio_url_it,
                    'en': panoramaData.audio_url_en,
                    'sa': panoramaData.audio_url_sa
                });

                $('#risviel-panorama-image-url').val(panoramaData.image_url || '');

                $('#risviel-north-orientation-controls').show().prop('disabled', false);
                $('#risviel-set-north-button').show().prop('disabled', false);

                $('#risviel-panorama-details').hide();

                $('.risviel-panorama-instructions').hide();
            },
            undefined,
            function(error) {
                console.error('Errore nel caricamento della texture:', error);
                alert('Errore nel caricamento dell\'immagine panoramica. Verifica l\'URL.');
            }
        );
    }

    /**
     * Loop di animazione
     */
    function animate() {
        requestAnimationFrame(animate);

        // Rendering della scena
        if (window.renderer && scene && window.camera) {
            window.renderer.render(scene, window.camera);
        }
    }

    /**
     * Carica la lista dei panorami
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
                if (response.success) {
                    updatePanoramasSelect(response.data);
                } else {
                    console.error('Errore nel caricamento dei panorami:', response.data.message);
                }
            },
            error: function(xhr, status, error) {
                console.error('Errore AJAX:', error);
            }
        });
    }

    /**
     * Aggiorna la select dei panorami
     * @param {Array} panoramas - Array di panorami
     */
    function updatePanoramasSelect(panoramas) {
        const $select = $('#risviel-panorama-id-select');
        $select.empty();
        $select.append($('<option value="">').text('Seleziona panorama...'));

        if (panoramas && panoramas.length > 0) {
            panoramas.forEach(panorama => {
                $select.append($('<option>').val(panorama.id).text(panorama.title_it || 'Panorama senza titolo'));
            });
        }
    }

    /**
     * Pulisce il form del panorama
     */
    function clearPanoramaForm() {
        $('#risviel-panorama-form')[0].reset();
        $('#risviel-panorama-id').val('');

        // Rimuovi il panorama corrente
        if (panoramaMesh) {
            scene.remove(panoramaMesh);
            panoramaMesh = null;
        }

        // Resetta il panorama corrente
        currentPanoramaData = null;

        // Mostra le istruzioni
        $('.risviel-panorama-instructions').show();

        // Seleziona il primo panorama disponibile
        const panoramaSelect = document.getElementById('risviel-panorama-id-select');
        if (panoramaSelect) {
            const firstOption = panoramaSelect.querySelector('option[value=""]');
            if (firstOption) {
                panoramaSelect.value = firstOption.value;
                panoramaSelect.dispatchEvent(new Event('change'));
            }
        }
    }

    /**
     * Setup selettori audio
     */
    function setupAudioSelectors() {
        const languages = ['it', 'en', 'sa'];

        languages.forEach(function(lang) {
            // Seleziona file
            $('#risviel-panorama-audio-' + lang + '-select').on('click', function(e) {
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
                        $('#risviel-panorama-audio-' + lang).val(attachment.url);
                        updateAudioPreview(lang, attachment.url);
                    });

                    mediaUploader.open();
                }
            });

            // Rimuovi file
            $('#risviel-panorama-audio-' + lang + '-remove').on('click', function(e) {
                e.preventDefault();
                $('#risviel-panorama-audio-' + lang).val('');
                updateAudioPreview(lang, '');
            });

            // Cambio manuale URL
            $('#risviel-panorama-audio-' + lang).on('change', function() {
                updateAudioPreview(lang, $(this).val());
            });
        });
    }

    /**
     * Elimina panorama
     */
    function deletePanorama() {
        const currentPanoramaId = $('#risviel-panorama-id-select').val();

        if (!currentPanoramaId) {
            alert('Nessun panorama selezionato da eliminare');
            return;
        }

        $.ajax({
            url: risviel_gisdoc_admin.ajax_url,
            type: 'POST',
            data: {
                action: 'risviel_gisdoc_delete_panorama',
                nonce: risviel_gisdoc_admin.nonce,
                id: currentPanoramaId
            },
            success: function(response) {
                if (response.success) {
                    loadPanoramasList();
                    clearPanoramaForm();
                    alert('Panorama eliminato con successo!');
                } else {
                    alert('Errore nell\'eliminazione del Panorama: ' + (response.data && response.data.message ? response.data.message : 'Errore sconosciuto'));
                }
            },
            error: function(xhr, status, error) {
                alert('Errore di connessione durante l\'eliminazione: ' + error);
            }
        });
    }

    /**
     * Configura gli event listeners
     */
    function setupEventListeners() {
        setupAudioSelectors();

        // Carica panorama
        $('#risviel-load-panorama').on('click', function(e) {
            e.preventDefault();

            const panoramaId = $('#risviel-panorama-id-select').val();

            if (panoramaId) {
                loadPanorama(panoramaId);
            } else {
                alert('Seleziona un panorama dalla lista.');
            }
        });

        // Listener per il pulsante "Imposta Nord"
        $('#risviel-set-north-button').on('click', function() {
            setNorthOffset();
        });

        // Carica panorama al cambio selezione
        $('#risviel-panorama-id-select').on('change', function(e) {
            e.preventDefault();

            const panoramaId = $('#risviel-panorama-id-select').val();

            if (panoramaId) {
                loadPanorama(panoramaId);
                $('#risviel-delete-panorama').show();
                $('#risviel-delete-panorama').on('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm('Sei sicuro di voler eliminare questo panorama?')) {
                        deletePanorama();
                    }
                });
            } else {
                clearPanoramaForm();
                $('#risviel-delete-panorama').hide();
            }
        });

        // Nuovo panorama
        $('#risviel-new-panorama').on('click', function(e) {
            e.preventDefault();
            clearPanoramaForm();
        });

        // Annulla/reset form panorama
        $('#risviel-reset-panorama-form').on('click', function(e) {
            e.preventDefault();
            clearPanoramaForm();
        });

        // Submit form panorama
        $('#risviel-panorama-form').on('submit', function(e) {
            e.preventDefault();

            // Raccogli i dati dal form
            const panoramaData = {
                id: $('#risviel-panorama-id').val(),
                image_url: $('#risviel-panorama-image-url').val(),
                title_it: $('#risviel-panorama-title-it').val(),
                title_en: $('#risviel-panorama-title-en').val(),
                title_sa: $('#risviel-panorama-title-sa').val(),

                // Ottieni il contenuto dagli editor TinyMCE
                description_it: getEditorContent('risviel-panorama-description-it'),
                description_en: getEditorContent('risviel-panorama-description-en'),
                description_sa: getEditorContent('risviel-panorama-description-sa'),

                audio_url_it: $('#risviel-panorama-audio-it').val() || '',
                audio_url_en: $('#risviel-panorama-audio-en').val() || '',
                audio_url_sa: $('#risviel-panorama-audio-sa').val() || ''
            };

            // Verifica che l'URL dell'immagine sia valido
            if (!panoramaData.image_url) {
                alert('L\'URL dell\'immagine è obbligatorio.');
                return;
            }

            // Salva il panorama
            $.ajax({
                url: risviel_gisdoc_admin.ajax_url,
                type: 'POST',
                data: {
                    action: 'risviel_gisdoc_save_panorama',
                    nonce: risviel_gisdoc_admin.nonce,
                    panorama: panoramaData
                },
                success: function(response) {
                    if (response.success) {
                        alert('Panorama salvato con successo.');

                        // Aggiorna la lista dei panorami
                        loadPanoramasList();

                        // Se è un nuovo panorama, aggiorna l'ID nel form
                        if (!panoramaData.id && response.data.id) {
                            $('#risviel-panorama-id').val(response.data.id);
                        }

                        // Carica il panorama nel visualizzatore
                        loadPanorama(response.data.id || panoramaData.id, panoramaData);
                    } else {
                        console.error('Errore nel salvataggio del panorama:', response.data.message);
                        alert(response.data.message || 'Si è verificato un errore durante il salvataggio del panorama.');
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Errore AJAX:', error);
                    alert('Si è verificato un errore durante il salvataggio del panorama.');
                }
            });
        });

        // Inizializzazione media uploader per le immagini
        $('#risviel-select-image').on('click', function(e) {
            e.preventDefault();

            const frame = wp.media({
                title: 'Seleziona immagine panoramica',
                multiple: false,
                library: {
                    type: 'image'
                },
                button: {
                    text: 'Usa questa immagine'
                }
            });

            frame.on('select', function() {
                const attachment = frame.state().get('selection').first().toJSON();
                $('#risviel-panorama-image-url').val(attachment.url);
            });

            frame.open();
        });

        // Event listener per il controllo dell'offset nord
        $('#risviel-north-offset, #north-offset-input, #panorama-north-offset').on('change input', function() {
            const newOffset = parseFloat($(this).val()) || 0;
            if (typeof window.updateMeshNorthOffset === 'function') {
                window.updateMeshNorthOffset(newOffset);
            }
        });
    }

    /**
     * Aggiorna la visualizzazione della rotazione corrente
     */
    function updateCurrentRotationDisplay() {
        if (!window.camera || !controls) return;

        let azimuthalAngle = 0;

        if (window.camera.position.length() < 1) {
            // Camera al centro: usa la rotazione della camera
            azimuthalAngle = window.camera.rotation.y;
        } else {
            // Camera che orbita: calcola dalla posizione
            const cameraPosition = window.camera.position.clone();
            const target = controls.target || new THREE.Vector3(0, 0, 0);
            const direction = cameraPosition.clone().sub(target);
            azimuthalAngle = Math.atan2(direction.x, direction.z);
        }

        // Converti da radianti a gradi
        currentCameraRotation = azimuthalAngle * (180 / Math.PI);

        // Normalizza l'angolo tra 0 e 360
        while (currentCameraRotation < 0) currentCameraRotation += 360;
        while (currentCameraRotation >= 360) currentCameraRotation -= 360;

        // Aggiorna la visualizzazione
        $('#risviel-current-rotation strong').text(Math.round(currentCameraRotation) + '°');
    }

    /**
     * Imposta l'offset nord per il panorama corrente
     */
    function setNorthOffset() {
        if (!currentPanoramaData || !currentPanoramaData.id) {
            showNotification('Nessun panorama caricato', 'error');
            return;
        }

        // Prendi l'offset attuale
        const northOffsetText = $('#risviel-north-offset-info strong').text();
        const currentNorthOffset = parseInt(northOffsetText.replace('°', '')) || 0;

        // Calcola il nuovo offset: offset_attuale - rotazione_camera
        let newNorthOffset = currentNorthOffset - currentCameraRotation;
        // Normalizza tra 0 e 360
        while (newNorthOffset < 0) newNorthOffset += 360;
        while (newNorthOffset >= 360) newNorthOffset -= 360;

        $.ajax({
            url: risviel_gisdoc_admin.ajax_url,
            type: 'POST',
            data: {
                action: 'risviel_gisdoc_set_panorama_north_offset',
                nonce: risviel_gisdoc_admin.nonce,
                panorama_id: currentPanoramaData.id,
                north_offset: Math.round(newNorthOffset)
            },
            beforeSend: function() {
                $('#risviel-set-north-button').prop('disabled', true).text('Salvando...');
            },
            success: function(response) {
                if (response.success) {
                    northOffset = newNorthOffset;
                    currentPanoramaData.north_offset = newNorthOffset;

                    // Aggiorna la visualizzazione
                    $('#risviel-north-offset-info strong').text(Math.round(northOffset) + '°');
                    $('#risviel-north-offset-info').show();

                    // RESET COMPLETO DELLA CAMERA E CONTROLS
                    if (window.camera) {
                        window.camera.rotation.set(0, 0, 0);
                    }

                    if (typeof window.phi !== 'undefined') {
                        window.phi = 0;
                    }
                    if (typeof window.theta !== 'undefined') {
                        window.theta = 0;
                    }

                    if (controls) {
                        if (controls.reset) {
                            controls.reset();
                        }
                        if (controls.azimuthalAngle !== undefined) {
                            controls.azimuthalAngle = 0;
                        }
                        if (controls.polarAngle !== undefined) {
                            controls.polarAngle = Math.PI / 2;
                        }
                        if (controls.update) {
                            controls.update();
                        }
                    }

                    currentCameraRotation = 0;
                    $('#risviel-current-rotation strong').text('0°');

                    setTimeout(function() {
                        updateCurrentRotationDisplay();
                    }, 100);

                    setTimeout(function() {
                        loadPanorama(currentPanoramaData.id);
                    }, 100);

                    showNotification('Orientamento nord impostato con successo', 'success');
                } else {
                    showNotification('Errore: ' + response.data.message, 'error');
                }
            },
            error: function(xhr, status, error) {
                console.error('Errore AJAX:', error);
                showNotification('Errore nella comunicazione con il server', 'error');
            },
            complete: function() {
                $('#risviel-set-north-button').prop('disabled', false);
                $('#risviel-set-north-button').html('<span class="dashicons dashicons-location"></span> Imposta Nord');
            }
        });
    }
    /**
     * Funzioni di utilità per le notifiche
     */
    function showNotification(message, type = 'info') {
        $('.risviel-notification').remove();

        const notification = $(`
            <div class="risviel-notification risviel-notification-${type}">
                ${message}
            </div>
        `);

        $('.risviel-panorama-viewer-container').prepend(notification);

        if (type === 'success') {
            setTimeout(() => {
                notification.fadeOut();
            }, 3000);
        }
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