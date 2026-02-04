
/**
 * File: risviel-gisdoc-controls.js
 * Sistema di controlli avanzati per panorami 360° con supporto per inerzia, pinch zoom e touch
 */

(function($) {
    'use strict';

    // Configurazione dei controlli
    const controlsConfig = {
        inertia: true,                // Abilita inerzia
        inertiaFriction: 0.95,        // Frizione dell'inerzia (0-1, più alto = meno attrito)
        minVelocity: 0.001,           // Velocità minima per l'inerzia
        rotationSpeed: 0.002 * 0.5,   // Velocità di rotazione
        zoomSpeed: 0.5,               // Velocità di zoom per pinch
        minFOV: 30,                   // FOV minimo (zoom massimo)
        maxFOV: 90,                   // FOV massimo (zoom minimo)
        pinchDebounceDelay: 300,      // Tempo di debounce dopo pinch in ms
        debug: false                  // Modalità debug
    };

    // Variabili di stato globali
    const activeControls = new Map();
    let isControlsInitialized = false;

    // Touch events migliorati
    let touchStartTime = 0;
    let touchStartPosition = { x: 0, y: 0 };
    let isTouchMoving = false;
    let touchTarget = null;

    // Inizializza al caricamento della pagina
    $(document).ready(function() {
        setTimeout(initializeControls, 1000);
    });

    /**
     * Inizializza il sistema di controlli
     */
    function initializeControls() {
        if (isControlsInitialized) return;

        if (window.panoramaViewers) {
            for (const id in window.panoramaViewers) {
                attachControlsToViewer(window.panoramaViewers[id], id);
            }
        }

        // Monitora la creazione di nuovi viewer
        monitorViewerCreation();

        isControlsInitialized = true;
        if (controlsConfig.debug) {
            console.log("🎮 Sistema di controlli avanzati inizializzato!");
        }
    }

    /**
     * Monitora la creazione di nuovi viewer
     */
    function monitorViewerCreation() {
        // Controlla periodicamente se sono stati creati nuovi viewer
        let knownViewers = new Set();

        const checkForNewViewers = () => {
            if (window.panoramaViewers) {
                for (const id in window.panoramaViewers) {
                    if (!knownViewers.has(id) && window.panoramaViewers[id].camera) {
                        knownViewers.add(id);
                        attachControlsToViewer(window.panoramaViewers[id], id);
                    }
                }
            }
            setTimeout(checkForNewViewers, 2000);
        };

        checkForNewViewers();
    }

    /**
     * Attacca i controlli a un viewer specifico
     */
    function attachControlsToViewer(viewer, id) {
        if (!viewer || !viewer.camera || !viewer.renderer) {
            if (controlsConfig.debug) {
                console.log(`🎮 Viewer ${id} non ancora pronto per i controlli, riproverò più tardi`);
            }
            setTimeout(() => attachControlsToViewer(viewer, id), 500);
            return;
        }

        // Evita di attaccare controlli duplicati
        if (activeControls.has(id)) {
            return;
        }

        setupAdvancedControls(viewer, id);

        if (controlsConfig.debug) {
            console.log(`🎮 Controlli avanzati attaccati a viewer ${id}`);
        }
    }

    /**
     * Configura controlli avanzati con inerzia e pinch zoom
     */
    function setupAdvancedControls(viewer, viewerId) {
        // Stato di questo specifico controllo
        const state = {
            isInteracting: false,
            previousPosition: { x: 0, y: 0 },
            phi: 0,
            theta: 0,
            velocity: { x: 0, y: 0 },
            lastMoveTime: 0,
            inertiaActive: false,
            isPinching: false,
            initialPinchDistance: 0,
            initialFOV: 0,
            lastPinchDistance: 0,
            pinchEndTime: 0,
            animationFrameId: null
        };

        // Memorizza stato per questo viewer
        activeControls.set(viewerId, state);

        const element = viewer.renderer.domElement;
        element.style.cursor = 'grab';

        // Funzioni helper per ottenere le coordinate dell'evento
        function getEventPosition(event) {
            if (event.touches && event.touches.length > 0) {
                return { x: event.touches[0].clientX, y: event.touches[0].clientY };
            } else {
                return { x: event.clientX, y: event.clientY };
            }
        }

        // Calcola distanza tra due tocchi
        function getPinchDistance(event) {
            if (event.touches.length < 2) return 0;
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            return Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
        }

        // Verifica se siamo ancora nel periodo di debounce dopo pinch
        function isInPinchDebounce() {
            return Date.now() - state.pinchEndTime < controlsConfig.pinchDebounceDelay;
        }

        function startInteraction(event) {
            // Gestione pinch zoom
            if (event.touches && event.touches.length === 2) {
                event.preventDefault();
                state.isPinching = true;
                state.isInteracting = false; // Disabilita rotazione durante pinch
                state.inertiaActive = false;

                state.initialPinchDistance = getPinchDistance(event);
                state.lastPinchDistance = state.initialPinchDistance;
                state.initialFOV = viewer.camera.fov;
                return;
            }

            // Gestione rotazione normale (1 tocco o mouse)
            if (event.touches && event.touches.length > 1) return; // Ignora multi-touch oltre 2

            // Blocca la rotazione se siamo nel periodo di debounce dopo pinch
            if (event.touches && isInPinchDebounce()) {
                event.preventDefault();
                return;
            }

            // Per mouse, previeni sempre il default e procedi con la navigazione
            if (!event.touches) {
                event.preventDefault();
                state.isInteracting = true;
                state.isPinching = false;
                state.inertiaActive = false;
                state.velocity = { x: 0, y: 0 };

                const position = getEventPosition(event);
                state.previousPosition = position;
                state.lastMoveTime = Date.now();
                element.style.cursor = 'grabbing';
                return;
            }

            // Per touch, NON preveniamo il default inizialmente
            // Questo permette agli eventi di click di funzionare
            const position = getEventPosition(event);

            // Salva informazioni per rilevare tap vs drag
            isTouchMoving = false;
            touchStartTime = Date.now();
            touchStartPosition = { x: position.x, y: position.y };
            touchTarget = event.target;

            // Inizializza stato per potenziale navigazione
            state.previousPosition = position;
            state.lastMoveTime = Date.now();
            state.velocity = { x: 0, y: 0 };

            // NON impostare isInteracting = true qui per touch
            // Lo faremo solo quando rileveremo un movimento significativo
        }

        function moveInteraction(event) {
            // Gestione pinch zoom
            if (state.isPinching && event.touches && event.touches.length === 2) {
                event.preventDefault();

                const currentPinchDistance = getPinchDistance(event);
                if (state.initialPinchDistance > 0 && currentPinchDistance > 0) {
                    const pinchDelta = currentPinchDistance - state.lastPinchDistance;

                    viewer.camera.fov -= pinchDelta * controlsConfig.zoomSpeed;
                    viewer.camera.fov = Math.max(controlsConfig.minFOV, Math.min(controlsConfig.maxFOV, viewer.camera.fov));
                    viewer.camera.updateProjectionMatrix();

                    state.lastPinchDistance = currentPinchDistance;
                }
                return;
            }

            // Gestione rotazione mouse (sempre attiva se isInteracting)
            if (!event.touches && state.isInteracting && !state.isPinching) {
                event.preventDefault();

                const currentTime = Date.now();
                const currentPosition = getEventPosition(event);
                const deltaMove = {
                    x: currentPosition.x - state.previousPosition.x,
                    y: currentPosition.y - state.previousPosition.y
                };

                // Calcola velocità per l'inerzia
                const deltaTime = currentTime - state.lastMoveTime;
                if (deltaTime > 0) {
                    state.velocity.x = deltaMove.x / deltaTime;
                    state.velocity.y = deltaMove.y / deltaTime;
                }

                // Rotazione
                state.theta -= deltaMove.x * controlsConfig.rotationSpeed;
                state.phi -= deltaMove.y * controlsConfig.rotationSpeed;
                state.phi = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, state.phi));

                updateCameraRotation(viewer, state.phi, state.theta);
                updateIndicatorsOrientation(viewer);

                state.previousPosition = currentPosition;
                state.lastMoveTime = currentTime;
                return;
            }

            // Gestione touch - attiva navigazione solo dopo movimento significativo
            if (event.touches && event.touches.length === 1 && !state.isPinching) {
                // Blocca se siamo nel periodo di debounce dopo pinch
                if (isInPinchDebounce()) {
                    return;
                }

                const currentPosition = getEventPosition(event);
                const moveDistance = Math.sqrt(
                    Math.pow(currentPosition.x - touchStartPosition.x, 2) +
                    Math.pow(currentPosition.y - touchStartPosition.y, 2)
                );

                // Se il movimento supera la soglia, inizia la navigazione
                if (moveDistance > 15) { // Soglia aumentata a 15px per essere più sicuri
                    // Ora preveniamo il default e iniziamo la navigazione
                    event.preventDefault();

                    if (!isTouchMoving) {
                        // Prima volta che superiamo la soglia
                        isTouchMoving = true;
                        state.isInteracting = true;
                        state.inertiaActive = false;
                    }

                    // Procedi con la rotazione
                    const currentTime = Date.now();
                    const deltaMove = {
                        x: currentPosition.x - state.previousPosition.x,
                        y: currentPosition.y - state.previousPosition.y
                    };

                    // Calcola velocità per l'inerzia
                    const deltaTime = currentTime - state.lastMoveTime;
                    if (deltaTime > 0) {
                        state.velocity.x = deltaMove.x / deltaTime;
                        state.velocity.y = deltaMove.y / deltaTime;
                    }

                    // Rotazione
                    state.theta -= deltaMove.x * controlsConfig.rotationSpeed;
                    state.phi -= deltaMove.y * controlsConfig.rotationSpeed;
                    state.phi = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, state.phi));

                    updateCameraRotation(viewer, state.phi, state.theta);
                    updateIndicatorsOrientation(viewer);

                    state.previousPosition = currentPosition;
                    state.lastMoveTime = currentTime;
                }
            }
        }

        function endInteraction(event) {
            // Fine pinch zoom
            if (state.isPinching) {
                state.isPinching = false;
                state.initialPinchDistance = 0;
                state.lastPinchDistance = 0;
                state.pinchEndTime = Date.now();
                return;
            }

            // Gestione tap su touch (click senza movimento significativo)
            if (event.changedTouches && !isTouchMoving) {
                const touchDuration = Date.now() - touchStartTime;

                // Se non c'è stato movimento significativo e il touch è durato poco, NON preveniamo l'evento
                // Lasciamo che gli eventi di click naturali del browser funzionino
                if (touchDuration < 500) {
                    // NON chiamiamo preventDefault() qui per evitare errori con passive listeners
                    // NON chiamiamo handleInteraction manualmente
                    // Lasciamo che il sistema di eventi del browser gestisca il click

                    if (controlsConfig.debug) {
                        console.log('🖱️ Touch tap rilevato, lasciando che il browser gestisca il click naturale');
                    }
                }
            }

            // Fine rotazione
            if (state.isInteracting) {
                // Solo prova a fare preventDefault se l'evento lo supporta e non è passive
                try {
                    if (event.preventDefault && !event.defaultPrevented) {
                        event.preventDefault();
                    }
                } catch (e) {
                    // Ignora errori di preventDefault su listener passivi
                }

                state.isInteracting = false;
                element.style.cursor = 'grab';

                // Avvia inerzia se c'è velocità sufficiente e non siamo in debounce
                if (controlsConfig.inertia && !isInPinchDebounce()) {
                    const velocityMagnitude = Math.sqrt(state.velocity.x * state.velocity.x + state.velocity.y * state.velocity.y);
                    if (velocityMagnitude > controlsConfig.minVelocity) {
                        state.inertiaActive = true;
                        applyInertia();
                    }
                }
            }

            // Reset variabili touch
            isTouchMoving = false;
            touchTarget = null;
        }

        // Funzione per applicare la rotazione della camera
        function updateCameraRotation(viewer, phi, theta) {
            const quaternion = new THREE.Quaternion();
            const xQuaternion = new THREE.Quaternion();
            xQuaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), phi);

            const yQuaternion = new THREE.Quaternion();
            yQuaternion.setFromAxisAngle(new THREE.Vector3(0, -1, 0), theta);

            quaternion.multiplyQuaternions(yQuaternion, xQuaternion);
            viewer.camera.quaternion.copy(quaternion);
        }

        // Funzione per aggiornare l'orientamento degli indicatori (compatibile con panorama originale)
        function updateIndicatorsOrientation(viewer) {
            if (typeof window.updateIndicatorsOrientation === 'function') {
                window.updateIndicatorsOrientation(viewer);
            } else if (viewer.activeIndicators && viewer.activeIndicators.length) {
                viewer.activeIndicators.forEach(indicator => {
                    if (indicator.mesh) {
                        indicator.mesh.quaternion.copy(viewer.camera.quaternion);
                    }
                });
            }
        }

        // Funzione per applicare l'inerzia
        function applyInertia() {
            if (!state.inertiaActive) return;

            // Applica frizione
            state.velocity.x *= controlsConfig.inertiaFriction;
            state.velocity.y *= controlsConfig.inertiaFriction;

            // Calcola il movimento in base alla velocità
            const deltaTime = 16; // ~60fps
            const deltaX = state.velocity.x * deltaTime;
            const deltaY = state.velocity.y * deltaTime;

            // Applica il movimento
            state.theta -= deltaX * controlsConfig.rotationSpeed;
            state.phi -= deltaY * controlsConfig.rotationSpeed;
            state.phi = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, state.phi));

            // Aggiorna la rotazione della camera
            updateCameraRotation(viewer, state.phi, state.theta);
            updateIndicatorsOrientation(viewer);

            // Continua l'inerzia finché la velocità è significativa
            const velocityMagnitude = Math.sqrt(state.velocity.x * state.velocity.x + state.velocity.y * state.velocity.y);
            if (velocityMagnitude > controlsConfig.minVelocity) {
                state.animationFrameId = requestAnimationFrame(applyInertia);
            } else {
                state.inertiaActive = false;
                state.animationFrameId = null;
            }
        }

        // Mouse events
        element.addEventListener('mousedown', startInteraction);
        document.addEventListener('mousemove', moveInteraction);
        document.addEventListener('mouseup', endInteraction);

        // Click per mouse (separato dalla navigazione)
        element.addEventListener('click', function(event) {
            // Solo per mouse, non per touch (che viene gestito dal sistema naturale del browser)
            if (!event.touches && typeof window.handleInteraction === 'function') {
                window.handleInteraction(viewer, event, 'mouse');
            }
        });

        // Touch events - gestiamo passive/non-passive in modo appropriato
        element.addEventListener('touchstart', startInteraction, { passive: true });
        element.addEventListener('touchmove', moveInteraction, { passive: false });
        element.addEventListener('touchend', endInteraction, { passive: true });


        // Wheel event for zoom
        element.addEventListener('wheel', function(event) {
            event.preventDefault();
            const delta = event.deltaY;
            viewer.camera.fov += delta * 0.05;
            viewer.camera.fov = Math.max(controlsConfig.minFOV, Math.min(controlsConfig.maxFOV, viewer.camera.fov));
            viewer.camera.updateProjectionMatrix();
        });

        // Leggi la rotazione iniziale
        if (viewer.camera) {
            const euler = new THREE.Euler().setFromQuaternion(viewer.camera.quaternion, 'YXZ');
            state.phi = euler.x;
            state.theta = euler.y;
        }

        if (controlsConfig.debug) {
            console.log(`🎮 Controlli avanzati configurati per ${viewerId}`);
        }
    }

    // Esposizione globale della configurazione
    window.controlsConfig = controlsConfig;

    // API pubblica
    window.advancedControls = {
        getActiveViewers: function() {
            return Array.from(activeControls.keys());
        },

        setInertia: function(enabled, friction = 0.95) {
            controlsConfig.inertia = enabled;
            if (friction !== undefined) {
                controlsConfig.inertiaFriction = Math.max(0.8, Math.min(0.99, friction));
            }
        },

        setRotationSpeed: function(speed) {
            controlsConfig.rotationSpeed = Math.max(0.0001, Math.min(0.01, speed));
        },

        setZoomSpeed: function(speed) {
            controlsConfig.zoomSpeed = Math.max(0.1, Math.min(2.0, speed));
        },

        setFOVLimits: function(min, max) {
            controlsConfig.minFOV = Math.max(10, Math.min(45, min));
            controlsConfig.maxFOV = Math.max(60, Math.min(120, max));
        },

        debug: function() {
            controlsConfig.debug = !controlsConfig.debug;
            console.log("🔧 Debug mode:", controlsConfig.debug ? "ON" : "OFF");
            console.log("📊 Configurazione corrente:", controlsConfig);
            console.log("📊 Controlli attivi:", Array.from(activeControls.keys()));
        },

        reinitialize: function() {
            // Rimuovi tutti i controlli esistenti
            activeControls.forEach((state, viewerId) => {
                if (state.animationFrameId) {
                    cancelAnimationFrame(state.animationFrameId);
                }
            });

            // Pulisci la mappa dei controlli
            activeControls.clear();
            isControlsInitialized = false;

            // Reinizializza
            setTimeout(initializeControls, 100);
        },

        // Ottieni stato di un controllo specifico (per debug)
        getControlState: function(viewerId) {
            if (!activeControls.has(viewerId)) {
                console.warn(`Controllo per ${viewerId} non trovato`);
                return null;
            }
            return { ...activeControls.get(viewerId) };
        },

        // Imposta rotazione manualmente
        setRotation: function(viewerId, phi, theta) {
            if (!activeControls.has(viewerId) || !window.panoramaViewers[viewerId]) {
                console.warn(`Viewer ${viewerId} non trovato`);
                return;
            }

            const state = activeControls.get(viewerId);
            const viewer = window.panoramaViewers[viewerId];

            // Normalizza e limita phi
            phi = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, phi));

            state.phi = phi;
            state.theta = theta;
            state.velocity = { x: 0, y: 0 };
            state.inertiaActive = false;

            const quaternion = new THREE.Quaternion();
            const xQuaternion = new THREE.Quaternion();
            xQuaternion.setFromAxisAngle(new THREE.Vector3(-1, 0, 0), phi);

            const yQuaternion = new THREE.Quaternion();
            yQuaternion.setFromAxisAngle(new THREE.Vector3(0, -1, 0), theta);

            quaternion.multiplyQuaternions(yQuaternion, xQuaternion);
            viewer.camera.quaternion.copy(quaternion);

            if (typeof window.updateIndicatorsOrientation === 'function') {
                window.updateIndicatorsOrientation(viewer);
            }
        }
    };

    // Esporta controlli come variabile globale per compatibilità
    window.setupAdvancedControls = setupAdvancedControls;

})(jQuery);