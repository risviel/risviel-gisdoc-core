<?php

/**
 * Template per la pagina di gestione dei panorami
 *
 * @since      1.0.0
 */

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
    <!--h1><?php echo esc_html(get_admin_page_title()); ?></h1-->

    <?php if ($tables_created !== 'yes' || !$db_configured): ?>
        <div class="notice notice-error">
            <p><?php _e('Per utilizzare questa funzionalità, è necessario configurare la connessione a PostgreSQL e creare le tabelle necessarie.', 'risviel-gisdoc'); ?></p>
            <p><a href="<?php echo admin_url('admin.php?page=' . $this->plugin_name . '-settings#database-settings'); ?>" class="button button-primary"><?php _e('Vai alle impostazioni', 'risviel-gisdoc'); ?></a></p>
        </div>
    <?php else: ?>
        <div class="risviel-gisdoc-panoramas">
            <div class="risviel-layout">
                <div class="risviel-sidebar">
                    <div class="risviel-panoramas-list-wrapper">
                        <div class="risviel-section-header">
                            <h2><?php _e('Panorami', 'risviel-gisdoc'); ?></h2>
                            <button id="risviel-new-panorama" class="button button-primary"><?php _e('Nuovo panorama', 'risviel-gisdoc'); ?></button>
                        </div>

                        <div class="risviel-search-box">
                            <div class="risviel-select-container">
                                <select id="risviel-panorama-id-select" name="risviel-panorama-id-select">
                                    <option value=""><?php _e('Seleziona panorama...', 'risviel-gisdoc'); ?></option>
                                </select>
                                <!--button id="risviel-load-panorama" class="button button-secondary"><?php _e('Carica', 'risviel-gisdoc'); ?></button-->
                            </div>
                        </div>

                        <div class="risviel-panorama-details-wrapper">
                            <h3><?php _e('Dettagli panorama', 'risviel-gisdoc'); ?></h3>
                            <div id="risviel-panorama-details">
                                <p class="risviel-no-selection"><?php _e('Seleziona un panorama per visualizzare i dettagli', 'risviel-gisdoc'); ?></p>
                            </div>

                            <!-- Controlli per l'orientamento nord -->
                            <div id="risviel-north-orientation-controls" style="display: none;">
                                <h4><?php _e('Orientamento Nord', 'risviel-gisdoc'); ?></h4>
                                <div class="risviel-north-controls">
                                    <p class="description"><?php _e('Ruota il panorama per allineare la vista con il nord geografico, quindi clicca "Imposta Nord".', 'risviel-gisdoc'); ?></p>
                                    <button id="risviel-set-north-button" class="button button-primary" disabled>
                                        <span class="dashicons dashicons-location"></span>
                                        <?php _e('Imposta Nord', 'risviel-gisdoc'); ?>
                                    </button>
                                    <div id="risviel-current-rotation" class="risviel-rotation-info">
                                        <span><?php _e('Rotazione corrente:', 'risviel-gisdoc'); ?> <strong>0°</strong></span>
                                    </div>
                                    <div id="risviel-north-offset-info" class="risviel-north-info" style="display: block;">
                                        <span><?php _e('Offset nord:', 'risviel-gisdoc'); ?> <strong>0°</strong></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <div class="risviel-main-content">
                    <div class="risviel-panorama-viewer-container">
                        <div id="risviel-admin-panorama-viewer"></div>
                        <div class="risviel-panorama-instructions">
                            <p><?php _e('Seleziona un panorama dalla lista a sinistra per visualizzarlo e modificarlo.', 'risviel-gisdoc'); ?></p>
                        </div>
                    </div>

                    <body oncontextmenu="return false;">
                        <!-- Top Toolbar -->
                        <div id="idTopToolbar" class="atonToolbar atonToolbar-top-left scrollableX"></div>

                        <!-- Bottom Toolbar -->
                        <div id="idBottomToolbar" class="atonToolbar atonToolbar-bottom scrollableX"></div>
                        <div id="idBottomRToolbar" class="atonToolbar atonToolbar-bottom-right"></div>

                        <!-- Main Popup -->
                        <div id="idPopup" class="atonPopupContainer" style="display:none;"></div>

                        <!-- Loader -->
                        <div id="idLoader" class="atonCenterLoader" style="display:none;"></div>
                        <div id="idBGcover" class="atonBGcover" style="display:none;"></div>

                        <!-- Powered by -->
                        <div id='idPoweredBy' class="poweredBy" >
                            Powered by <a href="http://osiris.itabc.cnr.it/aton/" target="_blank">ATON</a>
                        </div>
                    </body>

                    <div class="risviel-form-container">
                        <h3><?php _e('Dettagli panorama', 'risviel-gisdoc'); ?></h3>

                        <form id="risviel-panorama-form" method="post">
                            <input type="hidden" id="risviel-panorama-id" name="risviel-panorama-id" value="">

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
                                                <label for="risviel-panorama-image-url"><?php _e('URL immagine 360°', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <div class="risviel-url-input-group">
                                                    <input type="text" id="risviel-panorama-image-url" name="risviel-panorama-image-url" class="regular-text" required>
                                                    <button type="button" id="risviel-select-image" class="button button-secondary"><?php _e('Seleziona', 'risviel-gisdoc'); ?></button>
                                                </div>
                                                <p class="description"><?php _e('URL dell\'immagine 360° (equirettangolare) da utilizzare per il panorama.', 'risviel-gisdoc'); ?></p>
                                            </td>
                                        </tr>
                                    </table>
                                </div>

                                <div class="risviel-tab-content" data-tab="it">
                                    <table class="form-table">
                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-panorama-title-it"><?php _e('Titolo (IT)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="text" id="risviel-panorama-title-it" name="risviel-panorama-title-it" class="regular-text" required>
                                            </td>
                                        </tr>

                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-panorama-description-it"><?php _e('Descrizione (IT)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                 <?php
                                                    wp_editor(
                                                        '', // Contenuto iniziale
                                                        'risviel-panorama-description-it', // ID del campo
                                                        array(
                                                            'textarea_name' => 'risviel-panorama-description-it',
                                                            'textarea_rows' => 6,
                                                            'media_buttons' => true,
                                                            'teeny' => false,
                                                            'tinymce' => array(
                                                                'toolbar1' => 'formatselect,bold,italic,underline,strikethrough,|,bullist,numlist,|,link,unlink,|,spellchecker,fullscreen,wp_adv',
                                                                'toolbar2' => 'styleselect,justifyleft,justifycenter,justifyright,justifyfull,|,forecolor,backcolor,|,pastetext,removeformat,charmap,|,outdent,indent,|,undo,redo',
                                                                'block_formats' => 'Paragraph=p;Heading 2=h2;Heading 3=h3;Heading 4=h4;Preformatted=pre'
                                                            ),
                                                            'quicktags' => array(
                                                                'buttons' => 'strong,em,ul,ol,li,link,close'
                                                            )
                                                        )
                                                    );
                                                ?>
                                            </td>
                                        </tr>
                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-panorama-audio-it"><?php _e('Audio (IT)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="url" id="risviel-panorama-audio-it" name="audio_url_it" placeholder="<?php _e('URL audio o usa il pulsante per caricare', 'risviel-gisdoc'); ?>">
                                                <button type="button" id="risviel-panorama-audio-it-select" class="button risviel-upload-audio" data-target="risviel-panorama-audio-it"><?php _e('Carica Audio', 'risviel-gisdoc'); ?></button>
                                                <button type="button" id="risviel-panorama-audio-it-remove" class="button"><?php _e('Rimuovi', 'risviel-gisdoc'); ?></button>
                                                <div id="risviel-panorama-audio-it-preview" class="audio-preview" style="display: none;"></div>
                                            </td>
                                        </tr>
                                    </table>
                                </div>

                                <div class="risviel-tab-content" data-tab="en">
                                    <table class="form-table">
                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-panorama-title-en"><?php _e('Titolo (EN)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="text" id="risviel-panorama-title-en" name="risviel-panorama-title-en" class="regular-text">
                                            </td>
                                        </tr>

                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-panorama-description-en"><?php _e('Descrizione (EN)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                 <?php
                                                    wp_editor(
                                                        '', // Contenuto iniziale
                                                        'risviel-panorama-description-en', // ID del campo
                                                        array(
                                                            'textarea_name' => 'risviel-panorama-description-en',
                                                            'textarea_rows' => 6,
                                                            'media_buttons' => true,
                                                            'teeny' => false,
                                                            'tinymce' => array(
                                                                'toolbar1' => 'formatselect,bold,italic,underline,strikethrough,|,bullist,numlist,|,link,unlink,|,spellchecker,fullscreen,wp_adv',
                                                                'toolbar2' => 'styleselect,justifyleft,justifycenter,justifyright,justifyfull,|,forecolor,backcolor,|,pastetext,removeformat,charmap,|,outdent,indent,|,undo,redo',
                                                                'block_formats' => 'Paragraph=p;Heading 2=h2;Heading 3=h3;Heading 4=h4;Preformatted=pre'
                                                            ),
                                                            'quicktags' => array(
                                                                'buttons' => 'strong,em,ul,ol,li,link,close'
                                                            )
                                                        )
                                                    );
                                                ?>
                                            </td>
                                        </tr>
                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-panorama-audio-en"><?php _e('Audio (EN)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="url" id="risviel-panorama-audio-en" name="audio_url_en" placeholder="<?php _e('URL audio o usa il pulsante per caricare', 'risviel-gisdoc'); ?>">
                                                <button type="button" id="risviel-panorama-audio-en-select" class="button risviel-upload-audio" data-target="risviel-panorama-audio-en"><?php _e('Carica Audio', 'risviel-gisdoc'); ?></button>
                                                <button type="button" id="risviel-panorama-audio-en-remove" class="button"><?php _e('Rimuovi', 'risviel-gisdoc'); ?></button>
                                                <div id="risviel-panorama-audio-en-preview" class="audio-preview" style="display: none;"></div>
                                            </td>
                                        </tr>
                                    </table>
                                </div>

                                <div class="risviel-tab-content" data-tab="sa">
                                    <table class="form-table">
                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-panorama-title-sa"><?php _e('Titolo (SA)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="text" id="risviel-panorama-title-sa" name="risviel-panorama-title-sa" class="regular-text">
                                            </td>
                                        </tr>

                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-panorama-description-sa"><?php _e('Descrizione (SA)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                 <?php
                                                    wp_editor(
                                                        '', // Contenuto iniziale
                                                        'risviel-panorama-description-sa', // ID del campo
                                                        array(
                                                            'textarea_name' => 'risviel-panorama-description-sa',
                                                            'textarea_rows' => 6,
                                                            'media_buttons' => true,
                                                            'teeny' => false,
                                                            'tinymce' => array(
                                                                'toolbar1' => 'formatselect,bold,italic,underline,strikethrough,|,bullist,numlist,|,link,unlink,|,spellchecker,fullscreen,wp_adv',
                                                                'toolbar2' => 'styleselect,justifyleft,justifycenter,justifyright,justifyfull,|,forecolor,backcolor,|,pastetext,removeformat,charmap,|,outdent,indent,|,undo,redo',
                                                                'block_formats' => 'Paragraph=p;Heading 2=h2;Heading 3=h3;Heading 4=h4;Preformatted=pre'
                                                            ),
                                                            'quicktags' => array(
                                                                'buttons' => 'strong,em,ul,ol,li,link,close'
                                                            )
                                                        )
                                                    );
                                                ?>
                                            </td>
                                        </tr>
                                        <tr>
                                            <th scope="row">
                                                <label for="risviel-panorama-audio-sa"><?php _e('Audio (SA)', 'risviel-gisdoc'); ?></label>
                                            </th>
                                            <td>
                                                <input type="url" id="risviel-panorama-audio-sa" name="audio_url_sa" placeholder="<?php _e('URL audio o usa il pulsante per caricare', 'risviel-gisdoc'); ?>">
                                                <button type="button" id="risviel-panorama-audio-sa-select" class="button risviel-upload-audio" data-target="risviel-panorama-audio-sa"><?php _e('Carica Audio', 'risviel-gisdoc'); ?></button>
                                                <button type="button" id="risviel-panorama-audio-sa-remove" class="button"><?php _e('Rimuovi', 'risviel-gisdoc'); ?></button>
                                                <div id="risviel-panorama-audio-sa-preview" class="audio-preview" style="display: none;"></div>
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                            </div>

                            <div class="risviel-form-actions">
                                <button type="submit" class="button button-primary"><?php _e('Salva panorama', 'risviel-gisdoc'); ?></button>
                                <button type="submit" class="button button-link-delete" id="risviel-delete-panorama" style="display: none;"><?php _e('Elimina panorama', 'risviel-gisdoc'); ?></button>
                                <button type="button" id="risviel-reset-panorama-form" class="button button-secondary"><?php _e('Annulla', 'risviel-gisdoc'); ?></button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>


    <?php endif; ?>
</div>



<style>
    .risviel-north-controls {
    padding: 15px;
    background: #f9f9f9;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin-top: 10px;
}

.risviel-north-controls .description {
    margin-bottom: 10px;
    font-style: italic;
    color: #666;
}

.risviel-rotation-info,
.risviel-north-info {
    margin-top: 10px;
    padding: 8px;
    background: #fff;
    border-left: 4px solid #0073aa;
    font-size: 13px;
}

.risviel-north-info {
    border-left-color: #46b450;
}

#risviel-set-north-button {
    margin-bottom: 10px;
}

#risviel-set-north-button .dashicons {
    vertical-align: middle;
    margin-right: 5px;
}
</style>