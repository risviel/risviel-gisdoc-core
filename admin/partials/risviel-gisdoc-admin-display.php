<?php
/**
 * Template per la pagina principale di amministrazione
 *
 * @since      1.0.0
 */
require __DIR__ . '../../../config.php';
?>

<div class="wrap">
    <!--h1><?php echo esc_html(get_admin_page_title() ); ?></h1-->
    
    <div class="risviel-gisdoc-dashboard">
        <div class="risviel-gisdoc-welcome">
            <h1><?php _e('Benvenuto in GisDoc Core ' . RISVIEL_GISDOC_VERSION, RISVIEL_PLUGIN_SLUG); ?><sup> Community Edition </sup></h1>
            <a href="https://risviel.com" target="_blank">
                <img src="<?=RISVIEL_GISDOC_PLUGIN_URL?>assets/images/GISDOC_scritta_400.png">
            </a>
            <p><?php _e('GisDoc Core è un plugin per WordPress che ti permette di creare una mappa interattiva con punti di interesse e panorami 360°.', RISVIEL_PLUGIN_SLUG); ?></p>
        </div>

        
        <div class="risviel-gisdoc-status">
            <h3><?php _e('Stato del sistema', RISVIEL_PLUGIN_SLUG); ?></h3>
            
            <?php
            // Verifica se le tabelle sono state create
            $tables_created = get_option('risviel_gisdoc_tables_created', 'no');
            
            // Verifica se la connessione al database è configurata
            $db_configured = false;
            $db_name = get_option('risviel_gisdoc_pg_dbname', '');
            $db_user = get_option('risviel_gisdoc_pg_user', '');
            
            if (!empty($db_name) && !empty($db_user)) {
                $db_configured = true;
            }
            ?>
            
            <div class="risviel-status-item">
                <span class="status-label"><?php _e('Connessione PostgreSQL:', RISVIEL_PLUGIN_SLUG); ?></span>
                <?php if ($db_configured): ?>
                    <span class="status-value configured"><?php _e('Configurata', RISVIEL_PLUGIN_SLUG); ?></span>
                <?php else: ?>
                    <?php if (!$this->is_gisdoc_only_user()): ?>
                        <span class="status-value not-configured"><?php _e('Non configurata', RISVIEL_PLUGIN_SLUG); ?></span>
                        <a href="<?php echo admin_url('admin.php?page=' . $this->plugin_name . '-settings#database-settings'); ?>" class="button button-secondary"><?php _e('Configura', RISVIEL_PLUGIN_SLUG); ?></a>
                    <?php endif; ?>
                <?php endif; ?>
            </div>
            
            <div class="risviel-status-item">
                <span class="status-label"><?php _e('Tabelle database:', RISVIEL_PLUGIN_SLUG); ?></span>
                <?php if ($tables_created === 'yes'): ?>
                    <span class="status-value configured"><?php _e('Create', RISVIEL_PLUGIN_SLUG); ?></span>
                <?php else: ?>
                    <?php if (!$this->is_gisdoc_only_user()): ?>
                        <span class="status-value not-configured"><?php _e('Non create', RISVIEL_PLUGIN_SLUG); ?></span>
                        <a href="<?php echo admin_url('admin.php?page=' . $this->plugin_name . '-settings#database-settings'); ?>" class="button button-secondary"><?php _e('Crea ora', RISVIEL_PLUGIN_SLUG); ?></a>
                    <?php endif; ?>
                <?php endif; ?>
            </div>
        </div>
        
        <?php if ($tables_created === 'yes'): ?>
            <div class="risviel-gisdoc-quick-actions">
                <h3><?php _e('Azioni rapide', RISVIEL_PLUGIN_SLUG); ?></h3>
                <div class="risviel-action-buttons">
                    <a href="<?php echo admin_url('admin.php?page=' . $this->plugin_name . '-map-points'); ?>" class="button button-primary"><?php _e('Gestisci punti sulla mappa', RISVIEL_PLUGIN_SLUG); ?></a>
                    <a href="<?php echo admin_url('admin.php?page=' . $this->plugin_name . '-panoramas'); ?>" class="button button-primary"><?php _e('Gestisci panorami 360°', RISVIEL_PLUGIN_SLUG); ?></a>
                    <?php if (!$this->is_gisdoc_only_user()): ?>
                        <a href="<?php echo admin_url('admin.php?page=' . $this->plugin_name . '-settings'); ?>" class="button button-secondary"><?php _e('Impostazioni', RISVIEL_PLUGIN_SLUG); ?></a>
                    <?php endif; ?>
                </div>
            </div>
            
            <div class="risviel-gisdoc-shortcodes">
                <h3><?php _e('Shortcodes disponibili', RISVIEL_PLUGIN_SLUG); ?></h3>
                <table class="widefat">
                    <thead>
                        <tr>
                            <th><?php _e('Shortcode', RISVIEL_PLUGIN_SLUG); ?></th>
                            <th><?php _e('Descrizione', RISVIEL_PLUGIN_SLUG); ?></th>
                            <th><?php _e('Esempio', RISVIEL_PLUGIN_SLUG); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>[risviel_gisdoc_map]</code></td>
                            <td><?php _e('Visualizza la mappa interattiva con tutti i punti.', RISVIEL_PLUGIN_SLUG); ?></td>
                            <td><code>[risviel_gisdoc_map]</code></td>
                        </tr>
                        <tr>
                            <td><code>[risviel_map width="800px" height="500px" lang="it" for_totem="false"]</code></td>
                            <td><?php _e('Puoi anche personalizzare la mappa con parametri opzionali: <br/>- `width` è la larghezza del container della mappa (default: 100%)<br/>- `height` è l\'altezza del container della mappa (default: 600px)<br/>- `for_totem`, se impostato su true oppure omesso, fará in modo che le foto panoramiche vengano aperte con l\'impaginazione del Totem, altrimenti userá l\'impaginazione del sito' , RISVIEL_PLUGIN_SLUG); ?></td>
                            <td><code>[risviel_map width="800px" height="500px" lang="it" for_totem="false"]</code></td>
                        </tr>
                        <tr>
                            <td><code>[risviel_gisdoc_panorama]</code></td>
                            <td><?php _e('Visualizza un panorama specifico.', RISVIEL_PLUGIN_SLUG); ?></td>
                            <td><code>[risviel_gisdoc_panorama id="1"]</code></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        <?php else: ?>
            <div class="risviel-gisdoc-setup-notice">
                <h3><?php _e('Completare l\'installazione', RISVIEL_PLUGIN_SLUG); ?></h3>
                <p><?php _e('Per utilizzare tutte le funzionalità di GisDoc, è necessario configurare la connessione a PostgreSQL e creare le tabelle necessarie.', RISVIEL_PLUGIN_SLUG); ?></p>
                <a href="<?php echo admin_url('admin.php?page=' . $this->plugin_name . '-settings#database-settings'); ?>" class="button button-primary"><?php _e('Completa configurazione', RISVIEL_PLUGIN_SLUG); ?></a>
            </div>
        <?php endif; ?>
    </div>
</div>

<style>
.risviel-gisdoc-dashboard {
    margin-top: 20px;
}

.risviel-gisdoc-welcome {
    background: #fff;
    padding: 20px;
    border-radius: 4px;
    margin-bottom: 20px;
    box-shadow: 0 1px 1px rgba(0,0,0,0.04);
}

.risviel-gisdoc-status, 
.risviel-gisdoc-quick-actions,
.risviel-gisdoc-shortcodes,
.risviel-gisdoc-setup-notice {
    background: #fff;
    padding: 20px;
    border-radius: 4px;
    margin-bottom: 20px;
    box-shadow: 0 1px 1px rgba(0,0,0,0.04);
}

.risviel-status-item {
    margin-bottom: 10px;
    display: flex;
    align-items: center;
}

.status-label {
    font-weight: bold;
    margin-right: 10px;
    min-width: 180px;
}

.status-value {
    padding: 5px 10px;
    border-radius: 4px;
    margin-right: 10px;
}

.status-value.configured {
    background: #d1e7dd;
    color: #0f5132;
}

.status-value.not-configured {
    background: #f8d7da;
    color: #842029;
}

.risviel-action-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.risviel-gisdoc-shortcodes table {
    margin-top: 10px;
}

.risviel-gisdoc-setup-notice {
    border-left: 4px solid #dc3545;
}
</style>