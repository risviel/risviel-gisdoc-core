
/**
 * Gestione dei panorami 360° per GisDoc - Frontend
 * Segue la stessa logica del backend admin
 */
(function($) {
    'use strict';

    // Configurazione del sistema panoramico
    const panoramaConfig = {
        debug: true,
        defaultFOV: 75
    };

    // Mappa degli oggetti panorama
    const panoramaViewers = {};

    // Variabili globali per ogni viewer
    let activeHotspots = [];

    // Esposizione globale
    window.panoramaViewers = panoramaViewers;

    /**
     * Gestisce la navigazione del browser (pulsante indietro/avanti)
     */
    function setupBrowserNavigation() {
        window.addEventListener('popstate', function(event) {
            if (event.state && event.state.panoramaId) {
                // L'utente ha premuto indietro/avanti, carica il panorama appropriato
                const firstViewer = Object.keys(panoramaViewers)[0];
                if (firstViewer) {
                    loadPanoramaData(firstViewer, event.state.panoramaId, event.state.language || 'it');
                }
            } else {
                // Leggi i parametri dall'URL corrente
                const urlParams = new URLSearchParams(window.location.search);
                const panoramaId = urlParams.get('id');
                const language = urlParams.get('lang') || 'it';

                if (panoramaId) {
                    const firstViewer = Object.keys(panoramaViewers)[0];
                    if (firstViewer) {
                        loadPanoramaData(firstViewer, panoramaId, language);
                    }
                }
            }
        });
    }

    // Inizializza al caricamento della pagina
    $(document).ready(function() {

        // Setup navigazione browser
        setupBrowserNavigation();

        //runATON();
        //console.log("Frontend: Cercando elementi con classe .risviel-panorama");

        // Controlla parametri URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlPanoramaId = urlParams.get('id');
        const urlLanguage = urlParams.get('lang');

        if (urlPanoramaId) {
            //console.log("Frontend: Parametro ID panorama trovato nell'URL:", urlPanoramaId);

            let panoramaContainer = $('.risviel-panorama').first();
            if (panoramaContainer.length === 0) {
                //console.log("Frontend: Creazione container automatico");
                panoramaContainer = $('<div id="risviel-panorama-auto" class="risviel-panorama"></div>');
                panoramaContainer.css({ 'width': '100%', 'height': '600px' });
                $('body').append(panoramaContainer);
            }

            panoramaContainer.attr('data-id', urlPanoramaId);
            if (urlLanguage) {
                panoramaContainer.attr('data-lang', urlLanguage);
            }

            const containerId = panoramaContainer.attr('id');
            initPanoramaViewer(containerId);
        } else {
            $('.risviel-panorama').each(function() {
                const containerId = $(this).attr('id');
                //console.log("Frontend: Trovato panorama con ID:", containerId);
                initPanoramaViewer(containerId);
            });
        }
    });

    /**
     * Inizializza un visualizzatore di panorama
     */
    function initPanoramaViewer(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Container non trovato:', containerId);
            return;
        }

        //console.log('Frontend: Inizializzazione panorama in:', containerId);

        const urlParams = new URLSearchParams(window.location.search);
        const urlPanoramaId = urlParams.get('id');
        const urlLanguage = urlParams.get('lang');

        const panoramaId = urlPanoramaId || container.dataset.id;
        const language = urlLanguage || container.dataset.lang || 'it';

        if (!panoramaId) {
            console.error('ID panorama non specificato');
            container.innerHTML = '<p class="risviel-error">ID panorama non specificato</p>';
            return;
        }

        // Inizializza oggetto viewer
        panoramaViewers[containerId] = {
            scene: null,
            camera: null,
            renderer: null,
            panoramaMesh: null,
            activeHotspots: [],
            activeIndicators: [],
            container: container
        };

        // Carica i dati del panorama
        loadPanoramaData(containerId, panoramaId, language);
    }

    /**
     * Crea lo spinner di caricamento
     */
    function createLoadingSpinner(container) {
        // Rimuovi spinner precedente se esiste
        removeLoadingSpinner(container);

        const spinnerContainer = document.createElement('div');
        spinnerContainer.className = 'risviel-panorama-spinner';
        spinnerContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 15px;
            background: rgba(0, 0, 0, 0.6);
            color: white;
            font-family: Arial, sans-serif;
            pointer-events: none;
        `;

        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid #ffffff;
            border-radius: 50%;
            animation: risviel-spin 1s linear infinite;
        `;

        const loadingText = document.createElement('div');
        loadingText.textContent = 'Caricamento panorama...';
        loadingText.style.cssText = `
            font-size: 14px;
            font-weight: 500;
        `;

        // Aggiungi CSS per l'animazione dello spinner
        if (!document.getElementById('risviel-spinner-styles')) {
            const style = document.createElement('style');
            style.id = 'risviel-spinner-styles';
            style.textContent = `
                @keyframes risviel-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        spinnerContainer.appendChild(spinner);
        spinnerContainer.appendChild(loadingText);
        container.appendChild(spinnerContainer);
    }

    /**
     * Rimuove lo spinner di caricamento
     */
    function removeLoadingSpinner(container) {
        const spinner = container.querySelector('.risviel-panorama-spinner');
        if (spinner) {
            spinner.remove();
        }
    }

    /**
     * Crea overlay per transizione fade
     */
    function createTransitionOverlay(viewer) {
        if (!viewer.scene || !viewer.camera) return null;

        const fadeGeometry = new THREE.PlaneGeometry(2, 2);
        const fadeMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
            renderOrder: 999 // Assicura che si renderizzi sopra tutto
        });
        const fadeMesh = new THREE.Mesh(fadeGeometry, fadeMaterial);

        // Posiziona l'overlay molto vicino alla camera per coprire tutto
        fadeMesh.position.set(0, 0, -0.1);
        fadeMesh.renderOrder = 999; // Doppia sicurezza

        viewer.scene.add(fadeMesh);

        return { geometry: fadeGeometry, material: fadeMaterial, mesh: fadeMesh };
    }

    /**
     * Esegue transizione fade
     */
    function fadeTransition(viewer, fadeOverlay, fadeOut = true, duration = 400) {
        return new Promise((resolve) => {

            if (!fadeOverlay || !fadeOverlay.material) {
                resolve();
                return;
            }

            const startTime = Date.now();
            const startOpacity = fadeOut ? 0 : 1;
            const endOpacity = fadeOut ? 1 : 0;

            function animate() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                fadeOverlay.material.opacity = startOpacity + (endOpacity - startOpacity) * progress;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    if (!fadeOut) {
                        // Rimuovi overlay dopo fade in
                        fadeOverlay.mesh.parent.remove(fadeOverlay.mesh);
                        fadeOverlay.geometry.dispose();
                        fadeOverlay.material.dispose();
                    }
                    resolve();
                }
            }

            animate();
        });
    }

    /**
     * Carica i dati del panorama dal server
     * Equivalente del loadPanorama() del backend
     */
    function loadPanoramaData(containerId, panoramaId, language) {
        // PULIZIA COMPLETA DI TUTTI GLI ELEMENTI UI

        // Rimuovi pannelli media esistenti con overlay
        $('#idPanel').remove();
        $('#idPanelOverlay').remove();

        // Rimuovi tutti gli overlay scuri che potrebbero essere rimasti
        $('.media-panel-overlay, .panorama-overlay, .risviel-overlay').remove();

        // Rimuovi listener di tastiera
        $(document).off('keydown.mediaPanel');

        // Rimuovi tutti gli overlay con z-index alto che potrebbero essere overlay modali
        $('div[style*="position: fixed"], div[style*="position: absolute"]').each(function() {
            const $elem = $(this);
            const zIndex = parseInt($elem.css('z-index')) || 0;
            const hasOverlayStyle = $elem.css('background-color') &&
                                  ($elem.css('background-color').includes('rgba') ||
                                   $elem.css('background').includes('rgba'));

            // Se ha z-index alto e sembra essere un overlay, rimuovilo
            if (zIndex > 1000 && hasOverlayStyle && !$elem.hasClass('risviel-panorama-spinner')) {
                if (panoramaConfig.debug) {
                    console.log('🧹 Rimosso overlay residuo:', $elem[0]);
                }
                $elem.remove();
            }
        });

        const container = document.getElementById(containerId);
        const viewer = panoramaViewers[containerId];

        // RIMUOVI IMMEDIATAMENTE TUTTE LE AREE INTERATTIVE E INDICATORI
        if (viewer && viewer.scene) {
            // Rimuovi tutte le aree interattive esistenti
            if (viewer.activeHotspots && viewer.activeHotspots.length > 0) {
                removeInteractiveAreas(viewer);
            }

            // Rimuovi tutti gli indicatori esistenti
            if (viewer.activeIndicators && viewer.activeIndicators.length > 0) {
                removeIndicators(viewer);
            }

            // Pulisci gli array immediatamente
            viewer.activeHotspots = [];
            viewer.activeIndicators = [];
        }

        // Crea overlay per transizione se esiste già un panorama
        let fadeOverlay = null;
        if (viewer && viewer.scene && viewer.panoramaMesh) {
            fadeOverlay = createTransitionOverlay(viewer);
        }

        // Mostra spinner DOPO aver rimosso le aree interattive
        container.style.position = 'relative';
        createLoadingSpinner(container);

        if (!risviel_gisdoc_panorama) {
            console.error('Variabili globali risviel_gisdoc_panorama mancanti');
            removeLoadingSpinner(container);
            container.innerHTML = '<p class="risviel-error">Errore di configurazione</p>';
            return;
        }

        const ajaxData = {
            action: 'risviel_gisdoc_get_panorama',
            nonce: risviel_gisdoc_panorama.nonce,
            panorama_id: panoramaId,
            language: language
        };

        // Esegui fade out se c'è un panorama esistente
        const fadeOutPromise = fadeOverlay ? fadeTransition(viewer, fadeOverlay, true) : Promise.resolve();

        fadeOutPromise.then(() => {
            $.ajax({
                url: risviel_gisdoc_panorama.ajax_url,
                type: 'POST',
                data: ajaxData,
                success: function(response) {
                    if (response.success && response.data) {
                        if (!response.data.image_url) {
                            console.error('URL immagine mancante');
                            removeLoadingSpinner(container);
                            container.innerHTML = '<p class="risviel-error">URL immagine mancante</p>';
                            return;
                        }

                        // Setup panorama con transizione
                        setupPanorama(containerId, response.data, fadeOverlay);

                        // Aggiungi sovraimpressione per titolo/descrizione
                        createPanoramaOverlay(containerId, response.data);

                    } else {
                        let errorMsg = 'Errore nel caricamento del panorama';
                        if (response.data && response.data.message) {
                            errorMsg += ': ' + response.data.message;
                        }
                        console.error(errorMsg, response);
                        removeLoadingSpinner(container);
                        container.innerHTML = '<p class="risviel-error">' + errorMsg + '</p>';
                    }
                },
                error: function(xhr, status, error) {
                    console.error('Errore AJAX:', { status, error, xhr });
                    removeLoadingSpinner(container);
                    container.innerHTML = '<p class="risviel-error">Errore di connessione</p>';
                }
            });
        });
    }

     /**
     * Pulizia globale di tutti gli overlay e pannelli modali - versione migliorata
     */
    function cleanupAllOverlays() {
        if (panoramaConfig.debug) {
            console.log('🧹 Inizio pulizia overlay...');
        }

        // Rimuovi pannelli media specifici
        $('#idPanel').remove();
        $('#idPanelOverlay').remove();

        // Rimuovi overlay con classi specifiche
        $('.media-panel-overlay, .panorama-overlay, .risviel-overlay, .modal-overlay').remove();

        // Rimuovi listener di tastiera specifici
        $(document).off('keydown.mediaPanel');

        // Rimuovi listener di click specifici del pannello media
        $(document).off('click.mediaPanelInteraction');

        // Rimuovi overlay generici con stili sospetti
        $('div').each(function() {
            const $elem = $(this);
            const style = $elem.attr('style') || '';
            const zIndex = parseInt($elem.css('z-index')) || 0;

            // Se ha stili che suggeriscono un overlay modale
            const looksLikeOverlay = (
                style.includes('position: fixed') ||
                style.includes('position: absolute')
            ) && (
                style.includes('rgba(0,0,0') ||
                style.includes('rgba(0, 0, 0') ||
                style.includes('background: rgba') ||
                style.includes('background-color: rgba')
            ) && zIndex > 1000;

            // Non rimuovere il nostro spinner o elementi importanti
            const isImportantElement = $elem.hasClass('risviel-panorama-spinner') ||
                                     $elem.hasClass('panorama-info-overlay') ||
                                     $elem.closest('.risviel-panorama').length > 0;

            if (looksLikeOverlay && !isImportantElement) {
                if (panoramaConfig.debug) {
                    console.log('🧹 Rimosso overlay sospetto:', $elem[0]);
                }
                $elem.remove();
            }
        });

        // Ripristina overflow del body se era stato nascosto
        $('body').css('overflow', '');

        // Ripristina pointer-events se erano stati disabilitati
        $('body').css('pointer-events', '');

        if (panoramaConfig.debug) {
            console.log('🧹 Pulizia overlay completata');
        }
    }

    /**
     * Observer per monitorare l'aggiunta dinamica di pannelli media
     */
    function setupMediaPanelObserver() {
        // Observer per elementi aggiunti dinamicamente
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const $node = $(node);

                        // Se è stato aggiunto un pannello media
                        if ($node.is('#idPanel') || $node.find('#idPanel').length > 0) {
                            if (panoramaConfig.debug) {
                                console.log('📺 Rilevato nuovo pannello media');
                            }

                            // Aggiungi listener per la chiusura immediata
                            setTimeout(() => {
                                const $closeBtn = $('#idPanelClose');
                                if ($closeBtn.length && !$closeBtn.data('cleanup-listener')) {
                                    $closeBtn.data('cleanup-listener', true);
                                    $closeBtn.on('click.immediateCleanup', function(e) {
                                        if (panoramaConfig.debug) {
                                            console.log('🔘 Chiusura immediata pannello media');
                                        }
                                        cleanupAllOverlays();
                                        e.preventDefault();
                                        e.stopPropagation();
                                    });
                                }
                            }, 100);
                        }
                    }
                });
            });
        });

        // Osserva l'intero documento per elementi aggiunti
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return observer;
    }

    // Avvia l'observer
    let mediaPanelObserver = null;
    $(document).ready(function() {
        mediaPanelObserver = setupMediaPanelObserver();
    });


    // Esponi la funzione di pulizia globalmente
    window.cleanupAllOverlays = cleanupAllOverlays;

    /**
     * Listener globale per ESC key per chiudere overlay
     */
    $(document).on('keydown.globalOverlayCleanup', function(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            // Se ci sono overlay visibili, puliscili
            const overlaysPresent = $('#idPanel, #idPanelOverlay, .media-panel-overlay, .modal-overlay').length > 0;
            if (overlaysPresent) {
                cleanupAllOverlays();
                e.preventDefault();
                e.stopPropagation();
            }
        }
    });

    /**
     * Listener per click su overlay per chiudere
     */
    $(document).on('click.globalOverlayCleanup', function(e) {
        const $target = $(e.target);

        // Se click su overlay di sfondo (non sul contenuto)
        if ($target.is('#idPanelOverlay, .media-panel-overlay, .modal-overlay')) {
            cleanupAllOverlays();
            e.preventDefault();
            e.stopPropagation();
        }
    });

    /**
     * Listener specifico per il pulsante di chiusura del pannello media
     */
    $(document).on('click.mediaPanelClose', '#idPanelClose', function(e) {
        if (panoramaConfig.debug) {
            console.log('🔘 Click su pulsante chiusura pannello media');
        }

        // Chiama la funzione di pulizia completa
        cleanupAllOverlays();

        e.preventDefault();
        e.stopPropagation();
    });

    /**
     * Listener per altri pulsanti di chiusura possibili
     */
    $(document).on('click.mediaPanelClose', '.close-panel, .panel-close, [data-action="close"]', function(e) {
        if (panoramaConfig.debug) {
            console.log('🔘 Click su pulsante di chiusura generico');
        }

        // Verifica se siamo in un contesto di pannello media
        const $panel = $(this).closest('#idPanel, .media-panel, .modal-panel');
        if ($panel.length > 0) {
            cleanupAllOverlays();
            e.preventDefault();
            e.stopPropagation();
        }
    });

    /**
     * Listener per click su overlay per chiudere
     */
    $(document).on('click.globalOverlayCleanup', function(e) {
        const $target = $(e.target);

        // Se click su overlay di sfondo (non sul contenuto)
        if ($target.is('#idPanelOverlay, .media-panel-overlay, .modal-overlay')) {
            cleanupAllOverlays();
            e.preventDefault();
            e.stopPropagation();
        }
    });

    /**
     * Crea sovraimpressione per titolo e descrizione del panorama
     */
    function createPanoramaOverlay(containerId, panoramaData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Rimuovi overlay esistente
        const existingOverlay = container.querySelector('.panorama-info-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        // Controlla se ci sono titolo o descrizione
        const hasTitle = panoramaData.title && panoramaData.title.trim();
        const hasDescription = panoramaData.description && panoramaData.description.trim();

        if (!hasTitle && !hasDescription) return;

        // Crea l'overlay
        const overlay = document.createElement('div');
        overlay.className = 'panorama-info-overlay';
        overlay.style.cssText = `
            position: absolute;
            bottom: 150px;
            left: calc(50% - 200px);
            transform: translateX(-50%) translateY(20px);
            width: 400px;
            max-width: 400px;
            background: linear-gradient(135deg, rgba(26, 26, 26, 0.9) 0%, rgba(45, 45, 45, 0.85) 100%);
            color: #e5e5e5;
            padding: 20px 24px;
            border-radius: 16px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            z-index: 1000;
            opacity: 0;
            transition: all 0.4s ease-out;
            pointer-events: auto;
            cursor: pointer;
        `;

        // Aggiungi contenuto
        let content = '';

        if (hasTitle) {
            content += `<h3 style="
                margin: 0 0 ${hasDescription ? '12px' : '0'} 0;
                font-size: 18px;
                font-weight: 600;
                color: #ffffff;
                line-height: 1.3;
            ">${panoramaData.title}</h3>`;
        }

        if (hasDescription) {
            content += `<p style="
                margin: 0;
                font-size: 14px;
                line-height: 1.5;
                color: #d0d0d0;
                opacity: 0.9;
            ">${panoramaData.description}</p>`;
        }

        // Aggiungi icona di chiusura
        content += `<div style="
            position: absolute;
            top: 8px;
            right: 12px;
            width: 24px;
            height: 24px;
            cursor: pointer;
            opacity: 0.6;
            transition: opacity 0.2s ease;
            font-size: 18px;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
        " class="close-overlay">×</div>`;

        overlay.innerHTML = content;
        container.appendChild(overlay);

        // Animazione di entrata
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            overlay.style.transform = 'translateY(0)';
        });

        // Gestione eventi
        const closeBtn = overlay.querySelector('.close-overlay');

        // Hover sulla X
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.opacity = '1';
            closeBtn.style.transform = 'scale(1.1)';
        });

        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.opacity = '0.6';
            closeBtn.style.transform = 'scale(1)';
        });

        // Click per chiudere
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            overlay.style.opacity = '0';
            overlay.style.transform = 'translateY(20px)';
            setTimeout(() => overlay.remove(), 400);
        });

        // Auto-hide dopo 8 secondi
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.style.opacity = '0';
                overlay.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    if (overlay.parentNode) overlay.remove();
                }, 400);
            }
        }, 8000);
    }

    /**
     * Configura il panorama nel visualizzatore
     * Equivalente del _setupPanorama() del backend
     */
    function setupPanorama(containerId, panoramaData, fadeOverlay = null) {
        const container = document.getElementById(containerId);
        const viewer = panoramaViewers[containerId];

        if (typeof THREE === 'undefined') {
            console.error('THREE.js non disponibile');
            removeLoadingSpinner(container);
            container.innerHTML = '<p class="risviel-error">THREE.js non disponibile</p>';
            return;
        }

        try {
            // NON rimuovere lo spinner qui - deve rimanere durante il caricamento

            // Inizializza Three.js se non esiste
            if (!viewer.scene) {
                initThreeJsSystem(viewer, container);
            }

            // Carica texture panorama
            const loader = new THREE.TextureLoader();
            loader.load(
                panoramaData.image_url,
                function(texture) {
                    // PULIZIA COMPLETA DELLA SCENA PRECEDENTE

                    // Rimuovi panorama precedente
                    if (viewer.panoramaMesh) {
                        viewer.scene.remove(viewer.panoramaMesh);
                        if (viewer.panoramaMesh.geometry) viewer.panoramaMesh.geometry.dispose();
                        if (viewer.panoramaMesh.material) {
                            if (viewer.panoramaMesh.material.map) viewer.panoramaMesh.material.map.dispose();
                            viewer.panoramaMesh.material.dispose();
                        }
                        viewer.panoramaMesh = null;
                    }

                    // Rimuovi tutte le aree interattive precedenti
                    removeInteractiveAreas(viewer);

                    // Rimuovi tutti gli indicatori precedenti
                    removeIndicators(viewer);

                    // Pulisci array degli hotspots
                    viewer.activeHotspots = [];

                    // Crea nuovo panorama
                    createPanoramaSphere(viewer, texture);

                    // Carica nuove aree interattive
                    if (panoramaData.interactive_areas && panoramaData.interactive_areas.length > 0) {
                        renderInteractiveAreas(viewer, panoramaData.interactive_areas);
                    }

                    // Carica nuovi indicatori
                    if (panoramaData.indicators && panoramaData.indicators.length > 0) {
                        renderIndicators(viewer, panoramaData.indicators);
                    }

                    // Setup gestione eventi per interazioni
                    setupEventHandlers(viewer);

                    // Avvia rendering
                    startRenderLoop(viewer);

                    // Aspetta un frame per assicurarsi che tutto sia renderizzato
                    requestAnimationFrame(() => {
                        // Rimuovi lo spinner DOPO che tutto è stato caricato e renderizzato
                        removeLoadingSpinner(container);

                        // Esegui fade in se c'è un overlay
                        if (fadeOverlay) {
                            fadeTransition(viewer, fadeOverlay, false);
                        }
                    });
                },
                function(progress) {
                    // Progress callback - opzionale
                    // Potresti aggiungere qui un indicatore di progresso se vuoi
                    console.log('Caricamento texture:', Math.round((progress.loaded / progress.total) * 100) + '%');
                },
                function(error) {
                    console.error('Errore caricamento texture:', error);
                    removeLoadingSpinner(container);
                    container.innerHTML = '<p class="risviel-error">Errore caricamento immagine</p>';

                    if (fadeOverlay) {
                        fadeTransition(viewer, fadeOverlay, false);
                    }
                }
            );

        } catch (error) {
            console.error('Errore setup panorama:', error);
            removeLoadingSpinner(container);
            container.innerHTML = '<p class="risviel-error">Errore configurazione panorama</p>';

            if (fadeOverlay) {
                fadeTransition(viewer, fadeOverlay, false);
            }
        }
    }

     /**
     * Setup gestori eventi per interazioni
     */
    function setupEventHandlers(viewer) {
        const element = viewer.renderer.domElement;

        // Rimuovi gestori precedenti per evitare duplicati
        if (viewer._clickHandler) {
            element.removeEventListener('click', viewer._clickHandler);
            element.removeEventListener('touchend', viewer._touchHandler);
        }
        element.removeEventListener('mousemove', viewer._hoverHandler);

        // Crea nuovi gestori
        viewer._clickHandler = (event) => {
            // Gestisci click solo se non è stato un movimento di navigazione
            const debugMode = window.controlsConfig ? window.controlsConfig.debug : false;
            if (debugMode) {
                console.log('🖱️ Click/Touch event ricevuto:', event.type);
            }
            handleInteraction(viewer, event, event.type.includes('touch') ? 'touch' : 'mouse');
        };

        viewer._touchHandler = (event) => {
            // Gestisci touchend come potenziale click
            // Solo se non c'è stato movimento significativo
            if (event.changedTouches && event.changedTouches.length === 1) {
                const touch = event.changedTouches[0];
                const syntheticEvent = {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    preventDefault: () => {},
                    stopPropagation: () => {},
                    type: 'touchend'
                };

                // Piccolo delay per assicurarsi che il controllo abbia finito di gestire l'evento
                setTimeout(() => {
                    const debugMode = window.controlsConfig ? window.controlsConfig.debug : false;
                    if (debugMode) {
                        console.log('🖱️ TouchEnd sintetico per interazione');
                    }
                    handleInteraction(viewer, syntheticEvent, 'touch');
                }, 10);
            }
        };

        viewer._hoverHandler = (event) => handleHover(viewer, event);

        // Aggiungi gestori
        element.addEventListener('click', viewer._clickHandler);
        element.addEventListener('touchend', viewer._touchHandler, { passive: true });
        element.addEventListener('mousemove', viewer._hoverHandler);
    }

    /**
     * Rimuove tutte le aree interattive dalla scena
     */
    function removeInteractiveAreas(viewer) {
        if (!viewer.activeHotspots) return;

        // Rimuovi ogni area dalla scena e pulisci le risorse
        viewer.activeHotspots.forEach(hotspot => {
            if (hotspot.mesh) {
                viewer.scene.remove(hotspot.mesh);

                // Dispose delle geometrie e materiali
                if (hotspot.mesh.geometry) {
                    hotspot.mesh.geometry.dispose();
                }

                // Se è un gruppo, pulisci tutti i children
                if (hotspot.mesh.children) {
                    hotspot.mesh.children.forEach(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (child.material.map) child.material.map.dispose();
                            child.material.dispose();
                        }
                    });
                }

                // Pulisci il materiale principale
                if (hotspot.mesh.material) {
                    if (hotspot.mesh.material.map) hotspot.mesh.material.map.dispose();
                    hotspot.mesh.material.dispose();
                }
            }
        });

        // Svuota l'array
        viewer.activeHotspots = [];
    }

    /**
     * Rimuove tutti gli indicatori dalla scena
     */
    function removeIndicators(viewer) {
        if (!viewer.activeIndicators) return;

        // Rimuovi ogni indicatore dalla scena e pulisci le risorse
        viewer.activeIndicators.forEach(indicator => {
            if (indicator.mesh) {
                viewer.scene.remove(indicator.mesh);

                // Dispose delle geometrie e materiali
                if (indicator.mesh.geometry) {
                    indicator.mesh.geometry.dispose();
                }

                // Se è un gruppo, pulisci tutti i children
                if (indicator.mesh.children) {
                    indicator.mesh.children.forEach(child => {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (child.material.map) child.material.map.dispose();
                            child.material.dispose();
                        }
                    });
                }

                // Pulisci il materiale principale
                if (indicator.mesh.material) {
                    if (indicator.mesh.material.map) indicator.mesh.material.map.dispose();
                    indicator.mesh.material.dispose();
                }
            }
        });

        // Svuota l'array
        viewer.activeIndicators = [];
    }

    /**
     * Inizializza Three.js
     */
    function initThreeJsSystem(viewer, container) {
        // Scena
        viewer.scene = new THREE.Scene();

        // Camera
        viewer.camera = new THREE.PerspectiveCamera(
            panoramaConfig.defaultFOV,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        viewer.camera.position.set(0, 0, 0);

        // Renderer
        viewer.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: false
        });
        viewer.renderer.setSize(container.clientWidth, container.clientHeight);
        viewer.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(viewer.renderer.domElement);

        // Setup resize
        setupResize(viewer, container);

        // NON setup dei controlli qui - sarà gestito dal file controls
        // Il file controls.js si attacca automaticamente ai viewer quando sono pronti

        // Setup interazioni
        setupInteractions(viewer);

        // Avvia loop di rendering
        startRenderLoop(viewer);
    }

    /**
     * Setup ridimensionamento del viewer
     */
    function setupResize(viewer, container) {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;

                if (width > 0 && height > 0) {
                    // Aggiorna camera
                    viewer.camera.aspect = width / height;
                    viewer.camera.updateProjectionMatrix();

                    // Aggiorna renderer
                    viewer.renderer.setSize(width, height);
                }
            }
        });

        resizeObserver.observe(container);

        // Salva riferimento per cleanup
        viewer._resizeObserver = resizeObserver;

        // Fallback per browser che non supportano ResizeObserver
        if (!window.ResizeObserver) {
            const handleResize = () => {
                const width = container.clientWidth;
                const height = container.clientHeight;

                if (width > 0 && height > 0) {
                    viewer.camera.aspect = width / height;
                    viewer.camera.updateProjectionMatrix();
                    viewer.renderer.setSize(width, height);
                }
            };

            window.addEventListener('resize', handleResize);
            viewer._resizeHandler = handleResize;
        }
    }

    /**
     * Setup interazioni base del viewer
     */
    function setupInteractions(viewer) {
        // Imposta lo stile del canvas per il cursore
        if (viewer.renderer && viewer.renderer.domElement) {
            viewer.renderer.domElement.style.cursor = 'grab';
        }

        // Gli eventi di interazione saranno gestiti dal file controls.js
        // che si attacca automaticamente ai viewer quando sono pronti
    }



    function runATON(){
        let APP = ATON.App.realize();
        window.APP = APP;
        // Tell ATON to configure paths and resources as standalone
        ATON.setAsStandalone();

        // This is our assets root folder
        // In this sample App, scene descriptors (.json) are also placed there, but you are free to organize folders as you like
        APP.assetsPath = APP.basePath + "assets/";

        // Tell ATON to look for 3D content here
        ATON.setPathCollection(APP.assetsPath);

        // APP.setup() is required for web-app initialization
        // You can place here UI setup (HTML), events handling, etc.
        APP.setup = ()=>{
            ATON.FE.realize(); // Realize the base front-end
            ATON.FE.addBasicLoaderEvents(); // Add basic events handling

            // Sample params to load a 3D model or scene
            // E.g.: ?m=atoncube.glb or ?s=scene
            let model = APP.params.get('m');
            let scene = APP.params.get('s');

            // If model is provided, load it under the "main" node
            if (model) ATON.createSceneNode("main").load(model).attachToRoot();

            // If a scene is provided, load the JSON descriptor and assign the scene ID "sample-scene"
            if (scene) ATON.SceneHub.load(APP.assetsPath + scene + ".json", "sample-scene");

            // Setup minimal UI
            ATON.FE.uiAddButtonHome("idBottomToolbar");

            ATON.FE.uiAddButtonFullScreen("idTopToolbar");
            ATON.FE.uiAddButtonNav("idTopToolbar");
            ATON.FE.uiAddButtonVR("idTopToolbar");
        };

        window.addEventListener('load',()=>{
            APP.run();
        });
    }

    /**
     * Crea la sfera del panorama
     * Stesso codice del backend
     */
    function createPanoramaSphere(viewer, texture) {
        // Rimuovi mesh precedente
        if (viewer.panoramaMesh) {
            viewer.scene.remove(viewer.panoramaMesh);
        }

        // Stessa geometria del backend
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1); // Stesso scaling del backend

        // Stesso materiale del backend
        const material = new THREE.MeshBasicMaterial({ map: texture });

        viewer.panoramaMesh = new THREE.Mesh(geometry, material);
        viewer.scene.add(viewer.panoramaMesh);
    }

    /**
     * Setup controlli camera semplici (versione originale)
     */
    function setupSimpleControls(viewer) {
        let isMouseDown = false;
        let previousMousePosition = { x: 0, y: 0 };
        let phi = 0, theta = 0;

        const element = viewer.renderer.domElement;
        element.style.cursor = 'grab';

        element.addEventListener('mousedown', function(event) {
            isMouseDown = true;
            previousMousePosition.x = event.clientX;
            previousMousePosition.y = event.clientY;
            element.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', function(event) {
            if (!isMouseDown) return;

            const deltaMove = {
                x: event.clientX - previousMousePosition.x,
                y: event.clientY - previousMousePosition.y
            };

            const rotationSpeed = 0.002;
            theta -= deltaMove.x * rotationSpeed;
            phi -= deltaMove.y * rotationSpeed;

            phi = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, phi));

            updateCameraRotation(viewer, phi, theta);
            updateIndicatorsOrientation(viewer);

            previousMousePosition.x = event.clientX;
            previousMousePosition.y = event.clientY;
        });

        document.addEventListener('mouseup', function() {
            isMouseDown = false;
            element.style.cursor = 'grab';
        });

        // Touch events
        element.addEventListener('touchstart', function(event) {
            event.preventDefault();
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                isMouseDown = true;
                previousMousePosition.x = touch.clientX;
                previousMousePosition.y = touch.clientY;
            }
        });

        element.addEventListener('touchmove', function(event) {
            event.preventDefault();
            if (!isMouseDown || event.touches.length !== 1) return;

            const touch = event.touches[0];
            const deltaMove = {
                x: touch.clientX - previousMousePosition.x,
                y: touch.clientY - previousMousePosition.y
            };

            const rotationSpeed = 0.002;
            theta -= deltaMove.x * rotationSpeed;
            phi -= deltaMove.y * rotationSpeed;

            phi = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, phi));

            updateCameraRotation(viewer, phi, theta);
            updateIndicatorsOrientation(viewer);

            previousMousePosition.x = touch.clientX;
            previousMousePosition.y = touch.clientY;
        });

        element.addEventListener('touchend', function(event) {
            event.preventDefault();
            isMouseDown = false;
        });

        // Wheel zoom
        element.addEventListener('wheel', function(event) {
            event.preventDefault();
            const delta = event.deltaY;
            viewer.camera.fov += delta * 0.05;
            viewer.camera.fov = Math.max(30, Math.min(90, viewer.camera.fov));
            viewer.camera.updateProjectionMatrix();
        });

        function updateCameraRotation(viewer, phi, theta) {
            const quaternion = new THREE.Quaternion();
            const xQuaternion = new THREE.Quaternion();
            xQuaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), phi);

            const yQuaternion = new THREE.Quaternion();
            yQuaternion.setFromAxisAngle(new THREE.Vector3(0, -1, 0), theta);

            quaternion.multiplyQuaternions(yQuaternion, xQuaternion);
            viewer.camera.quaternion.copy(quaternion);
        }
    }

    /**
     * Rendering delle aree interattive
     * Stesso codice del renderInteractiveAreas() del backend
     */
    function renderInteractiveAreas(viewer, areasData) {
        if (panoramaConfig.debug) {
            console.log("Frontend: Rendering aree interattive:", areasData.length);
        }

        // NON rimuovere aree precedenti qui - sono già state rimosse in loadPanoramaData()
        // Assicuriamoci solo che l'array sia pulito
        if (!viewer.activeHotspots) {
            viewer.activeHotspots = [];
        }

        try {
            for (let i = 0; i < areasData.length; i++) {
                if (panoramaConfig.debug) {
                    console.log("Frontend: Processando area:", areasData[i]);
                }

                // Crea area interattiva (stesso codice del backend)
                const areaObj = createSimpleInteractiveArea(areasData[i]);
                if (areaObj && areaObj.mesh) {
                    viewer.scene.add(areaObj.mesh);
                    viewer.activeHotspots.push(areaObj);

                    if (panoramaConfig.debug) {
                        console.log("Frontend: Area aggiunta alla scena:", areasData[i].id);
                    }
                }
            }
        } catch (e) {
            console.error("Frontend: Errore nel rendering dell'area:", e);
        }
    }


    /**
     * Crea un'area interattiva
     * STESSO CODICE del createSimpleInteractiveArea() del backend
     */
    function createSimpleInteractiveArea(areaData) {
        try {
            //console.log("Frontend: Creazione area per ID:", areaData.id);

            // Le coordinate arrivano già convertite dal PHP
            let coordinates = areaData.coordinates;

            //console.log("Frontend: Coordinate ricevute:", coordinates);

            // Verifica formato coordinate (stesso controllo del backend)
            if (!Array.isArray(coordinates) || coordinates.length < 3) {
                console.error("Frontend: Coordinate non valide:", coordinates);
                return null;
            }

            // Le coordinate sono in formato UV (0-1), riconvertiamo in 3D
            const points3D = coordinates.map(coord => {
                const phi = (1 - coord.y) * Math.PI; // 0 a PI
                const theta = (coord.x - 0.5) * 2 * Math.PI; // -PI a PI
                const radius = 490; // Stesso raggio del backend

                const x = radius * Math.sin(phi) * Math.cos(theta);
                const y = radius * Math.cos(phi);
                const z = radius * Math.sin(phi) * Math.sin(theta);

                return new THREE.Vector3(x, y, z);
            });

            // Calcola centro (stesso del backend)
            const center = new THREE.Vector3();
            for (const point of points3D) {
                center.add(point);
            }
            center.divideScalar(points3D.length);

            // Normalizza e posiziona sulla sfera (stesso del backend)
            const sphereRadius = 490;
            const direction = center.clone().normalize();
            const positionOnSphere = direction.multiplyScalar(sphereRadius);

            // Crea gruppo (stesso del backend)
            const group = new THREE.Group();
            group.position.copy(positionOnSphere);

            // Crea shape 2D (stesso processo del backend)
            const shape = new THREE.Shape();

            // Stessa proiezione 2D del backend
            const up = new THREE.Vector3(0, 1, 0);
            const right = new THREE.Vector3().crossVectors(direction, up).normalize();
            const newUp = new THREE.Vector3().crossVectors(right, direction).normalize();

            const projectedPoints = [];
            for (const point of points3D) {
                const pointVec = new THREE.Vector3().subVectors(point, center);
                const x = pointVec.dot(right);
                const y = pointVec.dot(newUp);
                projectedPoints.push({ x, y });
            }

            // Costruisci shape (stesso del backend)
            shape.moveTo(projectedPoints[0].x, projectedPoints[0].y);
            for (let i = 1; i < projectedPoints.length; i++) {
                shape.lineTo(projectedPoints[i].x, projectedPoints[i].y);
            }
            shape.lineTo(projectedPoints[0].x, projectedPoints[0].y);

            // Stessa geometria del backend
            const shapeGeometry = new THREE.ShapeGeometry(shape);

            // STESSO MATERIALE del backend
            const fillMaterial = new THREE.MeshBasicMaterial({
                color: 0xff00ff,        // Magenta (stesso del backend)
                transparent: true,
                opacity: 0.6,          // Stessa opacità del backend
                side: THREE.DoubleSide,
                depthTest: false
            });

            const fillMesh = new THREE.Mesh(shapeGeometry, fillMaterial);
            fillMesh.lookAt(new THREE.Vector3(0, 0, 0).sub(group.position));
            group.add(fillMesh);

            // STESSE PROPRIETÀ di animazione del backend
            group._isIncreasing = true;
            group._pulseSpeed = 0.5;
            group._pulseMin = 0.05;
            group._pulseMax = 0.4;
            group._isHovered = false;
            group._material = fillMaterial;

            // STESSE FUNZIONI del backend
            group.update = function() {
                if (group._isHovered) return;

                if (group._isIncreasing) {
                    group._material.opacity += 0.01 * group._pulseSpeed;
                    if (group._material.opacity >= group._pulseMax) {
                        group._material.opacity = group._pulseMax;
                        group._isIncreasing = false;
                    }
                } else {
                    group._material.opacity -= 0.01 * group._pulseSpeed;
                    if (group._material.opacity <= group._pulseMin) {
                        group._material.opacity = group._pulseMin;
                        group._isIncreasing = true;
                    }
                }
            };

            group.onMouseOver = function() {
                group._isHovered = true;
                group._material.color.setHex(0x00ff00); // Verde
                group._material.opacity = 0.4;
                group._material.needsUpdate = true;
            };

            group.onMouseOut = function() {
                group._isHovered = false;
                group._material.color.setHex(0xff00ff); // Magenta
                group._material.opacity = group._pulseMin;
                group._isIncreasing = true;
                group._material.needsUpdate = true;
            };

            // Stessi userData del backend
            group.userData = {
                areaId: areaData.id,
                title: areaData.title || 'Area ' + areaData.id,
                content: areaData.content || '',
                actionType: areaData.action_type || '',
                actionTarget: areaData.action_target || ''
            };

            // Stessa callback del backend
            group.callback = function() {
                //console.log("Frontend: Area cliccata:", group.userData);
                showInteractivePanel(areaData);
            };

            //console.log("Frontend: Area creata con successo per ID:", areaData.id);

            return {
                mesh: group,
                data: areaData
            };

        } catch (e) {
            console.error("Frontend: Errore nella creazione dell'area:", e);
            return null;
        }
    }

    /**
     * Mostra pannello informativo
     * Stesso del backend
     */
    function showInteractivePanel(areaData) {
        const panelHtml = `
            <div id="idPanel" class="atonSidePanelContainer" style="position: fixed; top: 20px; right: 20px; width: 300px; background: white; border: 1px solid #ccc; padding: 20px; z-index: 1000;">
                <div class="atonPopupTitle" style="background: #bf7b37; color: white; padding: 10px; margin: -20px -20px 10px -20px;">
                    <div id="idPanelClose" style="float: right; cursor: pointer; font-weight: bold;">X</div>
                    <div id="idPanelTitle">${areaData.title || 'Area ' + areaData.id}</div>
                </div>
                <div id="atonSidePanelContent">
                    <div class="descriptionText">
                        <div>${areaData.content || 'Nessuna descrizione disponibile'}</div>
                    </div>
                </div>
            </div>
        `;

        $('#idPanel').remove();
        $('body').append(panelHtml);

        $('#idPanelClose').on('click', function() {
            $('#idPanel').remove();
        });
    }

    /**
     * Gestione interazione con le aree (click e touch) per aree e indicatori
     */
    function handleInteraction (viewer, event, interactionType) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const rect = viewer.renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / viewer.renderer.domElement.offsetWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / viewer.renderer.domElement.offsetHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, viewer.camera);

        // Combina tutti gli oggetti interattivi (aree + indicatori)
        const interactiveObjects = [];

        // Aggiungi le aree
        if (viewer.activeHotspots) {
            viewer.activeHotspots.forEach(hotspot => {
                if (hotspot.mesh) interactiveObjects.push(hotspot.mesh);
            });
        }

        // Aggiungi gli indicatori
        if (viewer.activeIndicators) {
            viewer.activeIndicators.forEach(indicator => {
                if (indicator.mesh) interactiveObjects.push(indicator.mesh);
            });
        }

        const intersects = raycaster.intersectObjects(interactiveObjects, true);


        if (intersects.length > 0) {
            let obj = intersects[0].object;

            // Trova l'oggetto parent con callback o azione
            while (obj && obj.parent && !obj.callback && !obj.userData.isIndicator) {
                obj = obj.parent;
            }

            if (obj) {
                if (obj.callback) {
                    // È un'area interattiva
                    //console.log(`Area ${interactionType}:`, obj.userData);
                    obj.callback();
                } else if (obj.userData.isIndicator) {
                    // È un indicatore
                    //console.log(`Indicatore ${interactionType}:`, obj.userData);
                    handleIndicatorClick(obj.userData);
                }
            }
        }
    }

    /**
     * Gestione click sulle aree
     * Stesso del setupAreaClickHandler() del backend
     */
    function handleAreaClick(viewer, event) {
        handleAreaInteraction(viewer, event, 'click');
    }

    /**
     * Gestione hover unificata per aree e indicatori
     */
    function handleHover(viewer, event) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const rect = viewer.renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / viewer.renderer.domElement.offsetWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / viewer.renderer.domElement.offsetHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, viewer.camera);

        // Combina tutti gli oggetti interattivi (aree + indicatori)
        const interactiveObjects = [];

        // Aggiungi le aree
        if (viewer.activeHotspots) {
            viewer.activeHotspots.forEach(hotspot => {
                if (hotspot.mesh) interactiveObjects.push(hotspot.mesh);
            });
        }

        // Aggiungi gli indicatori
        if (viewer.activeIndicators) {
            viewer.activeIndicators.forEach(indicator => {
                if (indicator.mesh) interactiveObjects.push(indicator.mesh);
            });
        }

        const intersects = raycaster.intersectObjects(interactiveObjects, true);

        // Reset hover precedente
        if (viewer._hoveredObject) {
            if (viewer._hoveredObject.onMouseOut) {
                viewer._hoveredObject.onMouseOut();
            } else if (viewer._hoveredObject.onHover) {
                viewer._hoveredObject.onHover(false);
            }
            viewer._hoveredObject = null;
        }

        // Gestisci hover nuovo oggetto
        if (intersects.length > 0) {
            let obj = intersects[0].object;

            // Trova l'oggetto parent con funzioni hover
            while (obj && obj.parent && !obj.onMouseOver && !obj.onHover && !obj.userData.isIndicator) {
                obj = obj.parent;
            }

            if (obj) {
                viewer._hoveredObject = obj;

                if (obj.onMouseOver && !obj._isHovered) {
                    // Area interattiva
                    obj.onMouseOver();
                    viewer.renderer.domElement.style.cursor = 'pointer';
                } else if (obj.userData.isIndicator) {
                    // Indicatore
                    if (obj.onHover) {
                        obj.onHover(true);
                    }
                    viewer.renderer.domElement.style.cursor = 'pointer';
                }
            }
        } else {
            // Nessun oggetto sotto il mouse
            viewer.renderer.domElement.style.cursor = 'grab';
        }
    }

    /**
     * Gestione click su indicatori
     */
    function handleIndicatorClick(indicatorData) {
        console.log('Frontend: Click su indicatore:', indicatorData);
        hideTooltip();
        switch (indicatorData.actionType) {
            case 'panorama':
                if (indicatorData.actionTarget) {
                    // Mostra immediatamente lo spinner
                    const firstViewer = Object.keys(panoramaViewers)[0];
                    if (firstViewer) {
                        const container = panoramaViewers[firstViewer].container;
                        const panoramaId = indicatorData.actionTarget;
                        const language = 'it';


                        // Carica il nuovo panorama nel viewer esistente
                        console.log('Caricamento immediato panorama:', panoramaId);
                        loadPanoramaData(firstViewer, panoramaId, language);

                        // Aggiorna anche l'URL del browser senza ricaricare la pagina
                        const currentUrl = new URL(window.location.href);
                        currentUrl.searchParams.set('id', panoramaId);
                        currentUrl.searchParams.set('lang', language);

                        // Usa pushState per aggiornare l'URL senza ricaricare
                        window.history.pushState(
                            { panoramaId: panoramaId, language: language },
                            '',
                            currentUrl.toString()
                        );
                    } else {
                        // Fallback: naviga normalmente se non c'è viewer
                        console.log('Navigazione normale - nessun viewer disponibile');
                        navigateToPanorama(indicatorData.actionTarget);
                    }
                }
                break;

            case 'video':
                if (indicatorData.actionTarget) {
                    // Apri video
                    showMediaPanel(indicatorData, 'video');
                }
                break;

            case 'audio':
                if (indicatorData.actionTarget) {
                    // Apri audio
                    showMediaPanel(indicatorData, 'audio');
                }
                break;

            case 'pdf':
                if (indicatorData.actionTarget) {
                    // Apri PDF
                    showMediaPanel(indicatorData, 'pdf');
                    //window.open(indicatorData.actionTarget, '_blank');
                }
                break;

            case 'image':
                if (indicatorData.actionTarget) {
                    // Apri Immagine
                    showMediaPanel(indicatorData, 'image');
                    //window.open(indicatorData.actionTarget, '_blank');
                }
                break;

            default:
                console.log('Tipo di azione non gestito:', indicatorData.actionType);
        }
    }

    /**
     * Funzione di fallback per navigazione normale
     */
    function navigateToPanorama(panoramaId) {
        const language = 'it';
        const panoramaPageId = risviel_gisdoc_public.panorama_page_id || '';

        let url;
        if (panoramaPageId) {
            url = `${window.location.origin}${window.location.pathname}../${panoramaPageId}?id=${panoramaId}&lang=${language}`;
        } else {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('id', panoramaId);
            currentUrl.searchParams.set('lang', language);
            url = currentUrl.toString();
        }

        window.location.href = url;
    }

    /**
     * Mostra pannello media per video/audio/pdf/image
     */
    function showMediaPanel(indicatorData, mediaType) {
        let mediaElement = '';
        let isLargeView = false;

        // Determina se usare la vista grande
        if (mediaType === 'video' || mediaType === 'pdf' || mediaType === 'image') {
            isLargeView = true;
        }

        if (mediaType === 'video') {
            mediaElement = `<video controls autoplay style="width: 100%; height: ${isLargeView ? '70vh' : '600px'}; max-height: 62vh !important;">
                                <source src="${indicatorData.actionTarget}" type="video/mp4">
                                Il tuo browser non supporta il tag video.
                            </video>`;
        } else if (mediaType === 'audio') {
            mediaElement = `<audio controls autoplay style="width: 100%;">
                <source src="${indicatorData.actionTarget}" type="audio/mpeg">
                Il tuo browser non supporta il tag audio.
            </audio>`;
        } else if (mediaType === 'image') {
            mediaElement = `<img src="${indicatorData.actionTarget}" style="width: 100%; height: ${isLargeView ? '70vh' : '600px'}; max-height: 62vh !important;"/>`;
        } else if (mediaType === 'pdf') {
            mediaElement = `<iframe src="${indicatorData.actionTarget}" 
                                style="width: 100%; height: 62vh; border: none;">
                                Il tuo browser non supporta la visualizzazione di PDF.
                            </iframe>`;
        }

        // Stili per finestra grande o piccola
        const panelStyles = isLargeView
            ? "position: fixed; top: 10vh !important; left: 10vw; width: 80vw !important; height: 80vh; background: white; border: 1px solid #ccc; padding: 20px; z-index: 1000; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);"
            : "position: fixed; top: 20px; right: 20px; width: 350px; background: white; border: 1px solid #ccc; padding: 20px; z-index: 1000; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);";

        const panelHtml = `
            <div id="idPanel" class="atonSidePanelContainer" style="${panelStyles}">
                <div class="atonPopupTitle" style="background: #bf7b37; color: white; padding: 10px; margin: -20px -20px 15px -20px; border-radius: 8px 8px 0 0;">
                    <div id="idPanelClose" style="float: right; cursor: pointer; font-weight: bold; font-size: 18px;">&times;</div>
                    <div id="idPanelTitle">${indicatorData.title}</div>
                </div>
                <div id="atonSidePanelContent" style="height: ${isLargeView ? 'calc(100% - 60px)' : 'auto'}; overflow: auto;">
                    ${mediaElement}
                </div>
            </div>
        `;

        // Aggiungi overlay di sfondo per la vista grande
        if (isLargeView) {
            const overlayHtml = `<div id="idPanelOverlay" style="position: fixed; top: 0; left: 0; width: 100vw; max-width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); z-index: 999;"></div>`;
            $('body').append(overlayHtml);
        }

        $('#idPanel').remove();
        $('body').append(panelHtml);

        // Gestione chiusura
        $('#idPanelClose, #idPanelOverlay').on('click', function() {
            $('#idPanel').remove();
            $('#idPanelOverlay').remove();
        });

        // Chiudi con ESC per la vista grande
        if (isLargeView) {
            $(document).on('keydown.mediaPanel', function(e) {
                if (e.key === 'Escape') {
                    $('#idPanel').remove();
                    $('#idPanelOverlay').remove();
                    $(document).off('keydown.mediaPanel');
                }
            });
        }
    }

    /**
     * Gestione interazione con le aree (backward compatibility)
     */
    function handleAreaInteraction(viewer, event, interactionType) {
        return handleInteraction(viewer, event, interactionType);
    }

    /**
     * Gestione hover sulle aree (backward compatibility)
     */
    function handleAreaHover(viewer, event) {
        return handleHover(viewer, event);
    }

    /**
     * Loop di rendering
     * Stesso del animate() del backend
     */
    function startRenderLoop(viewer) {
        // Ferma il loop precedente se esiste
        if (viewer.animationId) {
            cancelAnimationFrame(viewer.animationId);
        }

        function animate() {
            viewer.animationId = requestAnimationFrame(animate);

            // Aggiorna tutte le aree (stesso del backend)
            for (let i = 0; i < viewer.activeHotspots.length; i++) {
                const hotspot = viewer.activeHotspots[i];
                if (hotspot.mesh && typeof hotspot.mesh.update === 'function') {
                    hotspot.mesh.update();
                }
            }

            // Aggiorna le animazioni degli indicatori
            if (viewer.activeIndicators) {
                viewer.activeIndicators.forEach(indicator => {
                    if (indicator.mesh && indicator.mesh.update) {
                        indicator.mesh.update();
                    }
                });
            }

            // Aggiorna l'orientamento degli indicatori verso la camera
            updateIndicatorsOrientation(viewer);

            // Rendering
            if (viewer.renderer && viewer.scene && viewer.camera) {
                viewer.renderer.render(viewer.scene, viewer.camera);
            }
        }
        animate();
    }

    // Gestione ridimensionamento
    window.addEventListener('resize', function() {
        Object.keys(panoramaViewers).forEach(containerId => {
            const viewer = panoramaViewers[containerId];
            if (viewer && viewer.camera && viewer.renderer) {
                const container = viewer.container;
                viewer.camera.aspect = container.clientWidth / container.clientHeight;
                viewer.camera.updateProjectionMatrix();
                viewer.renderer.setSize(container.clientWidth, container.clientHeight);
            }
        });
    });

    // Esposizione globale della funzione di inizializzazione
    window.initPanoramaViewer = initPanoramaViewer;

    /**
     * Carica le icone degli indicatori
     */
    function loadIndicatorIcons(viewer) {
        // Usa i path corretti per il frontend
        const iconPaths = {
            'panorama': risviel_gisdoc_public.plugin_url + 'admin/icons/panorama-icon.png',
            'video': risviel_gisdoc_public.plugin_url + 'admin/icons/video-icon.png',
            'audio': risviel_gisdoc_public.plugin_url + 'admin/icons/audio-icon.png',
            'pdf': risviel_gisdoc_public.plugin_url + 'admin/icons/pdf-icon.png',
            'default': risviel_gisdoc_public.plugin_url + 'admin/icons/default-icon.png'
        };

        const textureLoader = new THREE.TextureLoader();

        for (const [type, path] of Object.entries(iconPaths)) {
            textureLoader.load(
                path,
                (texture) => {
                    if (!viewer.indicatorIcons) viewer.indicatorIcons = {};
                    viewer.indicatorIcons[type] = texture;
                },
                undefined,
                (error) => {
                    console.warn(`Impossibile caricare l'icona ${type}, uso fallback`);
                    if (!viewer.indicatorIcons) viewer.indicatorIcons = {};
                    viewer.indicatorIcons[type] = createFallbackTexture(type);
                }
            );
        }
    }

    /**
     * Crea una texture di fallback usando canvas
     */
    function createFallbackTexture(type) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d');

        // Colori per tipo
        const colors = {
            'panorama': '#0080ff',
            'video': '#ff0080',
            'audio': '#ff8000',
            'pdf': '#8000ff',
            'image': '#00c080',
            'default': '#00ff00'
        };

        // Simboli per tipo
        const symbols = {
            'panorama': '360°',
            'video': '▶',
            'audio': '♪',
            'pdf': 'PDF',
            'image': '🖼',
            'default': '●'
        };

        // Disegna il background
        context.fillStyle = colors[type] || colors.default;
        context.beginPath();
        context.arc(32, 32, 28, 0, Math.PI * 2);
        context.fill();

        // Disegna il simbolo
        context.fillStyle = 'white';
        context.font = 'bold 20px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(symbols[type] || symbols.default, 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    /**
     * Ottiene il colore per un tipo di indicatore
     */
    function getIndicatorColor(actionType) {
        const colors = {
            'panorama': 0x0080ff,
            'video': 0xff0080,
            'audio': 0xff8000,
            'pdf': 0x8000ff,
            'image': 0x0c080,
            'default': 0x00ff00
        };
        return colors[actionType] || colors.default;
    }

    /**
     * Crea la mesh per un indicatore avanzato
     * @param {Object} indicatorData - Dati dell'indicatore
     * @param {Object} viewer - Oggetto viewer
     * @returns {Object} Oggetto con la mesh e i dati dell'indicatore
     */
    function createIndicatorMesh(indicatorData, viewer) {
        try {
            //console.log('Frontend: Creazione mesh indicatore:', indicatorData);

            // Gestisci diverse strutture per la posizione
            let position;
            if (indicatorData.position) {
                position = new THREE.Vector3(
                    parseFloat(indicatorData.position.x),
                    parseFloat(indicatorData.position.y),
                    parseFloat(indicatorData.position.z)
                );
            } else {
                position = new THREE.Vector3(
                    parseFloat(indicatorData.position_x || indicatorData.x || 0),
                    parseFloat(indicatorData.position_y || indicatorData.y || 0),
                    parseFloat(indicatorData.position_z || indicatorData.z || 0)
                );
            }

            // Normalizza la posizione e posizionala sulla sfera
            const sphereRadius = 485;
            const direction = position.clone().normalize();
            const positionOnSphere = direction.multiplyScalar(sphereRadius);

            // Crea un gruppo per l'indicatore
            const group = new THREE.Group();
            group.position.copy(positionOnSphere);

            // 1. Crea il glow di background (effetto alone)
            const glowGeometry = new THREE.CircleGeometry(20, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: getIndicatorColor(indicatorData.action_type),
                transparent: true,
                opacity: 0.3,
                depthTest: false
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            group.add(glow);

            // 2. Crea l'anello pulsante
            const ringGeometry = new THREE.RingGeometry(12, 16, 16);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: getIndicatorColor(indicatorData.action_type),
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide,
                depthTest: false
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            group.add(ring);

            // 3. Crea l'icona sprite
            const iconTexture = createFallbackTexture(indicatorData.action_type);
            const iconMaterial = new THREE.SpriteMaterial({
                map: iconTexture,
                transparent: true,
                opacity: 1.0,
                depthTest: false
            });
            const iconSprite = new THREE.Sprite(iconMaterial);
            iconSprite.scale.set(24, 24, 1);
            group.add(iconSprite);

            // 4. Crea il punto centrale
            const centerGeometry = new THREE.CircleGeometry(3, 8);
            const centerMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.9,
                depthTest: false
            });
            const center = new THREE.Mesh(centerGeometry, centerMaterial);
            //group.add(center);

            // Proprietà per le animazioni
            group._originalScale = group.scale.clone();
            group._pulseTime = Math.random() * Math.PI * 2;
            group._isHovered = false;
            group._glowIntensity = 0.3;

            // Salva i riferimenti ai componenti
            group._glow = glow;
            group._ring = ring;
            group._icon = iconSprite;
            group._center = center;

            // Aggiungi dati all'indicatore
            group.userData = {
                indicatorId: indicatorData.id,
                title: indicatorData.title || indicatorData.title_it || 'Indicatore ' + indicatorData.id,
                actionType: indicatorData.action_type,
                actionTarget: indicatorData.action_target,
                originalData: indicatorData,
                isIndicator: true
            };

            // Funzione per aggiornare l'orientamento verso la camera
            group.updateOrientation = function() {
                const direction = new THREE.Vector3().subVectors(viewer.camera.position, group.position).normalize();
                const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

                group._glow.quaternion.copy(quaternion);
                group._ring.quaternion.copy(quaternion);
                group._center.quaternion.copy(quaternion);
            };

            // Funzione di aggiornamento per le animazioni
            group.update = function() {
                group._pulseTime += 0.03;

                if (group._isHovered) {
                    const hoverScale = 1.3 + 0.15 * Math.sin(group._pulseTime * 2);
                    group.scale.copy(group._originalScale).multiplyScalar(hoverScale);
                    group._glow.material.opacity = 0.6 + 0.2 * Math.sin(group._pulseTime);
                    group._ring.material.opacity = 1.0;
                } else {
                    const normalScale = 1.0 + 0.1 * Math.sin(group._pulseTime);
                    group.scale.copy(group._originalScale).multiplyScalar(normalScale);
                    group._glow.material.opacity = group._glowIntensity + 0.1 * Math.sin(group._pulseTime);
                    group._ring.material.opacity = 0.8 + 0.2 * Math.sin(group._pulseTime);
                }

                group._ring.rotation.z += 0.01;
                group.updateOrientation();
            };

            // Inizializza l'orientamento
            group.updateOrientation();

            // Callback per hover
            group.onHover = function(isHovering) {
                group._isHovered = isHovering;
                if (isHovering) {
                    viewer.renderer.domElement.style.cursor = 'pointer';
                    // Crea tooltip
                    showTooltip(indicatorData.title || indicatorData.title_it || 'Indicatore', event);
                } else {
                    viewer.renderer.domElement.style.cursor = 'grab';
                    // Nascondi tooltip
                    hideTooltip();
                }
            };

            //console.log('Frontend: Mesh indicatore creata con successo');
            return {
                mesh: group,
                data: indicatorData
            };
        } catch (e) {
            console.error("Frontend: Errore nella creazione della mesh dell'indicatore:", e);
            return null;
        }
    }

    // Variabile per mantenere il riferimento al tooltip
    let currentTooltip = null;
    let tooltipTimeout = null;

    // Funzione per mostrare il tooltip
    function showTooltip(text, event) {
        // Cancella eventuali timeout precedenti
        if (tooltipTimeout) {
            clearTimeout(tooltipTimeout);
            tooltipTimeout = null;
        }

        // Se il tooltip non esiste, crealo
        if (!currentTooltip) {
            currentTooltip = document.createElement('div');
            currentTooltip.id = 'indicator-tooltip';
            currentTooltip.style.cssText = `
                position: fixed;
                background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1f1f1f 100%);
                color: #e5e5e5;
                padding: 12px 16px;
                border-radius: 12px;
                font-size: 14px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                font-weight: 500;
                pointer-events: none;
                z-index: 10000;
                white-space: nowrap;
                box-shadow: 0 8px 25px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1);
                backdrop-filter: blur(10px);
                opacity: 0;
                transition: opacity 0.1s ease-out;
                border: 1px solid rgba(255,255,255,0.08);
            `;

            document.body.appendChild(currentTooltip);
        }

        // Aggiorna il contenuto solo se necessario
        if (currentTooltip.textContent !== text) {
            currentTooltip.textContent = text;
        }

        // Posiziona il tooltip
        if (event) {
            currentTooltip.style.left = (event.clientX + 15) + 'px';
            currentTooltip.style.top = (event.clientY - 45) + 'px';
        }

        // Mostra il tooltip
        currentTooltip.style.opacity = '1';
    }

    // Funzione per nascondere il tooltip con delay
    function hideTooltip() {
        if (currentTooltip && !tooltipTimeout) {
            tooltipTimeout = setTimeout(() => {
                if (currentTooltip) {
                    currentTooltip.style.opacity = '0';

                    setTimeout(() => {
                        if (currentTooltip && currentTooltip.parentNode) {
                            currentTooltip.parentNode.removeChild(currentTooltip);
                            currentTooltip = null;
                        }
                        tooltipTimeout = null;
                    }, 100);
                }
            }, 50); // Delay di 50ms prima di nascondere
        }
    }

    // Funzione per aggiornare la posizione senza ricreare
    function updateTooltipPosition(event) {
        if (currentTooltip && currentTooltip.style.opacity === '1') {
            currentTooltip.style.left = (event.clientX + 15) + 'px';
            currentTooltip.style.top = (event.clientY - 45) + 'px';
        }
    }

    // Aggiorna la posizione durante il movimento del mouse
    document.addEventListener('mousemove', updateTooltipPosition);

    /**
     * Renderizza gli indicatori nel panorama
     * @param {Object} viewer - Oggetto viewer
     * @param {Array} indicators - Array di indicatori
     */
    function renderIndicators(viewer, indicators) {
        //console.log('Frontend: Rendering indicatori:', indicators);

        // Rimuovi indicatori precedenti
        removeIndicators(viewer);

        // Pulisci indicatori precedenti
        if (viewer.activeIndicators) {
            viewer.activeIndicators.forEach(indicator => {
                if (indicator.mesh) {
                    viewer.scene.remove(indicator.mesh);
                }
            });
        }
        viewer.activeIndicators = [];

        // Carica le icone se non già fatto
        if (!viewer.indicatorIcons) {
            loadIndicatorIcons(viewer);
        }

        // Renderizza ogni indicatore
        indicators.forEach(indicatorData => {
            const indicatorObj = createIndicatorMesh(indicatorData, viewer);
            if (indicatorObj) {
                viewer.scene.add(indicatorObj.mesh);
                viewer.activeIndicators.push(indicatorObj);

                // Setup interazione click
                setupIndicatorClick(viewer, indicatorObj);
            }
        });

        //console.log('Frontend: Indicatori renderizzati:', viewer.activeIndicators.length);
    }

    /**
     * Setup click per un indicatore
     */
    function setupIndicatorClick(viewer, indicatorObj) {
        // Implementa la gestione del click qui se necessaria
        //console.log('Frontend: Setup click per indicatore:', indicatorObj.data.id);
    }

    /**
     * Aggiorna l'orientamento di tutti gli indicatori
     */
    function updateIndicatorsOrientation(viewer) {
        if (viewer.activeIndicators) {
            viewer.activeIndicators.forEach(indicatorObj => {
                if (indicatorObj.mesh && indicatorObj.mesh.updateOrientation) {
                    indicatorObj.mesh.updateOrientation();
                }
            });
        }
    }

    // Esponi la funzione globalmente per il file controls
    window.updateIndicatorsOrientation = updateIndicatorsOrientation;

    /**
     * Cleanup del viewer quando viene distrutto
     */
    function cleanupViewer(viewer) {
        // Ferma il rendering loop
        if (viewer.animationId) {
            cancelAnimationFrame(viewer.animationId);
            viewer.animationId = null;
        }

        // Cleanup del resize observer
        if (viewer._resizeObserver) {
            viewer._resizeObserver.disconnect();
            viewer._resizeObserver = null;
        }

        // Cleanup del resize handler fallback
        if (viewer._resizeHandler) {
            window.removeEventListener('resize', viewer._resizeHandler);
            viewer._resizeHandler = null;
        }

        // Cleanup degli event handlers
        if (viewer.renderer && viewer.renderer.domElement) {
            const element = viewer.renderer.domElement;
            element.removeEventListener('click', viewer._clickHandler);
            element.removeEventListener('mousemove', viewer._hoverHandler);
        }

        // Cleanup delle risorse Three.js
        removeInteractiveAreas(viewer);
        removeIndicators(viewer);

        if (viewer.panoramaMesh) {
            viewer.scene.remove(viewer.panoramaMesh);
            if (viewer.panoramaMesh.geometry) viewer.panoramaMesh.geometry.dispose();
            if (viewer.panoramaMesh.material) {
                if (viewer.panoramaMesh.material.map) viewer.panoramaMesh.material.map.dispose();
                viewer.panoramaMesh.material.dispose();
            }
            viewer.panoramaMesh = null;
        }

        if (viewer.renderer) {
            viewer.renderer.dispose();
            if (viewer.renderer.domElement && viewer.renderer.domElement.parentNode) {
                viewer.renderer.domElement.parentNode.removeChild(viewer.renderer.domElement);
            }
            viewer.renderer = null;
        }

        viewer.scene = null;
        viewer.camera = null;
    }

    // Pulizia al termine
    $(window).on('beforeunload', function() {
        // Pulisci tutti gli overlay prima di uscire
        cleanupAllOverlays();

        // Ferma l'observer
        if (mediaPanelObserver) {
            mediaPanelObserver.disconnect();
        }

        // Pulisci tutti i viewer
        Object.keys(panoramaViewers).forEach(id => {
            const viewer = panoramaViewers[id];
            if (viewer && typeof cleanupViewer === 'function') {
                cleanupViewer(viewer);
            }
        });
    });

    // API pubblica per pulizia - versione estesa
    window.panoramaAPI = {
        cleanupOverlays: cleanupAllOverlays,

        // Forza chiusura di tutti i pannelli media
        closeAllMediaPanels: function() {
            cleanupAllOverlays();
        },

        // Forza chiusura di un pannello specifico
        closeMediaPanel: function(panelId = 'idPanel') {
            $(`#${panelId}`).remove();
            $(`#${panelId}Overlay`).remove();
            cleanupAllOverlays();
        },

        // Debug: mostra overlay presenti
        debugOverlays: function() {
            console.log('🔍 Overlay presenti:');
            $('div[style*="position: fixed"], div[style*="position: absolute"]').each(function(i) {
                const $elem = $(this);
                const zIndex = $elem.css('z-index');
                console.log(`${i+1}. Z-index: ${zIndex}, ID: ${$elem.attr('id') || 'none'}, Classes: ${$elem.attr('class') || 'none'}`, $elem[0]);
            });
        },

        // Forza pulizia aggressiva
        forceCleanup: function() {
            // Rimuovi TUTTO quello che potrebbe essere un overlay
            $('div').each(function() {
                const $elem = $(this);
                const zIndex = parseInt($elem.css('z-index')) || 0;
                const position = $elem.css('position');

                if (zIndex > 1000 && (position === 'fixed' || position === 'absolute')) {
                    const isImportant = $elem.hasClass('risviel-panorama-spinner') ||
                                      $elem.hasClass('panorama-info-overlay') ||
                                      $elem.closest('.risviel-panorama').length > 0;

                    if (!isImportant) {
                        console.log('💥 Rimozione forzata:', $elem[0]);
                        $elem.remove();
                    }
                }
            });

            $('body').css({'overflow': '', 'pointer-events': ''});
        }
    };


})(jQuery);