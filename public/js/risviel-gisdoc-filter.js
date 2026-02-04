
/**
 * Filtro categorie per la mappa Risviel GisDoc
 * Supporta interazioni touch e desktop
 */
(function() {
    'use strict';

    // Configurazione
    const CONFIG = {
        filterMode: 'OR', // 'OR' = mostra punti con almeno una categoria selezionata
        animationDuration: 300,
        debounceDelay: 150
    };

    // Stato del filtro
    let state = {
        selectedCategories: [],
        allMarkers: [],
        map: null,
        markersLayer: null
    };

    /**
     * Inizializza il sistema di filtro
     */
    function init() {
        console.log('[FILTER DEBUG] init() chiamato');

        const filterContainer = document.getElementById('risviel-map-filters');
        if (!filterContainer) {
            console.log('[FILTER DEBUG] filterContainer non trovato, esco');
            return;
        }

        // Se markersLayer non è pronto, ritenta tra 200 ms
        if (!window.risvielMap || !window.risvielMap.markersLayer) {
            console.log('[FILTER DEBUG] risvielMap non pronto, ritento tra 200ms', {
                risvielMap: window.risvielMap,
                markersLayer: window.risvielMap?.markersLayer
            });
            setTimeout(init, 200);
            return;
        }

        console.log('[FILTER DEBUG] Inizializzazione completata', {
            markersLayer: window.risvielMap.markersLayer,
            markersCount: window.risvielMap.markers?.length
        });

        // Ascolta eventi sui checkbox
        filterContainer.addEventListener('change', handleFilterChange);
        filterContainer.addEventListener('touchend', handleTouchEnd, { passive: false });

        const checkedBoxes = filterContainer.querySelectorAll('input[type="checkbox"]:checked');
        state.selectedCategories = Array.from(checkedBoxes).map(cb => cb.value);

        console.log('[FILTER DEBUG] Categorie inizialmente selezionate:', state.selectedCategories);

        state.map = window.risvielMap.map;
        state.markersLayer = window.risvielMap.markersLayer;
        state.allMarkers = window.risvielMap.markers || [];
    }

    /**
     * Gestisce il cambio di un filtro
     */
    function handleFilterChange(event) {
        if (event.target.type !== 'checkbox') return;

        const categoryId = event.target.value;
        const isChecked = event.target.checked;

        // Aggiorna stato
        if (isChecked) {
            if (!state.selectedCategories.includes(categoryId)) {
                state.selectedCategories.push(categoryId);
            }
        } else {
            state.selectedCategories = state.selectedCategories.filter(id => id !== categoryId);
        }

        // Aggiorna UI del checkbox
        updateCheckboxUI(event.target);

        // Applica filtro con debounce
        debounce(applyFilter, CONFIG.debounceDelay)();
    }

    /**
     * Gestisce eventi touch per migliore UX mobile
     */
    function handleTouchEnd(event) {
        const label = event.target.closest('.risviel-filter-item');
        if (!label) return;

        // Previeni doppio trigger
        event.preventDefault();

        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    /**
     * Aggiorna UI del checkbox dopo selezione
     */
    function updateCheckboxUI(checkbox) {
        const label = checkbox.closest('.risviel-filter-item');
        if (!label) return;

        if (checkbox.checked) {
            label.classList.add('is-active');
            label.setAttribute('aria-pressed', 'true');
        } else {
            label.classList.remove('is-active');
            label.setAttribute('aria-pressed', 'false');
        }
    }

    /**
     * Applica il filtro ai marker della mappa
     */
    function applyFilter() {
        // Rileggi sempre i marker aggiornati dall'oggetto globale
        if (window.risvielMap) {
            if (window.risvielMap.markersLayer) {
                state.markersLayer = window.risvielMap.markersLayer;
            }
            if (window.risvielMap.markers) {
                state.allMarkers = window.risvielMap.markers;
            }
        }

        if (!state.markersLayer) {
            console.warn('Markers layer not available');
            return;
        }

        // Se non ci sono marker, esci silenziosamente (potrebbero essere in caricamento)
        if (!state.allMarkers || !state.allMarkers.length) {
            return;
        }

        // Se nessuna categoria selezionata, mostra tutti
        const showAll = state.selectedCategories.length === 0;

        state.allMarkers.forEach(markerData => {
            const marker = markerData.marker;
            const markerCategories = markerData.categories || [];

            let shouldShow = showAll;

            if (!showAll) {
                // Logica OR: mostra se il marker ha almeno una delle categorie selezionate
                shouldShow = markerCategories.some(catId =>
                    state.selectedCategories.includes(String(catId))
                );
            }

            // Aggiorna lo stato di visibilità
            markerData.visible = shouldShow;

            // Anima la visibilità
            if (shouldShow) {
                showMarker(marker);
            } else {
                hideMarker(marker);
            }
        });

        // Dispatch evento per altri componenti
        document.dispatchEvent(new CustomEvent('risviel:filterApplied', {
            detail: {
                selectedCategories: state.selectedCategories,
                visibleCount: state.allMarkers.filter(m => m.visible).length
            }
        }));
    }

    /**
     * Mostra un marker con animazione
     */
    function showMarker(marker) {
        const wasOnLayer = state.markersLayer.hasLayer(marker);

        if (!state.markersLayer.hasLayer(marker)) {
            state.markersLayer.addLayer(marker);
        }

        console.log('[FILTER DEBUG] showMarker:', {
            wasOnLayer,
            nowOnLayer: state.markersLayer.hasLayer(marker),
            hasIcon: !!marker._icon
        });

        if (marker._icon) {
            marker._icon.style.transition = `opacity ${CONFIG.animationDuration}ms ease`;
            marker._icon.style.opacity = '1';
            marker._icon.style.pointerEvents = 'auto';
        }
    }

    /**
     * Nasconde un marker con animazione
     */
    function hideMarker(marker) {
        console.log('[FILTER DEBUG] hideMarker:', {
            hasIcon: !!marker._icon,
            isOnLayer: state.markersLayer.hasLayer(marker)
        });

        if (marker._icon) {
            marker._icon.style.transition = `opacity ${CONFIG.animationDuration}ms ease`;
            marker._icon.style.opacity = '0';
            marker._icon.style.pointerEvents = 'none';

            // Rimuovi dopo animazione
            setTimeout(() => {
                if (marker._icon && marker._icon.style.opacity === '0') {
                    state.markersLayer.removeLayer(marker);
                }
            }, CONFIG.animationDuration);
        }
    }

    /**
     * Resetta tutti i filtri
     */
    function resetFilters() {
        const filterContainer = document.getElementById('risviel-map-filters');
        if (!filterContainer) return;

        const checkboxes = filterContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
            updateCheckboxUI(cb);
        });

        state.selectedCategories = [];
        applyFilter();
    }

    /**
     * Seleziona tutte le categorie
     */
    function selectAllCategories() {
        const filterContainer = document.getElementById('risviel-map-filters');
        if (!filterContainer) return;

        const checkboxes = filterContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
            updateCheckboxUI(cb);
            if (!state.selectedCategories.includes(cb.value)) {
                state.selectedCategories.push(cb.value);
            }
        });

        applyFilter();
    }

    /**
     * Utility: debounce function
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Esponi API pubblica
    window.risvielFilter = {
        init: init,
        applyFilter: applyFilter,
        resetFilters: resetFilters,
        selectAllCategories: selectAllCategories,
        getSelectedCategories: () => [...state.selectedCategories],
        setSelectedCategories: (categories) => {
            state.selectedCategories = categories;
            applyFilter();
        }
    };

    // Auto-init quando DOM è pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();