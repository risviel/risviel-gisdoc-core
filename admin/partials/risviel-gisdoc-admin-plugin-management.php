<?php
/**
 * Template per la pagina di gestione plugin.
 *
 * @since      1.0.0
 */

// URL della pagina esterna con parametri
?>
<div class="wrap">
    <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

    <div class="notice notice-info" style="margin-top: 20px;">
        <p>
            <strong><?php _e('Gestione Plugin Esterna', 'risviel-gisdoc'); ?></strong><br>
            <?php _e('La gestione del plugin avviene su una piattaforma esterna sicura.', 'risviel-gisdoc'); ?>
        </p>
    </div>

    <div class="risviel-external-management" style="text-align: center; margin-top: 40px; padding: 40px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 8px;">
        <h2><?php _e('Accedi alla Gestione Plugin', 'risviel-gisdoc'); ?></h2>
        <p style="margin-bottom: 30px;">
            <?php _e('Clicca sul pulsante per accedere al pannello di gestione del plugin.', 'risviel-gisdoc'); ?>
        </p>

        <a href="<?php echo esc_url($external_url); ?>"
           target="_blank"
           class="button button-primary button-hero">
            <?php _e('Apri Gestione Plugin', 'risviel-gisdoc'); ?>
            <span class="dashicons dashicons-external" style="margin-left: 8px; vertical-align: middle;"></span>
        </a>

        <div style="margin-top: 20px; font-size: 12px; color: #666;">
            <?php _e('Si aprirà in una nuova finestra', 'risviel-gisdoc'); ?>
        </div>
    </div>

    <div style="margin-top: 30px;">
        <h3><?php _e('Informazioni sulla Gestione', 'risviel-gisdoc'); ?></h3>
        <p><?php _e('Attraverso il pannello di gestione esterno potrai:', 'risviel-gisdoc'); ?></p>
        <ul style="list-style-type: disc; margin-left: 20px;">
            <li><?php _e('Verificare aggiornamenti disponibili', 'risviel-gisdoc'); ?></li>
            <li><?php _e('Accedere al supporto tecnico', 'risviel-gisdoc'); ?></li>
            <li><?php _e('Gestire la licenza del plugin', 'risviel-gisdoc'); ?></li>
            <li><?php _e('Visualizzare documentazione e guide', 'risviel-gisdoc'); ?></li>
        </ul>
    </div>
</div>

<style>
.risviel-external-management .dashicons {
    font-size: 18px;
    width: 18px;
    height: 18px;
}
</style>