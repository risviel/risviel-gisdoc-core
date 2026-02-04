
<?php
/**
 * Gestione database per le categorie dei punti mappa
 *
 * @package Risviel_GisDoc
 */

// Impedisce accesso diretto
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Classe per la gestione delle categorie nel database PostgreSQL
 */
class Risviel_GisDoc_Categories_DB {

    /**
     * Istanza del database PostGIS
     * @var Risviel_GisDoc_PostGIS|null
     */
    private $db = null;

    /**
     * Ultimo errore
     * @var string
     */
    public $last_error = '';

    /**
     * Costruttore
     */
    public function __construct() {
        $this->load_db_class();
    }

    /**
     * Carica la classe DB se non già caricata
     */
    private function load_db_class() {
        // Determina il percorso del file
        $plugin_dir = defined('RISVIEL_GISDOC_PLUGIN_DIR')
            ? RISVIEL_GISDOC_PLUGIN_DIR
            : plugin_dir_path(dirname(__FILE__));

        $db_file = $plugin_dir . 'includes/class-risviel-gisdoc-db.php';

        // Carica il file se la classe non esiste già
        if (!class_exists('Risviel_GisDoc_PostGIS')) {
            if (file_exists($db_file)) {
                require_once $db_file;
            } else {
                $this->last_error = 'File DB non trovato: ' . $db_file;
                error_log('Risviel GisDoc Categories - ' . $this->last_error);
                return;
            }
        }

        // Usa il singleton
        if (class_exists('Risviel_GisDoc_PostGIS')) {
            $this->db = Risviel_GisDoc_PostGIS::get_instance();
            // Inizializza la connessione
            $this->db->init_connection();
        } else {
            $this->last_error = 'Classe Risviel_GisDoc_PostGIS non disponibile';
            error_log('Risviel GisDoc Categories - ' . $this->last_error);
        }
    }

    /**
     * Verifica se la connessione DB è disponibile
     *
     * @return bool
     */
    private function has_connection() {
        return $this->db !== null && $this->db->is_connected();
    }

    /**
     * Ottiene la connessione al database
     *
     * @return resource|false
     */
    private function get_connection() {
        if ($this->db === null) {
            return false;
        }

        // Assicurati che la connessione sia inizializzata
        if (!$this->db->is_connected()) {
            $this->db->init_connection();
        }

        return $this->db->get_connection();
    }

    /**
     * Restituisce l'ultimo errore
     *
     * @return string
     */
    public function get_last_error() {
        return $this->last_error;
    }

    /**
     * Verifica se le tabelle esistono
     *
     * @return bool
     */
    public function tables_exist() {
        $conn = $this->get_connection();
        if (!$conn) {
            return false;
        }

        $sql = "SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'gisdoc_categories'
        ) as table_exists";

        $result = @pg_query($conn, $sql);
        if (!$result) {
            $this->last_error = 'Errore verifica tabella: ' . pg_last_error($conn);
            return false;
        }

        $row = pg_fetch_assoc($result);
        return isset($row['table_exists']) && ($row['table_exists'] === 't' || $row['table_exists'] === true);
    }

    /**
     * Crea le tabelle per le categorie
     *
     * @return bool
     */
    public function create_tables() {
        $conn = $this->get_connection();
        if (!$conn) {
            $this->last_error = 'Nessuna connessione disponibile per creare le tabelle';
            return false;
        }

        // Tabella categorie
        $sql_categories = "
            CREATE TABLE IF NOT EXISTS gisdoc_categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                slug VARCHAR(255) UNIQUE NOT NULL,
                description TEXT DEFAULT '',
                color VARCHAR(7) DEFAULT '#3388ff',
                icon VARCHAR(500) DEFAULT '',
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ";

        $result1 = @pg_query($conn, $sql_categories);
        if ($result1 === false) {
            $this->last_error = 'Errore creazione gisdoc_categories: ' . pg_last_error($conn);
            error_log('Risviel GisDoc Categories - ' . $this->last_error);
            return false;
        }

        // Tabella relazione punti-categorie
        $sql_point_categories = "
            CREATE TABLE IF NOT EXISTS gisdoc_point_categories (
                point_id INT NOT NULL,
                category_id INT NOT NULL,
                PRIMARY KEY (point_id, category_id),
                FOREIGN KEY (category_id) REFERENCES gisdoc_categories(id) ON DELETE CASCADE
            )
        ";

        $result2 = @pg_query($conn, $sql_point_categories);
        if ($result2 === false) {
            $this->last_error = 'Errore creazione gisdoc_point_categories: ' . pg_last_error($conn);
            error_log('Risviel GisDoc Categories - ' . $this->last_error);
            return false;
        }

        return true;
    }

    /**
     * Ottiene tutte le categorie
     *
     * @return array
     */
    public function get_categories() {
        $conn = $this->get_connection();
        if (!$conn) {
            return array();
        }

        $result = @pg_query($conn, "SELECT * FROM gisdoc_categories ORDER BY sort_order, name");
        if (!$result) {
            return array();
        }

        $categories = pg_fetch_all($result);
        return is_array($categories) ? $categories : array();
    }

    /**
     * Ottiene una categoria per ID
     *
     * @param int $id
     * @return array|null
     */
    public function get_category($id) {
        $conn = $this->get_connection();
        if (!$conn) {
            return null;
        }

        $id = intval($id);
        $result = @pg_query_params($conn, "SELECT * FROM gisdoc_categories WHERE id = $1", array($id));

        if (!$result) {
            return null;
        }

        $row = pg_fetch_assoc($result);
        return $row ?: null;
    }

    /**
     * Crea una nuova categoria
     *
     * @param array $data
     * @return int|false ID della categoria creata o false
     */
    public function create_category($data) {
        $conn = $this->get_connection();
        if (!$conn) {
            $this->last_error = 'Nessuna connessione DB disponibile';
            error_log('Risviel GisDoc Categories - ' . $this->last_error);
            return false;
        }

        // Prepara i dati
        $name = sanitize_text_field($data['name'] ?? '');
        $slug = sanitize_title($data['slug'] ?? '');

        if (empty($slug)) {
            $slug = sanitize_title(remove_accents($name));
        }
        if (empty($slug)) {
            $slug = 'categoria-' . time();
        }

        $description = sanitize_textarea_field($data['description'] ?? '');
        $color = $data['color'] ?? '#3388ff';

        if (!preg_match('/^#[a-fA-F0-9]{6}$/', $color)) {
            $color = '#3388ff';
        }

        $icon = esc_url_raw($data['icon'] ?? '');
        $sort_order = intval($data['sort_order'] ?? 0);

        // Verifica slug duplicato
        $check_result = @pg_query_params($conn, "SELECT id FROM gisdoc_categories WHERE slug = $1", array($slug));
        if ($check_result && pg_num_rows($check_result) > 0) {
            $slug = $slug . '-' . uniqid();
        }

        // INSERT
        $sql = "INSERT INTO gisdoc_categories (name, slug, description, color, icon, sort_order) 
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id";

        $result = @pg_query_params($conn, $sql, array(
            $name, $slug, $description, $color, $icon, $sort_order
        ));

        if ($result === false) {
            $this->last_error = 'Errore SQL: ' . pg_last_error($conn);
            error_log('Risviel GisDoc Categories - ' . $this->last_error);
            return false;
        }

        $row = pg_fetch_assoc($result);
        if (isset($row['id'])) {
            return intval($row['id']);
        }

        $this->last_error = 'Nessun ID restituito';
        return false;
    }

    /**
     * Aggiorna una categoria
     *
     * @param int $id
     * @param array $data
     * @return bool
     */
    public function update_category($id, $data) {
        $conn = $this->get_connection();
        if (!$conn) {
            return false;
        }

        $id = intval($id);
        $name = sanitize_text_field($data['name'] ?? '');
        $slug = sanitize_title($data['slug'] ?? $name);
        $description = sanitize_textarea_field($data['description'] ?? '');
        $color = $data['color'] ?? '#3388ff';
        if (!preg_match('/^#[a-fA-F0-9]{6}$/', $color)) {
            $color = '#3388ff';
        }
        $icon = esc_url_raw($data['icon'] ?? '');
        $sort_order = intval($data['sort_order'] ?? 0);

        $sql = "UPDATE gisdoc_categories 
                SET name = $1, slug = $2, description = $3, 
                    color = $4, icon = $5, sort_order = $6,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $7";

        $result = @pg_query_params($conn, $sql, array(
            $name, $slug, $description, $color, $icon, $sort_order, $id
        ));

        return $result !== false;
    }

    /**
     * Elimina una categoria
     *
     * @param int $id
     * @return bool
     */
    public function delete_category($id) {
        $conn = $this->get_connection();
        if (!$conn) {
            return false;
        }

        $id = intval($id);
        $result = @pg_query_params($conn, "DELETE FROM gisdoc_categories WHERE id = $1", array($id));

        return $result !== false;
    }

    /**
     * Ottiene le categorie di un punto
     *
     * @param int $point_id
     * @return array
     */
    public function get_point_categories($point_id) {
        $conn = $this->get_connection();
        if (!$conn) {
            return array();
        }

        $point_id = intval($point_id);
        $sql = "SELECT c.* FROM gisdoc_categories c
                INNER JOIN gisdoc_point_categories pc ON c.id = pc.category_id
                WHERE pc.point_id = $1
                ORDER BY c.sort_order, c.name";

        $result = @pg_query_params($conn, $sql, array($point_id));

        if (!$result) {
            return array();
        }

        $categories = pg_fetch_all($result);
        return is_array($categories) ? $categories : array();
    }

    /**
     * Imposta le categorie di un punto
     *
     * @param int $point_id
     * @param array $category_ids
     * @return bool
     */
    public function set_point_categories($point_id, $category_ids) {
        $conn = $this->get_connection();
        if (!$conn) {
            return false;
        }

        $point_id = intval($point_id);

        @pg_query_params($conn, "DELETE FROM gisdoc_point_categories WHERE point_id = $1", array($point_id));

        if (!empty($category_ids) && is_array($category_ids)) {
            foreach ($category_ids as $cat_id) {
                $cat_id = intval($cat_id);
                if ($cat_id > 0) {
                    @pg_query_params($conn,
                        "INSERT INTO gisdoc_point_categories (point_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                        array($point_id, $cat_id)
                    );
                }
            }
        }

        return true;
    }

    /**
     * Ottiene i punti filtrati per categorie (logica OR)
     *
     * @param array $category_ids
     * @return array
     */
    public function get_points_by_categories($category_ids) {
        $conn = $this->get_connection();
        if (!$conn || empty($category_ids)) {
            return array();
        }

        $ids = array_filter(array_map('intval', $category_ids), function($id) {
            return $id > 0;
        });

        if (empty($ids)) {
            return array();
        }

        $placeholders = array();
        $params = array();
        foreach ($ids as $index => $id) {
            $placeholders[] = '$' . ($index + 1);
            $params[] = $id;
        }
        $ids_string = implode(',', $placeholders);

        $sql = "SELECT DISTINCT p.*, 
                       ST_X(p.geom) as lng, 
                       ST_Y(p.geom) as lat,
                       array_agg(pc.category_id) as category_ids
                FROM gisdoc_map_points p
                INNER JOIN gisdoc_point_categories pc ON p.id = pc.point_id
                WHERE pc.category_id IN ($ids_string)
                GROUP BY p.id";

        $result = @pg_query_params($conn, $sql, $params);

        if (!$result) {
            return array();
        }

        $points = pg_fetch_all($result);
        return is_array($points) ? $points : array();
    }
}