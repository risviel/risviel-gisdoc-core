
/**
 * File: risviel-gisdoc-compass.js
 * Bussola SVG moderna - Versione VETTORIALE stabilizzata anti-vibrazione
 */

(function($) {
    'use strict';

    // Configurazione della bussola
    const compassConfig = {
        enabled: true,
        size: 120,
        position: 'bottom-left',
        opacity: 0.9,
        northOffset: 0,
        smoothing: true,
        smoothingFactor: 0.15,
        stabilization: true,           // Nuovo: stabilizzazione per prevenire vibrazioni
        stabilizationThreshold: 0.5,   // Nuovo: soglia in gradi per considerare un movimento
        debug: false
    };

    // Stato della bussola
    let compassInitialized = false;
    let panoramaContainers = [];
    let needleRotation = 0;
    let animationId = null;
    let thetaValue = 0;
    let detectedTheta = false;

    // Sistema vettoriale stabilizzato
    let needleVector = { x: 0, y: -1 }; // Inizialmente punta a nord
    let targetVector = { x: 0, y: -1 };
    let lastStableNeedleVector = { x: 0, y: -1 };
    let stabilityCounter = 0;
    const STABILITY_THRESHOLD = 10; // Quanti frame senza movimento significativo per considerare l'ago stabile

    // Buffer per smoothing avanzato
    let vectorHistory = [];
    const HISTORY_SIZE = 5;

    // Inizializza al caricamento della pagina
    $(document).ready(function() {
        setTimeout(initializeCompass, 1000);
    });

    /**
     * Inizializza la bussola
     */
    function initializeCompass() {
        if (compassInitialized) return;

        findPanoramaContainers();
        if (panoramaContainers.length === 0) {
            setTimeout(initializeCompass, 1000);
            return;
        }

        addCompassStyles();
        createCompassElements();
        interceptCustomControls();
        startCameraTracking();

        compassInitialized = true;
        console.log("🧭 Bussola inizializzata con SISTEMA VETTORIALE STABILIZZATO!");
    }

    /**
     * Intercetta i controlli custom per ottenere theta
     */
    function interceptCustomControls() {
        // Hook nella funzione setupSimpleControls se disponibile
        if (window.setupSimpleControls) {
            const originalSetup = window.setupSimpleControls;
            window.setupSimpleControls = function(viewer) {
                const result = originalSetup.apply(this, arguments);
                console.log("🔗 Viewer passato a setupSimpleControls:", viewer);
                return result;
            };
        }

        // Cerca viewers esistenti
        if (window.panoramaViewers) {
            for (const id in window.panoramaViewers) {
                const viewer = window.panoramaViewers[id];
                attachToViewer(viewer, id);
            }
        }

        // Monitora la creazione di nuovi viewer
        monitorViewerCreation();
    }

    /**
     * Si attacca a un viewer specifico per monitorare le rotazioni
     */
    function attachToViewer(viewer, id) {
        if (!viewer || !viewer.camera) return;

        // Monitora i cambiamenti del quaternion della camera
        let lastQuaternion = viewer.camera.quaternion.clone();

        const checkRotation = () => {
            if (!viewer.camera.quaternion.equals(lastQuaternion)) {
                // La camera è cambiata, calcola theta dal quaternion
                const theta = extractThetaFromQuaternion(viewer.camera.quaternion);
                updateThetaValue(theta);
                lastQuaternion = viewer.camera.quaternion.clone();
            }
            requestAnimationFrame(checkRotation);
        };

        checkRotation();
    }

    /**
     * Estrae l'angolo theta (yaw) dal quaternion della camera
     */
    function extractThetaFromQuaternion(quaternion) {
        // Converte il quaternion in angoli di Eulero
        const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
        return euler.y; // L'angolo Y è il nostro theta (rotazione orizzontale)
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
                    if (!knownViewers.has(id)) {
                        knownViewers.add(id);
                        attachToViewer(window.panoramaViewers[id], id);
                    }
                }
            }
            setTimeout(checkForNewViewers, 2000);
        };

        checkForNewViewers();
    }

    /**
     * Aggiorna il valore theta rilevato
     */
    function updateThetaValue(theta) {
        thetaValue = theta;
        detectedTheta = true;

        if (compassConfig.debug) {
            const degrees = theta * (180 / Math.PI);
            console.log(`🎯 Theta rilevato: ${theta.toFixed(6)} rad = ${degrees.toFixed(2)}°`);
        }
    }

    /**
     * Normalizza un angolo nell'intervallo [0, 360)
     */
    function normalizeAngle(angle) {
        return ((angle % 360) + 360) % 360;
    }

    /**
     * Converti da gradi a radianti
     */
    function degToRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Converti da radianti a gradi
     */
    function radToDeg(radians) {
        return radians * (180 / Math.PI);
    }

    /**
     * Converti un angolo in gradi a un vettore unitario
     */
    function angleToVector(degrees) {
        const radians = degToRad(degrees);
        return {
            x: Math.sin(radians),
            y: -Math.cos(radians)  // y negativo perché 0° punta verso l'alto
        };
    }

    /**
     * Converti un vettore a un angolo in gradi
     */
    function vectorToAngle(vector) {
        return normalizeAngle(radToDeg(Math.atan2(vector.x, -vector.y)));
    }

    /**
     * Interpola linearmente tra due vettori
     */
    function lerpVectors(v1, v2, t) {
        t = Math.max(0, Math.min(1, t)); // Clamp t to [0,1]
        return {
            x: v1.x + (v2.x - v1.x) * t,
            y: v1.y + (v2.y - v1.y) * t
        };
    }

    /**
     * Normalizza un vettore
     */
    function normalizeVector(v) {
        const length = Math.sqrt(v.x * v.x + v.y * v.y);
        if (length === 0 || Math.abs(length - 1) < 0.0001) return v; // Già normalizzato o zero
        return {
            x: v.x / length,
            y: v.y / length
        };
    }

    /**
     * Calcola la distanza angolare tra due vettori in gradi
     */
    function vectorAngularDistance(v1, v2) {
        // Usa il prodotto scalare per trovare l'angolo tra i vettori
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        const cosAngle = dot / (mag1 * mag2);

        // Clamp per evitare errori di precisione
        const clampedCos = Math.max(-1, Math.min(1, cosAngle));

        return radToDeg(Math.acos(clampedCos));
    }

    /**
     * Controlla se un movimento è significativo
     */
    function isSignificantMovement(v1, v2) {
        return vectorAngularDistance(v1, v2) > compassConfig.stabilizationThreshold;
    }

    /**
     * Media più vettori per uno smoothing avanzato
     */
    function averageVectors(vectors) {
        if (vectors.length === 0) return { x: 0, y: -1 };

        let sumX = 0, sumY = 0;
        vectors.forEach(v => {
            sumX += v.x;
            sumY += v.y;
        });

        return normalizeVector({
            x: sumX / vectors.length,
            y: sumY / vectors.length
        });
    }

    /**
     * Sistema di tracking della camera VETTORIALE STABILIZZATO
     */
    function startCameraTracking() {
        function updateCompass() {
            const cameraRotation = getCameraRotation();

            if (cameraRotation !== null) {
                // Converti l'angolo in un vettore direzionale
                const newTargetVector = angleToVector(cameraRotation);

                // Aggiungi al buffer di storia
                vectorHistory.push(newTargetVector);
                if (vectorHistory.length > HISTORY_SIZE) {
                    vectorHistory.shift();
                }

                // Usa una media mobile per il targetVector
                targetVector = averageVectors(vectorHistory);

                // Verifica se è un movimento significativo
                const isMoving = isSignificantMovement(needleVector, targetVector);

                if (isMoving) {
                    // Reset della stabilità se c'è movimento
                    stabilityCounter = 0;

                    if (compassConfig.smoothing) {
                        // Interpola tra la direzione attuale e quella target
                        needleVector = lerpVectors(needleVector, targetVector, compassConfig.smoothingFactor);

                        // Normalizza il vettore dell'ago per evitare drift
                        needleVector = normalizeVector(needleVector);
                    } else {
                        // Senza smoothing, salta direttamente al target
                        needleVector = targetVector;
                    }

                    // Memorizza l'ultima posizione stabile
                    lastStableNeedleVector = needleVector;
                } else {
                    // Incrementa il contatore di stabilità
                    stabilityCounter++;

                    if (compassConfig.stabilization && stabilityCounter >= STABILITY_THRESHOLD) {
                        // Se è stabile abbastanza a lungo, fissa l'ago
                        needleVector = lastStableNeedleVector;
                    } else if (compassConfig.smoothing) {
                        // Applica uno smoothing ridotto per micro-movimenti
                        const reducedFactor = compassConfig.smoothingFactor * 0.5;
                        needleVector = lerpVectors(needleVector, targetVector, reducedFactor);
                        needleVector = normalizeVector(needleVector);
                    }
                }

                // Converti il vettore dell'ago in un angolo e arrotonda a 2 decimali
                needleRotation = Math.round(vectorToAngle(needleVector) * 100) / 100;

                if (compassConfig.debug && isMoving) {
                    const targetAngle = vectorToAngle(targetVector);
                    const distance = vectorAngularDistance(needleVector, targetVector);
                    console.log(`🧭 Target: ${targetAngle.toFixed(2)}°, Needle: ${needleRotation.toFixed(2)}°, Dist: ${distance.toFixed(2)}°, Moving: ${isMoving}`);
                }
            }

            // Aggiorna la visualizzazione
            updateNeedleRotation(needleRotation);
            animationId = requestAnimationFrame(updateCompass);
        }

        updateCompass();
    }

    /**
     * Ottiene la rotazione della camera
     */
    function getCameraRotation() {
        // Usa theta se è stato rilevato
        if (detectedTheta) {
            let degrees = thetaValue * (180 / Math.PI);
            degrees = normalizeAngle(degrees + compassConfig.northOffset);

            if (compassConfig.debug) {
                console.log(`🎯 Theta custom: ${thetaValue.toFixed(4)} rad = ${degrees.toFixed(2)}°`);
            }

            return degrees;
        }

        // Fallback alla camera rotation
        const camera = findActiveCamera();
        if (camera?.rotation) {
            let degrees = camera.rotation.y * (180 / Math.PI);
            degrees = normalizeAngle(degrees + compassConfig.northOffset);

            if (compassConfig.debug) {
                console.log(`📷 Camera fallback: ${camera.rotation.y.toFixed(4)} rad = ${degrees.toFixed(2)}°`);
            }

            return degrees;
        }

        return null;
    }

    /**
     * Trova la camera attiva
     */
    function findActiveCamera() {
        if (window.camera) return window.camera;

        if (window.panoramaViewers) {
            for (const id in window.panoramaViewers) {
                if (window.panoramaViewers[id]?.camera) {
                    return window.panoramaViewers[id].camera;
                }
            }
        }

        return null;
    }

    /**
     * Aggiorna la rotazione dell'ago
     */
    function updateNeedleRotation(rotation) {
        panoramaContainers.forEach(container => {
            const needle = container.compass?.querySelector('.compass-needle');
            if (needle) {
                needle.style.transform = `rotate(${rotation}deg)`;
            }
        });
    }

    /**
     * Trova i container dei panorami
     */
    function findPanoramaContainers() {
        panoramaContainers = [];

        // Cerca container frontend
        $('.risviel-panorama').each(function() {
            panoramaContainers.push({
                element: this,
                id: $(this).attr('id') || 'panorama-' + panoramaContainers.length,
                type: 'frontend'
            });
        });

        // Cerca container admin
        const adminContainer = document.querySelector('#risviel-admin-panorama-viewer');
        if (adminContainer) {
            panoramaContainers.push({
                element: adminContainer,
                id: 'admin-panorama',
                type: 'admin'
            });
        }

        // Cerca container generici con canvas
        document.querySelectorAll('.panorama-container, .viewer-container, .threejs-container').forEach(function(container) {
            if (container.querySelector('canvas')) {
                panoramaContainers.push({
                    element: container,
                    id: container.id || 'generic-panorama-' + panoramaContainers.length,
                    type: 'generic'
                });
            }
        });

        // Fallback: cerca qualsiasi div con canvas
        if (panoramaContainers.length === 0) {
            document.querySelectorAll('div').forEach(function(div) {
                if (div.querySelector('canvas') && !div.classList.contains('modern-compass')) {
                    panoramaContainers.push({
                        element: div,
                        id: div.id || 'canvas-container-' + panoramaContainers.length,
                        type: 'canvas-container'
                    });
                }
            });
        }
    }

    /**
     * Crea gli elementi della bussola per ogni container
     */
    function createCompassElements() {
        panoramaContainers.forEach((container, index) => {
            if (container.element.querySelector('.modern-compass')) return;

            const compassContainer = document.createElement('div');
            compassContainer.className = `modern-compass ${compassConfig.position}`;
            compassContainer.innerHTML = createCompassSVG();

            container.element.appendChild(compassContainer);
            container.compass = compassContainer;
        });
    }

    /**
     * Crea il design SVG della bussola moderna
     */
    function createCompassSVG() {
        return `
            <svg class="compass-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <radialGradient id="shadowGradient" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" style="stop-color:rgba(0,0,0,0.1);stop-opacity:1" />
                        <stop offset="100%" style="stop-color:rgba(0,0,0,0.3);stop-opacity:1" />
                    </radialGradient>
                    <radialGradient id="baseGradient" cx="30%" cy="30%" r="70%">
                        <stop offset="0%" style="stop-color:#f8f9fa;stop-opacity:1" />
                        <stop offset="70%" style="stop-color:#e9ecef;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#dee2e6;stop-opacity:1" />
                    </radialGradient>
                    <linearGradient id="northGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#dc3545;stop-opacity:1" />
                        <stop offset="50%" style="stop-color:#c82333;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#a71e2a;stop-opacity:1" />
                    </linearGradient>
                    <linearGradient id="southGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#f8f9fa;stop-opacity:1" />
                        <stop offset="50%" style="stop-color:#e9ecef;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#adb5bd;stop-opacity:1" />
                    </linearGradient>
                    <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                        <feOffset dx="2" dy="2" result="offset"/>
                        <feComponentTransfer>
                            <feFuncA type="linear" slope="0.3"/>
                        </feComponentTransfer>
                        <feMerge> 
                            <feMergeNode/>
                            <feMergeNode in="SourceGraphic"/> 
                        </feMerge>
                    </filter>
                </defs>
                
                <circle cx="100" cy="100" r="95" fill="url(#shadowGradient)" opacity="0.3"/>
                <circle cx="100" cy="100" r="90" fill="url(#baseGradient)" stroke="#6c757d" stroke-width="2" filter="url(#dropShadow)"/>
                <circle cx="100" cy="100" r="80" fill="none" stroke="#495057" stroke-width="1.5"/>
                
                <g stroke="#495057" stroke-width="2" stroke-linecap="round">
                    <line x1="100" y1="25" x2="100" y2="35" transform="rotate(0 100 100)"/>
                    <line x1="100" y1="25" x2="100" y2="35" transform="rotate(90 100 100)"/>
                    <line x1="100" y1="25" x2="100" y2="35" transform="rotate(180 100 100)"/>
                    <line x1="100" y1="25" x2="100" y2="35" transform="rotate(270 100 100)"/>
                </g>
                
                <g stroke="#6c757d" stroke-width="1" stroke-linecap="round">
                    <line x1="100" y1="25" x2="100" y2="30" transform="rotate(45 100 100)"/>
                    <line x1="100" y1="25" x2="100" y2="30" transform="rotate(135 100 100)"/>
                    <line x1="100" y1="25" x2="100" y2="30" transform="rotate(225 100 100)"/>
                    <line x1="100" y1="25" x2="100" y2="30" transform="rotate(315 100 100)"/>
                </g>
                
                <g fill="#dc3545" font-family="Arial, sans-serif" font-size="24" font-weight="bold" text-anchor="middle">
                    <text x="100" y="20" dominant-baseline="middle">N</text>
                </g>
                <g fill="#495057" font-family="Arial, sans-serif" font-size="18" font-weight="normal" text-anchor="middle">
                    <text x="175" y="105" dominant-baseline="middle">E</text>
                    <text x="100" y="190" dominant-baseline="middle">S</text>
                    <text x="25" y="105" dominant-baseline="middle">W</text>
                </g>
                
                <g class="compass-needle" transform-origin="100 100">
                    <path d="M 100 45 L 95 100 L 100 95 L 105 100 Z" 
                          fill="url(#northGradient)" 
                          stroke="#a71e2a" 
                          stroke-width="1" 
                          filter="url(#dropShadow)"/>
                    
                    <path d="M 100 155 L 95 100 L 100 105 L 105 100 Z" 
                          fill="url(#southGradient)" 
                          stroke="#6c757d" 
                          stroke-width="1" 
                          filter="url(#dropShadow)"/>
                    
                    <circle cx="100" cy="100" r="8" fill="#343a40" stroke="#fff" stroke-width="2" filter="url(#dropShadow)"/>
                    <circle cx="100" cy="100" r="4" fill="#dc3545"/>
                </g>
                
                <circle cx="100" cy="100" r="15" fill="none" stroke="#adb5bd" stroke-width="1" opacity="0.5"/>
            </svg>
        `;
    }

    /**
     * Aggiunge gli stili CSS
     */
    function addCompassStyles() {
        if (document.getElementById('modern-compass-styles')) return;

        const styleElement = document.createElement('style');
        styleElement.id = 'modern-compass-styles';
        styleElement.textContent = `
            .modern-compass {
                position: absolute;
                width: ${compassConfig.size}px;
                height: ${compassConfig.size}px;
                opacity: ${compassConfig.opacity};
                pointer-events: none;
                z-index: 1000;
                will-change: transform;
            }
            
            .modern-compass.top-right { top: 20px; right: 20px; }
            .modern-compass.top-left { top: 20px; left: 20px; }
            .modern-compass.bottom-right { bottom: 60px; right: 20px; }
            .modern-compass.bottom-left { bottom: 60px; left: 20px; }
            
            .compass-svg {
                width: 100%;
                height: 100%;
                drop-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            
            .compass-needle {
                transform-origin: center;
            }
            
            .modern-compass circle[fill="#dc3545"] {
                animation: pulse 2s ease-in-out infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
        `;

        document.head.appendChild(styleElement);
    }

    // API pubblica
    window.modernCompass = {
        setSize: function(size) {
            compassConfig.size = size;
            document.querySelectorAll('.modern-compass').forEach(compass => {
                compass.style.width = size + 'px';
                compass.style.height = size + 'px';
            });
        },

        setPosition: function(position) {
            if (['top-right', 'top-left', 'bottom-right', 'bottom-left'].includes(position)) {
                compassConfig.position = position;
                document.querySelectorAll('.modern-compass').forEach(compass => {
                    compass.className = `modern-compass ${position}`;
                });
            }
        },

        setOpacity: function(opacity) {
            compassConfig.opacity = opacity;
            document.querySelectorAll('.modern-compass').forEach(compass => {
                compass.style.opacity = opacity;
            });
        },

        toggle: function(enabled) {
            compassConfig.enabled = enabled;
            document.querySelectorAll('.modern-compass').forEach(compass => {
                compass.style.display = enabled ? 'block' : 'none';
            });
        },

        setSmoothing: function(enabled, factor = 0.15) {
            compassConfig.smoothing = enabled;
            compassConfig.smoothingFactor = Math.max(0.05, Math.min(0.5, factor));
        },

        setStabilization: function(enabled, threshold = 0.5) {
            compassConfig.stabilization = enabled;
            compassConfig.stabilizationThreshold = threshold;
        },

        setNorthOffset: function(degrees) {
            compassConfig.northOffset = degrees;
        },

        debug: function() {
            compassConfig.debug = !compassConfig.debug;
            console.log("🔧 Debug mode:", compassConfig.debug ? "ON" : "OFF");
            console.log("📊 Stato corrente:");
            console.log("- Theta rilevato:", detectedTheta);
            console.log("- Valore theta:", thetaValue);
            console.log("- Needle Vector:", needleVector);
            console.log("- Target Vector:", targetVector);
            console.log("- Angolo ago:", needleRotation, "°");
            console.log("- Contatore stabilità:", stabilityCounter);
        },

        reinitialize: function() {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }

            document.querySelectorAll('.modern-compass').forEach(compass => {
                compass.remove();
            });

            compassInitialized = false;
            panoramaContainers = [];
            needleRotation = 0;
            thetaValue = 0;
            detectedTheta = false;
            needleVector = { x: 0, y: -1 };
            targetVector = { x: 0, y: -1 };
            lastStableNeedleVector = { x: 0, y: -1 };
            stabilityCounter = 0;
            vectorHistory = [];

            setTimeout(initializeCompass, 100);
        },

        // Imposta direttamente l'orientamento per debugging
        setOrientation: function(degrees) {
            targetVector = angleToVector(degrees);
            needleVector = targetVector;
            lastStableNeedleVector = targetVector;
            needleRotation = degrees;
            updateNeedleRotation(degrees);
            console.log(`🧭 Orientamento manuale impostato a ${degrees}°`);
        },

        // Test completo
        testFullRotation: function() {
            let testAngle = 0;
            const startTest = () => {
                testAngle = (testAngle + 5) % 360;
                this.setOrientation(testAngle);
                console.log(`🧪 Test: ${testAngle}°`);
                setTimeout(startTest, 100);
            };
            startTest();
        },

        // Nuovi controlli di stabilità
        increaseStability: function() {
            const newThreshold = Math.min(5.0, compassConfig.stabilizationThreshold + 0.1);
            this.setStabilization(true, newThreshold);
            console.log(`📊 Stabilità aumentata a ${newThreshold.toFixed(1)}°`);
            return newThreshold;
        },

        decreaseStability: function() {
            const newThreshold = Math.max(0.1, compassConfig.stabilizationThreshold - 0.1);
            this.setStabilization(true, newThreshold);
            console.log(`📊 Stabilità diminuita a ${newThreshold.toFixed(1)}°`);
            return newThreshold;
        }
    };

})(jQuery);