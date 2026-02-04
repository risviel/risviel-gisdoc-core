<?php
/**
 * Definisce la funzionalità di internazionalizzazione.
 *
 * @since      1.0.0
 */
class Risviel_GisDoc_i18n {

    /**
     * Carica il dominio di testo per il plugin.
     *
     * @since    1.0.0
     */
    public function load_plugin_textdomain() {
        load_plugin_textdomain(
            RISVIEL_PLUGIN_SLUG,
            false,
            dirname(dirname(plugin_basename(__FILE__))) . '/languages/'
        );
    }
}