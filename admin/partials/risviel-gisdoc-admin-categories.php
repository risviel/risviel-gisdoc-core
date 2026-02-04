<?php
// File: admin/partials/risviel-gisdoc-admin-categories.php

/**
 * Vista admin per la gestione delle categorie
 */

// Verifica permessi
if (!current_user_can('manage_options')) {
    wp_die(__('Non hai i permessi per accedere a questa pagina.', RISVIEL_PLUGIN_SLUG));
}

// Carica la classe categorie
require_once RISVIEL_GISDOC_PLUGIN_DIR . 'includes/class-risviel-gisdoc-categories-db.php';
$categories_db = new Risviel_GisDoc_Categories_DB();

// Gestione azioni
$action = isset($_GET['action']) ? sanitize_text_field($_GET['action']) : 'list';
$message = '';
$error = '';

// Gestione form submit
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['risviel_category_nonce'])) {
    if (!wp_verify_nonce($_POST['risviel_category_nonce'], 'risviel_category_action')) {
        wp_die(__('Nonce non valido', RISVIEL_PLUGIN_SLUG));
    }

    $form_action = sanitize_text_field($_POST['form_action'] ?? '');

    $data = array(
        'name'        => sanitize_text_field($_POST['category_name'] ?? ''),
        'slug'        => sanitize_title($_POST['category_slug'] ?? ''),
        'description' => sanitize_textarea_field($_POST['category_description'] ?? ''),
        'color'       => sanitize_hex_color($_POST['category_color'] ?? '#3388ff'),
        'icon'        => esc_url_raw($_POST['category_icon'] ?? ''),
        'sort_order'  => intval($_POST['category_sort_order'] ?? 0),
    );

    if ($form_action === 'create') {
        if ($categories_db->create_category($data)) {
            $message = __('Categoria creata con successo!', RISVIEL_PLUGIN_SLUG);
            $action = 'list';
        } else {
            $error = __('Errore durante la creazione della categoria.', RISVIEL_PLUGIN_SLUG);
        }
    } elseif ($form_action === 'update') {
        $id = intval($_POST['category_id']);
        if ($categories_db->update_category($id, $data)) {
            $message = __('Categoria aggiornata con successo!', RISVIEL_PLUGIN_SLUG);
            $action = 'list';
        } else {
            $error = __('Errore durante l\'aggiornamento della categoria.', RISVIEL_PLUGIN_SLUG);
        }
    }
}

// Gestione eliminazione
if ($action === 'delete' && isset($_GET['id'])) {
    if (!wp_verify_nonce($_GET['_wpnonce'] ?? '', 'delete_category_' . $_GET['id'])) {
        wp_die(__('Nonce non valido', RISVIEL_PLUGIN_SLUG));
    }

    if ($categories_db->delete_category(intval($_GET['id']))) {
        $message = __('Categoria eliminata con successo!', RISVIEL_PLUGIN_SLUG);
    } else {
        $error = __('Errore durante l\'eliminazione della categoria.', RISVIEL_PLUGIN_SLUG);
    }
    $action = 'list';
}

// Carica categoria per modifica
$edit_category = null;
if ($action === 'edit' && isset($_GET['id'])) {
    $edit_category = $categories_db->get_category(intval($_GET['id']));
}

$categories = $categories_db->get_categories();
?>

<div class="wrap risviel-gisdoc-categories">
    <h1 class="wp-heading-inline">
        <?php esc_html_e('Categorie Punti Mappa', RISVIEL_PLUGIN_SLUG); ?>
    </h1>

    <?php if ($action === 'list'): ?>
        <a href="<?php echo esc_url(add_query_arg('action', 'new')); ?>" class="page-title-action">
            <?php esc_html_e('Aggiungi Nuova', RISVIEL_PLUGIN_SLUG); ?>
        </a>
    <?php endif; ?>

    <hr class="wp-header-end">

    <?php if ($message): ?>
        <div class="notice notice-success is-dismissible">
            <p><?php echo esc_html($message); ?></p>
        </div>
    <?php endif; ?>

    <?php if ($error): ?>
        <div class="notice notice-error is-dismissible">
            <p><?php echo esc_html($error); ?></p>
        </div>
    <?php endif; ?>

    <?php if ($action === 'list'): ?>
        <!-- Lista Categorie -->
        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th scope="col" class="column-color" style="width: 50px;"><?php esc_html_e('Colore', RISVIEL_PLUGIN_SLUG); ?></th>
                    <th scope="col" class="column-name"><?php esc_html_e('Nome', RISVIEL_PLUGIN_SLUG); ?></th>
                    <th scope="col" class="column-slug"><?php esc_html_e('Slug', RISVIEL_PLUGIN_SLUG); ?></th>
                    <th scope="col" class="column-description"><?php esc_html_e('Descrizione', RISVIEL_PLUGIN_SLUG); ?></th>
                    <th scope="col" class="column-order" style="width: 80px;"><?php esc_html_e('Ordine', RISVIEL_PLUGIN_SLUG); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($categories)): ?>
                    <tr>
                        <td colspan="5"><?php esc_html_e('Nessuna categoria trovata.', RISVIEL_PLUGIN_SLUG); ?></td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($categories as $cat): ?>
                        <tr>
                            <td>
                                <span class="category-color-preview" style="display: inline-block; width: 30px; height: 30px; border-radius: 50%; background-color: <?php echo esc_attr($cat['color']); ?>; border: 2px solid #ddd;"></span>
                            </td>
                            <td>
                                <strong>
                                    <a href="<?php echo esc_url(add_query_arg(array('action' => 'edit', 'id' => $cat['id']))); ?>">
                                        <?php echo esc_html($cat['name']); ?>
                                    </a>
                                </strong>
                                <div class="row-actions">
                                    <span class="edit">
                                        <a href="<?php echo esc_url(add_query_arg(array('action' => 'edit', 'id' => $cat['id']))); ?>">
                                            <?php esc_html_e('Modifica', RISVIEL_PLUGIN_SLUG); ?>
                                        </a> |
                                    </span>
                                    <span class="delete">
                                        <a href="<?php echo esc_url(wp_nonce_url(add_query_arg(array('action' => 'delete', 'id' => $cat['id'])), 'delete_category_' . $cat['id'])); ?>"
                                           class="submitdelete"
                                           onclick="return confirm('<?php esc_attr_e('Sei sicuro di voler eliminare questa categoria?', RISVIEL_PLUGIN_SLUG); ?>');">
                                            <?php esc_html_e('Elimina', RISVIEL_PLUGIN_SLUG); ?>
                                        </a>
                                    </span>
                                </div>
                            </td>
                            <td><?php echo esc_html($cat['slug']); ?></td>
                            <td><?php echo esc_html(wp_trim_words($cat['description'], 10)); ?></td>
                            <td><?php echo esc_html($cat['sort_order']); ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>

    <?php elseif ($action === 'new' || $action === 'edit'): ?>
        <!-- Form Categoria -->
        <form method="post" class="risviel-category-form">
            <?php wp_nonce_field('risviel_category_action', 'risviel_category_nonce'); ?>
            <input type="hidden" name="form_action" value="<?php echo $edit_category ? 'update' : 'create'; ?>">
            <?php if ($edit_category): ?>
                <input type="hidden" name="category_id" value="<?php echo esc_attr($edit_category['id']); ?>">
            <?php endif; ?>

            <table class="form-table">
                <tr>
                    <th scope="row">
                        <label for="category_name"><?php esc_html_e('Nome', RISVIEL_PLUGIN_SLUG); ?> <span class="required">*</span></label>
                    </th>
                    <td>
                        <input type="text"
                               id="category_name"
                               name="category_name"
                               class="regular-text"
                               value="<?php echo esc_attr($edit_category['name'] ?? ''); ?>"
                               required
                               style="min-height: 44px; font-size: 16px;">
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="category_slug"><?php esc_html_e('Slug', RISVIEL_PLUGIN_SLUG); ?></label>
                    </th>
                    <td>
                        <input type="text"
                               id="category_slug"
                               name="category_slug"
                               class="regular-text"
                               value="<?php echo esc_attr($edit_category['slug'] ?? ''); ?>"
                               style="min-height: 44px; font-size: 16px;">
                        <p class="description"><?php esc_html_e('Lascia vuoto per generare automaticamente dal nome.', RISVIEL_PLUGIN_SLUG); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="category_description"><?php esc_html_e('Descrizione', RISVIEL_PLUGIN_SLUG); ?></label>
                    </th>
                    <td>
                        <textarea id="category_description"
                                  name="category_description"
                                  rows="4"
                                  class="large-text"
                                  style="font-size: 16px;"><?php echo esc_textarea($edit_category['description'] ?? ''); ?></textarea>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="category_color"><?php esc_html_e('Colore', RISVIEL_PLUGIN_SLUG); ?></label>
                    </th>
                    <td>
                        <input type="color"
                               id="category_color"
                               name="category_color"
                               value="<?php echo esc_attr($edit_category['color'] ?? '#3388ff'); ?>"
                               style="width: 60px; height: 44px; padding: 0; border: none; cursor: pointer;">
                        <span class="description" style="margin-left: 10px;"><?php esc_html_e('Colore del marker sulla mappa', RISVIEL_PLUGIN_SLUG); ?></span>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="category_icon"><?php esc_html_e('Icona', RISVIEL_PLUGIN_SLUG); ?></label>
                    </th>
                    <td>
                        <input type="url"
                               id="category_icon"
                               name="category_icon"
                               class="regular-text"
                               value="<?php echo esc_url($edit_category['icon'] ?? ''); ?>"
                               style="min-height: 44px; font-size: 16px;">
                        <button type="button" class="button risviel-media-upload" data-target="category_icon" style="min-height: 44px;">
                            <?php esc_html_e('Seleziona Icona', RISVIEL_PLUGIN_SLUG); ?>
                        </button>
                        <p class="description"><?php esc_html_e('URL dell\'icona personalizzata (opzionale)', RISVIEL_PLUGIN_SLUG); ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="category_sort_order"><?php esc_html_e('Ordine', RISVIEL_PLUGIN_SLUG); ?></label>
                    </th>
                    <td>
                        <input type="number"
                               id="category_sort_order"
                               name="category_sort_order"
                               class="small-text"
                               value="<?php echo esc_attr($edit_category['sort_order'] ?? 0); ?>"
                               min="0"
                               style="min-height: 44px; font-size: 16px; width: 80px;">
                    </td>
                </tr>
            </table>

            <p class="submit">
                <button type="submit" class="button button-primary button-large" style="min-height: 48px; padding: 0 24px; font-size: 16px;">
                    <?php echo $edit_category ? esc_html__('Aggiorna Categoria', RISVIEL_PLUGIN_SLUG) : esc_html__('Crea Categoria', RISVIEL_PLUGIN_SLUG); ?>
                </button>
                <a href="<?php echo esc_url(remove_query_arg(array('action', 'id'))); ?>" class="button button-large" style="min-height: 48px; padding: 0 24px; font-size: 16px;">
                    <?php esc_html_e('Annulla', RISVIEL_PLUGIN_SLUG); ?>
                </a>
            </p>
        </form>
    <?php endif; ?>
    <script>
jQuery(document).ready(function($) {
    // Media Uploader per selezionare icona
    $('.risviel-media-upload').on('click', function(e) {
        e.preventDefault();

        var button = $(this);
        var targetInput = $('#' + button.data('target'));

        // Crea il frame del media uploader
        var mediaUploader = wp.media({
            title: '<?php esc_html_e("Seleziona Icona", "risviel-gisdoc"); ?>',
            button: {
                text: '<?php esc_html_e("Usa questa immagine", "risviel-gisdoc"); ?>'
            },
            multiple: false,
            library: {
                type: 'image'
            }
        });

        // Quando un'immagine viene selezionata
        mediaUploader.on('select', function() {
            var attachment = mediaUploader.state().get('selection').first().toJSON();
            targetInput.val(attachment.url);

            // Mostra anteprima se non esiste
            var preview = button.siblings('.risviel-icon-preview');
            if (preview.length === 0) {
                preview = $('<img class="risviel-icon-preview" style="max-width: 50px; max-height: 50px; margin-left: 10px; vertical-align: middle;">');
                button.after(preview);
            }
            preview.attr('src', attachment.url);
        });

        mediaUploader.open();
    });

    // Mostra anteprima esistente
    var iconInput = $('#category_icon');
    if (iconInput.val()) {
        var preview = $('<img class="risviel-icon-preview" style="max-width: 50px; max-height: 50px; margin-left: 10px; vertical-align: middle;">');
        preview.attr('src', iconInput.val());
        $('.risviel-media-upload[data-target="category_icon"]').after(preview);
    }
});
</script>
<?php
// Assicurati che il media uploader sia caricato
wp_enqueue_media();
?>
</div>

<style>
/* Stili touch-friendly per admin */
.risviel-gisdoc-categories .button,
.risviel-gisdoc-categories input[type="text"],
.risviel-gisdoc-categories input[type="url"],
.risviel-gisdoc-categories input[type="number"],
.risviel-gisdoc-categories textarea,
.risviel-gisdoc-categories select {
    min-height: 44px;
    font-size: 16px;
}

.risviel-gisdoc-categories .row-actions {
    padding: 8px 0;
}

.risviel-gisdoc-categories .row-actions a {
    padding: 8px 12px;
    display: inline-block;
}

@media screen and (max-width: 782px) {
    .risviel-gisdoc-categories .form-table td {
        padding: 15px 0;
    }

    .risviel-gisdoc-categories .button {
        width: 100%;
        margin-top: 10px;
    }
}
</style>


