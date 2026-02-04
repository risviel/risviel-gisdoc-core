
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

    let northOffset = 0;

    // Esposizione globale
    window.panoramaViewers = panoramaViewers;

    /**
     * Gestisce la navigazione del browser (pulsante indietro/avanti)
     */
    function setupBrowserNavigation() {
        window.addEventListener('popstate', function(event) {
            if (panoramaConfig.debug) {
                console.log('🔙 Evento popstate rilevato (navigazione browser/gesto indietro)');
            }

            // Pulizia immediata di tutti gli overlay quando si naviga
            cleanupAllOverlays();

            // Forza rimozione di elementi specifici che potrebbero essere rimasti
            setTimeout(() => {
                $('#idPanel, #idPanelOverlay').remove();
                $('.media-panel-overlay, .modal-overlay, .panorama-overlay').remove();

                // Ripristina lo stato del body
                $('body').css({
                    'overflow': '',
                    'pointer-events': ''
                });

                if (panoramaConfig.debug) {
                    console.log('🧹 Overlay forzatamente rimossi dopo navigazione');
                }
            }, 10);

            if (event.state && event.state.panoramaId) {
                const firstViewer = Object.keys(panoramaViewers)[0];
                if (firstViewer) {
                    loadPanoramaData(firstViewer, event.state.panoramaId, event.state.language || 'it');
                }
            } else {
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

        // Controlla parametri URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlPanoramaId = urlParams.get('id');
        const urlLanguage = urlParams.get('lang');

        if (urlPanoramaId) {
            let panoramaContainer = $('.risviel-panorama').first();
            if (panoramaContainer.length === 0) {
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
            container: container
        };

        // Carica i dati del panorama
        loadPanoramaData(containerId, panoramaId, language);
    }

    /**
     * Crea lo spinner di caricamento
     */
    function createLoadingSpinner(container) {
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
     * Carica i dati del panorama dal server
     */
    function loadPanoramaData(containerId, panoramaId, language) {
        if (panoramaConfig.debug) {
            console.log('🔄 Inizio caricamento panorama:', panoramaId);
        }
        const container = document.getElementById(containerId);
        const viewer = panoramaViewers[containerId];

        // Pulizia completa e immediata
        cleanupAllOverlays();

        // Stop immediato di tutti i rendering loops
        if (viewer && viewer._animationId) {
            cancelAnimationFrame(viewer._animationId);
            viewer._animationId = null;
        }

        // Pulizia totale della scena Three.js
        if (viewer && viewer.scene) {
            if (viewer.renderer) {
                viewer.renderer.setAnimationLoop(null);
            }

            const objectsToRemove = [];
            viewer.scene.traverse((object) => {
                if (object !== viewer.scene) {
                    objectsToRemove.push(object);
                }
            });

            objectsToRemove.forEach(object => {
                viewer.scene.remove(object);

                if (object.geometry) {
                    object.geometry.dispose();
                }
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => {
                            if (material.map) material.map.dispose();
                            if (material.alphaMap) material.alphaMap.dispose();
                            material.dispose();
                        });
                    } else {
                        if (object.material.map) object.material.map.dispose();
                        if (object.material.alphaMap) object.material.alphaMap.dispose();
                        object.material.dispose();
                    }
                }
            });

            viewer.panoramaMesh = null;

            if (panoramaConfig.debug) {
                console.log('🧹 Scena completamente pulita, oggetti rimanenti:', viewer.scene.children.length);
            }
        }

        // Mostra spinner dopo la pulizia
        container.style.position = 'relative';
        createLoadingSpinner(container);

        // Forza un rendering pulito prima di continuare
        if (viewer && viewer.renderer && viewer.camera) {
            viewer.renderer.render(viewer.scene, viewer.camera);
        }

        // Caricamento nuovo panorama
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

        setTimeout(() => {
            $.ajax({
                url: risviel_gisdoc_panorama.ajax_url,
                type: 'POST',
                data: ajaxData,
                success: function(response) {
                    console.log('Risposta AJAX:', response.data);
                    if (response.success && response.data) {
                        if (!response.data.image_url) {
                            console.error('URL immagine mancante');
                            removeLoadingSpinner(container);
                            container.innerHTML = '<p class="risviel-error">URL immagine mancante</p>';
                            return;
                        }

                        setupPanorama(containerId, response.data);

                        setTimeout(() => {
                            createPanoramaOverlay(containerId, response.data);
                        }, 500);

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
        }, 50);
    }

    /**
     * Pulizia globale di tutti gli overlay e pannelli modali
     */
    function cleanupAllOverlays() {
        if (panoramaConfig.debug) {
            console.log('🧹 Inizio pulizia overlay...');
        }

        $('#idPanel').remove();
        $('#idPanelOverlay').remove();

        $('.media-panel-overlay, .panorama-overlay, .risviel-overlay, .modal-overlay').remove();

        $(document).off('keydown.mediaPanel');
        $(document).off('click.mediaPanelInteraction');

        $('div').each(function() {
            const $elem = $(this);
            const style = $elem.attr('style') || '';
            const zIndex = parseInt($elem.css('z-index')) || 0;

            const looksLikeOverlay = (
                style.includes('position: fixed') ||
                style.includes('position: absolute')
            ) && (
                style.includes('rgba(0,0,0') ||
                style.includes('rgba(0, 0, 0') ||
                style.includes('background: rgba') ||
                style.includes('background-color: rgba')
            ) && zIndex > 1000;

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

        $('body').css('overflow', '');
        $('body').css('pointer-events', '');

        if (panoramaConfig.debug) {
            console.log('🧹 Pulizia overlay completata');
        }
    }

    /**
     * Observer per monitorare l'aggiunta dinamica di pannelli media
     */
    function setupMediaPanelObserver() {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const $node = $(node);

                        if ($node.is('#idPanel') || $node.find('#idPanel').length > 0) {
                            if (panoramaConfig.debug) {
                                console.log('📺 Rilevato nuovo pannello media');
                            }

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
    window.loadPanoramaData = loadPanoramaData;

    /**
     * Listener globale per ESC key per chiudere overlay
     */
    $(document).on('keydown.globalOverlayCleanup', function(e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
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

        if ($target.is('#idPanelOverlay, .media-panel-overlay, .modal-overlay')) {
            cleanupAllOverlays();
            e.preventDefault();
            e.stopPropagation();
        }
    });

    $(document).on('click.mediaPanelClose', '#idPanelClose', function(e) {
        if (panoramaConfig.debug) {
            console.log('🔘 Click su pulsante chiusura pannello media');
        }

        cleanupAllOverlays();

        e.preventDefault();
        e.stopPropagation();
    });

    $(document).on('click.mediaPanelClose', '.close-panel, .panel-close, [data-action="close"]', function(e) {
        if (panoramaConfig.debug) {
            console.log('🔘 Click su pulsante di chiusura generico');
        }

        const $panel = $(this).closest('#idPanel, .media-panel, .modal-panel');
        if ($panel.length > 0) {
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

        const existingOverlay = container.querySelector('.panorama-info-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        const hasTitle = panoramaData.title && panoramaData.title.trim();
        const hasDescription = panoramaData.description && panoramaData.description.trim();

        if (!hasTitle && !hasDescription) return;

        const overlay = document.createElement('div');
        overlay.className = 'panorama-info-overlay';
        overlay.style.cssText = `
            position: absolute;
            bottom: 185px;
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

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            overlay.style.transform = 'translateY(0)';
        });

        const closeBtn = overlay.querySelector('.close-overlay');

        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.opacity = '1';
            closeBtn.style.transform = 'scale(1.1)';
        });

        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.opacity = '0.6';
            closeBtn.style.transform = 'scale(1)';
        });

        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            overlay.style.opacity = '0';
            overlay.style.transform = 'translateY(20px)';
            setTimeout(() => overlay.remove(), 400);
        });

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
     */
    function setupPanorama(containerId, panoramaData) {
        const container = document.getElementById(containerId);
        const viewer = panoramaViewers[containerId];

        if (typeof THREE === 'undefined') {
            console.error('THREE.js non disponibile');
            removeLoadingSpinner(container);
            container.innerHTML = '<p class="risviel-error">THREE.js non disponibile</p>';
            return;
        }

        try {
            if (!viewer.scene) {
                initThreeJsSystem(viewer, container);
            }

            if (viewer.scene.children.length > 0) {
                if (panoramaConfig.debug) {
                    console.warn('⚠️ Scena non completamente pulita, forzo pulizia...');
                }

                const remainingObjects = [...viewer.scene.children];
                remainingObjects.forEach(obj => {
                    viewer.scene.remove(obj);
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) obj.material.dispose();
                });
            }

            const loader = new THREE.TextureLoader();
            loader.load(
                panoramaData.image_url,
                function(texture) {
                    if (panoramaConfig.debug) {
                        console.log('✅ Texture caricata, creazione panorama...');
                    }
                    northOffset = panoramaData.north_offset;

                    createPanoramaSphere(viewer, texture);

                    requestAnimationFrame(() => {
                        startRenderLoop(viewer);

                        requestAnimationFrame(() => {
                            removeLoadingSpinner(container);

                            if (panoramaConfig.debug) {
                                console.log('✅ Panorama completamente caricato e renderizzato');
                            }
                        });
                    });
                },
                function(progress) {
                    if (progress.total > 0) {
                        const percent = Math.round((progress.loaded / progress.total) * 100);
                        if (panoramaConfig.debug) {
                            console.log('📈 Caricamento texture:', percent + '%');
                        }
                    }
                },
                function(error) {
                    console.error('❌ Errore caricamento texture:', error);
                    removeLoadingSpinner(container);
                    container.innerHTML = '<p class="risviel-error">Errore caricamento immagine</p>';
                }
            );

        } catch (error) {
            console.error('❌ Errore setup panorama:', error);
            removeLoadingSpinner(container);
            container.innerHTML = '<p class="risviel-error">Errore configurazione panorama</p>';
        }
    }

    /**
     * Inizializza Three.js
     */
    function initThreeJsSystem(viewer, container) {
        viewer.scene = new THREE.Scene();

        viewer.camera = new THREE.PerspectiveCamera(
            panoramaConfig.defaultFOV,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        viewer.camera.position.set(0, 0, 0);

        viewer.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: false
        });
        viewer.renderer.setSize(container.clientWidth, container.clientHeight);
        viewer.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(viewer.renderer.domElement);

        setupResize(viewer, container);
        setupInteractions(viewer);
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
                    viewer.camera.aspect = width / height;
                    viewer.camera.updateProjectionMatrix();
                    viewer.renderer.setSize(width, height);
                }
            }
        });

        resizeObserver.observe(container);
        viewer._resizeObserver = resizeObserver;

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
        if (viewer.renderer && viewer.renderer.domElement) {
            viewer.renderer.domElement.style.cursor = 'grab';
        }
    }

    /**
     * Crea la sfera del panorama
     */
    function createPanoramaSphere(viewer, texture) {
        if (viewer.panoramaMesh) {
            viewer.scene.remove(viewer.panoramaMesh);
        }

        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);

        const material = new THREE.MeshBasicMaterial({ map: texture });

        viewer.panoramaMesh = new THREE.Mesh(geometry, material);

        if (northOffset !== 0) {
            const offsetRadians = northOffset * (Math.PI / 180);
            viewer.panoramaMesh.rotation.y = offsetRadians;
            console.log('North offset applicato alla mesh panorama:', northOffset + '°');
        }

        viewer.scene.add(viewer.panoramaMesh);
    }

    /**
     * Loop di rendering
     */
    function startRenderLoop(viewer) {
        if (viewer.animationId) {
            cancelAnimationFrame(viewer.animationId);
        }

        function animate() {
            viewer.animationId = requestAnimationFrame(animate);

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
     * Cleanup del viewer quando viene distrutto
     */
    function cleanupViewer(viewer) {
        if (viewer.animationId) {
            cancelAnimationFrame(viewer.animationId);
            viewer.animationId = null;
        }

        if (viewer._resizeObserver) {
            viewer._resizeObserver.disconnect();
            viewer._resizeObserver = null;
        }

        if (viewer._resizeHandler) {
            window.removeEventListener('resize', viewer._resizeHandler);
            viewer._resizeHandler = null;
        }

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
        cleanupAllOverlays();

        if (mediaPanelObserver) {
            mediaPanelObserver.disconnect();
        }

        Object.keys(panoramaViewers).forEach(id => {
            const viewer = panoramaViewers[id];
            if (viewer && typeof cleanupViewer === 'function') {
                cleanupViewer(viewer);
            }
        });
    });

    // API pubblica per pulizia
    window.panoramaAPI = {
        cleanupOverlays: cleanupAllOverlays,

        closeAllMediaPanels: function() {
            cleanupAllOverlays();
        },

        closeMediaPanel: function(panelId = 'idPanel') {
            $(`#${panelId}`).remove();
            $(`#${panelId}Overlay`).remove();
            cleanupAllOverlays();
        },

        debugOverlays: function() {
            console.log('🔍 Overlay presenti:');
            $('div[style*="position: fixed"], div[style*="position: absolute"]').each(function(i) {
                const $elem = $(this);
                const zIndex = $elem.css('z-index');
                console.log(`${i+1}. Z-index: ${zIndex}, ID: ${$elem.attr('id') || 'none'}, Classes: ${$elem.attr('class') || 'none'}`, $elem[0]);
            });
        },

        forceCleanup: function() {
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