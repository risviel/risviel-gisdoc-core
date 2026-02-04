<?php
/**
 * Classe per la gestione dei punti sulla mappa.
 *
 * @since      1.0.0
 */
class Risviel_GisDoc_Map_Point {

    /**
     * ID del punto.
     *
     * @since    1.0.0
     * @access   private
     * @var      integer    $id    ID del punto.
     */
    public $id;

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
     * File audio nelle diverse lingue.
     *
     * @since    1.0.1
     * @access   private
     * @var      array    $audio_files    Array con i file audio nelle diverse lingue.
     */
    private $audio_files;

    /**
     * ID del panorama associato.
     *
     * @since    1.0.0
     * @access   private
     * @var      integer    $panorama_id    ID del panorama associato.
     */
    private $panorama_id;

    /**
     * Coordinate geografiche.
     *
     * @since    1.0.0
     * @access   private
     * @var      array    $coordinates    Array con le coordinate [lat, lng].
     */
    public $coordinates;

    /**
     * Istanza della connessione PostgreSQL.
     *
     * @since    1.0.0
     * @access   private
     * @var      Risviel_GisDoc_PostGIS    $db    Istanza della connessione PostgreSQL.
     */
    private $db;

    /**
     * Icona personalizzata per il punto.
     *
     * @since    1.0.0
     * @access   private
     * @var      string    $custom_icon    URL dell'icona personalizzata.
     */
    private $custom_icon;

    /**
     * Visibilità del punto sulla mappa.
     *
     * @since    1.0.0
     * @access   private
     * @var      boolean    $visible    Se il punto è visibile o meno.
     */
    private $visible;

    /**
     * Costruttore.
     *
     * @since    1.0.0
     * @param    integer    $id    ID del punto (opzionale).
     */
    public function __construct($id = null) {
        $this->db = Risviel_GisDoc_PostGIS::get_instance();
        $this->titles = array('it' => '', 'en' => '', 'sa' => '');
        $this->descriptions = array('it' => '', 'en' => '', 'sa' => '');
        $this->audio_files = array('it' => '', 'en' => '', 'sa' => '');
        $this->coordinates = array('lat' => 0, 'lng' => 0);
        $this->custom_icon = '';
        $this->visible = false;

        if ($id !== null) {
            $this->load($id);
        }
    }

    /**
     * Carica i dati di un punto dalla tabella map_points.
     *
     * @since     1.0.0
     * @param     integer    $id    ID del punto da caricare.
     * @return    boolean           True se il caricamento è avvenuto con successo, false altrimenti.
     */
    public function load($id) {
        $query = "SELECT id, title_it, title_en, title_sa, description_it, description_en, description_sa, 
                  audio_it, audio_en, audio_sa, panorama_id, ST_X(geom) as lng, ST_Y(geom) as lat,
                  custom_icon, visible 
                  FROM map_points WHERE id = $1";

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
        $this->audio_files['it'] = $row['audio_it'];
        $this->audio_files['en'] = $row['audio_en'];
        $this->audio_files['sa'] = $row['audio_sa'];
        $this->panorama_id = $row['panorama_id'];
        $this->coordinates['lat'] = $row['lat'];
        $this->coordinates['lng'] = $row['lng'];
        $this->custom_icon = $row['custom_icon'];
        $this->visible = isset($row['visible']) ? ($row['visible'] === 't' || $row['visible'] === true) : true;

        return true;
    }

/**
     * Salva il punto nel database.
     *
     * @since     1.0.0
     * @return    boolean    True se il salvataggio è avvenuto con successo, false altrimenti.
     */
    public function save() {
        if ($this->id === null) {
            return $this->insert();
        } else {
            return $this->update();
        }
    }

    /**
     * Inserisce un nuovo punto nel database.
     *
     * @since     1.0.0
     * @return    boolean    True se l'inserimento è avvenuto con successo, false altrimenti.
     */
    private function insert() {
        $query = "INSERT INTO map_points (title_it, title_en, title_sa,
                        description_it, description_en, description_sa,
                        audio_it, audio_en, audio_sa,
                        panorama_id, geom,
                        custom_icon, visible) 
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ST_GeomFromText($11, 4326), $12, $13) 
                  RETURNING id";

        $geom = 'POINT(' . $this->coordinates['lng'] . ' ' . $this->coordinates['lat'] . ')';

        $result = $this->db->query($query, array(
            $this->titles['it'],
            $this->titles['en'],
            $this->titles['sa'],
            $this->descriptions['it'],
            $this->descriptions['en'],
            $this->descriptions['sa'],
            urldecode($this->audio_files['it']),
            urldecode($this->audio_files['en']),
            urldecode($this->audio_files['sa']),
            $this->panorama_id,
            $geom,
            $this->custom_icon,
            $this->visible ? 'true' : 'false'
        ));

        if ($result) {
            $row = $this->db->fetch_row($result);
            if ($row) {
                $this->id = $row['id'];
                return true;
            }
        }

        return false;
    }

    /**
     * Aggiorna un punto esistente nel database.
     *
     * @since     1.0.0
     * @return    boolean    True se l'aggiornamento è avvenuto con successo, false altrimenti.
     */
    private function update() {
        $query = "UPDATE map_points SET title_it = $1, title_en = $2, title_sa = $3, 
                  description_it = $4, description_en = $5, description_sa = $6,
                  audio_it = $7, audio_en = $8, audio_sa = $9,
                  panorama_id = $10, geom = ST_GeomFromText($11, 4326), 
                  custom_icon = $12, visible = $13 
                  WHERE id = $14";

        $geom = 'POINT(' . $this->coordinates['lng'] . ' ' . $this->coordinates['lat'] . ')';

        $result = $this->db->query($query, array(
            $this->titles['it'],
            $this->titles['en'],
            $this->titles['sa'],
            $this->descriptions['it'],
            $this->descriptions['en'],
            $this->descriptions['sa'],
            urldecode($this->audio_files['it']),
            urldecode($this->audio_files['en']),
            urldecode($this->audio_files['sa']),
            $this->panorama_id,
            $geom,
            $this->custom_icon,
            $this->visible ? 'true' : 'false',
            $this->id
        ));

        return $result !== false;
    }

    /**
     * Elimina il punto dal database.
     *
     * @since     1.0.0
     * @return    boolean    True se l'eliminazione è avvenuta con successo, false altrimenti.
     */
    public function delete() {
        if (!isset($this->id)) {
            return false;
        }

        $query = "DELETE FROM map_points WHERE id = $1";
        $result = $this->db->query($query, array($this->id));

        return ($result !== false);
    }

    /**
     * Restituisce tutti i punti dalla tabella map_points.
     *
     * @since     1.0.0
     * @param     boolean    $visible_only    Se restituire solo i punti visibili.
     * @return    array                      Array di oggetti Risviel_GisDoc_Map_Point.
     */
    public static function get_all($visible_only = false) {
        $db = Risviel_GisDoc_PostGIS::get_instance();

        $query = "SELECT id, title_it, title_en, title_sa, description_it, description_en, description_sa,
                  audio_it, audio_en, audio_sa, panorama_id, ST_X(geom) as lng, ST_Y(geom) as lat, 
                  custom_icon, visible 
                  FROM map_points";

        if ($visible_only) {
            $query .= " WHERE visible = true";
        }

        $query .= " ORDER BY id";

        $result = $db->query($query);

        if (!$result) {
            return array();
        }

        $points = array();
        while ($row = $db->fetch_row($result)) {
            $point = new self();
            $point->id = $row['id'];
            $point->titles['it'] = $row['title_it'];
            $point->titles['en'] = $row['title_en'];
            $point->titles['sa'] = $row['title_sa'];
            $point->descriptions['it'] = $row['description_it'];
            $point->descriptions['en'] = $row['description_en'];
            $point->descriptions['sa'] = $row['description_sa'];
            $point->audio_files['it'] = $row['audio_it'];
            $point->audio_files['en'] = $row['audio_en'];
            $point->audio_files['sa'] = $row['audio_sa'];
            $point->panorama_id = $row['panorama_id'];
            $point->coordinates['lat'] = $row['lat'];
            $point->coordinates['lng'] = $row['lng'];
            $point->custom_icon = $row['custom_icon'];
            $point->visible = $row['visible'];

            $points[] = $point;
        }

        return $points;
    }

    /**
     * Ottiene i punti entro un determinato raggio.
     *
     * @since     1.0.0
     * @param     float      $lat       Latitudine del centro.
     * @param     float      $lng       Longitudine del centro.
     * @param     float      $radius    Raggio in metri.
     * @param     string     $lang      Lingua dei dati (it, en, sa).
     * @return    array                Array di punti in formato JSON.
     */
    public static function get_points_within_radius($lat, $lng, $radius, $lang = 'it') {
        $db = Risviel_GisDoc_PostGIS::get_instance();

        $query = "
            SELECT id, 
                   title_$lang as title, 
                   description_$lang as description,
                   panorama_id,
                   ST_X(geom) as lng, 
                   ST_Y(geom) as lat,
                   ST_Distance(
                       geom, 
                       ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
                   ) as distance
            FROM map_points
            WHERE ST_DWithin(
                geom, 
                ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, 
                $3
            )
            ORDER BY distance
        ";

        $result = $db->query($query, array($lat, $lng, $radius));

        if (!$result) {
            return array();
        }

        return $db->fetch_all($result);
    }

    /**
     * Imposta il titolo nella lingua specificata.
     *
     * @since     1.0.0
     * @param     string    $title    Titolo.
     * @param     string    $lang     Codice lingua (it, en, sa).
     */
    public function set_title($title, $lang = 'it') {
        if (isset($this->titles[$lang])) {
            $this->titles[$lang] = $title;
        }
    }

    /**
     * Restituisce il titolo nella lingua specificata.
     *
     * @since     1.0.0
     * @param     string    $lang    Codice lingua (it, en, sa).
     * @return    string            Titolo nella lingua specificata.
     */
    public function get_title($lang = 'it') {
        return isset($this->titles[$lang]) ? $this->titles[$lang] : '';
    }

    /**
     * Imposta la descrizione nella lingua specificata.
     *
     * @since     1.0.0
     * @param     string    $description    Descrizione.
     * @param     string    $lang          Codice lingua (it, en, sa).
     */
    public function set_description($description, $lang = 'it') {
        if (isset($this->descriptions[$lang])) {
            $this->descriptions[$lang] = wp_kses_post($description);
        }
    }

    /**
     * Imposta il file audio nella lingua specificata.
     *
     * @since     1.0.1
     * @param     string    $audio_file    Percorso del file audio.
     * @param     string    $lang         Codice lingua (it, en, sa).
     */
    public function set_audio_file($audio_file, $lang = 'it') {
        if (isset($this->audio_files[$lang])) {
            $this->audio_files[$lang] = $audio_file;
        }
    }

    /**
     * Restituisce la descrizione nella lingua specificata.
     *
     * @since     1.0.0
     * @param     string    $lang    Codice lingua (it, en, sa).
     * @return    string            Descrizione nella lingua specificata.
     */
    public function get_description($lang = 'it') {
        return isset($this->descriptions[$lang]) ? $this->descriptions[$lang] : '';
    }

    /**
     * Restituisce il file audio nella lingua specificata.
     *
     * @since     1.0.1
     * @param     string    $lang    Codice lingua (it, en, sa).
     * @return    string            Percorso del file audio nella lingua specificata.
     */
    public function get_audio_file($lang = 'it') {
        return isset($this->audio_files[$lang]) ? $this->audio_files[$lang] : '';
    }


    /**
     * Imposta l'ID del panorama associato.
     *
     * @since    1.0.0
     * @param    integer    $panorama_id    ID del panorama.
     */
    public function set_panorama_id($panorama_id) {
        $this->panorama_id = (int) $panorama_id;
    }

    /**
     * Restituisce l'ID del panorama associato.
     *
     * @since     1.0.0
     * @return    integer    ID del panorama associato.
     */
    public function get_panorama_id() {
        return $this->panorama_id;
    }

    /**
     * Imposta le coordinate.
     *
     * @since    1.0.0
     * @param    float    $lat    Latitudine.
     * @param    float    $lng    Longitudine.
     */
    public function set_coordinates($lat, $lng) {
        $this->coordinates['lat'] = (float) $lat;
        $this->coordinates['lng'] = (float) $lng;
    }

    /**
     * Ottiene le coordinate.
     *
     * @since     1.0.0
     * @return    array    Array con le coordinate [lat, lng].
     */
    public function get_coordinates() {
        return $this->coordinates;
    }

    /**
     * Ottiene l'ID del punto.
     *
     * @since     1.0.0
     * @return    integer    ID del punto.
     */
    public function get_id() {
        return $this->id;
    }

    /**
     * Imposta l'icona personalizzata.
     *
     * @since    1.0.0
     * @param    string    $icon_url    URL dell'icona.
     */
    public function set_custom_icon($icon_url) {
        $this->custom_icon = esc_url_raw($icon_url);
    }

    /**
     * Ottiene l'URL dell'icona personalizzata.
     *
     * @since     1.0.0
     * @return    string    URL dell'icona.
     */
    public function get_custom_icon() {
        return $this->custom_icon;
    }

    /**
     * Imposta la visibilità del punto.
     *
     * @since    1.0.0
     * @param    boolean    $visible    Se il punto è visibile o meno.
     */
    public function set_visible($visible) {
        $this->visible = (bool) $visible;
    }

    /**
     * Verifica se il punto è visibile.
     *
     * @since     1.0.0
     * @return    boolean    True se il punto è visibile, false altrimenti.
     */
    public function is_visible() {
        return (bool) $this->visible;
    }


    /**
     * Elimina un punto dal database tramite ID.
     *
     * @since     1.0.0
     * @param     integer    $id    ID del punto da eliminare.
     * @return    boolean           True se l'eliminazione è avvenuta con successo, false altrimenti.
     */
    public static function delete_by_id($id) {
        $point = new self($id);
        return $point->delete();
    }


}