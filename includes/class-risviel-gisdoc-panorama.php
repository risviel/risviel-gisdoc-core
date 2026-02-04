<?php
/**
 * Classe per la gestione delle foto panoramiche 360°.
 *
 * @since      1.0.0
 */
class Risviel_GisDoc_Panorama {

    /**
     * ID del panorama.
     *
     * @since    1.0.0
     * @access   private
     * @var      integer    $id    ID del panorama.
     */
    private $id;

    /**
     * Titoli nelle diverse lingue.
     *
     * @since    1.0.0
     * @access   private
     * @var      array    $titles    Array con i titoli nelle diverse lingue.
     */
    private $titles;

    /**
     * Descrizioni nelle diverse lingue.
     *
     * @since    1.0.0
     * @access   private
     * @var      array    $descriptions    Array con le descrizioni nelle diverse lingue.
     */
    private $descriptions;

    /**
     * Audio nelle diverse lingue.
     *
     * @since    1.0.0
     * @access   private
     * @var      array    $audio_urls    Array con gli URL degli audio nelle diverse lingue.
     */
    private $audio_urls;


    /**
     * Percorso dell'immagine 360°.
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $image_url    Percorso dell'immagine 360°.
     */
    private $image_url;

    /**
     * Istanza della connessione PostgreSQL.
     *
     * @since    1.0.0
     * @access   private
     * @var      Risviel_GisDoc_PostGIS    $db    Istanza della connessione PostgreSQL.
     */
    private $db;

      /**
     * Offset angolare per l'orientamento nord (in gradi).
     *
     * @since    1.0.0
     * @access   private
     * @var      float    $north_offset    Offset angolare in gradi per l'orientamento nord.
     */
    private $north_offset;

    /**
     * Costruttore.
     *
     * @since    1.0.0
     * @param    integer    $id    ID del panorama (opzionale).
     */
    public function __construct($id = null) {
        $this->db = Risviel_GisDoc_PostGIS::get_instance();
        $this->titles = array('it' => '', 'en' => '', 'sa' => '');
        $this->descriptions = array('it' => '', 'en' => '', 'sa' => '');
        $this->audio_urls = array('it' => '', 'en' => '', 'sa' => '');
        $this->north_offset = 0.0; // Valore di default

        if ($id !== null) {
            $this->load($id);
        }
    }

    /**
     * Imposta l'offset dell'orientamento nord.
     *
     * @since    1.0.0
     * @param    float    $offset    Offset angolare in gradi.
     */
    public function set_north_offset($offset) {
        $this->north_offset = floatval($offset);
    }

    /**
     * Ottiene l'offset dell'orientamento nord.
     *
     * @since    1.0.0
     * @return   float    Offset angolare in gradi.
     */
    public function get_north_offset() {
        return $this->north_offset;
    }

    /**
     * Carica i dati di un panorama dalla tabella panoramas.
     *
     * @since     1.0.0
     * @param     integer    $id    ID del panorama da caricare.
     * @return    boolean           True se il caricamento è avvenuto con successo, false altrimenti.
     */
    public function load($id) {
        $query = "SELECT id, title_it, title_en, title_sa, description_it, description_en, description_sa, 
                         audio_url_it, audio_url_en, audio_url_sa, image_url 
                  FROM panoramas WHERE id = $1";

        $result = $this->db->query($query, array($id));

        if (!$result) {
            return false;
        }

        $row = $this->db->fetch_row($result);

        if (!$row) {
            return false;
        }

        $this->id = $row['id'];
        $this->titles['it'] = $row['title_it'];
        $this->titles['en'] = $row['title_en'];
        $this->titles['sa'] = $row['title_sa'];
        $this->descriptions['it'] = $row['description_it'];
        $this->descriptions['en'] = $row['description_en'];
        $this->descriptions['sa'] = $row['description_sa'];
        $this->audio_urls['it'] = $row['audio_url_it'] ?? '';
        $this->audio_urls['en'] = $row['audio_url_en'] ?? '';
        $this->audio_urls['sa'] = $row['audio_url_sa'] ?? '';
        $this->image_url = $row['image_url'];

        return true;
    }

    /**
     * Salva il panorama nel database.
     *
     * @since     1.0.0
     * @return    boolean    True se il salvataggio è avvenuto con successo, false altrimenti.
     */
    public function save() {

        if (isset($this->id)) {
            // Aggiorna il panorama esistente
            $query = "UPDATE panoramas SET 
                            title_it = '" . $this->get_title('it') . "',
                            title_en = '" . $this->get_title('en') . "', 
                            title_sa = '" . $this->get_title('sa') . "', 
                            description_it = '" . $this->get_description('it') . "', 
                            description_en = '" . $this->get_description('en') . "',
                            description_sa = '" . $this->get_description('sa') . "',
                            audio_url_it = '" . $this->get_audio_url('it') . "', 
                            audio_url_en = '" . $this->get_audio_url('en') . "',
                            audio_url_sa = '" . $this->get_audio_url('sa') . "', 
                            image_url = '" . $this->get_image_url() . "',
                            updated_at = CURRENT_TIMESTAMP
                      WHERE id = " . $this->id;



            $result = $this->db->query($query);

            return ($result !== false);
        } else {
            // Inserisce un nuovo panorama

            $query ="INSERT INTO panoramas 
                      (title_it, title_en, title_sa, description_it, description_en, description_sa,
                         audio_url_it, audio_url_en, audio_url_sa, image_url, north_offset, created_at, updated_at) 
                      VALUES (
                               '" . $this->get_title('it') . "', 
                               '" . $this->get_title('en') . "',
                               '" . $this->get_title('sa') . "',
                               '" . $this->get_description('it') . "',
                               '" . $this->get_description('en') . "',
                               '" . $this->get_description('sa') . "',
                               '" . $this->get_audio_url('it') . "',
                               '" . $this->get_audio_url('en') . "',
                               '" . $this->get_audio_url('sa') . "',
                               '" . $this->get_image_url() . "',
                              0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
                      RETURNING id";

            $result = $this->db->query($query);


            if ($result) {
                $row = $this->db->fetch_row($result);
                $this->id = $row['id'];
                return true;
            }

            return false;
        }
    }

    /**
     * Elimina il panorama dal database.
     *
     * @since     1.0.0
     * @return    boolean    True se l'eliminazione è avvenuta con successo, false altrimenti.
     */
    public function delete() {
        if (!isset($this->id)) {
            return false;
        }

        // Prima di eliminare il panorama, elimina anche il file dell'immagine
        $upload_dir = wp_upload_dir();
        $file_path = $upload_dir['basedir'] . '/' . $this->image_url;

        if (file_exists($file_path)) {
            unlink($file_path);
        }

        $query = "DELETE FROM panoramas WHERE id = $1";
        $result = $this->db->query($query, array($this->id));

        return ($result !== false);
    }

    /**
     * Ottiene tutti i panorami dal database.
     *
     * @since     1.0.0
     * @return    array      Array di oggetti Risviel_GisDoc_Panorama.
     */
    public static function get_all() {
        $db = Risviel_GisDoc_PostGIS::get_instance();
        $query = "SELECT id FROM panoramas ORDER BY id";

        $result = $db->query($query);

        if (!$result) {
            return array();
        }

        $rows = $db->fetch_all($result);
        $panoramas = array();

        foreach ($rows as $row) {
            $panoramas[] = new Risviel_GisDoc_Panorama($row['id']);
        }

        return $panoramas;
    }

    /**
     * Ottiene tutti i panorami in formato array.
     *
     * @since     1.0.0
     * @param     string     $lang    Lingua dei dati (it, en, sa).
     * @return    array               Array di panorami.
     */
    public static function get_all_as_array($lang = 'it') {
        $db = Risviel_GisDoc_PostGIS::get_instance();

        $query = "
            SELECT id, 
                   title_$lang as title, 
                   description_$lang as description,
                   image_url
            FROM panoramas
            ORDER BY id
        ";

        $result = $db->query($query);

        if (!$result) {
            return array();
        }

        return $db->fetch_all($result);
    }

    /**
     * Carica una nuova immagine 360°.
     *
     * @since     1.0.0
     * @param     array     $file    File caricato ($_FILES).
     * @return    string             Percorso relativo dell'immagine o false in caso di errore.
     */
    public function upload_image($file) {
        if (!function_exists('wp_handle_upload')) {
            require_once(ABSPATH . 'wp-admin/includes/file.php');
        }

        $upload_overrides = array('test_form' => false);
        $movefile = wp_handle_upload($file, $upload_overrides);

        if ($movefile && !isset($movefile['error'])) {
            $upload_dir = wp_upload_dir();
            $relative_path = str_replace($upload_dir['basedir'] . '/', '', $movefile['file']);
            $this->image_url = $relative_path;
            return $relative_path;
        } else {
            return false;
        }
    }

    /**
     * Imposta il titolo in una determinata lingua.
     *
     * @since    1.0.0
     * @param    string    $lang     Codice lingua (it, en, sa).
     * @param    string    $title    Titolo.
     */
    public function set_title($lang, $title) {
        if (isset($this->titles[$lang])) {
            $this->titles[$lang] = sanitize_text_field($title);
        }
    }

    /**
     * Ottiene il titolo in una determinata lingua.
     *
     * @since     1.0.0
     * @param     string    $lang    Codice lingua (it, en, sa).
     * @return    string             Titolo.
     */
    public function get_title($lang) {
        return isset($this->titles[$lang]) ? $this->titles[$lang] : '';
    }

    /**
     * Imposta la descrizione in una determinata lingua.
     *
     * @since    1.0.0
     * @param    string    $lang         Codice lingua (it, en, sa).
     * @param    string    $description  Descrizione.
     */
    public function set_description($lang, $description) {
        if (isset($this->descriptions[$lang])) {
            $this->descriptions[$lang] = wp_kses_post($description);
        }
    }

    /**
     * Ottiene la descrizione in una determinata lingua.
     *
     * @since     1.0.0
     * @param     string    $lang    Codice lingua (it, en, sa).
     * @return    string             Descrizione.
     */
    public function get_description($lang) {
        return isset($this->descriptions[$lang]) ? $this->descriptions[$lang] : '';
    }

    /**
     * Imposta il percorso dell'immagine 360°.
     *
     * @since    1.0.0
     * @param    string    $path    Percorso dell'immagine.
     */
    public function set_image_url($path) {
        $this->image_url = $path;
    }

    /**
     * Ottiene il percorso dell'immagine 360°.
     *
     * @since     1.0.0
     * @return    string    Percorso dell'immagine.
     */
    public function get_image_path() {
        return $this->image_url;
    }

    /**
     * Ottiene l'URL completo dell'immagine 360°.
     *
     * @since     1.0.0
     * @return    string    URL dell'immagine.
     */
    public function get_image_url() {
        $upload_dir = wp_upload_dir();
       // return $upload_dir['baseurl'] . '/' . $this->image_url;
        return $this->image_url;
    }

    // Getter per gli audio
    public function get_audio_url($lang = 'it') {
        return isset($this->audio_urls[$lang]) ? $this->audio_urls[$lang] : '';
    }

    public function get_all_audio_urls() {
        return $this->audio_urls;
    }

    // Setter per gli audio
    public function set_audio_url($lang, $url) {
        if (isset($this->audio_urls[$lang])) {
            $this->audio_urls[$lang] = $url;
        }
    }


    /**
     * Ottiene l'ID del panorama.
     *
     * @since     1.0.0
     * @return    integer    ID del panorama.
     */
    public function get_id() {
        return isset($this->id) ? $this->id : 0;
    }



}