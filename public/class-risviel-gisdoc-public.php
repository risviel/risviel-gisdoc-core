<?php
/**
 * Classe per la gestione del front-end.
 *
 * @since      1.0.0
 */
class Risviel_GisDoc_Public {

    /**
     * Il nome identificativo del plugin.
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $plugin_name    Il nome identificativo del plugin.
     */
    private $plugin_name;

    /**
     * La versione del plugin.
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $version    La versione corrente del plugin.
     */
    private $version;

    /**
     * Flag per indicare se gli asset sono stati caricati
     */
    private static $assets_loaded = false;

    /**
     * Flag per indicare se gli shortcode sono presenti
     */
    private static $has_shortcodes = null;

    /**
     * AJAX handler per ottenere le categorie del filtro
     */
    function risviel_gisdoc_get_filter_categories() {
        // Verifica nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_public_nonce')) {
            wp_send_json_error('Invalid nonce');
            return;
        }

        require_once RISVIEL_GISDOC_PLUGIN_DIR . 'includes/class-risviel-gisdoc-categories-db.php';
        $categories_db = new Risviel_GisDoc_Categories_DB();
        $categories = $categories_db->get_categories();

        if (empty($categories)) {
            wp_send_json_success([]);
            return;
        }

        // Formatta le categorie per il frontend
        $formatted_categories = array_map(function($category) {
            return [
                'id'    => $category['id'],
                'name'  => $category['name'],
                'color' => $category['color'] ?? '#0073aa',
                'icon'  => $category['icon'] ?? null
            ];
        }, $categories);

        wp_send_json_success($formatted_categories);
    }

    /**
     * Inizializza la classe e imposta le sue proprietà.
     *
     * @since    1.0.0
     * @param    string    $plugin_name    Il nome del plugin.
     * @param    string    $version        La versione del plugin.
     */
    public function __construct($plugin_name, $version) {
        $this->plugin_name = $plugin_name;
        $this->version = $version;

        // Aggiungi gli action hook per AJAX nel frontend
        add_action('wp_ajax_risviel_gisdoc_get_map_points', array($this, 'ajax_get_map_points'));
        add_action('wp_ajax_nopriv_risviel_gisdoc_get_map_points', array($this, 'ajax_get_map_points'));

        add_action('wp_ajax_risviel_gisdoc_get_panorama', array($this, 'ajax_get_panorama'));
        add_action('wp_ajax_nopriv_risviel_gisdoc_get_panorama', array($this, 'ajax_get_panorama'));


        // Aggiungi l'action AJAX per ottenere le categorie del filtro
        add_action('wp_ajax_risviel_gisdoc_get_filter_categories', array($this, 'risviel_gisdoc_get_filter_categories'));
        add_action('wp_ajax_nopriv_risviel_gisdoc_get_filter_categories', array($this, 'risviel_gisdoc_get_filter_categories'));

        // Aggiungi hook per controllare il contenuto dopo che è stato processato
        add_action('wp', array($this, 'check_for_shortcodes'));
    }

    /**
     * Controlla se ci sono shortcode del plugin dopo che il post è stato caricato
     */
    public function check_for_shortcodes() {
        global $post;

        if ($post && !empty($post->post_content)) {
            $plugin_shortcodes = array('risviel_map', 'risviel_panorama', 'risviel_gisdoc_panorama');
            $plugin_classes = array('risviel-map', 'risviel-panorama');

            foreach ($plugin_shortcodes as $shortcode) {
                if (has_shortcode($post->post_content, $shortcode)) {
                    self::$has_shortcodes = true;
                    break;
                }
            }

            if (!self::$has_shortcodes) {
                foreach ($plugin_classes as $class) {
                    if (strpos($post->post_content, $class) !== false) {
                        self::$has_shortcodes = true;
                        break;
                    }
                }
            }
        }

        // Controlla anche parametri URL
        if (!self::$has_shortcodes && isset($_GET['id']) && !empty($_GET['id'])) {
            self::$has_shortcodes = true;
        }
    }

    /**
     * Verifica se la pagina corrente contiene shortcode del plugin
     */
    private function has_plugin_shortcodes() {
        // Se abbiamo già determinato la presenza di shortcode, usa quel valore
        if (self::$has_shortcodes !== null) {
            return self::$has_shortcodes;
        }

        global $post, $wp_query;

        // Lista degli shortcode del plugin
        $plugin_shortcodes = array(
            'risviel_map',
            'risviel_panorama',
            'risviel_gisdoc_panorama'
        );

        // Lista delle classi CSS che indicano presenza del plugin
        $plugin_classes = array(
            'risviel-map',
            'risviel-panorama'
        );

        $has_shortcode = false;

        // Controlla il post principale
        if ($post && !empty($post->post_content)) {
            foreach ($plugin_shortcodes as $shortcode) {
                if (has_shortcode($post->post_content, $shortcode)) {
                    $has_shortcode = true;
                    break;
                }
            }

            // Controlla anche la presenza di classi CSS del plugin
            if (!$has_shortcode) {
                foreach ($plugin_classes as $class) {
                    if (strpos($post->post_content, $class) !== false) {
                        $has_shortcode = true;
                        break;
                    }
                }
            }
        }

        // Controlla tutti i post nella query (per archivi, home page, ecc.)
        if (!$has_shortcode && $wp_query && isset($wp_query->posts)) {
            foreach ($wp_query->posts as $query_post) {
                if (!empty($query_post->post_content)) {
                    foreach ($plugin_shortcodes as $shortcode) {
                        if (has_shortcode($query_post->post_content, $shortcode)) {
                            $has_shortcode = true;
                            break 2;
                        }
                    }

                    if (!$has_shortcode) {
                        foreach ($plugin_classes as $class) {
                            if (strpos($query_post->post_content, $class) !== false) {
                                $has_shortcode = true;
                                break 2;
                            }
                        }
                    }
                }
            }
        }

        // Controlla widget e sidebar
        if (!$has_shortcode) {
            $sidebars_widgets = wp_get_sidebars_widgets();
            if (is_array($sidebars_widgets)) {
                foreach ($sidebars_widgets as $sidebar => $widgets) {
                    if (is_array($widgets)) {
                        foreach ($widgets as $widget) {
                            $widget_content = get_option('widget_' . $widget);
                            if (is_array($widget_content)) {
                                foreach ($widget_content as $instance) {
                                    if (is_array($instance) && isset($instance['text'])) {
                                        foreach ($plugin_shortcodes as $shortcode) {
                                            if (has_shortcode($instance['text'], $shortcode)) {
                                                $has_shortcode = true;
                                                break 4;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Controlla parametri URL per panorami diretti
        if (!$has_shortcode) {
            if (isset($_GET['id']) && !empty($_GET['id'])) {
                $has_shortcode = true;
            }
        }

        // Per il debug - forza il caricamento su pagine specifiche se necessario
        if (!$has_shortcode && is_admin() === false) {
            // Aggiungi qui eventuali controlli specifici per template o pagine particolari
            $current_template = get_page_template_slug();
            if (strpos($current_template, 'risviel') !== false) {
                $has_shortcode = true;
            }
        }

        self::$has_shortcodes = $has_shortcode;
        return $has_shortcode;
    }

    /**
     * Forza il caricamento degli asset quando viene utilizzato uno shortcode
     */
    public function ensure_assets_loaded() {
        if (!self::$assets_loaded) {
            // Carica sempre gli asset quando uno shortcode viene chiamato
            $this->load_assets();
            self::$assets_loaded = true;
        }
    }

    /**
     * Carica effettivamente gli asset
     */
    private function load_assets() {

            // Registra e carica jQuery
            wp_enqueue_script('jquery');
            /*wp_deregister_script('jquery');
            wp_enqueue_script('jquery', 'https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js', array(), null, true);*/

            // Registra e carica Leaflet
            wp_enqueue_style('leaflet', RISVIEL_GISDOC_PLUGIN_URL . 'assets/leaflet/leaflet.css', array(), '1.7.1');
            wp_enqueue_script('leaflet', RISVIEL_GISDOC_PLUGIN_URL . 'assets/leaflet/leaflet.js', array('jquery'), '1.7.1', false);
            wp_enqueue_style('leaflet_legend', RISVIEL_GISDOC_PLUGIN_URL . 'assets/leaflet/plugins/leaflet.legend/leaflet.legend.css', array(), '1.7.1');
            wp_enqueue_script('leaflet_legend', RISVIEL_GISDOC_PLUGIN_URL . 'assets/leaflet/plugins/leaflet.legend/leaflet.legend.js', array(), '1.7.1', false);

            // Registra e carica Three.js
            wp_enqueue_script('threejs', RISVIEL_GISDOC_PLUGIN_URL . 'assets/threejs/three.min.js', array('jquery'), 'r128', false);

            // Carica stili del plugin
            wp_enqueue_style('aton-css', '/res/css/aton.css', array(), 'all');
            wp_enqueue_style($this->plugin_name, RISVIEL_GISDOC_PLUGIN_URL . 'public/css/risviel-gisdoc-public.min.css', array(), $this->version, 'all');

            // Carica script del plugin
            wp_enqueue_script($this->plugin_name . '-panorama', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-panorama.min.js', array('jquery', 'threejs'), $this->version, false);
            //wp_enqueue_script($this->plugin_name . '-mini-map', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-mini-map.js', array('jquery', 'threejs'), $this->version, false);
            wp_enqueue_script($this->plugin_name . '-controls', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-controls.min.js', array('jquery', 'threejs'), $this->version, false);
            wp_enqueue_script($this->plugin_name . '-compass', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-compass.min.js', array('jquery', 'threejs'), $this->version, false);
            wp_enqueue_script($this->plugin_name, RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-map.min.js', array('jquery', 'leaflet', 'threejs'), $this->version, false);


            // Carica i filtri
            wp_enqueue_script($this->plugin_name . '-filter', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-filter.min.js', array(), $this->version, false);
            wp_enqueue_style($this->plugin_name . '-filter', RISVIEL_GISDOC_PLUGIN_URL . 'public/css/risviel-gisdoc-filter.min.css', array(), $this->version, 'all');
            wp_localize_script('risviel-gisdoc-filter', 'risvielFilterConfig', array(
                'filterMode' => 'OR',
                'ajaxUrl' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('risviel_filter_nonce'),
                'i18n' => array(
                    'noResults' => __('Nessun punto trovato per le categorie selezionate.', 'risviel-gisdoc'),
                    'showingAll' => __('Visualizzazione di tutti i punti.', 'risviel-gisdoc'),
                )
            ));

            /*wp_enqueue_script('aton-node-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.node.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-pov-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.pov.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-lightprobe-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.lightprobe.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-xpf-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.xpf.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-flare-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.flare.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-eventhub-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.eventhub.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-mathub-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.mathub.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-utils-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.utils.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-scenehub-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.scenehub.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-audiohub-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.audiohub.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-locnode-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.locnode.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-devori-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.devori.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-nav-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.nav.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-xr-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.xr.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-sui-button-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.sui.button.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-sui-label-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.sui.label.js', array('jquery', 'aton-sui-button-js'), '1.0.0', false);
            wp_enqueue_script('aton-sui-mediapanel-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.sui.mediapanel.js', array('jquery', 'aton-sui-label-js'), '1.0.0', false);
            wp_enqueue_script('aton-sui-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.sui.js', array('jquery', 'aton-sui-mediapanel-js'), '1.0.0', false);
            wp_enqueue_script('aton-ui-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.ui.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-avatar-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.avatar.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-photon-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.photon.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-semfactory-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.semfactory.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-fe-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.fe.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-mediaflow-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.mediaflow.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-phygital-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.phygital.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-app-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.app.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-fx-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.fx.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-xpfnetwork-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.xpfnetwork.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-cc-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.cc.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-mres-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.mres.js', array('jquery', 'threejs'), '1.0.0', false);
            wp_enqueue_script('aton-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.js', array('jquery', 'aton-sui-js'), '1.0.0', false);*/


            // Crea nonce per sicurezza
            $nonce = wp_create_nonce('risviel_gisdoc_public_nonce');
            $panorama_nonce = wp_create_nonce('risviel_gisdoc_panorama_nonce');

            // Localizza i dati per gli script
            wp_localize_script($this->plugin_name . '-panorama', 'risviel_gisdoc_panorama', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => $panorama_nonce,
                'default_language' => get_option('risviel_gisdoc_default_language', 'it')
            ));

            wp_localize_script($this->plugin_name, 'risviel_gisdoc_public', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => $nonce,
                'default_language' => get_option('risviel_gisdoc_default_language', 'it'),
                'map_center_lat' => get_option('risviel_gisdoc_map_center_lat', '0'),
                'map_center_lng' => get_option('risviel_gisdoc_map_center_lng', '0'),
                'map_zoom' => get_option('risviel_gisdoc_map_zoom', '11'),
                'plugin_url' => RISVIEL_GISDOC_PLUGIN_URL,
                'panorama_page_id' => get_option('risviel_gisdoc_panorama_page_id', 'touchscreen-foto-panoramica-360')
            ));

    }

    /**
     * Registra gli stili per il front-end.
     *
     * @since    1.0.0
     */
    public function enqueue_styles() {
        // Se gli asset sono già stati caricati, non ricaricarli
        if (self::$assets_loaded) {
            return;
        }

        // Carica stili solo se ci sono shortcode del plugin nella pagina
        if (!$this->has_plugin_shortcodes()) {
            return;
        }

        wp_enqueue_style('leaflet', RISVIEL_GISDOC_PLUGIN_URL . 'assets/leaflet/leaflet.css', array(), '1.7.1');
        wp_enqueue_style('leaflet_legend', RISVIEL_GISDOC_PLUGIN_URL . 'assets/leaflet/plugins/leaflet.legend/leaflet.legend.css', array(), '1.7.1');
        wp_enqueue_style('aton', '/res/css/aton.css', array(), 'all');
        wp_enqueue_style($this->plugin_name, RISVIEL_GISDOC_PLUGIN_URL . 'public/css/risviel-gisdoc-public.min.css', array(), $this->version, 'all');
    }

    /**
     * Registra gli script per il front-end.
     *
     * @since    1.0.0
     */
    public function enqueue_scripts() {
        // Se gli asset sono già stati caricati, non ricaricarli
        if (self::$assets_loaded) {
            return;
        }

        // Carica script solo se ci sono shortcode del plugin nella pagina
        if (!$this->has_plugin_shortcodes()) {
            return;
        }

        /*wp_deregister_script('jquery');
        wp_enqueue_script('jquery', 'https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js', array(), null, true);*/

        // Registra jQuery
        wp_enqueue_script('jquery');

        // Registra Leaflet e Three.js come dipendenze
        wp_enqueue_script('leaflet', RISVIEL_GISDOC_PLUGIN_URL . 'assets/leaflet/leaflet.js', array('jquery'), '1.7.1', false);
        wp_enqueue_script('leaflet_legend', RISVIEL_GISDOC_PLUGIN_URL . 'assets/leaflet/plugins/leaflet.legend/leaflet.legend.js', array(), '1.7.1');
        wp_enqueue_script('threejs', RISVIEL_GISDOC_PLUGIN_URL . 'assets/threejs/three.min.js', array('jquery'), 'r128', false);

        // Crea un nonce specifico per il plugin
        $nonce = wp_create_nonce('risviel_gisdoc_public_nonce');

        //if (isset($_GET['page']) && $_GET['page'] === $this->plugin_name . '-panoramas') {
            wp_enqueue_script($this->plugin_name . '-panorama', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-panorama.min.js', array('jquery', 'threejs'), $this->version, false);
            wp_enqueue_script($this->plugin_name . '-mini-map', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-mini-map.min.js', array('jquery', 'threejs'), $this->version, false);
            wp_enqueue_script($this->plugin_name . '-controls', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-controls.min.js', array('jquery', 'threejs'), $this->version, false);
            wp_enqueue_script($this->plugin_name . '-compass', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-compass.min.js', array('jquery', 'threejs'), $this->version, false);
            wp_enqueue_script($this->plugin_name, RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-map.min.js', array('jquery', 'leaflet', 'threejs'), $this->version, false);
        //}

        // Crea un nonce specifico per il panorama
        $panorama_nonce = wp_create_nonce('risviel_gisdoc_panorama_nonce');

        // Passa i parametri allo script
        wp_localize_script($this->plugin_name . '-panorama', 'risviel_gisdoc_panorama', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('risviel_gisdoc_panorama_nonce'),
            'default_language' => get_option('risviel_gisdoc_default_language', 'it')
        ));

        // Localizza i dati per lo script principale
        wp_localize_script($this->plugin_name, 'risviel_gisdoc_public', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => $nonce, // Usa lo stesso nonce
            'default_language' => get_option('risviel_gisdoc_default_language', 'it'),
            'map_center_lat' => get_option('risviel_gisdoc_map_center_lat', '0'),
            'map_center_lng' => get_option('risviel_gisdoc_map_center_lng', '0'),
            'map_zoom' => get_option('risviel_gisdoc_map_zoom', '11'),
            'plugin_url' => RISVIEL_GISDOC_PLUGIN_URL,
            'panorama_page_id' => get_option('risviel_gisdoc_panorama_page_id', 'touchscreen-foto-panoramica-360') // Aggiungi l'ID della pagina panorama
        ));

    }

    /**
     * Registra i ganci per la parte pubblica
     */
    private function define_public_hooks() {
        // Registra shortcodes
        add_shortcode('risviel_panorama', array($this, 'panorama_shortcode'));

        // Registra azioni AJAX
        add_action('wp_ajax_risviel_gisdoc_get_panorama', array($this, 'ajax_get_panorama'));
        add_action('wp_ajax_nopriv_risviel_gisdoc_get_panorama', array($this, 'ajax_get_panorama'));
    }

    /**
     * Registra gli shortcode.
     *
     * @since    1.0.0
     */
    public function register_shortcodes() {
        add_shortcode('risviel_map', array($this, 'map_shortcode'));

        add_shortcode('risviel_gisdoc_panorama', array($this, 'panorama_shortcode'));
    }

    /**
     * Shortcode per la visualizzazione della mappa.
     *
     * @since     1.0.0
     * @param     array     $atts    Attributi dello shortcode.
     * @return    string             Output HTML.
     */
    public function map_shortcode($atts) {
        // Assicurati che gli asset siano caricati
        $this->ensure_assets_loaded();

        // Parametri di default
        $atts = shortcode_atts(array(
            'width' => '100%',
            'height' => '600px',
            'lang' => get_option('risviel_gisdoc_default_language', 'it'),
            'for_totem' => 'true',
        ), $atts);

        // Genera un ID unico per il container della mappa
        $map_id = 'risviel-map-' . uniqid();

        // CSS inline per il container della mappa
        $map_style = 'width: ' . esc_attr($atts['width']) . '; height: ' . esc_attr($atts['height']) . ';';

        $output = '';

        // Aggiungi il filtro categorie se abilitato
        if (isset ($atts['show_filter']) && $atts['show_filter'] === 'true') {
            $output .= $this->render_category_filter();
        }

        // HTML del container della mappa
        $output .= '<div id="' . $map_id . '" class="risviel-map" style="' . $map_style . '" data-lang="' . esc_attr($atts['lang']) . '" data-for_totem="' . esc_attr($atts['for_totem']) . '"></div>';


        parse_str($_SERVER['REQUEST_URI'], $res);
        $lang = $res['lang'] ?? $atts['lang'];

        $output .= $this->getFooter($lang);

        return $output;
    }

    /**
     * Renderizza il filtro categorie per la mappa
     *
     * @return string HTML del filtro
     */
    private function render_category_filter() {
        // Carica la classe categorie
        require_once RISVIEL_GISDOC_PLUGIN_DIR . 'includes/class-risviel-gisdoc-categories-db.php';
        $categories_db = new Risviel_GisDoc_Categories_DB();
        $categories = $categories_db->get_categories();

        if (empty($categories)) {
            return '';
        }

        ob_start();
        ?>
        <div id="risviel-map-filters" class="risviel-map-filters" role="group" aria-label="<?php esc_attr_e('Filtra punti per categoria', 'risviel-gisdoc'); ?>">
            <div class="risviel-filters-header">
                <h3 class="risviel-filters-title"><?php esc_html_e('Filtra per categoria', 'risviel-gisdoc'); ?></h3>
                <!--div class="risviel-filters-actions">
                    <button type="button" class="risviel-filter-btn risviel-filter-btn--reset" onclick="if(window.risvielFilter) risvielFilter.resetFilters();">
                        < ?php esc_html_e('Reset', 'risviel-gisdoc'); ?>
                    </button>
                    <button type="button" class="risviel-filter-btn risviel-filter-btn--all" onclick="if(window.risvielFilter) risvielFilter.selectAllCategories();">
                        < ?php esc_html_e('Tutti', 'risviel-gisdoc'); ?>
                    </button>
                </div-->
            </div>

            <div class="risviel-filters-list">
                <?php foreach ($categories as $category): ?>
                    <label class="risviel-filter-item"
                           role="checkbox"
                           aria-checked="false"
                           tabindex="0"
                           style="--category-color: <?php echo esc_attr($category['color']); ?>">
                        <input type="checkbox"
                               name="risviel_category[]"
                               value="<?php echo esc_attr($category['id']); ?>"
                               data-category-id="<?php echo esc_attr($category['id']); ?>"
                               class="risviel-filter-checkbox">
                        <span class="risviel-filter-indicator"></span>
                        <?php if (!empty($category['icon'])): ?>
                            <img src="<?php echo esc_url($category['icon']); ?>"
                                 alt=""
                                 class="risviel-filter-icon"
                                 loading="lazy">
                        <?php else: ?>
                            <span class="risviel-filter-color" style="background-color: <?php echo esc_attr($category['color']); ?>"></span>
                        <?php endif; ?>
                        <span class="risviel-filter-name"><?php echo esc_html($category['name']); ?></span>
                    </label>
                <?php endforeach; ?>
            </div>

            <p class="risviel-filters-help">
                <?php esc_html_e('Seleziona una o più categorie per filtrare i punti sulla mappa.', 'risviel-gisdoc'); ?>
            </p>
        </div>
        <?php
        return ob_get_clean();
    }

    public function Aton_init()
    {
        $output = '<body oncontextmenu="return false;">
        
            <!-- Top Toolbar -->
            <div id="idTopToolbar" class="atonToolbar atonToolbar-top-left scrollableX"></div>
        
            <!-- Bottom Toolbar -->
            <div id="idBottomToolbar" class="atonToolbar atonToolbar-bottom scrollableX"></div>
            <div id="idBottomRToolbar" class="atonToolbar atonToolbar-bottom-right"></div>
        
            <!-- Main Popup -->
            <div id="idPopup" class="atonPopupContainer" style="display:none;"></div>
        
            <!-- Loader -->
            <div id="idLoader" class="atonCenterLoader" style="display:none;"></div>
            <div id="idBGcover" class="atonBGcover" style="display:none;"></div>
        
            <!-- Powered by -->
            <div id=\'idPoweredBy\' class="poweredBy" >
                Powered by <a href="http://osiris.itabc.cnr.it/aton/" target="_blank">ATON</a>
            </div>
        </body>';
        return $output;
    }

    public function getHeader($lang)
    {
        $output = ' <div id="idTopToolbar" class="atonToolbar atonToolbar-top-left scrollableX" style="z-index: 999999; background: rgba(18, 18, 18, 0.85) !important">
                         <div id="btn-home" class="atonBTN btn-home" title="home" style="padding-left: 12px; padding-right: 12px;">
                            <img src="../res/icons/home.png">
                         </div>
                     </div>
                     <script>
                        document.addEventListener(\'DOMContentLoaded\', function() {
                            document.addEventListener(\'click\', function(e) {
                                if (e.target.closest(\'.btn-home\')) {
                                    location.href = \'/wp/mappa?lang=' . $lang . '\';
                                }
                            });
                        });
                    </script>';
        return $output;
    }


public function getFooter($lang)
{
    $output = '
                <script>
                    // Script per coordinare le animazioni dei controlli
                    document.addEventListener(\'DOMContentLoaded\', function() {
                        // Funzione per inizializzare le animazioni
                        function initControlAnimations() {
                            const mapContainer = document.querySelector(\'.leaflet-container\');
                            const layerControl = document.querySelector(\'.leaflet-control-layers\');
                            const zoomControl = document.querySelector(\'.leaflet-control-zoom\');
                            const footer = document.querySelector(\'footer\');
                            
                            if (mapContainer) {
                                mapContainer.classList.add(\'controls-loading\');
                            }
                            
                            // Sequenza di animazioni
                            setTimeout(() => {
                                if (layerControl) {
                                    layerControl.classList.add(\'loaded\');
                                }
                            }, 300);
                            
                            setTimeout(() => {
                                if (zoomControl) {
                                    zoomControl.classList.add(\'loaded\');
                                }
                            }, 300);
                            
                            setTimeout(() => {
                                if (footer) {
                                    footer.classList.add(\'loaded\');
                                }
                            }, 300);
                            
                            // Rimuovi lo stato di caricamento
                            setTimeout(() => {
                                if (mapContainer) {
                                    mapContainer.classList.remove(\'controls-loading\');
                                    mapContainer.classList.add(\'controls-loaded\');
                                }
                            }, 1000);
                        }
                        
                        // Avvia le animazioni dopo un breve delay
                        setTimeout(initControlAnimations, 500);
                        
                        // Listener per l\'espansione del controllo layer
                        /*document.addEventListener(\'click\', function(e) {
                            if (e.target.closest(\'.leaflet-control-layers-toggle\')) {
                                setTimeout(() => {
                                    const expandedControl = document.querySelector(\'.leaflet-control-layers-expanded\');
                                    if (expandedControl) {
                                        expandedControl.classList.add(\'loaded\');
                                    }
                                }, 50);
                            }
                        });*/
                        
                                    
                        
                    });

            </script>
                        ';

    return $output;
}

public function getFooter_old($lang)
{
    $output = '<footer class="with-text">
                    <img src="' . RISVIEL_GISDOC_PLUGIN_URL . 'assets/images/logo_progetto.png" alt="Logo Footer" class="__web-inspector-hide-shortcut__">
                </footer>
                <script>
                    // Script per coordinare le animazioni dei controlli
                    document.addEventListener(\'DOMContentLoaded\', function() {
                        // Funzione per inizializzare le animazioni
                        function initControlAnimations() {
                            const mapContainer = document.querySelector(\'.leaflet-container\');
                            const layerControl = document.querySelector(\'.leaflet-control-layers\');
                            const zoomControl = document.querySelector(\'.leaflet-control-zoom\');
                            const footer = document.querySelector(\'footer\');
                            
                            if (mapContainer) {
                                mapContainer.classList.add(\'controls-loading\');
                            }
                            
                            // Sequenza di animazioni
                            setTimeout(() => {
                                if (layerControl) {
                                    layerControl.classList.add(\'loaded\');
                                }
                            }, 300);
                            
                            setTimeout(() => {
                                if (zoomControl) {
                                    zoomControl.classList.add(\'loaded\');
                                }
                            }, 300);
                            
                            setTimeout(() => {
                                if (footer) {
                                    footer.classList.add(\'loaded\');
                                }
                            }, 300);
                            
                            // Rimuovi lo stato di caricamento
                            setTimeout(() => {
                                if (mapContainer) {
                                    mapContainer.classList.remove(\'controls-loading\');
                                    mapContainer.classList.add(\'controls-loaded\');
                                }
                            }, 1000);
                        }
                        
                        // Avvia le animazioni dopo un breve delay
                        setTimeout(initControlAnimations, 500);
                        
                        // Listener per l\'espansione del controllo layer
                        document.addEventListener(\'click\', function(e) {
                            if (e.target.closest(\'.leaflet-control-layers-toggle\')) {
                                setTimeout(() => {
                                    const expandedControl = document.querySelector(\'.leaflet-control-layers-expanded\');
                                    if (expandedControl) {
                                        expandedControl.classList.add(\'loaded\');
                                    }
                                }, 50);
                            }
                        });
                        
                                    
                                    
                        // 🥚 EASTER EGG - Crediti con 8 click/tap rapidi entro 2 secondi il giorno 24
                        let clickCount = 0;
                        let clickTimer = null;
                        let easterEggAudio = null; 
                        let dayOfEsterEgg = 9; // il giorno 24 del mese; 
                        let tapToActivateEsterEgg = 8; // 8 Tocchi
                        let timesToActivateEsterEgg = 2000; // entro 2 secondi
                        const targetElement = document.querySelector(\'footer img\');
                        
                        // Verifica se oggi è il giorno dayOfEsterEgg
                        function isEasterEggDay() {
                            const today = new Date();
                            return today.getDate() === dayOfEsterEgg;
                        }
                        function resetClickCounter() {
                            clickCount = 0;
                            if (clickTimer) {
                                clearTimeout(clickTimer);
                                clickTimer = null;
                            }
                        }
                        function stopEasterEggAudio() {
                            if (easterEggAudio) {
                                easterEggAudio.pause();
                                easterEggAudio.currentTime = 0;
                                easterEggAudio = null;
                            }
                        }
                        function playEasterEggAudio() {
                            try {
                                // Puoi cambiare il percorso del file audio qui
                                const audioUrl = "' . RISVIEL_GISDOC_PLUGIN_URL . 'public/audio/routine.mp3";
                                easterEggAudio = new Audio(audioUrl);
                                easterEggAudio.volume = 0.5; // Volume al 50%
                                easterEggAudio.loop = true; // Ripeti in loop
                                
                                // Gestisci errori di caricamento
                                easterEggAudio.addEventListener(\'error\', function() {
                                    console.log(\'Easter egg audio non trovato o non caricabile\');
                                });
                                
                                easterEggAudio.play().catch(function(error) {
                                    console.log(\'Riproduzione audio bloccata dal browser:\', error);
                                });
                            } catch (error) {
                                console.log(\'Errore nella riproduzione audio:\', error);
                            }
                        }
                        
                        // Funzione per chiudere il modal e fermare l\'audio
                        function closeModal() {
                            stopEasterEggAudio();
                            const modal = document.getElementById(\'risviel-credits-modal\');
                            if (modal) {
                                modal.remove();
                            }
                        }
                            
                        // Funzione globale per chiudere il modal
                        window.closeEasterEggModal = function() {
                            stopEasterEggAudio();
                            const modal = document.getElementById(\'risviel-credits-modal\');
                            if (modal) {
                                modal.remove();
                            }
                        }

                        function showCreditsModal() {
                            // Rimuovi modal esistente se presente
                            const existingModal = document.getElementById(\'risviel-credits-modal\');
                            if (existingModal) {
                                existingModal.remove();
                                stopEasterEggAudio(); // Ferma audio se modal già aperto
                            }
                            
                            // Avvia l\'audio dell\'easter egg
                            playEasterEggAudio();
                            
                            const today = new Date();
                            const dateString = today.toLocaleDateString(\'it-IT\', { 
                                day: \'numeric\', 
                                month: \'long\', 
                                year: \'numeric\' 
                            });

                            // Crea il modal dei crediti
                            const modal = document.createElement(\'div\');
                            modal.id = \'risviel-credits-modal\';
                            modal.style.cssText = `
                                position: fixed;
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                background: rgba(0, 0, 0, 0.9);
                                z-index: 999999;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                opacity: 0;
                                transition: opacity 0.5s ease;
                                backdrop-filter: blur(10px);
                            `;
                            
                            modal.innerHTML = `
                                <div style="
                                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
                                    color: white;
                                    padding: 40px;
                                    border-radius: 20px;
                                    max-width: 500px;
                                    width: 90%;
                                    text-align: center;
                                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
                                    border: 2px solid rgba(64, 200, 255, 0.3);
                                    position: relative;
                                    transform: scale(0.8);
                                    transition: transform 0.5s ease;
                                ">
                                    <div style="
                                        position: absolute;
                                        top: 15px;
                                        right: 20px;
                                        cursor: pointer;
                                        font-size: 24px;
                                        opacity: 0.7;
                                        transition: opacity 0.3s ease;
                                        color: #40c8ff;
                                    " onclick="window.closeEasterEggModal();">×</div>
                                    
                                    <div style="
                                        font-size: 28px;
                                        margin-bottom: 20px;
                                        background: linear-gradient(45deg, #40c8ff, #64b5f6);
                                        -webkit-background-clip: text;
                                        -webkit-text-fill-color: transparent;
                                        background-clip: text;
                                        font-weight: bold;
                                    ">🚀 RISVIEL GisDoc</div>
                                    
                                    <div style="
                                        font-size: 16px;
                                        line-height: 1.6;
                                        margin-bottom: 25px;
                                        opacity: 0.9;
                                    ">
                                        <strong>Sistema di Documentazione Geografica Interattiva</strong>
                                    </div>
                                    
                                    <div style="
                                        font-size: 14px;
                                        line-height: 1.8;
                                        margin-bottom: 25px;
                                        opacity: 0.8;
                                        text-align: left;
                                    ">
                                        <div style="
                                            margin-bottom: 20px;
                                            padding: 15px;
                                            background: rgba(64, 200, 255, 0.1);
                                            border-radius: 10px;
                                            border-left: 4px solid #40c8ff;
                                        ">
                                            <strong style="color: #40c8ff; font-size: 16px;">👨‍💻 Sviluppatore</strong><br>
                                            <span style="font-size: 18px; font-weight: bold; color: #ffffff;">Antonio Sanna</span><br>
                                            <span style="font-size: 12px; opacity: 0.7;">Full Stack Developer</span>
                                        </div>
                                        
                                        <div style="margin-bottom: 15px;">
                                            <strong style="color: #40c8ff;">🏗️ Sviluppo:</strong><br>
                                            Sistema sviluppato con tecnologie moderne per la gestione
                                            e visualizzazione di contenuti geografici interattivi
                                        </div>
                                        
                                        <div style="margin-bottom: 15px;">
                                            <strong style="color: #40c8ff;">🛠️ Tecnologie:</strong><br>
                                            WordPress • Leaflet.js • Three.js • Aton
                                        </div>
                                        
                                        <div style="margin-bottom: 15px;">
                                            <strong style="color: #40c8ff;">📍 Funzionalità:</strong><br>
                                            Mappe interattive • Panorami 360° • Multimedia
                                        </div>
                                    </div>
                                    
                                    <div style="
                                        font-size: 12px;
                                        opacity: 0.6;
                                        border-top: 1px solid rgba(255, 255, 255, 0.1);
                                        padding-top: 15px;
                                        margin-top: 20px;
                                    ">
                                        © 2025 RISVIEL • Versione ' . RISVIEL_GISDOC_VERSION . '<br>
                                        <span style="color: #40c8ff;">Developed by Antonio Sanna</span><br><br>
                                        <span style="font-size: 10px;">Easter egg speciale del giorno ` + dayOfEsterEgg + `! 🥚🎵</span>
                                    </div>
                                    
                                    <div style="
                                        margin-top: 20px;
                                        padding: 10px;
                                        background: rgba(64, 200, 255, 0.1);
                                        border-radius: 10px;
                                        font-size: 12px;
                                        color: #40c8ff;
                                    ">
                                        💡 Clicca l\'icona ×  o premi ESC per chiudere
                                    </div>
                                </div>
                            `;
                            
                            document.body.appendChild(modal);
                            
                            // Animazione di entrata
                            setTimeout(() => {
                                modal.style.opacity = \'1\';
                                const content = modal.querySelector(\'div > div\');
                                if (content) {
                                    content.style.transform = \'scale(1)\';
                                }
                            }, 50);
                            
                            // Chiudi con ESC
                            const escHandler = (e) => {
                                if (e.key === \'Escape\') {
                                    closeModal();
                                    document.removeEventListener(\'keydown\', escHandler);
                                }
                            };
                            document.addEventListener(\'keydown\', escHandler);
                            
                            // Chiudi cliccando fuori
                            modal.addEventListener(\'click\', (e) => {
                                if (e.target === modal) {
                                    closeModal();
                                }
                            });
                            
                            // Auto-chiudi dopo 60 secondi
                            setTimeout(() => {
                                if (document.getElementById(\'risviel-credits-modal\')) {
                                    closeModal();
                                }
                            }, 68000);
                            
                        }
                        function showNotAvailableMessage() {
                                // Feedback per quando l\'easter egg non è disponibile
                                const targetElement = document.querySelector(\'footer img\');
                                if (targetElement) {
                                    // Crea un tooltip temporaneo
                                    const tooltip = document.createElement(\'div\');
                                    tooltip.style.cssText = `
                                        position: absolute;
                                        background: rgba(0, 0, 0, 0.8);
                                        color: white;
                                        padding: 8px 12px;
                                        border-radius: 6px;
                                        font-size: 12px;
                                        z-index: 999999;
                                        pointer-events: none;
                                        opacity: 0;
                                        transition: opacity 0.3s ease;
                                        white-space: nowrap;
                                    `;
                                    tooltip.textContent = \'🥚 Easter egg disponibile solo il giorno 24!\';
                                    
                                    // Posiziona il tooltip
                                    document.body.appendChild(tooltip);
                                    const rect = targetElement.getBoundingClientRect();
                                    tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + \'px\';
                                    tooltip.style.top = (rect.top - tooltip.offsetHeight - 10) + \'px\';
                                    
                                    // Mostra e nascondi il tooltip
                                    setTimeout(() => tooltip.style.opacity = \'1\', 50);
                                    setTimeout(() => {
                                        tooltip.style.opacity = \'0\';
                                        setTimeout(() => tooltip.remove(), 300);
                                    }, 2000);
                                }
                            }
                            
                        if (targetElement) {
                            targetElement.addEventListener(\'click\', function(e) {
                                e.preventDefault();

                                clickCount++;
                                
                                // Feedback visivo per ogni click
                                this.style.transform = \'scale(0.95)\';
                                setTimeout(() => {
                                    this.style.transform = \'scale(1)\';
                                }, 100);
                                
                                if (clickCount === 1) {
                                    // Avvia timer per reset dopo 2 secondi
                                    clickTimer = setTimeout(resetClickCounter, timesToActivateEsterEgg);
                                } else if (clickCount === tapToActivateEsterEgg) {
                                    
                                
                                    // Verifica se è il giorno giusto per l\'easter egg
                                    if (!isEasterEggDay()) {
                                        showNotAvailableMessage();
                                        return;
                                    }
                                    // Easter egg attivato!
                                    resetClickCounter();
                                    showCreditsModal();
                                }
                            });
                            
                            // Supporto touch per dispositivi mobili
                            targetElement.addEventListener(\'touchstart\', function(e) {
                                e.preventDefault();
                                // Simula il click per dispositivi touch
                                this.click();
                            }, { passive: false });
                            
                            // Aggiungi stile per feedback visivo
                            targetElement.style.cssText += `
                                cursor: pointer;
                                transition: transform 0.1s ease;
                                user-select: none;
                                -webkit-user-select: none;
                                -moz-user-select: none;
                                -ms-user-select: none;
                            `;
                        }
                        // 🥚 EASTER EGG - Crediti con 8 click/tap rapidi entro 2 secondi il giorno 24
                        
                    });

            </script>
                        ';

    return $output;
}

    /**
     * Shortcode per la visualizzazione del panorama.
     *
     * @since     1.0.0
     * @param     array     $atts    Attributi dello shortcode.
     * @return    string             Output HTML.
     */
    public function panorama_shortcode($atts) {
        // Assicurati che gli asset siano caricati PRIMA di tutto
        $this->ensure_assets_loaded();

        // Parametri di default
        $atts = shortcode_atts(array(
            'id' => 0,
            'width' => '100%',
            'height' => '600px',
            'lang' => get_option('risviel_gisdoc_default_language', 'it'),
        ), $atts);

        // Verifica se l'ID del panorama è valido
        $panorama_id = intval($atts['id']);

        if ($panorama_id <= 0) {
            return '<p class="risviel-error">' . __('ID panorama non valido', 'risviel-gisdoc') . '</p>';
        }

        // Genera un ID unico per il container del panorama
        $panorama_id_html = 'risviel-panorama-' . uniqid();

        // CSS inline per il container del panorama
        $panorama_style = 'width: ' . esc_attr($atts['width']) . '; height: ' . esc_attr($atts['height']) . ';';

        // HTML del container del panorama con informazioni di debug
        $output = '<div id="' . $panorama_id_html . '" class="risviel-panorama" style="' . $panorama_style . '" data-id="' . $panorama_id . '" data-lang="' . esc_attr($atts['lang']) . '">';
        $output .= '<p>Caricamento panorama ' . $panorama_id . '...</p>';
        $output .= '</div>';

        // Aggiungi script di inizializzazione inline che si assicura che tutto sia pronto
        $output .= '<script>
        (function() {
            function initPanorama() {
                if (typeof initPanoramaViewer === "function") {
                    console.log("Inizializzazione panorama per ID:", "' . $panorama_id_html . '");
                    initPanoramaViewer("' . $panorama_id_html . '");
                } else {
                    console.log("initPanoramaViewer non ancora disponibile, riprovo tra 100ms");
                    setTimeout(initPanorama, 100);
                }
            }
            
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", initPanorama);
            } else {
                setTimeout(initPanorama, 100);
            }
        })();
        </script>';

        $output .= $this->Aton_init();

        parse_str($_SERVER['REQUEST_URI'], $res);
        $lang = $res['lang'] ?? $atts['lang'];
;
        //$output .= $this->getHeader($lang);
        $output .= $this->getFooter($lang);

        return $output;
    }

    /**
     * Gestisce la richiesta AJAX per ottenere i punti sulla mappa.
     *
     * @since    1.0.0
     */
    public function ajax_get_map_points() {
        // Verifica il nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_public_nonce')) {
            wp_send_json_error(array('message' => 'Verifica di sicurezza fallita.'));
            return;
        }

        // Ottieni i parametri dalla richiesta
        $lat = isset($_POST['lat']) ? floatval($_POST['lat']) : 0;
        $lng = isset($_POST['lng']) ? floatval($_POST['lng']) : 0;
        $radius = isset($_POST['radius']) ? floatval($_POST['radius']) : 5000; // 5km di default
        $language = isset($_POST['language']) ? sanitize_text_field($_POST['language']) : 'it';

        // Converti il raggio da metri a gradi (approssimativo)
        $radius_degrees = $radius / 111320; // 111.32 km per grado alla latitudine 0

        // Ottieni l'istanza del database
        $db = Risviel_GisDoc_PostGIS::get_instance();

        // Verifica che la connessione sia attiva
        if (!$db->init_connection() || !$db->is_connected()) {
            wp_send_json_error(array('message' => 'Errore di connessione al database.'));
            return;
        }

        // Query per ottenere i punti vicini alla posizione specificata
       /* $query = "
            SELECT 
                id, 
                title_$language AS title, 
                description_$language AS description, 
                audio_$language AS audio, 
                panorama_id,
                ST_X(geom) AS lng, 
                ST_Y(geom) AS lat,
                custom_icon
            FROM 
                map_points
            WHERE 
                ST_DWithin(
                    geom,
                    ST_SetSRID(ST_MakePoint($lng, $lat), 4326),
                    $radius_degrees
                )
            AND visible = true
            ORDER BY 
                id DESC
        ";*/

        $query = "
            SELECT 
                id, 
                title_$language AS title, 
                description_$language AS description, 
                audio_$language AS audio, 
                panorama_id,
                ST_X(geom) AS lng, 
                ST_Y(geom) AS lat,
                custom_icon
            FROM 
                map_points
            WHERE 
                visible = true
            ORDER BY 
                id DESC
        ";

        $result = $db->query($query);

        if ($result === false) {
            wp_send_json_error(array('message' => 'Errore nella query dei punti sulla mappa.'));
            return;
        }

        $points = $db->fetch_all($result);

        require_once RISVIEL_GISDOC_PLUGIN_DIR . 'includes/class-risviel-gisdoc-categories-db.php';
        $cat_db = new Risviel_GisDoc_Categories_DB();

        // Processa i risultati per assicurarsi che tutti i campi necessari siano presenti
        $processed_points = array();
        foreach ($points as $point) {
            $cats = $cat_db->get_point_categories($point['id']);
            $category_ids = !empty($cats) ? array_map('intval', array_column($cats, 'id')) : array();
            $processed_points[] = array(
                'id' => intval($point['id']),
                'title' => $point['title'] ?: 'Punto ' . $point['id'],
                'description' => $point['description'] ?: '',
                'audio' => $point['audio'] ?: '',
                'panorama_id' => !empty($point['panorama_id']) ? intval($point['panorama_id']) : null,
                'lat' => floatval($point['lat']),
                'lng' => floatval($point['lng']),
                'custom_icon' => $point['custom_icon'] ?: '',
                'category_ids'=> $category_ids,
            );
        }

        wp_send_json_success($processed_points);
    }



/**
 * Gestisce la richiesta AJAX per ottenere i dati di un panorama
 */
public function ajax_get_panorama() {
    // Verifica semplificata del nonce
    if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_panorama_nonce')) {
        wp_send_json_error(array('message' => 'Verifica di sicurezza fallita.'));
        return;
    }

    // Ottieni l'ID del panorama
    $panorama_id = isset($_POST['panorama_id']) ? intval($_POST['panorama_id']) : 0;

    if ($panorama_id <= 0) {
        wp_send_json_error(array('message' => 'ID panorama non valido.'));
        return;
    }

    // Ottieni la lingua
    $language = isset($_POST['language']) ? sanitize_text_field($_POST['language']) : 'it';

    // Ottieni l'istanza del database PostgreSQL
    $db = Risviel_GisDoc_PostGIS::get_instance();

    // Verifica che la connessione sia attiva
    if (!$db->init_connection() || !$db->is_connected()) {
        wp_send_json_error(array('message' => 'Errore di connessione al database PostgreSQL.'));
        return;
    }

    // Query per ottenere i dati del panorama
    $query = "SELECT * FROM panoramas WHERE id = $1";
    $result = $db->query($query, array($panorama_id));

    if (!$result) {
        wp_send_json_error(array('message' => 'Errore nella query del panorama.'));
        return;
    }

    $panorama = $db->fetch_row($result);

    if (!$panorama) {
        wp_send_json_error(array('message' => 'Panorama non trovato.'));
        return;
    }

    // Costruisci l'oggetto di risposta
    $response_data = array(
        'id' => intval($panorama['id']),
        'title' => $language === 'it' ? $panorama['title_it'] : ($language === 'en' ? $panorama['title_en'] : $panorama['title_sa']),
        'description' => $language === 'it' ? $panorama['description_it'] : ($language === 'en' ? $panorama['description_en'] : $panorama['description_sa']),
        'image_url' => $panorama['image_url'],
        'interactive_areas' => array(),
        'indicators' => array(),
        'north_offset' => floatval($panorama['north_offset']),
    );

    // Log per debug
    error_log('Caricamento aree per panorama ID: ' . $panorama_id);

    // Prima, verifica quali colonne esistono effettivamente nella tabella
    $check_columns_query = "SELECT column_name FROM information_schema.columns WHERE table_name = 'interactive_areas'";
    $columns_result = $db->query($check_columns_query);
    $existing_columns = array();

    if ($columns_result) {
        $columns = $db->fetch_all($columns_result);
        foreach ($columns as $column) {
            $existing_columns[] = $column['column_name'];
        }
        error_log('Colonne esistenti nella tabella interactive_areas: ' . implode(', ', $existing_columns));
    }

    // Costruisci la query in base alle colonne disponibili
    $base_fields = array(
        'id',
        'title_it', 'title_en', 'title_sa',
        'content_it', 'content_en', 'content_sa',
        'audio_url_it', 'audio_url_en', 'audio_url_sa'
    );

    $optional_fields = array(
        'coordinates',
        'action_type',
        'action_url',
        'action_panorama_id',
        'target_panorama_id',
        'scale'
    );

    $selected_fields = $base_fields;
    foreach ($optional_fields as $field) {
        if (in_array($field, $existing_columns)) {
            $selected_fields[] = $field;
        }
    }

    $areas_query = "SELECT " . implode(', ', $selected_fields) . " FROM interactive_areas WHERE panorama_id = $1";

    error_log('Query aree costruita: ' . $areas_query);

    $areas_result = $db->query($areas_query, array($panorama_id));

    if ($areas_result) {
        $areas = $db->fetch_all($areas_result);
        error_log('Aree trovate nel database: ' . count($areas));

        foreach ($areas as $area) {
            error_log('Processando area ID: ' . $area['id']);
/*
            // Ottieni le coordinate come array
            $coordinates = null;
            if (isset($area['coordinates']) && !empty($area['coordinates'])) {
                error_log('Coordinate grezze dal database per area ' . $area['id'] . ': ' . var_export($area['coordinates'], true));

                // Se le coordinate sono già un array, usale direttamente
                if (is_array($area['coordinates'])) {
                    $coordinates = $area['coordinates'];
                    error_log('Coordinate già in formato array');
                } else {
                    // Se sono una stringa, prova diversi metodi di parsing
                    $coord_string = $area['coordinates'];

                    // Prova prima il parsing diretto
                    $coordinates = json_decode($coord_string, true);

                    if (json_last_error() !== JSON_ERROR_NONE) {
                        error_log('Primo tentativo di parsing JSON fallito: ' . json_last_error_msg());

                        // Prova a pulire la stringa
                        $coord_string = stripslashes($coord_string);
                        $coordinates = json_decode($coord_string, true);

                        if (json_last_error() !== JSON_ERROR_NONE) {
                            error_log('Secondo tentativo di parsing JSON fallito: ' . json_last_error_msg());

                            // Prova a fare un unescape manuale
                            $coord_string = str_replace('\\"', '"', $coord_string);
                            $coordinates = json_decode($coord_string, true);

                            if (json_last_error() !== JSON_ERROR_NONE) {
                                error_log('Terzo tentativo di parsing JSON fallito: ' . json_last_error_msg());
                                error_log('Stringa dopo cleaning: ' . $coord_string);

                                // Se PostgreSQL sta restituendo un tipo specifico, proviamo a convertirlo
                                if (is_resource($area['coordinates'])) {
                                    $coord_string = stream_get_contents($area['coordinates']);
                                    error_log('Contenuto da resource: ' . $coord_string);
                                    $coordinates = json_decode($coord_string, true);
                                }

                                if (json_last_error() !== JSON_ERROR_NONE) {
                                    error_log('Parsing finale fallito: ' . json_last_error_msg());
                                    $coordinates = null;
                                }
                            }
                        }
                    }
                }

                if ($coordinates && is_array($coordinates)) {
                    error_log('Coordinate parsate con successo: ' . count($coordinates) . ' punti');

                    // Converti coordinate 3D in coordinate normalizzate (x, y tra 0 e 1)
                    $normalized_coordinates = array();
                    foreach ($coordinates as $coord) {
                        if (isset($coord['x']) && isset($coord['y']) && isset($coord['z'])) {
                            // Converti coordinate 3D sferiche in coordinate UV normalizzate
                            $normalized = $this->convertSphereToUV($coord['x'], $coord['y'], $coord['z']);
                            $normalized_coordinates[] = $normalized;
                        }
                    }

                    if (count($normalized_coordinates) > 0) {
                        $coordinates = $normalized_coordinates;
                        error_log('Coordinate convertite in UV: ' . json_encode($coordinates));
                    }
                }
            }
*/

                        // --- SOSTITUISCI TUTTO IL PRIMO BLOCCO CON QUESTO ---

// Prendi le coordinate dall'area
$coordinates = $area['coordinates'] ?? null;


// Assegna a $this->coordinates con la logica richiesta
if (is_array($coordinates)) {
    // Se è un array, convertilo in JSON
    $coordinates = json_encode($coordinates);
} elseif (is_string($coordinates)) {
    // Se è una stringa, verifica se è JSON valido
    $decoded = json_decode($coordinates, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        // È già JSON valido: mantieni la stringa
        $coordinates = $coordinates;
    } else {
        // Non è JSON valido: conserva la stringa così com'è
        $coordinates = $coordinates;
    }
} else {
    // Per altri tipi (null incluso), cast a stringa
    $coordinates = (string) $coordinates;
}
            // Determina il contenuto in base alla lingua
            $title = '';
            $content = '';
            $audio_url = '';

            switch ($language) {
                case 'en':
                    $title = $area['title_en'] ?: $area['title_it'];
                    $content = $area['content_en'] ?: $area['content_it'];
                    $audio_url = $area['audio_url_en'] ?: $area['audio_url_it'];
                    break;
                case 'sa':
                    $title = $area['title_sa'] ?: $area['title_it'];
                    $content = $area['content_sa'] ?: $area['content_it'];
                    $audio_url = $area['audio_url_sa'] ?: $area['audio_url_it'];
                    break;
                default:
                    $title = $area['title_it'];
                    $content = $area['content_it'];
                    $audio_url = $area['audio_url_it'];
                    break;
            }

            $area_data = array(
                'id' => intval($area['id']),
                'title' => $title ?: 'Area ' . $area['id'],
                'content' => $content ?: '',
                'audio_url' => $audio_url ?: '',
                'coordinates' => $coordinates,
                'action_type' => isset($area['action_type']) ? $area['action_type'] : null,
                'action_url' => isset($area['action_url']) ? $area['action_url'] : null,
                'action_panorama_id' => isset($area['action_panorama_id']) ? $area['action_panorama_id'] : null,
                'target_panorama_id' => isset($area['target_panorama_id']) ? $area['target_panorama_id'] : null,
                'scale' => isset($area['scale']) ? $area['scale'] : 1
            );

            // Aggiungi l'area alla risposta
            $response_data['interactive_areas'][] = $area_data;
            error_log('Area ' . $area['id'] . ' aggiunta alla risposta');
        }
    } else {
        error_log('Errore nella query delle aree interattive');
    }

    // *** CARICA GLI INDICATORI ***
    error_log('Caricamento indicatori per panorama ID: ' . $panorama_id);

    // Query per ottenere gli indicatori
    $indicators_query = "SELECT id, position_x, position_y, position_z, title_it, title_en, title_sa, 
                               action_type, action_target, icon_type,
                               action_target_it, action_target_en, action_target_sa 
                        FROM panorama_indicators 
                        WHERE panorama_id = $1 
                        ORDER BY id";

    $indicators_result = $db->query($indicators_query, array($panorama_id));

    if ($indicators_result) {
        $indicators = $db->fetch_all($indicators_result);
        error_log('Indicatori trovati nel database: ' . count($indicators));

        foreach ($indicators as $indicator) {
            error_log('Processando indicatore ID: ' . $indicator['id']);

            // Determina il titolo in base alla lingua
            $title = '';
            $content = '';
            $action_target = $indicator['action_target'];
            switch ($language) {
                case 'en':
                    $title = $indicator['title_en'] ?: $indicator['title_it'];
                    $content  = $indicator['action_target_en'] ?: $indicator['action_target_it'];
                    if($indicator['action_type'] !== 'panorama') {
                        $action_target = $indicator['action_target_en'] ?: $indicator['action_target_it'];
                    }
                    break;
                case 'sa':
                    $title = $indicator['title_sa'] ?: $indicator['title_it'];
                    $content  = $indicator['action_target_sa'] ?: $indicator['action_target_it'];
                    if($indicator['action_type'] !== 'panorama') {
                        $action_target  = $indicator['action_target_sa'] ?: $indicator['action_target_it'];
                    }
                    break;
                default:
                    $title = $indicator['title_it'];
                    $content  = $indicator['action_target_it'];
                    if($indicator['action_type'] !== 'panorama') {
                        $action_target  = $indicator['action_target_it'];
                    }
                    break;
            }

            $indicator_data = array(
                'id' => intval($indicator['id']),
                'position_x' => floatval($indicator['position_x']),
                'position_y' => floatval($indicator['position_y']),
                'position_z' => floatval($indicator['position_z']),
                'title' => $title ?: 'Indicatore ' . $indicator['id'],
                'title_it' => $indicator['title_it'],
                'title_en' => $indicator['title_en'],
                'title_sa' => $indicator['title_sa'],
                'action_type' => $indicator['action_type'],
                'action_target' => $action_target,
                'icon_type' => $indicator['icon_type'] ?: 'default',
                'content'  => $content,
                'content_it' => $indicator['action_target_it'],
                'content_en' => $indicator['action_target_en'],
                'content_sa' => $indicator['action_target_sa'],
                'action_target_it' => $indicator['action_target_it'],
                'action_target_en' => $indicator['action_target_en'],
                'action_target_sa' => $indicator['action_target_sa']
            );

            // Aggiungi l'indicatore alla risposta
            $response_data['indicators'][] = $indicator_data;
            error_log('Indicatore ' . $indicator['id'] . ' aggiunto alla risposta');
        }
    } else {
        error_log('Errore nella query degli indicatori');
    }

    error_log('Totale aree nella risposta: ' . count($response_data['interactive_areas']));
    error_log('Totale indicatori nella risposta: ' . count($response_data['indicators']));


    wp_send_json_success($response_data);
}

/**
 * Converte coordinate 3D sferiche in coordinate UV normalizzate (0-1)
 * @param float $x Coordinata X 3D
 * @param float $y Coordinata Y 3D
 * @param float $z Coordinata Z 3D
 * @return array Coordinate UV normalizzate
 */
private function convertSphereToUV($x, $y, $z) {
    // Calcola il raggio
    $radius = sqrt($x * $x + $y * $y + $z * $z);

    if ($radius == 0) {
        return array('x' => 0.5, 'y' => 0.5);
    }

    // Normalizza le coordinate
    $nx = $x / $radius;
    $ny = $y / $radius;
    $nz = $z / $radius;

    // Converte in coordinate sferiche
    $phi = acos(-$ny); // Angolo verticale (0 a PI)
    $theta = atan2($nz, $nx) + M_PI; // Angolo orizzontale (0 a 2*PI)

    // Converte in coordinate UV normalizzate
    $u = $theta / (2 * M_PI); // 0 a 1
    $v = $phi / M_PI; // 0 a 1

    return array(
        'x' => $u,
        'y' => $v
    );
}


}