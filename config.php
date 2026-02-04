<?php

/**
 * Versione corrente del plugin.
 */
if (!defined('RISVIEL_GISDOC_VERSION')) {
    define('RISVIEL_GISDOC_VERSION', '1.0.0');
}

if (!defined('RISVIEL_GISDOC_PLUGIN_DIR')){
    define('RISVIEL_GISDOC_PLUGIN_DIR', plugin_dir_path(__FILE__));
}

if (!defined('RISVIEL_GISDOC_PLUGIN_URL')) {
    define('RISVIEL_GISDOC_PLUGIN_URL', plugin_dir_url(__FILE__));
}

if (!defined('RISVIEL_PLUGIN_SLUG')) {
    define('RISVIEL_PLUGIN_SLUG', 'risviel-gisdoc-core');
}
