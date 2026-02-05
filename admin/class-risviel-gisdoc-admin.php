<?php
/**
 * Classe per la gestione dell'amministrazione.
 *
 * @since      1.0.0
 */

class Risviel_GisDoc_Admin {

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
     * Inizializza la classe e imposta le sue proprietà.
     *
     * @since    1.0.0
     * @param    string    $plugin_name    Il nome del plugin.
     * @param    string    $version        La versione del plugin.
     */
    public function __construct($plugin_name, $version) {

        $this->plugin_name = $plugin_name;
        $this->version = $version;

        // Aggiungi hook per personalizzare l'admin per utenti GisDoc
        add_action('admin_init', array($this, 'restrict_admin_access'));
        add_action('admin_menu', array($this, 'customize_admin_menu_for_gisdoc_users'), 999);
        add_action('wp_dashboard_setup', array($this, 'customize_dashboard_for_gisdoc_users'), 999);
        add_filter('admin_body_class', array($this, 'add_gisdoc_user_body_class'));

        // Aggiungi l'handler per l'ajax di test della connessione
        add_action('wp_ajax_risviel_gisdoc_test_connection', array($this, 'ajax_test_connection'));

        // Aggiungi l'handler per l'ajax di creazione delle tabelle
        add_action('wp_ajax_risviel_gisdoc_create_tables', array($this, 'ajax_create_tables'));

        // Aggiungi gli handler per la gestione dei punti sulla mappa
        add_action('wp_ajax_risviel_gisdoc_save_map_point', array($this, 'ajax_save_map_point'));
        add_action('wp_ajax_risviel_gisdoc_get_all_map_points', array($this, 'ajax_get_all_map_points'));
        add_action('wp_ajax_risviel_gisdoc_get_map_point', array($this, 'ajax_get_map_point'));
        add_action('wp_ajax_risviel_gisdoc_delete_map_point', array($this, 'ajax_delete_map_point'));

        // Aggiungi gli handler per gli AJAX dei panorami
        add_action('wp_ajax_risviel_gisdoc_save_panorama', array($this, 'ajax_save_panorama'));
        add_action('wp_ajax_risviel_gisdoc_get_all_panoramas', array($this, 'ajax_get_all_panoramas'));
        add_action('wp_ajax_risviel_gisdoc_admin_get_panorama', array($this, 'ajax_get_panorama'));
        add_action('wp_ajax_risviel_gisdoc_delete_panorama', array($this, 'ajax_delete_panorama'));

        // Hook AJAX per il north offset
        add_action('wp_ajax_risviel_gisdoc_set_panorama_north_offset', array($this, 'ajax_set_panorama_north_offset'));

    }


    /** Controllo accesso */

    /**
     * Personalizza la dashboard per utenti GisDoc
     */
    public function customize_dashboard_for_gisdoc_users() {
        if ($this->is_gisdoc_only_user()) {
            // Rimuovi tutti i widget della dashboard
            remove_meta_box('dashboard_quick_press', 'dashboard', 'side');
            remove_meta_box('dashboard_recent_drafts', 'dashboard', 'side');
            remove_meta_box('dashboard_primary', 'dashboard', 'side');
            remove_meta_box('dashboard_secondary', 'dashboard', 'side');
            remove_meta_box('dashboard_incoming_links', 'dashboard', 'normal');
            remove_meta_box('dashboard_plugins', 'dashboard', 'normal');
            remove_meta_box('dashboard_right_now', 'dashboard', 'normal');
            remove_meta_box('dashboard_recent_comments', 'dashboard', 'normal');
            remove_meta_box('dashboard_activity', 'dashboard', 'normal');

            // Aggiungi widget personalizzato per GisDoc
            wp_add_dashboard_widget(
                'risviel_gisdoc_dashboard_widget',
                __('Benvenuto in GisDoc', 'risviel-gisdoc'),
                array($this, 'gisdoc_dashboard_widget_content')
            );

            wp_add_dashboard_widget(
                'risviel_gisdoc_quick_actions',
                __('Azioni Rapide', 'risviel-gisdoc'),
                array($this, 'gisdoc_quick_actions_widget')
            );

        }
    }

    /**
     * Contenuto del widget dashboard personalizzato
     */
    public function gisdoc_dashboard_widget_content() {
        echo '<div class="risviel-gisdoc-welcome">';
        echo '<h1>' . 'Benvenuto in GisDoc ' . RISVIEL_GISDOC_VERSION . '<sup> Lite version </sup></h1>';
        echo '<a href="https://risviel.com" target="_blank">';
        echo '    <img src="' . RISVIEL_GISDOC_PLUGIN_URL . 'assets/images/GISDOC_scritta_400.png">';
        echo '</a>';
        echo '<p>GisDoc è un plugin per WordPress che ti permette di creare una mappa interattiva con punti di interesse e panorami 360°</p>';
            if(ini_get('violet.license_key')) {
                include_once(RISVIEL_GISDOC_PLUGIN_DIR . 'admin/partials/risviel-gisdoc-admin-license.php');
            }
        echo '</div>';
    }

    /**
     * Widget azioni rapide per dashboard
     */
    public function gisdoc_quick_actions_widget() {
        echo '<div class="risviel-gisdoc-quick-actions">';
        echo '<div class="risviel-gisdoc-dashboard-links">';
        echo '<a href="' . admin_url('admin.php?page=' . $this->plugin_name . '-map-points') . '" class="button button-primary">' . __('Gestisci Punti Mappa', 'risviel-gisdoc') . '</a>';
        echo '<a href="' . admin_url('admin.php?page=' . $this->plugin_name . '-panoramas') . '" class="button button-secondary">' . __('Gestisci Panorami', 'risviel-gisdoc') . '</a>';
        echo '</div>';
        echo '</div>';
    }

    /**
     * Aggiunge classe CSS per utenti GisDoc
     */
    public function add_gisdoc_user_body_class($classes) {
        $current_user = wp_get_current_user();

        if (in_array('risviel_gisdoc_user', $current_user->roles)) {
            $classes .= ' risviel-gisdoc-user';
        }

        return $classes;
    }

    /**
     * Verifica se l'utente corrente è SOLO un utente GisDoc
     * (e non ha altri privilegi)
     */
    private function is_gisdoc_only_user() {
        $current_user = wp_get_current_user();

        // Se ha il ruolo risviel_gisdoc_user
        if (!in_array('risviel_gisdoc_user', $current_user->roles)) {
            return false;
        }

        // E non ha capacità amministrative
        if (current_user_can('manage_options') ||
            current_user_can('edit_themes') ||
            curidrent_user_can('install_plugins') ||
            current_user_can('edit_users')) {
            return false;
        }

        // E ha solo ruoli limitati
        $restricted_roles = array('risviel_gisdoc_user', 'subscriber');
        $user_roles = $current_user->roles;

        foreach ($user_roles as $role) {
            if (!in_array($role, $restricted_roles)) {
                return false; // Ha altri ruoli potenti
            }
        }

        return true;
    }
    public static function create_gisdoc_role() {
        // Crea il ruolo GisDoc limitato
        add_role(
            'risviel_gisdoc_user',
            __('Utente GisDoc', 'risviel-gisdoc'),
            array(
                'read' => true,
                'risviel_gisdoc_view' => true,
                'risviel_gisdoc_edit' => true,
                'risviel_gisdoc_manage' => true,
            )
        );

        // Aggiungi capacità GisDoc a ruoli esistenti che dovrebbero averle
        $roles_with_gisdoc_access = array('administrator', 'editor');

        foreach ($roles_with_gisdoc_access as $role_name) {
            $role = get_role($role_name);
            if ($role) {
                $role->add_cap('risviel_gisdoc_view');
                $role->add_cap('risviel_gisdoc_edit');
                $role->add_cap('risviel_gisdoc_manage');
            }
        }
    }

    /**
     * Restringe l'accesso solo per utenti esclusivamente GisDoc
     */
    public function restrict_admin_access() {
        if ($this->is_gisdoc_only_user()) {
            // Applica restrizioni solo agli utenti che hanno SOLO il ruolo GisDoc
            $this->apply_gisdoc_restrictions();
        }
    }

    /**
     * Personalizza il menu solo per utenti esclusivamente GisDoc
     */
    public function customize_admin_menu_for_gisdoc_users() {
        if ($this->is_gisdoc_only_user()) {
            // Rimuovi menu solo per utenti GisDoc puri
            $this->remove_standard_wordpress_menus();

            // Poi personalizza il menu del plugin per renderlo più prominente
            $this->enhance_gisdoc_menu_for_restricted_users();
        }
    }

     /**
     * Migliora il menu GisDoc per utenti limitati
     */
    private function enhance_gisdoc_menu_for_restricted_users() {
        global $menu, $submenu;

        // Rendi più prominente il menu GisDoc
        foreach ($menu as $key => $item) {
            if (isset($item[2]) && $item[2] === $this->plugin_name) {
                // Cambia l'icona e il testo per renderlo più evidente
                $menu[$key][0] = '<strong>' . __('GisDoc', 'risviel-gisdoc') . '</strong>';
                $menu[$key][6] = 'dashicons-admin-site-alt'; // Icona più prominente
                break;
            }
        }

        // Aggiungi un separatore prima del menu GisDoc se necessario
        $menu[29] = array('', 'read', 'separator-gisdoc', '', 'wp-menu-separator');

    }

    /**
     * Applica le restrizioni GisDoc
     */
    private function apply_gisdoc_restrictions() {
        show_admin_bar(false);

        $allowed_pages = array(
            'admin.php?page=' . $this->plugin_name,
            'admin.php?page=' . $this->plugin_name . '-map-points',
            'admin.php?page=' . $this->plugin_name . '-panoramas',
            'admin.php?page=' . $this->plugin_name . '-settings',
            'profile.php', // Permetti la modifica del proprio profilo
            'admin.php?page=logout' // Permetti logout
        );

        $current_page = $_SERVER['REQUEST_URI'];
        $is_allowed = false;

        foreach ($allowed_pages as $allowed_page) {
            if (strpos($current_page, $allowed_page) !== false) {
                $is_allowed = true;
                break;
            }
        }

        if (!$is_allowed && strpos($current_page, 'admin.php') !== false) {
            wp_redirect(admin_url('admin.php?page=' . $this->plugin_name));
            exit;
        }
    }

    /**
     * Rimuove i menu WordPress standard
     */
    private function remove_standard_wordpress_menus() {
        //remove_menu_page('index.php');                  // Dashboard
        remove_menu_page('edit.php');                   // Posts
        remove_menu_page('upload.php');                 // Media
        remove_menu_page('edit.php?post_type=page');    // Pages
        remove_menu_page('edit-comments.php');          // Comments
        remove_menu_page('themes.php');                 // Appearance
        remove_menu_page('plugins.php');                // Plugins
        remove_menu_page('users.php');                  // Users
        remove_menu_page('tools.php');                  // Tools
        remove_menu_page('options-general.php');        // Settings

    }

    /** Fine controllo accesso */



    /**
     * Handler AJAX per impostare l'offset nord di un panorama.
     *
     * @since    1.0.0
     */
    public function ajax_set_panorama_north_offset() {
        // Verifica nonce
        if (!wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_admin_nonce')) {
            wp_die('Security check failed');
        }

        // Verifica permessi
        if (!current_user_can('edit_posts')) {
            wp_send_json_error(array('message' => 'Permessi insufficienti.'));
            return;
        }

        $panorama_id = isset($_POST['panorama_id']) ? intval($_POST['panorama_id']) : 0;
        $north_offset = isset($_POST['north_offset']) ? floatval($_POST['north_offset']) : 0.0;

        if ($panorama_id <= 0) {
            wp_send_json_error(array('message' => 'ID panorama non valido.'));
            return;
        }

        try {
            // Inizializza la connessione al database
            $db = Risviel_GisDoc_PostGIS::get_instance();
            if (!$db->init_connection()) {
                wp_send_json_error(array('message' => 'Errore connessione database.'));
                return;
            }

            // Aggiorna il north_offset nella tabella panoramas
            $query = "UPDATE panoramas SET north_offset = $1 WHERE id = $2";
            $result = $db->query($query, array($north_offset, $panorama_id));

            if ($result) {
                wp_send_json_success(array(
                    'message' => 'Orientamento nord impostato con successo.',
                    'north_offset' => $north_offset
                ));
            } else {
                wp_send_json_error(array('message' => 'Errore nell\'aggiornamento del database.'));
            }

        } catch (Exception $e) {
            error_log('Errore set north offset: ' . $e->getMessage());
            wp_send_json_error(array('message' => 'Errore del server: ' . $e->getMessage()));
        }
    }

    /**
     * Registra gli stili per l'area di amministrazione.
     *
     * @since    1.0.0
     */
    public function enqueue_styles() {
        wp_enqueue_style('leaflet', RISVIEL_GISDOC_PLUGIN_URL . 'assets/leaflet/leaflet.css', array(), '1.7.1');

        $admin_css = RISVIEL_GISDOC_PLUGIN_URL . 'admin/css/risviel-gisdoc-admin.min.css';
        $admin_css = apply_filters('risviel_gisdoc_admin_css', $admin_css);
        wp_enqueue_style($this->plugin_name, $admin_css, array(), $this->version, 'all');

    }

    /**
     * Registra gli script per l'area di amministrazione.
     *
     * @since    1.0.0
     */
    public function enqueue_scripts() {
        // Ottieni la pagina corrente
        $screen = get_current_screen();

        // Carica gli script per tutte le pagine del plugin
        if (strpos($screen->id, 'risviel-gisdoc') !== false) {

            // Carica gli script media di WordPress solo nelle pagine del nostro plugin
            if (isset($_GET['page']) && strpos($_GET['page'], $this->plugin_name) === 0) {
                wp_enqueue_media();
            }

            wp_deregister_script('jquery');
            wp_enqueue_script('jquery', 'https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js', array(), null, true);

            // Registra Leaflet e Three.js come dipendenze
            wp_enqueue_script('leaflet', RISVIEL_GISDOC_PLUGIN_URL . 'assets/leaflet/leaflet.js', array('jquery'), '1.7.1', false);
            wp_enqueue_script('threejs', RISVIEL_GISDOC_PLUGIN_URL . 'assets/threejs/three.min.js', array('jquery'), 'r128', false);

            // Script comuni per tutte le pagine del plugin
            $admin_js = RISVIEL_GISDOC_PLUGIN_URL . 'admin/js/risviel-gisdoc-admin.min.js';
            $admin_js = apply_filters('risviel_gisdoc_admin_js', $admin_js);
            wp_register_script($this->plugin_name, $admin_js, array('jquery', 'leaflet', 'threejs'), $this->version, false);

            wp_localize_script($this->plugin_name, 'risviel_gisdoc_admin', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('risviel_gisdoc_admin_nonce'),
                'map_center_lat' => get_option('risviel_gisdoc_map_center_lat', '0'),
                'map_center_lng' => get_option('risviel_gisdoc_map_center_lng', '0'),
                'map_zoom' => get_option('risviel_gisdoc_map_zoom', '13'),
                'plugin_url' => RISVIEL_GISDOC_PLUGIN_URL
            ));
            wp_enqueue_script($this->plugin_name);


             // Script specifici per la pagina dei punti mappa - imposta dipendenza dallo script principale
            if (isset($_GET['page']) && $_GET['page'] === $this->plugin_name . '-map-points') {
                wp_enqueue_script($this->plugin_name . '-map', RISVIEL_GISDOC_PLUGIN_URL . 'admin/js/risviel-gisdoc-admin-map.min.js', array('jquery', 'leaflet', $this->plugin_name), $this->version, false);
            }

            // Script specifici per la pagina dei panorami - imposta dipendenza dallo script principale
            if (isset($_GET['page']) && $_GET['page'] === $this->plugin_name . '-panoramas') {

                // Carica gli script specifici del backend
                $panorama_js = RISVIEL_GISDOC_PLUGIN_URL . 'admin/js/risviel-gisdoc-admin-panorama.min.js';
                $panorama_js = apply_filters('risviel_gisdoc_admin_panorama_js', $panorama_js);
                wp_register_script($this->plugin_name . '-panorama', $panorama_js, array('jquery', 'threejs', $this->plugin_name), $this->version, false);

                wp_enqueue_script($this->plugin_name . '-compass', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-compass.min.js', array('jquery', 'threejs', $this->plugin_name . '-panorama'), $this->version, false);
 /*               wp_enqueue_script($this->plugin_name . '-panorama', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-panorama.js', ['jquery', 'threejs'], $this->version, false);
                wp_enqueue_script($this->plugin_name . '-controls', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-controls.js', ['jquery', $this->plugin_name . '-panorama'], $this->version, false);
                wp_enqueue_script($this->plugin_name . '-compass', RISVIEL_GISDOC_PLUGIN_URL . 'public/js/risviel-gisdoc-compass.js', ['jquery', $this->plugin_name . '-panorama'], $this->version, false);
*//*
                wp_enqueue_script($this->plugin_name . '-editor', RISVIEL_GISDOC_PLUGIN_URL . 'admin/js/risviel-gisdoc-admin-editor.js', ['jquery', $this->plugin_name . '-panorama', $this->plugin_name . '-controls'], $this->version, false);
*/
/*
                wp_enqueue_script($this->plugin_name . '-panorami', RISVIEL_GISDOC_PLUGIN_URL . 'admin/js/risviel-gisdoc-admin-panorami.js', ['jquery', 'threejs', $this->plugin_name . '-panorama', $this->plugin_name . '-controls'], $this->version, false);
                wp_enqueue_script($this->plugin_name . '-aree-interattive', RISVIEL_GISDOC_PLUGIN_URL . 'admin/js/risviel-gisdoc-admin-aree-interattive.js', ['jquery', 'threejs', $this->plugin_name . '-panorama', $this->plugin_name . '-controls'], $this->version, false);
                wp_enqueue_script($this->plugin_name . '-indicatori', RISVIEL_GISDOC_PLUGIN_URL . 'admin/js/risviel-gisdoc-admin-indicatori.js', ['jquery', 'threejs', $this->plugin_name . '-panorama', $this->plugin_name . '-controls'], $this->version, false);
*/            }


        /*
                wp_enqueue_script('threejs', RISVIEL_GISDOC_PLUGIN_URL . 'assets/threejs/three.min.js', array(), 'r128', false);
                /*wp_enqueue_script('aton', RISVIEL_GISDOC_PLUGIN_URL . 'assets/threejs/ATON.min.js', array('jquery', 'threejs'), '1.0.0', false);*/

            if (strpos($screen->id, 'risviel-gisdoc-panoramas') !== false) {
                wp_enqueue_script('aton-node-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.node.js', array('jquery', 'threejs'), '1.0.0', false);
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
                wp_enqueue_script('aton-js', RISVIEL_GISDOC_PLUGIN_URL . 'assets/aton/ATON.js', array('jquery', 'aton-sui-js'), '1.0.0', false);
            }

        }
    }


    /**
     * Aggiunge il menu di amministrazione del plugin.
     *
     * @since    1.0.0
     */
    public function add_plugin_admin_menu() {

        add_menu_page(
            __('GisDoc', 'risviel-gisdoc'),
            __('GisDoc', 'risviel-gisdoc'),
            'manage_options',
            $this->plugin_name,
            array($this, 'display_plugin_admin_page'),
            'dashicons-location-alt',
            26
        );

        add_submenu_page(
            $this->plugin_name,
            __('Impostazioni', 'risviel-gisdoc'),
            __('Impostazioni', 'risviel-gisdoc'),
            'manage_options',
            $this->plugin_name . '-settings',
            array($this, 'display_plugin_admin_settings')
        );

        add_submenu_page(
            $this->plugin_name,
            __('Punti Mappa', 'risviel-gisdoc'),
            __('Punti Mappa', 'risviel-gisdoc'),
            'risviel_gisdoc_edit',
            $this->plugin_name . '-map-points',
            array($this, 'display_plugin_map_points')
        );

        add_submenu_page(
            $this->plugin_name,
            __('Categorie Punti Mappa', 'risviel-gisdoc'),
            __('Categorie', 'risviel-gisdoc'),
            'manage_options',
            $this->plugin_name . '-categories',
            array($this, 'display_categories_page')
        );

        add_submenu_page(
            $this->plugin_name,
            __('Panorami', 'risviel-gisdoc'),
            __('Panorami', 'risviel-gisdoc'),
            'risviel_gisdoc_edit',
            $this->plugin_name . '-panoramas',
            array($this, 'display_plugin_panoramas')
        );

    }

    /**
     * Mostra la pagina categorie
     */
    public function display_categories_page() {
        require_once RISVIEL_GISDOC_PLUGIN_DIR . 'admin/partials/risviel-gisdoc-admin-categories.php';
    }

    /**
     * Registra le impostazioni del plugin.
     *
     * @since    1.0.0
     */
    public function register_settings() {
        register_setting($this->plugin_name, 'risviel_gisdoc_default_language');
        register_setting($this->plugin_name, 'risviel_gisdoc_map_center_lat');
        register_setting($this->plugin_name, 'risviel_gisdoc_map_center_lng');
        register_setting($this->plugin_name, 'risviel_gisdoc_map_zoom');
        register_setting($this->plugin_name, 'risviel_gisdoc_pg_host');
        register_setting($this->plugin_name, 'risviel_gisdoc_pg_port');
        register_setting($this->plugin_name, 'risviel_gisdoc_pg_dbname');
        register_setting($this->plugin_name, 'risviel_gisdoc_pg_user');
        register_setting($this->plugin_name, 'risviel_gisdoc_pg_password');
    }


    /**
     * Visualizza la pagina principale di amministrazione.
     *
     * @since    1.0.0
     */
    public function display_plugin_admin_page() {
        $partial_path = apply_filters('risviel_gisdoc_admin_display_partial',
            RISVIEL_GISDOC_PLUGIN_DIR . 'admin/partials/risviel-gisdoc-admin-display.php'
        );
        include_once($partial_path);
    }

    /**
     * Visualizza la pagina delle impostazioni.
     *
     * @since    1.0.0
     */
    public function display_plugin_admin_settings() {
        $partial_path = apply_filters('risviel_gisdoc_admin_settings_partial',
            RISVIEL_GISDOC_PLUGIN_DIR . 'admin/partials/risviel-gisdoc-admin-settings.php'
        );
        include_once($partial_path);
    }

    /**
     * Visualizza la pagina di gestione dei punti sulla mappa.
     *
     * @since    1.0.0
     */
    public function display_plugin_map_points() {
        $partial_path = apply_filters('risviel_gisdoc_admin_map_points_partial',
            RISVIEL_GISDOC_PLUGIN_DIR . 'admin/partials/risviel-gisdoc-admin-map-points.php'
        );
        include_once($partial_path);
    }

    /**
     * Visualizza la pagina di gestione dei panorami.
     *
     * @since    1.0.0
     */
    public function display_plugin_panoramas() {
        $partial_path = apply_filters('risviel_gisdoc_admin_panoramas_partial',
            RISVIEL_GISDOC_PLUGIN_DIR . 'admin/partials/risviel-gisdoc-admin-panoramas.php'
        );
        include_once($partial_path);
    }

    /**
     * Gestisce la richiesta AJAX per testare la connessione al database.
     *
     * @since    1.0.0
     */
    public function ajax_test_connection() {
        // Verifica il nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_admin_nonce')) {
            wp_send_json_error(array('message' => 'Verifica di sicurezza fallita.'));
        }

        // Salva i parametri di connessione inviati
        if (isset($_POST['host'])) {
            update_option('risviel_gisdoc_pg_host', sanitize_text_field($_POST['host']));
        }
        if (isset($_POST['port'])) {
            update_option('risviel_gisdoc_pg_port', sanitize_text_field($_POST['port']));
        }
        if (isset($_POST['dbname'])) {
            update_option('risviel_gisdoc_pg_dbname', sanitize_text_field($_POST['dbname']));
        }
        if (isset($_POST['user'])) {
            update_option('risviel_gisdoc_pg_user', sanitize_text_field($_POST['user']));
        }
        if (isset($_POST['password'])) {
            update_option('risviel_gisdoc_pg_password', sanitize_text_field($_POST['password']));
        }

        // Ottieni l'istanza del database e testa la connessione
        $db = Risviel_GisDoc_PostGIS::get_instance();
        $test_result = $db->test_connection();

        if ($test_result['success']) {
            wp_send_json_success(array('message' => $test_result['message']));
        } else {
            wp_send_json_error(array('message' => $test_result['message']));
        }
    }

    /**
     * Gestisce la richiesta AJAX per creare le tabelle del database.
     *
     * @since    1.0.0
     */
    public function ajax_create_tables() {
        // Verifica il nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_admin_nonce')) {
            wp_send_json_error(array('message' => 'Verifica di sicurezza fallita.'));
        }

        // Verifica se le tabelle sono già state create
        $tables_created = get_option('risviel_gisdoc_tables_created', 'no');

        if ($tables_created === 'yes') {
            wp_send_json_success(array('message' => 'Le tabelle sono già state create.'));
            return;
        }

        // Ottieni l'istanza del database
        $db = Risviel_GisDoc_PostGIS::get_instance();

        // Verifica che la connessione sia attiva
        if (!$db->init_connection() || !$db->is_connected()) {
            error_log('Risviel GisDoc: Connessione al database fallita durante la creazione delle tabelle');
            wp_send_json_error(array('message' => 'Impossibile connettersi al database. Verifica i parametri di connessione.'));
            return;
        }


        // Verifica che PostGIS sia installato
        $check_postgis = "SELECT postgis_version();";
        $postgis_result = $db->query($check_postgis);
        if (!$postgis_result) {
            error_log('Risviel GisDoc: PostGIS non sembra essere installato nel database');
            wp_send_json_error(array('message' => 'PostGIS non sembra essere installato nel database. È richiesto per il funzionamento del plugin.'));
            return;
        }

        // Tabella dei punti sulla mappa
        $query = "
            CREATE TABLE IF NOT EXISTS map_points (
                id SERIAL PRIMARY KEY,
                title_it VARCHAR(255) NOT NULL DEFAULT '',
                title_en VARCHAR(255) NOT NULL DEFAULT '',
                title_sa VARCHAR(255) NOT NULL DEFAULT '',
                description_it TEXT NOT NULL DEFAULT '',
                description_en TEXT NOT NULL DEFAULT '',
                description_sa TEXT NOT NULL DEFAULT '',
                audio_it VARCHAR(500) NOT NULL DEFAULT '',
                audio_en VARCHAR(500) NOT NULL DEFAULT '',
                audio_sa VARCHAR(500) NOT NULL DEFAULT '',
                panorama_id INTEGER,
                geom GEOMETRY(POINT, 4326),
                custom_icon VARCHAR(500) DEFAULT '',
                visible BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ";
        $result1 = $db->query($query);
        if (!$result1) {
            error_log('Risviel GisDoc: Errore nella creazione della tabella map_points');
            wp_send_json_error(array('message' => 'Errore nella creazione della tabella map_points. Controlla i log per dettagli.'));
            return;
        }

        // Tabella dei panorami
        $query = "
            CREATE TABLE IF NOT EXISTS panoramas (
                id SERIAL PRIMARY KEY,
                title_it VARCHAR(255) NOT NULL DEFAULT '',
                title_en VARCHAR(255) NOT NULL DEFAULT '',
                title_sa VARCHAR(255) NOT NULL DEFAULT '',
                description_it TEXT NOT NULL DEFAULT '',
                description_en TEXT NOT NULL DEFAULT '',
                description_sa TEXT NOT NULL DEFAULT '',
                audio_url_it TEXT NOT NULL DEFAULT '',
                audio_url_en TEXT NOT NULL DEFAULT '',
                audio_url_sa TEXT NOT NULL DEFAULT '',
                north_offset NUMERIC NOT NULL DEFAULT 0,
                image_url VARCHAR(500) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ";
        $result2 = $db->query($query);
        if (!$result2) {
            error_log('Risviel GisDoc: Errore nella creazione della tabella panoramas');
            wp_send_json_error(array('message' => 'Errore nella creazione della tabella panoramas. Controlla i log per dettagli.'));
            return;
        }


        // Tabella categorie
        $query = "
            CREATE TABLE IF NOT EXISTS gisdoc_categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) UNIQUE NOT NULL,
                description TEXT DEFAULT '',
                color VARCHAR(7) DEFAULT '#3388ff',
                icon VARCHAR(500) DEFAULT '',
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ";
        $result3 = $db->query($query);
        if (!$result3) {
            error_log('Risviel GisDoc: Errore nella creazione della tabella gisdoc_categories');
            wp_send_json_error(array('message' => 'Errore nella creazione della tabella gisdoc_categories. Controlla i log per dettagli.'));
            return;
        }

        // Tabella relazione punti-categorie
        $query = "
            CREATE TABLE IF NOT EXISTS gisdoc_point_categories (
                point_id INT NOT NULL,
                category_id INT NOT NULL,
                PRIMARY KEY (point_id, category_id),
                FOREIGN KEY (category_id) REFERENCES gisdoc_categories(id) ON DELETE CASCADE
            )
        ";
        $result4 = $db->query($query);
        if (!$result3) {
            error_log('Risviel GisDoc: Errore nella creazione della tabella gisdoc_point_categories');
            wp_send_json_error(array('message' => 'Errore nella creazione della tabella gisdoc_point_categories. Controlla i log per dettagli.'));
            return;
        }


        // Tabella per le aree interattive
        $queries[] = "
            CREATE TABLE IF NOT EXISTS interactive_areas (
                id SERIAL PRIMARY KEY,
                panorama_id INTEGER NOT NULL,
                title_it VARCHAR(255) NOT NULL DEFAULT '',
                title_en VARCHAR(255) NOT NULL DEFAULT '',
                title_sa VARCHAR(255) NOT NULL DEFAULT '',
                content_it TEXT NOT NULL DEFAULT '',
                content_en TEXT NOT NULL DEFAULT '',
                content_sa TEXT NOT NULL DEFAULT '',
                mask_path VARCHAR(500),
                coordinates TEXT,
                audio_url_it TEXT NOT NULL DEFAULT '',
                audio_url_en TEXT NOT NULL DEFAULT '',
                audio_url_sa TEXT NOT NULL DEFAULT '',
                action_type      varchar(50)  default ''::character varying,
                action_target    varchar(255) default ''::character varying,
                action_target_it varchar(255) default ''::character varying,
                action_target_en varchar(255) default ''::character varying,
                action_target_sa varchar(255) default ''::character varying,
                scale            double precision,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_panorama
                    FOREIGN KEY(panorama_id)
                    REFERENCES panoramas(id)
                    ON DELETE CASCADE
            )
        ";


        // Tabella per le aree interattive
        $queries[] = "
            CREATE TABLE IF NOT EXISTS panorama_indicators (
                id SERIAL PRIMARY KEY,
                panorama_id INTEGER NOT NULL REFERENCES panoramas(id) ON DELETE CASCADE,
                position_x DECIMAL(10,6) NOT NULL,
                position_y DECIMAL(10,6) NOT NULL,
                position_z DECIMAL(10,6) NOT NULL,
                title_it TEXT,
                title_en TEXT,
                title_sa TEXT,
                action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('panorama', 'video', 'audio', 'pdf', 'image')),
                action_target TEXT NOT NULL,
                icon_type VARCHAR(20) DEFAULT 'default',
                action_target_it TEXT,
                action_target_en TEXT,
                action_target_sa TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ;
        ";
        // Indici per migliorare le performance
        $queries[] = "CREATE INDEX IF NOT EXISTS idx_map_points_geom ON map_points USING GIST (geom)";
        $queries[] = "CREATE INDEX IF NOT EXISTS idx_map_points_visible ON map_points (visible)";
        $queries[] = "CREATE INDEX IF NOT EXISTS idx_interactive_areas_panorama ON interactive_areas (panorama_id)";
        $queries[] = "CREATE INDEX IF NOT EXISTS idx_panorama_indicators_panorama_id ON panorama_indicators(panorama_id)";

        // Esegui tutte le query
            $success = true;
            foreach ($queries as $query) {
                $result = $db->query($query);
                if (!$result) {
                    error_log('Risviel GisDoc: Errore nella creazione delle tabelle: ' . $query);
                    $success = false;
                    break;
                }
            }

            if ($success) {
                // Salva l'opzione che indica che le tabelle sono state create
                update_option('risviel_gisdoc_tables_created', 'yes');

                wp_send_json_success(array(
                    'message' => 'Tabelle create con successo! Sono state create 4 tabelle e 4 sequenze.',
                    'tables_count' => 4
                ));
            } else {
                wp_send_json_error(array('message' => 'Errore durante la creazione di una o più tabelle. Controlla i log per i dettagli.'));
            }

    }


    /**
     * Handler AJAX per il salvataggio dei punti sulla mappa.
     *
     * @since    1.0.0
     */
    public function ajax_save_map_point() {
        // Verifica il nonce
        if (!wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_admin_nonce')) {
            wp_die('Sicurezza non verificata');
        }

        // Debug: Log dei dati ricevuti
        error_log('AJAX Save Map Point - Dati ricevuti: ' . print_r($_POST, true));

        try {
            // Verifica e sanitizza i dati obbligatori
            $point_id = isset($_POST['point_id']) && !empty($_POST['point_id']) ? intval($_POST['point_id']) : null;

            // Coordinate
            if (!isset($_POST['lat']) || !isset($_POST['lng'])) {
                wp_send_json_error(array('message' => 'Coordinate mancanti'));
                return;
            }

            $lat = floatval($_POST['lat']);
            $lng = floatval($_POST['lng']);

            if ($lat == 0 && $lng == 0) {
                wp_send_json_error(array('message' => 'Coordinate non valide'));
                return;
            }

            // Titolo italiano obbligatorio
            if (!isset($_POST['title_it']) || empty(trim($_POST['title_it']))) {
                wp_send_json_error(array('message' => 'Il titolo in italiano è obbligatorio'));
                return;
            }

            // Crea o carica il punto
            if ($point_id) {
                $point = new Risviel_GisDoc_Map_Point($point_id);
                if (!$point->id) {
                    wp_send_json_error(array('message' => 'Punto non trovato'));
                    return;
                }
            } else {
                $point = new Risviel_GisDoc_Map_Point();
            }

            // Imposta le coordinate
            $point->set_coordinates($lat, $lng);

            // Imposta i titoli
            $point->set_title(sanitize_text_field($_POST['title_it']), 'it');
            $point->set_title(isset($_POST['title_en']) ? sanitize_text_field($_POST['title_en']) : '', 'en');
            $point->set_title(isset($_POST['title_sa']) ? sanitize_text_field($_POST['title_sa']) : '', 'sa');

            // Imposta le descrizioni (permettendo HTML)
            $point->set_description(isset($_POST['description_it']) ? wp_kses_post($_POST['description_it']) : '', 'it');
            $point->set_description(isset($_POST['description_en']) ? wp_kses_post($_POST['description_en']) : '', 'en');
            $point->set_description(isset($_POST['description_sa']) ? wp_kses_post($_POST['description_sa']) : '', 'sa');

            // Imposta i file audio
            $point->set_audio_file( isset($_POST['audio_it']) ? esc_url_raw($_POST['audio_it']) : '', 'it');
            $point->set_audio_file(isset($_POST['audio_en']) ? esc_url_raw($_POST['audio_en']) : '', 'en',);
            $point->set_audio_file(isset($_POST['audio_sa']) ? esc_url_raw($_POST['audio_sa']) : '', 'sa');

            // Imposta panorama ID
            $panorama_id = isset($_POST['panorama_id']) && !empty($_POST['panorama_id']) ? intval($_POST['panorama_id']) : null;
            $point->set_panorama_id($panorama_id);

            // Imposta icona personalizzata
            $custom_icon = isset($_POST['custom_icon']) ? esc_url_raw($_POST['custom_icon']) : '';
            $point->set_custom_icon($custom_icon);

            // Imposta visibilità
            $visible = isset($_POST['visible']) && ($_POST['visible'] == '1' || $_POST['visible'] === true);
            $point->set_visible($visible);

            // Salva il punto
            if ($point->save()) {

                // --- Salva le categorie associate ---
                $cat_ids = array();
                if (isset($_POST['point_categories']) && is_array($_POST['point_categories'])) {
                    $cat_ids = array_map('intval', $_POST['point_categories']);
                }
                require_once RISVIEL_GISDOC_PLUGIN_DIR . 'includes/class-risviel-gisdoc-categories-db.php';
                $cat_db = new Risviel_GisDoc_Categories_DB();
                $cat_db->set_point_categories($point->id, $cat_ids);

                $response_data = array(
                    'message' => 'Punto salvato con successo',
                    'point_id' => $point->id
                );
                wp_send_json_success($response_data);
            } else {
                wp_send_json_error(array('message' => 'Errore durante il salvataggio nel database'));
            }

        } catch (Exception $e) {
            error_log('Errore in ajax_save_map_point: ' . $e->getMessage());
            wp_send_json_error(array('message' => 'Errore interno: ' . $e->getMessage()));
        }
    }

    /**
     * Gestisce la richiesta AJAX per caricare tutti i punti sulla mappa.
     *
     * @since    1.0.0
     */
    public function ajax_get_all_map_points() {
        // Verifica il nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_admin_nonce')) {
            wp_send_json_error(array('message' => 'Verifica di sicurezza fallita.'));
            return;
        }

        // Ottieni i parametri della richiesta
        $lat = isset($_POST['lat']) ? floatval($_POST['lat']) : 0;
        $lng = isset($_POST['lng']) ? floatval($_POST['lng']) : 0;
        $radius = isset($_POST['radius']) ? floatval($_POST['radius']) : 10000;
        $language = isset($_POST['language']) ? sanitize_text_field($_POST['language']) : 'it';

        // Ottieni l'istanza del database
        $db = Risviel_GisDoc_PostGIS::get_instance();

        // Verifica che la connessione sia attiva
        if (!$db->init_connection()) {
            wp_send_json_error(array('message' => 'Impossibile connettersi al database. Verifica i parametri di connessione.'));
            return;
        }

        // Query per ottenere tutti i punti
        $query = "
            SELECT 
                id, title_it, title_en, title_sa,
                description_it, description_en, description_sa,
                  audio_it, audio_en, audio_sa, panorama_id, 
                ST_X(geom) as lng, ST_Y(geom) as lat, custom_icon, visible,
                created_at, updated_at
            FROM map_points
            ORDER BY id;
        ";

        if (isset($_POST['language'])) {
            // Prepara la query SQL per ottenere i punti entro il raggio specificato
            // e seleziona i campi in base alla lingua
            $title_field = "title_$language";
            $description_field = "description_$language";
            $audio_field = "audio_$language";


            // Se il campo della lingua richiesta è vuoto, usa l'italiano come fallback
            $query = "
            SELECT 
                id, 
                COALESCE(NULLIF($title_field, ''), title_it) as title, 
                COALESCE(NULLIF($description_field, ''), description_it) as description, 
                COALESCE(NULLIF($audio_field, ''), audio_it) as audio, 
                panorama_id,
                ST_X(geom) as lng, 
                ST_Y(geom) as lat
            FROM 
                map_points
            WHERE 
                ST_DWithin(
                    geom, 
                    ST_SetSRID(ST_MakePoint($lng, $lat), 4326), 
                    $radius / 111320
                )
            ORDER BY 
                ST_Distance(geom, ST_SetSRID(ST_MakePoint($lng, $lat), 4326))
            LIMIT 100
        ";
        }

        $result = $db->query($query);

        if (!$result) {
            error_log('Risviel GisDoc: Errore nel caricamento dei punti sulla mappa');
            wp_send_json_error(array('message' => 'Errore nel caricamento dei punti sulla mappa.'));
            return;
        }

        $points = $db->fetch_all($result);

        // Aggiungi category_ids ad ogni punto
        require_once RISVIEL_GISDOC_PLUGIN_DIR . 'includes/class-risviel-gisdoc-categories-db.php';
        $cat_db = new Risviel_GisDoc_Categories_DB();
        foreach ($points as &$p) {
            $p['category_ids'] = array();
            $cats = $cat_db->get_point_categories($p['id']);
            if (!empty($cats)) {
                $p['category_ids'] = array_map('intval', array_column($cats, 'id'));
            }
        }
        unset($p);

        wp_send_json_success($points);
    }

    /**
     * Gestisce la richiesta AJAX per caricare un singolo punto sulla mappa.
     *
     * @since    1.0.0
     */
    public function ajax_get_map_point()
    {
        // Verifica il nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_admin_nonce')) {
            wp_send_json_error(array('message' => 'Nonce non valido.'));
            wp_die();
        }

        // Verifica l'ID del punto
        if (!isset($_POST['point_id']) || empty($_POST['point_id'])) {
            wp_send_json_error(array('message' => 'ID del punto mancante o non valido.'));
            wp_die();
        }

        $point_id = intval($_POST['point_id']);

        // Carica i dati del punto
        $point = new Risviel_GisDoc_Map_Point($point_id);

        // Verifica se il punto è stato caricato correttamente
        if (!isset($point->id) || empty($point->id)) {
            wp_send_json_error(array('message' => 'Punto non trovato nel database.'));
            wp_die();
        }

        // Prepara i dati da restituire
        $data = array(
            'id' => $point->id,
            'title_it' => $point->get_title('it'),
            'title_en' => $point->get_title('en'),
            'title_sa' => $point->get_title('sa'),
            'description_it' => $point->get_description('it'),
            'description_en' => $point->get_description('en'),
            'description_sa' => $point->get_description('sa'),
            'audio_it' => $point->get_audio_file('it'),
            'audio_en' => $point->get_audio_file('en'),
            'audio_sa' => $point->get_audio_file('sa'),
            'panorama_id' => $point->get_panorama_id(),
            'lat' => (float)$point->coordinates['lat'],
            'lng' => (float)$point->coordinates['lng'],
            'custom_icon' => $point->get_custom_icon(),
            'visible' => (float)$point->is_visible()
        );

        // Aggiungi category_ids
        require_once RISVIEL_GISDOC_PLUGIN_DIR . 'includes/class-risviel-gisdoc-categories-db.php';
        $cat_db = new Risviel_GisDoc_Categories_DB();
        $cats = $cat_db->get_point_categories($point->id);
        $data['category_ids'] = !empty($cats) ? array_map('intval', array_column($cats, 'id')) : array();

        wp_send_json_success($data);
        wp_die();
    }


    /**
     * Gestisce la richiesta AJAX per eliminare un punto sulla mappa.
     *
     * @since    1.0.0
     */
    public function ajax_delete_map_point() {
        // Verifica il nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_admin_nonce')) {
            wp_send_json_error(array('message' => 'Verifica di sicurezza fallita.'));
            return;
        }

        // Verifica che l'ID del punto sia presente
        if (!isset($_POST['point_id']) || !is_numeric($_POST['point_id'])) {
            wp_send_json_error(array('message' => 'ID del punto mancante o non valido.'));
            return;
        }


        $id = intval($_POST['point_id']);


        // Ottieni l'istanza del database
        $db = Risviel_GisDoc_PostGIS::get_instance();

        // Verifica che la connessione sia attiva
        if (!$db->init_connection()) {
            wp_send_json_error(array('message' => 'Impossibile connettersi al database. Verifica i parametri di connessione.'));
            return;
        }

        // Query per eliminare il punto
        $query = "DELETE FROM map_points WHERE id = $1;";

        $result = $db->query($query, array($id));

        if (!$result) {
            error_log('Risviel GisDoc: Errore nell\'eliminazione del punto sulla mappa');
            wp_send_json_error(array('message' => 'Errore nell\'eliminazione del punto sulla mappa.'));
            return;
        }

        wp_send_json_success(array('message' => 'Punto eliminato con successo.'));
    }

    /**
     * Gestisce la richiesta AJAX per salvare un panorama.
     *
     * @since    1.0.0
     */
    public function ajax_save_panorama_old() {
        // Verifica il nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_admin_nonce')) {
            wp_send_json_error(array('message' => 'Verifica di sicurezza fallita.'));
        }

        // Verifica che i dati siano stati inviati
        if (!isset($_POST['panorama'])) {
            wp_send_json_error(array('message' => 'Dati mancanti.'));
        }

        // Ottieni i dati dal POST
        $panorama_data = $_POST['panorama'];

        // Verifica che i campi obbligatori siano presenti
        if (empty($panorama_data['title_it']) || empty($panorama_data['image_url'])) {
            wp_send_json_error(array('message' => 'Titolo in italiano e URL immagine sono obbligatori.'));
        }

        // Ottieni l'istanza del database
        $db = Risviel_GisDoc_PostGIS::get_instance();

        // Verifica che la connessione sia attiva
        if (!$db->init_connection()) {
            wp_send_json_error(array('message' => 'Errore di connessione al database.'));
            return;
        }

        // Prepara i dati per l'inserimento/aggiornamento
        $id = !empty($panorama_data['id']) ? intval($panorama_data['id']) : 0;
        $title_it = sanitize_text_field($panorama_data['title_it']);
        $title_en = isset($panorama_data['title_en']) ? sanitize_text_field($panorama_data['title_en']) : '';
        $title_sa = isset($panorama_data['title_sa']) ? sanitize_text_field($panorama_data['title_sa']) : '';


        // Per le descrizioni, usa wp_kses_post per permettere HTML formattato
        $description_it = wp_kses_post($panorama_data['description_it'] ?? '');
        $description_en = wp_kses_post($panorama_data['description_en'] ?? '');
        $description_sa = wp_kses_post($panorama_data['description_sa'] ?? '');

        /*$description_it = isset($panorama_data['description_it']) ? sanitize_textarea_field($panorama_data['description_it']) : '';
        $description_en = isset($panorama_data['description_en']) ? sanitize_textarea_field($panorama_data['description_en']) : '';
        $description_sa = isset($panorama_data['description_sa']) ? sanitize_textarea_field($panorama_data['description_sa']) : '';*/

        $audio_url_it = esc_url_raw($panorama_data['audio_url_it']);
        $audio_url_en = esc_url_raw($panorama_data['audio_url_en']);
        $audio_url_sa = esc_url_raw($panorama_data['audio_url_sa']);

        $image_url = esc_url_raw($panorama_data['image_url']);

        try {
            if ($id > 0) {
                // Aggiornamento di un panorama esistente
                $query = "
                    UPDATE panoramas 
                    SET 
                        title_it = $1, 
                        title_en = $2, 
                        title_sa = $3, 
                        description_it = $4, 
                        description_en = $5, 
                        description_sa = $6, 
                        audio_url_it = $7, 
                        audio_url_en = $8, 
                        audio_url_sa = $9, 
                        image_url = $10,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $11
                    RETURNING id
                ";

                $result = $db->query(
                    $query,
                    array(
                        $title_it,
                        $title_en,
                        $title_sa,
                        $description_it,
                        $description_en,
                        $description_sa,
                        $audio_url_it,
                        $audio_url_en,
                        $audio_url_sa,
                        $image_url,
                        $id
                    )
                );

                if (!$result) {
                    wp_send_json_error(array('message' => 'Errore nell\'aggiornamento del panorama.'));
                    return;
                }

                wp_send_json_success(array('message' => 'Panorama aggiornato con successo.', 'id' => $id));
            } else {
                // Inserimento di un nuovo panorama
                $query = "
                    INSERT INTO panoramas 
                    (title_it, title_en, title_sa, description_it, description_en, description_sa,
                     audio_url_it,  audio_url_en, audio_url_sa, image_url) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id
                ";

                $result = $db->query(
                    $query,
                    array(
                        $title_it,
                        $title_en,
                        $title_sa,
                        $description_it,
                        $description_en,
                        $description_sa,
                        $audio_url_it,
                        $audio_url_en,
                        $audio_url_sa,
                        $image_url
                    )
                );


                if (!$result) {
                    wp_send_json_error(array('message' => 'Errore nell\'inserimento del panorama.'));
                    return;
                }

                $row = $db->fetch_row($result);
                $new_id = $row['id'];

                wp_send_json_success(array('message' => 'Panorama creato con successo.', 'id' => $new_id));
            }
        } catch (Exception $e) {
            wp_send_json_error(array('message' => 'Errore: ' . $e->getMessage()));
        }
    }

        /**
     * Gestisce la richiesta AJAX per salvare un panorama.
     *
     * @since    1.0.0
     */
    public function ajax_save_panorama() {

        // Verifica il nonce
        if (!wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_admin_nonce')) {
            wp_die('Sicurezza non verificata');
        }

        // Debug: Log dei dati ricevuti
        error_log('AJAX Save Panorama - Dati ricevuti: ' . print_r($_POST, true));

        // Verifica che i dati siano stati inviati
        if (!isset($_POST['panorama'])) {
            wp_send_json_error(array('message' => 'Dati mancanti.'));
        }

        try {
            // Verifica e sanitizza i dati obbligatori
            $id = isset($_POST['panorama']['id']) && !empty($_POST['panorama']['id']) ? intval($_POST['panorama']['id']) : null;

            $title_it = sanitize_text_field($_POST['panorama']['title_it']);
            $title_en = isset($_POST['panorama']['title_en']) ? sanitize_text_field($_POST['panorama']['title_en']) : '';
            $title_sa = isset($_POST['panorama']['title_sa']) ? sanitize_text_field($_POST['panorama']['title_sa']) : '';


            // Per le descrizioni, usa wp_kses_post per permettere HTML formattato
            $description_it = wp_kses_post($_POST['panorama']['description_it'] ?? '');
            $description_en = wp_kses_post($_POST['panorama']['description_en'] ?? '');
            $description_sa = wp_kses_post($_POST['panorama']['description_sa'] ?? '');

            $audio_url_it = esc_url_raw($_POST['panorama']['audio_url_it']) ?? '';
            $audio_url_en = esc_url_raw($_POST['panorama']['audio_url_en']) ?? '';
            $audio_url_sa = esc_url_raw($_POST['panorama']['audio_url_sa']) ?? '';

            $image_url = esc_url_raw($_POST['panorama']['image_url']) ?? '';

            // Crea o carica il panorama
            if ($id) {
                $panorama = new Risviel_GisDoc_Panorama($id);
                if (!$panorama->get_id()) {
                    wp_send_json_error(array('message' => 'Panorama non trovato'));
                    return;
                }
            } else {
                $panorama = new Risviel_GisDoc_Panorama();
            }

            // Imposta i titoli
            $panorama->set_title('it',$title_it);
            $panorama->set_title('en',$title_en);
            $panorama->set_title('sa',$title_sa);

            // Imposta le descrizioni (permettendo HTML)
            $panorama->set_description('it',$description_it);
            $panorama->set_description('en',$description_en);
            $panorama->set_description('sa',$description_sa);

            // Imposta i file audio
            $panorama->set_audio_url('it', $audio_url_it);
            $panorama->set_audio_url('en', $audio_url_en);
            $panorama->set_audio_url('sa', $audio_url_sa);

            // Imposta l'immagine
            $panorama->set_image_url($image_url);

            // Salva il panorama
            if ($panorama->save()) {
                $response_data = array(
                    'message' => 'Panorama salvato con successo',
                    'point_id' => $panorama->get_id()
                );
                wp_send_json_success($response_data);
            } else {
                wp_send_json_error(array('message' => 'Errore durante il salvataggio nel database'));
            }

        } catch (Exception $e) {
            error_log('Errore in ajax_save_panorama: ' . $e->getMessage());
            wp_send_json_error(array('message' => 'Errore interno: ' . $e->getMessage()));
        }

    }
    /**
     * Gestisce la richiesta AJAX per ottenere tutti i panorami.
     *
     * @since    1.0.0
     */
    public function ajax_get_all_panoramas() {
        // Verifica il nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_admin_nonce')) {
            wp_send_json_error(array('message' => 'Verifica di sicurezza fallita.'));
        }

        // Ottieni l'istanza del database
        $db = Risviel_GisDoc_PostGIS::get_instance();

        // Verifica che la connessione sia attiva
        if (!$db->init_connection()) {
            wp_send_json_error(array('message' => 'Errore di connessione al database.'));
            return;
        }

        try {
            // Query per ottenere tutti i panorami
            $query = "SELECT id, title_it, title_en, title_sa FROM panoramas ORDER BY title_it ASC";
            $result = $db->query($query);

            if (!$result) {
                wp_send_json_error(array('message' => 'Errore nel recupero dei panorami.'));
                return;
            }

            $panoramas = $db->fetch_all($result);

            wp_send_json_success($panoramas);
        } catch (Exception $e) {
            wp_send_json_error(array('message' => 'Errore: ' . $e->getMessage()));
        }
    }

    /**
     * Gestisce la richiesta AJAX per ottenere un singolo panorama.
     *
     * @since    1.0.0
     */
    public function ajax_get_panorama() {
    // Verifica il nonce
    if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_admin_nonce')) {
        wp_send_json_error(array('message' => 'Verifica di sicurezza fallita.'));
        return;
    }

    // Verifica che l'ID sia stato inviato
    if (!isset($_POST['panorama_id']) || empty($_POST['panorama_id'])) {
        wp_send_json_error(array('message' => 'ID panorama mancante.'));
    }

    $id = intval($_POST['panorama_id']);

    // Ottieni l'istanza del database
    $db = Risviel_GisDoc_PostGIS::get_instance();

    // Verifica che la connessione sia attiva
    if (!$db->init_connection()) {
        wp_send_json_error(array('message' => 'Errore di connessione al database.'));
        return;
    }

    try {
        // Query per ottenere il panorama
        $query = "
            SELECT 
                p.id, p.title_it, p.title_en, p.title_sa, 
                p.description_it, p.description_en, p.description_sa, 
                p.audio_url_it, p.audio_url_en, p.audio_url_sa, 
                p.image_url, p.north_offset
            FROM panoramas p
            WHERE p.id = $1
        ";

        $result = $db->query($query, array($id));

        if (!$result) {
            error_log("Errore nella query di recupero panorama: " . pg_last_error());
            wp_send_json_error(array('message' => 'Errore nel recupero del panorama.'));
            return;
        }

        $panorama = $db->fetch_row($result);

        if (!$panorama) {
            wp_send_json_error(array('message' => 'Panorama non trovato.'));
            return;
        }

        // Se abbiamo ricevuto le aree interattive come stringa JSON, convertiamole in array
        if (isset($panorama['interactive_areas']) && is_string($panorama['interactive_areas'])) {
            $panorama['interactive_areas'] = json_decode($panorama['interactive_areas'], true);
        }

        // Aggiungi l'URL completo per le maschere
        if (isset($panorama['interactive_areas']) && is_array($panorama['interactive_areas'])) {
            $upload_dir = wp_upload_dir();
            foreach ($panorama['interactive_areas'] as &$area) {
                if (!empty($area['mask_path'])) {
                    $area['mask_url'] = $upload_dir['baseurl'] . '/' . $area['mask_path'];
                } else {
                    $area['mask_url'] = '';
                }

                // Converti le coordinate da stringa JSON ad array se necessario
                if (!empty($area['coordinates']) && is_string($area['coordinates'])) {
                    $area['coordinates_array'] = json_decode($area['coordinates'], true);
                } else {
                    $area['coordinates_array'] = [];
                }
            }
        }

        wp_send_json_success($panorama);
    } catch (Exception $e) {
        error_log("Eccezione nel recupero panorama: " . $e->getMessage());
        wp_send_json_error(array('message' => 'Errore: ' . $e->getMessage()));
    }
}

    /**
     * Gestisce la richiesta AJAX per eliminare un panorama.
     *
     * @since    1.0.0
     */
    public function ajax_delete_panorama()
    {
        // Verifica il nonce
        if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'risviel_gisdoc_admin_nonce')) {
            wp_send_json_error(array('message' => 'Verifica di sicurezza fallita.'));
        }

        // Verifica che l'ID sia stato inviato
        if (!isset($_POST['id']) || empty($_POST['id'])) {
            wp_send_json_error(array('message' => 'ID panorama mancante.'));
        }

        $id = intval($_POST['id']);

        // Ottieni l'istanza del database
        $db = Risviel_GisDoc_PostGIS::get_instance();

        // Verifica che la connessione sia attiva
        if (!$db->init_connection()) {
            wp_send_json_error(array('message' => 'Errore di connessione al database.'));
            return;
        }

        try {
            // Elimina il panorama
            $query = "DELETE FROM panoramas WHERE id = $1";
            $result = $db->query($query, array($id));

            if (!$result) {
                wp_send_json_error(array('message' => 'Errore nell\'eliminazione del panorama.'));
                return;
            }

            wp_send_json_success(array('message' => 'Panorama eliminato con successo.'));
        } catch (Exception $e) {
            wp_send_json_error(array('message' => 'Errore: ' . $e->getMessage()));
        }
    }





}