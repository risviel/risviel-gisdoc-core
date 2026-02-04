<?php
/**
 * Gestisce l'attivazione del plugin.
 *
 * @since      1.0.0
 */
class Risviel_GisDoc_Activator {

    /**
     * Esegue le operazioni necessarie all'attivazione del plugin.
     *
     * @since    1.0.0
     */
    public static function activate() {
        // Aggiungi le opzioni di default
        self::add_default_options();

        // Imposta un flag per indicare che le tabelle devono essere create
        // al primo accesso alle impostazioni del plugin
        add_option('risviel_gisdoc_tables_created', 'no');

        // Aggiorna i permalink
        flush_rewrite_rules();

        // Crea il ruolo personalizzato per GisDoc
        self::create_gisdoc_role();
    }

    /**
     * Funzione helper per creare un utente GisDoc
     */
    function create_gisdoc_user($username, $email, $password = '') {
        if (empty($password)) {
            $password = wp_generate_password();
        }

        $user_id = wp_create_user($username, $password, $email);

        if (!is_wp_error($user_id)) {
            $user = new WP_User($user_id);
            $user->set_role('risviel_gisdoc_user');

            return array(
                'user_id' => $user_id,
                'username' => $username,
                'password' => $password,
                'email' => $email
            );
        }

        return false;
    }

    /**
     * Crea un ruolo utente personalizzato per GisDoc
     */
    private static function create_gisdoc_role() {
        // Rimuovi il ruolo se esiste già (per aggiornamenti)
        remove_role('risviel_gisdoc_user');

        // Crea il nuovo ruolo con capacità minime
        add_role(
            'risviel_gisdoc_user',
            __('Utente GisDoc', RISVIEL_PLUGIN_SLUG),
            array(
                'read' => true,
                // Capacità personalizzate per il plugin
                'risviel_gisdoc_view' => true,
                'risviel_gisdoc_edit' => true,
                'risviel_gisdoc_manage' => true,
                // Rimuovi accesso alla dashboard standard
                'access_dashboard' => false,
            )
        );

        // Aggiungi le capacità personalizzate anche agli amministratori
        $admin_role = get_role('administrator');
        if ($admin_role) {
            $admin_role->add_cap('risviel_gisdoc_view');
            $admin_role->add_cap('risviel_gisdoc_edit');
            $admin_role->add_cap('risviel_gisdoc_manage');
        }
    }





    /**
     * Aggiunge le opzioni di default al database WordPress.
     *
     * @since    1.0.0
     */
    private static function add_default_options() {
        // Impostazioni di base
        add_option('risviel_gisdoc_default_language', 'it');
        add_option('risviel_gisdoc_map_center_lat', '40.29');  // Latitudine default
        add_option('risviel_gisdoc_map_center_lng', '9.61');   // Longitudine default
        add_option('risviel_gisdoc_map_zoom', '13');           // Livello di zoom default

        // Impostazioni PostgreSQL/PostGIS
        add_option('risviel_gisdoc_pg_host', 'localhost');
        add_option('risviel_gisdoc_pg_port', '5432');
        add_option('risviel_gisdoc_pg_dbname', '');
        add_option('risviel_gisdoc_pg_user', '');
        add_option('risviel_gisdoc_pg_password', '');

        // Nuove opzioni per la gestione audio
        add_option('risviel_gisdoc_audio_max_size', '10'); // MB
        add_option('risviel_gisdoc_audio_allowed_types', 'mp3,wav,ogg,m4a');

        // Versione del database per gestire gli aggiornamenti
        add_option('risviel_gisdoc_db_version', '1.0.0');

    }
}