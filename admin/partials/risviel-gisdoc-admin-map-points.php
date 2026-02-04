<?php
/**
 * Template per la pagina di gestione dei punti sulla mappa
 *
 * @since      1.0.0
 */


// Carica categorie per il form
require_once RISVIEL_GISDOC_PLUGIN_DIR . 'includes/class-risviel-gisdoc-categories-db.php';
$categories_db = new Risviel_GisDoc_Categories_DB();
$all_categories = $categories_db->get_categories();
$point_category_ids = array(); // default vuoto per nuovo punto

// Verifica se le tabelle sono state create
$tables_created = get_option('risviel_gisdoc_tables_created', 'no');

// Verifica se la connessione è configurata
$db_configured = false;
$db_name = get_option('risviel_gisdoc_pg_dbname', '');
$db_user = get_option('risviel_gisdoc_pg_user', '');

if (!empty($db_name) && !empty($db_user)) {
    $db_configured = true;
}
?>

<div class="wrap">
    <?php if ($tables_created !== 'yes' || !$db_configured): ?>
        <div class="notice notice-error">
            <p><?php _e('Per utilizzare questa funzionalità, è necessario configurare la connessione a PostgreSQL e creare le tabelle necessarie.', 'risviel-gisdoc'); ?></p>
            <p><a href="<?php echo admin_url('admin.php?page=' . $this->plugin_name . '-settings#database-settings'); ?>" class="button button-primary"><?php _e('Vai alle impostazioni', 'risviel-gisdoc'); ?></a></p>
        </div>
    <?php else: ?>
        <div class="risviel-gisdoc-map-points">
            <div class="risviel-layout">
                <div class="risviel-sidebar">
                    <div class="risviel-points-list-wrapper">
                        <div class="risviel-section-header">
                            <h2><?php _e('Punti sulla mappa', 'risviel-gisdoc'); ?></h2>
                            <button id="risviel-new-point" class="button button-primary"><?php _e('Nuovo punto', 'risviel-gisdoc'); ?></button>
                        </div>

                        <div class="risviel-search-box">
                            <input type="text" id="risviel-points-search" placeholder="<?php _e('Cerca punti...', 'risviel-gisdoc'); ?>" class="regular-text">
                            <div class="risviel-filter-options">
                                <label>
                                    <input type="checkbox" id="risviel-filter-visible" checked> 
                                    <?php _e('Solo punti visibili', 'risviel-gisdoc'); ?>
                                </label>
                                <label>
                                    <input type="checkbox" id="risviel-filter-with-panorama"> 
                                    <?php _e('Solo con panorama', 'risviel-gisdoc'); ?>
                                </label>
                            </div>
                        </div>

                        <ul id="risviel-points-list" class="risviel-list">
                            <li class="empty"><?php _e('Caricamento in corso...', 'risviel-gisdoc'); ?></li>
                        </ul>
                    </div>
                </div>

                <div class="risviel-main-content">
                    <div class="risviel-map-container">
                        <div id="risviel-admin-map"></div>
                        <div class="risviel-map-instructions">
                            <p><?php _e('Clicca sulla mappa per selezionare un punto o cerca un punto esistente nella lista a sinistra.', 'risviel-gisdoc'); ?></p>
                        </div>
                    </div>

                    <div class="risviel-form-container">
                        <h3><?php _e('Dettagli punto', 'risviel-gisdoc'); ?></h3>

                        <form id="risviel-point-form" method="post">
                            <input type="hidden" id="risviel-point-id" name="risviel-point-id" value="">

                            <div class="risviel-tabs">
                                <div class="risviel-tab-headers">
                                    <button type="button" class="risviel-tab-header active" data-tab="info"><?php _e('Informazioni', 'risviel-gisdoc'); ?></button>
                                    <button type="button" class="risviel-tab-header" data-tab="it"><?php _e('Italiano', 'risviel-gisdoc'); ?></button>
                                    <button type="button" class="risviel-tab-header" data-tab="en"><?php _e('Inglese', 'risviel-gisdoc'); ?></button>
                                    <button type="button" class="risviel-tab-header" data-tab="sa"><?php _e('Sardo', 'risviel-gisdoc'); ?></button>
                                </div>

                                <div class="risviel-tab-content active" data-tab="info">
                                    <table class="form-table">
                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-lat"><?php _e('Latitudine', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="text" id="risviel-point-lat" name="risviel-point-lat" class="regular-text" required>
                                            </td>
                                        </tr>

                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-lng"><?php _e('Longitudine', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="text" id="risviel-point-lng" name="risviel-point-lng" class="regular-text" required>
                                            </td>
                                        </tr>

                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-visible"><?php _e('Visibile sulla mappa', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="checkbox" id="risviel-point-visible" name="risviel-point-visible" value="1" checked>
                                                <span class="description"><?php _e('Se deselezionato, il punto non sarà visibile sulla mappa pubblica', 'risviel-gisdoc'); ?></span>
                                            </td>
                                        </tr>

                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-custom-icon"><?php _e('Icona personalizzata', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="text" id="risviel-point-custom-icon" name="risviel-point-custom-icon" class="regular-text">
                                                <button type="button" id="risviel-point-custom-icon-select" class="button"><?php _e('Seleziona immagine', 'risviel-gisdoc'); ?></button>
                                                <button type="button" id="risviel-point-custom-icon-remove" class="button"><?php _e('Rimuovi', 'risviel-gisdoc'); ?></button>
                                                <div id="risviel-point-custom-icon-preview" class="icon-preview"></div>
                                                <p class="description"><?php _e('Se non specificata, verrà utilizzata l\'icona predefinita', 'risviel-gisdoc'); ?></p>
                                            </td>
                                        </tr>





                                        <tr class="risviel-categories-row">
                                            <th scope="row">
                                                    <label><?php esc_html_e('Categorie', 'risviel-gisdoc'); ?></label>
                                                </th>
                                                <td>
                                                    <?php if (empty($all_categories)): ?>
                                                        <p class="description">
                                                            <?php
                                                            printf(
                                                                esc_html__('Nessuna categoria disponibile. %sCreane una%s.', 'risviel-gisdoc'),
                                                                '<a href="' . esc_url(admin_url('admin.php?page=risviel-gisdoc-categories')) . '">',
                                                                '</a>'
                                                            );
                                                            ?>
                                                        </p>
                                                    <?php else: ?>
                                                        <fieldset class="risviel-categories-fieldset">
                                                            <div class="risviel-categories-list" style="display: flex; flex-wrap: wrap; gap: 10px;">
                                                                <?php foreach ($all_categories as $cat):
                                                                    $is_selected = in_array($cat['id'], $point_category_ids);
                                                                ?>
                                                                    <label class="risviel-category-checkbox" style="
                                                                        display: flex;
                                                                        align-items: center;
                                                                        padding: 12px 16px;
                                                                        background: <?php echo $is_selected ? esc_attr($cat['color']) . '22' : '#f0f0f0'; ?>;
                                                                        border: 2px solid <?php echo esc_attr($cat['color']); ?>;
                                                                        border-radius: 8px;
                                                                        cursor: pointer;
                                                                        transition: all 0.2s ease;
                                                                        min-width: 120px;
                                                                        user-select: none;
                                                                    ">
                                                                        <input type="checkbox"
                                                                               name="point_categories[]"
                                                                               value="<?php echo esc_attr($cat['id']); ?>"
                                                                               <?php checked($is_selected); ?>
                                                                               style="width: 20px; height: 20px; margin-right: 10px; cursor: pointer;">
                                                                        <span style="
                                                                            width: 16px;
                                                                            height: 16px;
                                                                            border-radius: 50%;
                                                                            background-color: <?php echo esc_attr($cat['color']); ?>;
                                                                            margin-right: 8px;
                                                                            flex-shrink: 0;
                                                                        "></span>
                                                                        <span style="font-size: 14px; font-weight: 500;">
                                                                            <?php echo esc_html($cat['name']); ?>
                                                                        </span>
                                                                    </label>
                                                                <?php endforeach; ?>
                                                            </div>
                                                        </fieldset>
                                                        <p class="description" style="margin-top: 10px;">
                                                            <?php esc_html_e('Seleziona una o più categorie per questo punto.', 'risviel-gisdoc'); ?>
                                                        </p>
                                                    <?php endif; ?>
                                                </td>
                                        </tr>

                                        <style>
                                        .risviel-category-checkbox:hover {
                                            transform: translateY(-2px);
                                            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                                        }

                                        .risviel-category-checkbox:active {
                                            transform: translateY(0);
                                        }

                                        .risviel-category-checkbox input[type="checkbox"]:checked + .category-color + .category-name {
                                            font-weight: 600;
                                        }

                                        /* Touch-friendly adjustments */
                                        @media (pointer: coarse) {
                                            .risviel-category-checkbox {
                                                padding: 16px 20px !important;
                                                min-height: 48px;
                                            }

                                            .risviel-category-checkbox input[type="checkbox"] {
                                                width: 24px !important;
                                                height: 24px !important;
                                            }
                                        }
                                        </style>












                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-panorama-id"><?php _e('Panorama collegato', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <select id="risviel-point-panorama-id" name="risviel-point-panorama-id">
                                                    <option value=""><?php _e('Nessun panorama', 'risviel-gisdoc'); ?></option>
                                                </select>
                                                <div id="risviel-point-panorama-preview" class="panorama-preview" style="display: none;"></div>
                                            </td>
                                        </tr>
                                    </table>
                                </div>

                                <div class="risviel-tab-content" data-tab="it">
                                    <table class="form-table">
                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-title-it"><?php _e('Titolo (IT)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="text" id="risviel-point-title-it" name="risviel-point-title-it" class="regular-text" required>
                                            </td>
                                        </tr>

                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-description-it"><?php _e('Descrizione (IT)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <?php
                                                $editor_settings = array(
                                                    'textarea_name' => 'risviel-point-description-it',
                                                    'media_buttons' => true,
                                                    'textarea_rows' => 8,
                                                    'teeny' => false,
                                                    'tinymce' => array(
                                                        'toolbar1' => 'bold,italic,underline,link,unlink,bullist,numlist,blockquote,alignleft,aligncenter,alignright,undo,redo',
                                                        'toolbar2' => 'formatselect,forecolor,backcolor,pastetext,removeformat,charmap,outdent,indent,hr',
                                                        'setup' => 'function(editor) {
                                                            editor.on("init", function() {
                                                                console.log("TinyMCE editor " + editor.id + " initialized");
                                                            });
                                                        }'
                                                    ),
                                                    'quicktags' => true,
                                                    'wpautop' => true,
                                                    'drag_drop_upload' => true
                                                );
                                                wp_editor('', 'risviel-point-description-it', $editor_settings);
                                                ?>
                                            </td>
                                        </tr>

                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-audio-it"><?php _e('File Audio (IT)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="text" id="risviel-point-audio-it" name="risviel-point-audio-it" class="regular-text">
                                                <button type="button" id="risviel-point-audio-it-select" class="button"><?php _e('Seleziona audio', 'risviel-gisdoc'); ?></button>
                                                <button type="button" id="risviel-point-audio-it-remove" class="button"><?php _e('Rimuovi', 'risviel-gisdoc'); ?></button>
                                                <div id="risviel-point-audio-it-preview" class="audio-preview" style="display: none;"></div>
                                            </td>
                                        </tr>
                                    </table>
                                </div>

                                <div class="risviel-tab-content" data-tab="en">
                                    <table class="form-table">
                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-title-en"><?php _e('Titolo (EN)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="text" id="risviel-point-title-en" name="risviel-point-title-en" class="regular-text">
                                            </td>
                                        </tr>

                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-description-en"><?php _e('Descrizione (EN)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <?php
                                                $editor_settings['textarea_name'] = 'risviel-point-description-en';
                                                wp_editor('', 'risviel-point-description-en', $editor_settings);
                                                ?>
                                            </td>
                                        </tr>

                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-audio-en"><?php _e('File Audio (EN)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="text" id="risviel-point-audio-en" name="risviel-point-audio-en" class="regular-text">
                                                <button type="button" id="risviel-point-audio-en-select" class="button"><?php _e('Seleziona audio', 'risviel-gisdoc'); ?></button>
                                                <button type="button" id="risviel-point-audio-en-remove" class="button"><?php _e('Rimuovi', 'risviel-gisdoc'); ?></button>
                                                <div id="risviel-point-audio-en-preview" class="audio-preview" style="display: none;"></div>
                                            </td>
                                        </tr>
                                    </table>
                                </div>

                                <div class="risviel-tab-content" data-tab="sa">
                                    <table class="form-table">
                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-title-sa"><?php _e('Titolo (SA)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="text" id="risviel-point-title-sa" name="risviel-point-title-sa" class="regular-text">
                                            </td>
                                        </tr>

                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-description-sa"><?php _e('Descrizione (SA)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <?php
                                                $editor_settings['textarea_name'] = 'risviel-point-description-sa';
                                                wp_editor('', 'risviel-point-description-sa', $editor_settings);
                                                ?>
                                            </td>
                                        </tr>

                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-point-audio-sa"><?php _e('File Audio (SA)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="text" id="risviel-point-audio-sa" name="risviel-point-audio-sa" class="regular-text">
                                                <button type="button" id="risviel-point-audio-sa-select" class="button"><?php _e('Seleziona audio', 'risviel-gisdoc'); ?></button>
                                                <button type="button" id="risviel-point-audio-sa-remove" class="button"><?php _e('Rimuovi', 'risviel-gisdoc'); ?></button>
                                                <div id="risviel-point-audio-sa-preview" class="audio-preview" style="display: none;"></div>
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                            </div>

                            <div class="risviel-form-actions">
                                <button type="button" id="risviel-edit-point" class="button button-secondary" style="display: none;"><?php _e('Modifica', 'risviel-gisdoc'); ?></button>
                                <button type="button" id="risviel-cancel-edit" class="button button-secondary" style="display: none;"><?php _e('Annulla', 'risviel-gisdoc'); ?></button>
                                <button type="button" id="risviel-save-point" class="button button-primary"><?php _e('Salva punto', 'risviel-gisdoc'); ?></button>
                                <button type="button" id="risviel-delete-point" class="button button-link-delete" style="display: none;"><?php _e('Elimina punto', 'risviel-gisdoc'); ?></button>
                            </div>

                        </form>
                    </div>
                </div>
            </div>
        </div>

        <!-- CSS per migliorare l'interfaccia -->
        <style>
        .risviel-list li.selected {
            background-color: #e7f3ff;
            border-left: 4px solid #0073aa;
            font-weight: bold;
        }

        .risviel-filter-options {
            margin-top: 10px;
            padding: 10px;
            background: #f9f9f9;
            border: 1px solid #ddd;
        }

        .risviel-filter-options label {
            display: block;
            margin-bottom: 5px;
            cursor: pointer;
        }

        .risviel-filter-options input[type="checkbox"] {
            margin-right: 8px;
        }

        .panorama-preview {
            margin-top: 10px;
            max-width: 100%;
        }

        .icon-preview, .audio-preview {
            margin-top: 10px;
        }

        .risviel-layout {
            display: flex;
            gap: 20px;
        }

        .risviel-sidebar {
            width: 380px;
            flex-shrink: 0;
        }

        .risviel-main-content {
            flex: 1;
        }

        .risviel-map-container {
            height: 600px;
            margin-bottom: 20px;
            border: 1px solid #ddd;
        }

        #risviel-admin-map {
            height: 100%;
            width: 100%;
        }

        .risviel-points-list-wrapper {
            background: #fff;
            border: 1px solid #ddd;
            height: calc(100vh - 200px);
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .risviel-section-header {
            padding: 15px;
            border-bottom: 1px solid #ddd;
            background: #f9f9f9;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .risviel-section-header h2 {
            margin: 0;
            font-size: 16px;
        }

        .risviel-search-box {
            padding: 15px;
            border-bottom: 1px solid #ddd;
            background: #fff;
        }

        .risviel-list {
            flex: 1;
            overflow-y: auto;
            margin: 0;
            padding: 0;
            list-style: none;
        }

        .risviel-list li {
            padding: 12px 15px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .risviel-list li:hover {
            background-color: #f5f5f5;
        }

        .risviel-list li.empty {
            text-align: center;
            color: #666;
            font-style: italic;
            cursor: default;
        }

        .point-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .point-title {
            font-weight: 600;
            color: #333;
        }

        .point-coords {
            font-size: 11px;
            color: #666;
            font-family: monospace;
        }

        .risviel-tabs {
            background: #fff;
            border: 1px solid #ddd;
        }

        .risviel-tab-headers {
            display: flex;
            background: #f1f1f1;
            border-bottom: 1px solid #ddd;
        }

        .risviel-tab-header {
            padding: 12px 20px;
            border: none;
            background: transparent;
            cursor: pointer;
            border-right: 1px solid #ddd;
        }

        .risviel-tab-header.active {
            background: #fff;
            font-weight: bold;
        }

        .risviel-tab-content {
            display: none;
            padding: 20px;
        }

        .risviel-tab-content.active {
            display: block;
        }

        .risviel-form-actions {
            padding: 15px 20px;
            background: #f9f9f9;
            border-top: 1px solid #ddd;
            text-align: right;
        }

        .risviel-form-actions button {
            margin-left: 10px;
        }
        </style>

        <!-- JavaScript aggiuntivo per gestire i filtri e l'evidenziazione -->
        <script>
        jQuery(document).ready(function($) {
            // Gestione filtri
            $('#risviel-filter-visible, #risviel-filter-with-panorama').on('change', function() {
                if (typeof window.risvielMapFunctions !== 'undefined') {
                    window.risvielMapFunctions.applyFilters();
                }
            });

            // Assicurati che TinyMCE sia inizializzato correttamente
            if (typeof tinyMCE !== 'undefined') {
                tinyMCE.on('AddEditor', function(e) {
                    console.log('TinyMCE editor added:', e.editor.id);
                });
            }
        });
        </script>
    <?php endif; ?>
</div>