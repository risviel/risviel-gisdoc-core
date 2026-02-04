/**
 * Imposta il contenuto degli editor TinyMCE
 */
function setEditorContent(editorId, content) {
    if (typeof tinymce !== 'undefined') {
        const editor = tinymce.get(editorId);
        if (editor) {
            editor.setContent(content || '');
        } else {
            // Se l'editor non è ancora inizializzato, usa jQuery
            $('#' + editorId).val(content || '');
        }
    } else {
        $('#' + editorId).val(content || '');
    }
}

/**
 * Ottiene il contenuto dagli editor TinyMCE
 */
function getEditorContent(editorId) {
    if (typeof tinymce !== 'undefined') {
        const editor = tinymce.get(editorId);
        if (editor) {
            return editor.getContent();
        }
    }
    return $('#' + editorId).val();
}

/**
 * File: risviel-gisdoc-admin.js
 * Funzionalità condivise per l'admin di GisDoc
 */

(function($) {
    'use strict';


    // Funzioni e gestori comuni
    $(document).ready(function() {
        $('#wpfooter').hide();

        // Gestione delle tab nelle interfacce admin
        $('.risviel-tab-header').on('click', function(e) {
            e.preventDefault();
            const tab = $(this).data('tab');

            // Rimuovi la classe active da tutte le tab e i contenuti
            $('.risviel-tab-header').removeClass('active');
            $('.risviel-tab-content').removeClass('active');

            // Aggiungi la classe active alla tab cliccata e al suo contenuto
            $(this).addClass('active');
            $('.risviel-tab-content[data-tab="' + tab + '"]').addClass('active');
        });

        // Gestione della navigazione nelle pagine di amministrazione
        $('.nav-tab').on('click', function(e) {
            e.preventDefault();

            // Rimuovi la classe active da tutte le tab e contenuti
            $('.nav-tab').removeClass('nav-tab-active');
            $('.tab-content').removeClass('active');

            // Aggiungi la classe active alla tab cliccata
            $(this).addClass('nav-tab-active');

            // Mostra il contenuto corrispondente
            $($(this).attr('href')).addClass('active');
        });

        // Gestione degli avvisi
        const $notices = $('.notice');
        if ($notices.length > 0) {
            // Aggiungi pulsante di chiusura agli avvisi
            $notices.each(function() {
                const $notice = $(this);
                if (!$notice.hasClass('notice-persistent')) {
                    $notice.append('<button type="button" class="notice-dismiss"><span class="screen-reader-text">Nascondi questo avviso.</span></button>');
                }
            });

            // Gestisci la chiusura degli avvisi
            $('.notice-dismiss').on('click', function() {
                $(this).closest('.notice').fadeOut(300, function() {
                    $(this).remove();
                });
            });
        }
    });

})(jQuery);