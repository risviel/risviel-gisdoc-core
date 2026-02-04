<?php
/**
 * Gestisce la disattivazione del plugin.
 *
 * @since      1.0.0
 */
class Risviel_GisDoc_Deactivator {

    /**
     * Esegue le operazioni necessarie alla disattivazione del plugin.
     *
     * @since    1.0.0
     */
    public static function deactivate() {
        // Operazioni da eseguire alla disattivazione
        // Non eliminiamo le tabelle o le opzioni in modo che i dati siano preservati
        
        // Aggiorna i permalink
        flush_rewrite_rules();

        // Opzionale: rimuovi il ruolo personalizzato alla disattivazione
        // remove_role('risviel_gisdoc_user');
    }
}