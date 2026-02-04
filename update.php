<?php

// https://github.com/YahnisElsts/plugin-update-checker/tree/master?tab=readme-ov-file#getting-started
define( 'RISVIEL_PLUGIN_UPDATE_URL', 'https://risviel.com/_update/wp/preview.php?slug=' . RISVIEL_PLUGIN_SLUG );

//require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
// Carica la libreria solo se non è già stata caricata da altri plugin
if (!class_exists('YahnisElsts\PluginUpdateChecker\v5\PucFactory')) {
    require_once(__DIR__ . '/vendor/plugin-update-checker/plugin-update-checker.php');
}

	use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

	$myUpdateChecker = PucFactory::buildUpdateChecker(
    RISVIEL_PLUGIN_UPDATE_URL,
    RISVIEL_GISDOC_PLUGIN_DIR . RISVIEL_PLUGIN_SLUG . '.php',
   // __FILE__, //Full path to the main plugin file or functions.php.
    RISVIEL_PLUGIN_SLUG
);
