<?php

/**
 * Risviel GisDoc Core
 *
 * @package           Risviel GisDoc Core
 * @author            Antonio Sanna
 * @copyright         2025 Antonio Sanna
 * @license           MIT
 *
 * @wordpress-plugin
 * Plugin Name:       Risviel GisDoc Core
 * Plugin URI:        https://www.risviel.com/
 * Description:       Risviel GisDoc Core &egrave; un plugin WordPress che permette di gestire punti di interesse su mappe interattive e visualizzare panorami a 360.
 * Version:           1.0.0
 * Requires at least: 6.7
 * Requires PHP:      7.2
 * Author:            Antonio Sanna
 * Author URI:        https://www.risviel.com/
 * License:           MIT
 * License URI:       https://opensource.org/license/mit
 * Update URI:        https://www.risviel.com/_update/wp/uploads/risviel-gisdoc-core/risviel-gisdoc-core
 * Text Domain:       risviel-gisdoc-core
 * Domain Path:       /languages
 */

// Se questo file viene chiamato direttamente, interrompi.
if (!defined('WPINC')) {
    die;
}
require __DIR__ . '/config.php';
require __DIR__ . '/update.php';


/**
 * Codice eseguito durante l'attivazione del plugin.
 */
function activate_risviel_gisdoc() {
    require_once plugin_dir_path(__FILE__) . 'includes/class-risviel-gisdoc-activator.php';
    Risviel_GisDoc_Activator::activate();
}

/**
 * Codice eseguito durante la disattivazione del plugin.
 */
function deactivate_risviel_gisdoc() {
    require_once plugin_dir_path(__FILE__) . 'includes/class-risviel-gisdoc-deactivator.php';
    Risviel_GisDoc_Deactivator::deactivate();
}

register_activation_hook(__FILE__, 'activate_risviel_gisdoc');
register_deactivation_hook(__FILE__, 'deactivate_risviel_gisdoc');

/**
 * Carica la classe principale del plugin
 */
require plugin_dir_path(__FILE__) . 'includes/class-risviel-gisdoc.php';

/**
 * Inizia l'esecuzione del plugin.
 */
function run_risviel_gisdoc() {
    $plugin = new Risviel_GisDoc();
    $plugin->run();
}

// Esegui con priorità 20 per permettere alle extension di registrare filtri prima
add_action('plugins_loaded', 'run_risviel_gisdoc', 20);