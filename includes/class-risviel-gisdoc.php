<?php
/**
 * La classe principale del plugin.
 *
 * @since      1.0.0
 */
class Risviel_GisDoc {

    /**
     * Il loader che gestisce gli hook del plugin.
     *
     * @since    1.0.0
     * @access   protected
     * @var      Risviel_GisDoc_Loader    $loader    Mantiene e registra tutti gli hook per il plugin.
     */
    protected $loader;

    /**
     * Il nome identificativo del plugin.
     *
     * @since    1.0.0
     * @access   protected
     * @var      string    $plugin_name    Il nome identificativo del plugin.
     */
    protected $plugin_name;

    /**
     * La versione corrente del plugin.
     *
     * @since    1.0.0
     * @access   protected
     * @var      string    $version    La versione corrente del plugin.
     */
    protected $version;

    /**
     * Definisce le funzionalità core del plugin.
     *
     * @since    1.0.0
     */
    public function __construct() {
        $this->version = RISVIEL_GISDOC_VERSION;
        $this->plugin_name = RISVIEL_PLUGIN_SLUG;

        $this->load_dependencies();
        $this->set_locale();
        $this->define_admin_hooks();
        $this->define_public_hooks();
        $this->register_rest_routes();
    }

    /**
     * Carica le dipendenze richieste per il plugin.
     *
     * @since    1.0.0
     * @access   private
     */
    private function load_dependencies() {
        // Loader per gestire gli hook
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-risviel-gisdoc-loader.php';

        // Classe per l'internazionalizzazione
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-risviel-gisdoc-i18n.php';

        // Classe per la gestione del database
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-risviel-gisdoc-db.php';

        // Classi per i modelli di dati
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-risviel-gisdoc-map-point.php';
        require_once plugin_dir_path(dirname(__FILE__)) . 'includes/class-risviel-gisdoc-panorama.php';

        // Classi per l'admin area
        require_once plugin_dir_path(dirname(__FILE__)) . 'admin/class-risviel-gisdoc-admin.php';

        // Classi per il front-end
        require_once plugin_dir_path(dirname(__FILE__)) . 'public/class-risviel-gisdoc-public.php';

        $this->loader = new Risviel_GisDoc_Loader();
    }

    /**
     * Definisce le funzionalità relative all'internazionalizzazione.
     *
     * @since    1.0.0
     * @access   private
     */
    private function set_locale() {
        $plugin_i18n = new Risviel_GisDoc_i18n();
        $this->loader->add_action('plugins_loaded', $plugin_i18n, 'load_plugin_textdomain');
    }

    /**
     * Registra tutti gli hook relativi alla funzionalità di amministrazione.
     *
     * @since    1.0.0
     * @access   private
     */
    private function define_admin_hooks() {
        $plugin_admin = new Risviel_GisDoc_Admin($this->get_plugin_name(), $this->get_version());

        // Enqueue admin scripts e styles
        $this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_styles');
        $this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_scripts');

        // Aggiungi menu admin
        $this->loader->add_action('admin_menu', $plugin_admin, 'add_plugin_admin_menu');

        // Registra impostazioni
        $this->loader->add_action('admin_init', $plugin_admin, 'register_settings');
    }

    /**
     * Registra tutti gli hook relativi alla funzionalità pubblica.
     *
     * @since    1.0.0
     * @access   private
     */
    private function define_public_hooks() {
        $plugin_public = new Risviel_GisDoc_Public($this->get_plugin_name(), $this->get_version());

        // Enqueue public scripts e styles
        $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_styles');
        $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_scripts');

        // Registra shortcodes
        $this->loader->add_action('init', $plugin_public, 'register_shortcodes');
    }

    /**
     * Registra le REST API routes.
     *
     * @since    1.0.0
     * @access   private
     */
    private function register_rest_routes() {
        $this->loader->add_action('rest_api_init', $this, 'register_rest_api_endpoints');
    }

    /**
     * Definisce gli endpoint REST API.
     *
     * @since    1.0.0
     */
    public function register_rest_api_endpoints() {
        // Implementazione degli endpoint REST API
    }

    /**
     * Esegue il loader per registrare tutti gli hook con WordPress.
     *
     * @since    1.0.0
     */
    public function run() {
        $this->loader->run();
    }

    /**
     * Il nome usato per identificare il plugin.
     *
     * @since     1.0.0
     * @return    string    Il nome del plugin.
     */
    public function get_plugin_name() {
        return $this->plugin_name;
    }

    /**
     * Riferimento all'oggetto loader che registra tutti gli hook.
     *
     * @since     1.0.0
     * @return    Risviel_GisDoc_Loader    Gestisce gli hook del plugin.
     */
    public function get_loader() {
        return $this->loader;
    }

    /**
     * Ritorna la versione del plugin.
     *
     * @since     1.0.0
     * @return    string    La versione del plugin.
     */
    public function get_version() {
        return $this->version;
    }
}