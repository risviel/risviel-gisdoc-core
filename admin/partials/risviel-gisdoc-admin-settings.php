
<?php
/**
 * Template per la pagina delle impostazioni
 *
 * @since      1.0.0
 */
?>

<div class="wrap">
    <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

    <div id="risviel-gisdoc-settings-tabs" class="nav-tab-wrapper">
        <a href="#general-settings" class="nav-tab nav-tab-active"><?php _e('Generali', 'risviel-gisdoc'); ?></a>
        <a href="#database-settings" class="nav-tab"><?php _e('Database', 'risviel-gisdoc'); ?></a>
    </div>

    <form method="post" action="options.php" id="risviel-gisdoc-settings-form">
        <?php
        settings_fields($this->plugin_name);
        ?>

        <div id="general-settings" class="tab-content active">
            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="risviel_gisdoc_default_language"><?php _e('Lingua predefinita', 'risviel-gisdoc'); ?></label>
                    </th>
                    <td>
                        <select name="risviel_gisdoc_default_language" id="risviel_gisdoc_default_language">
                            <option value="it" <?php selected(get_option('risviel_gisdoc_default_language'), 'it'); ?>><?php _e('Italiano', 'risviel-gisdoc'); ?></option>
                            <option value="en" <?php selected(get_option('risviel_gisdoc_default_language'), 'en'); ?>><?php _e('Inglese', 'risviel-gisdoc'); ?></option>
                            <option value="sa" <?php selected(get_option('risviel_gisdoc_default_language'), 'sa'); ?>><?php _e('Sardo', 'risviel-gisdoc'); ?></option>
                        </select>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label><?php _e('Posizione predefinita della mappa', 'risviel-gisdoc'); ?></label>
                    </th>
                    <td>
                        <div id="settings-map-container" style="width: 100%; height: 400px; margin-bottom: 15px;"></div>

                        <p class="description"><?php _e('Sposta la mappa e usa lo zoom per impostare la posizione predefinita. I valori nei campi sotto verranno aggiornati automaticamente.', 'risviel-gisdoc'); ?></p>

                        <input type="hidden" name="risviel_gisdoc_map_center_lat" id="risviel_gisdoc_map_center_lat" value="<?php echo esc_attr(get_option('risviel_gisdoc_map_center_lat')); ?>" />
                        <input type="hidden" name="risviel_gisdoc_map_center_lng" id="risviel_gisdoc_map_center_lng" value="<?php echo esc_attr(get_option('risviel_gisdoc_map_center_lng')); ?>" />
                        <input type="hidden" name="risviel_gisdoc_map_zoom" id="risviel_gisdoc_map_zoom" value="<?php echo esc_attr(get_option('risviel_gisdoc_map_zoom')); ?>" />

                        <div class="map-coordinates-display">
                            <div class="map-coordinate">
                                <label><?php _e('Latitudine:', 'risviel-gisdoc'); ?></label>
                                <span id="display_lat"><?php echo esc_html(get_option('risviel_gisdoc_map_center_lat')); ?></span>
                            </div>
                            <div class="map-coordinate">
                                <label><?php _e('Longitudine:', 'risviel-gisdoc'); ?></label>
                                <span id="display_lng"><?php echo esc_html(get_option('risviel_gisdoc_map_center_lng')); ?></span>
                            </div>
                            <div class="map-coordinate">
                                <label><?php _e('Zoom:', 'risviel-gisdoc'); ?></label>
                                <span id="display_zoom"><?php echo esc_html(get_option('risviel_gisdoc_map_zoom')); ?></span>
                            </div>
                        </div>
                    </td>
                </tr>
            </table>
        </div>

        <div id="database-settings" class="tab-content">
            <h2><?php _e('Impostazioni connessione PostgreSQL/PostGIS', 'risviel-gisdoc'); ?></h2>

            <div id="db-connection-form">
                <table class="form-table">
                    <tr>
                        <th scope="row">
                            <label for="risviel_gisdoc_pg_host"><?php _e('Host', 'risviel-gisdoc'); ?></label>
                        </th>
                        <td>
                            <input type="text" name="risviel_gisdoc_pg_host" id="risviel_gisdoc_pg_host" value="<?php echo esc_attr(get_option('risviel_gisdoc_pg_host')); ?>" class="regular-text" />
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="risviel_gisdoc_pg_port"><?php _e('Porta', 'risviel-gisdoc'); ?></label>
                        </th>
                        <td>
                            <input type="text" name="risviel_gisdoc_pg_port" id="risviel_gisdoc_pg_port" value="<?php echo esc_attr(get_option('risviel_gisdoc_pg_port')); ?>" class="regular-text" />
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="risviel_gisdoc_pg_dbname"><?php _e('Nome database', 'risviel-gisdoc'); ?></label>
                        </th>
                        <td>
                            <input type="text" name="risviel_gisdoc_pg_dbname" id="risviel_gisdoc_pg_dbname" value="<?php echo esc_attr(get_option('risviel_gisdoc_pg_dbname')); ?>" class="regular-text" />
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="risviel_gisdoc_pg_user"><?php _e('Utente', 'risviel-gisdoc'); ?></label>
                        </th>
                        <td>
                            <input type="text" name="risviel_gisdoc_pg_user" id="risviel_gisdoc_pg_user" value="<?php echo esc_attr(get_option('risviel_gisdoc_pg_user')); ?>" class="regular-text" />
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="risviel_gisdoc_pg_password"><?php _e('Password', 'risviel-gisdoc'); ?></label>
                        </th>
                        <td>
                            <input type="password" name="risviel_gisdoc_pg_password" id="risviel_gisdoc_pg_password" value="<?php echo esc_attr(get_option('risviel_gisdoc_pg_password')); ?>" class="regular-text" />
                        </td>
                    </tr>
                </table>

                <p>
                    <button id="risviel-test-connection" class="button button-secondary"><?php _e('Testa connessione', 'risviel-gisdoc'); ?></button>
                    <span id="connection-result" style="margin-left: 10px;"></span>
                </p>

                <?php
                // Verifica se le tabelle sono già state create
                $tables_created = get_option('risviel_gisdoc_tables_created', 'no');

                if ($tables_created === 'no') :
                ?>
                <div id="create-tables-section" style="display: none;">
                    <hr />
                    <h3><?php _e('Creazione tabelle', 'risviel-gisdoc'); ?></h3>
                    <p><?php _e('La connessione al database è stata stabilita con successo. Ora è possibile creare le tabelle necessarie per il funzionamento del plugin.', 'risviel-gisdoc'); ?></p>
                    <p>
                        <button id="risviel-create-tables" class="button button-primary"><?php _e('Crea tabelle', 'risviel-gisdoc'); ?></button>
                        <span id="tables-result" style="margin-left: 10px;"></span>
                    </p>
                </div>
                <?php else : ?>
                <div id="tables-created-message">
                    <hr />
                    <h3><?php _e('Tabelle', 'risviel-gisdoc'); ?></h3>
                    <p><?php _e('Le tabelle necessarie per il funzionamento del plugin sono già state create.', 'risviel-gisdoc'); ?></p>
                </div>
                <?php endif; ?>
            </div>
        </div>

        <div class="submit-wrapper" style="padding: 20px 0;">
            <?php submit_button(__('Salva impostazioni', 'risviel-gisdoc')); ?>
        </div>
    </form>
</div>

<script type="text/javascript">
jQuery(document).ready(function($) {
    // Gestione delle tab
    $('.nav-tab').on('click', function(e) {
        e.preventDefault();

        // Rimuovi la classe active da tutte le tab e contenuti
        $('.nav-tab').removeClass('nav-tab-active');
        $('.tab-content').removeClass('active');

        // Aggiungi la classe active alla tab cliccata
        $(this).addClass('nav-tab-active');

        // Mostra il contenuto corrispondente
        $($(this).attr('href')).addClass('active');

        // Se abbiamo appena attivato la tab con la mappa, assicuriamoci che venga ridisegnata correttamente
        if ($(this).attr('href') === '#general-settings' && settingsMap) {
            settingsMap.invalidateSize();
        }
    });

    // Inizializza la mappa per le impostazioni
    let settingsMap = null;
    let centerMarker = null;

    function initSettingsMap() {
        // Ottieni le coordinate salvate
        const lat = parseFloat($('#risviel_gisdoc_map_center_lat').val()) || 40.29;
        const lng = parseFloat($('#risviel_gisdoc_map_center_lng').val()) || 9.61;
        const zoom = parseInt($('#risviel_gisdoc_map_zoom').val()) || 13;

        // Inizializza la mappa
        settingsMap = L.map('settings-map-container').setView([lat, lng], zoom);

        // Aggiungi OpenStreetMap come layer di base
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(settingsMap);

        // Aggiungi un marker al centro della mappa
        centerMarker = L.marker([lat, lng], {
            draggable: true,
            title: 'Centro mappa'
        }).addTo(settingsMap);

        // Aggiorna i campi quando il marker viene trascinato
        centerMarker.on('dragend', function(event) {
            const position = centerMarker.getLatLng();
            updateMapCoordinates(position.lat, position.lng, settingsMap.getZoom());
        });

        // Aggiorna i campi quando la mappa viene spostata
        settingsMap.on('moveend', function() {
            const center = settingsMap.getCenter();
            centerMarker.setLatLng(center);
            updateMapCoordinates(center.lat, center.lng, settingsMap.getZoom());
        });

        // Aggiorna i campi quando lo zoom cambia
        settingsMap.on('zoomend', function() {
            const center = settingsMap.getCenter();
            updateMapCoordinates(center.lat, center.lng, settingsMap.getZoom());
        });
    }

    // Funzione per aggiornare i campi delle coordinate
    function updateMapCoordinates(lat, lng, zoom) {
        // Aggiorna i campi nascosti
        $('#risviel_gisdoc_map_center_lat').val(lat.toFixed(6));
        $('#risviel_gisdoc_map_center_lng').val(lng.toFixed(6));
        $('#risviel_gisdoc_map_zoom').val(zoom);

        // Aggiorna anche i valori visualizzati
        $('#display_lat').text(lat.toFixed(6));
        $('#display_lng').text(lng.toFixed(6));
        $('#display_zoom').text(zoom);
    }

    // Inizializza la mappa
    if ($('#settings-map-container').length) {
        initSettingsMap();
    }

    // Test della connessione
    $('#risviel-test-connection').on('click', function(e) {
        e.preventDefault();

        var connectionData = {
            action: 'risviel_gisdoc_test_connection',
            nonce: risviel_gisdoc_admin.nonce,
            host: $('#risviel_gisdoc_pg_host').val(),
            port: $('#risviel_gisdoc_pg_port').val(),
            dbname: $('#risviel_gisdoc_pg_dbname').val(),
            user: $('#risviel_gisdoc_pg_user').val(),
            password: $('#risviel_gisdoc_pg_password').val()
        };

        $('#connection-result').html('<?php _e('Verifica in corso...', 'risviel-gisdoc'); ?>');

        $.post(risviel_gisdoc_admin.ajax_url, connectionData, function(response) {
            if (response.success) {
                $('#connection-result').html('<span style="color: green;">' + response.data.message + '</span>');
                $('#create-tables-section').show();
            } else {
                $('#connection-result').html('<span style="color: red;">' + response.data.message + '</span>');
                $('#create-tables-section').hide();
            }
        });
    });

    // Creazione delle tabelle
    $('#risviel-create-tables').on('click', function(e) {
        e.preventDefault();

        var data = {
            action: 'risviel_gisdoc_create_tables',
            nonce: risviel_gisdoc_admin.nonce
        };

        $('#tables-result').html('<?php _e('Creazione in corso...', 'risviel-gisdoc'); ?>');

        $.post(risviel_gisdoc_admin.ajax_url, data, function(response) {
            if (response.success) {
                $('#tables-result').html('<span style="color: green;">' + response.data.message + '</span>');
                setTimeout(function() {
                    location.reload();
                }, 2000);
            } else {
                $('#tables-result').html('<span style="color: red;">' + response.data.message + '</span>');
            }
        });
    });
});
</script>

<style>
.tab-content {
    display: none;
    padding: 20px 0;
}
.tab-content.active {
    display: block;
}
.map-coordinates-display {
    margin-top: 10px;
    background: #f9f9f9;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    display: flex;
    flex-wrap: wrap;
}
.map-coordinate {
    margin-right: 20px;
    margin-bottom: 5px;
}
.map-coordinate label {
    font-weight: bold;
    margin-right: 5px;
}
.submit-wrapper {
    clear: both;
}
</style>