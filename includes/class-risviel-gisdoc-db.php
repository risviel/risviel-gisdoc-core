<?php
/**
 * Gestisce la connessione a PostgreSQL e le operazioni PostGIS.
 *
 * @since      1.0.0
 */
class Risviel_GisDoc_PostGIS {

    /**
     * Istanza singleton.
     *
     * @since    1.0.0
     * @access   private
     * @var      Risviel_GisDoc_PostGIS    $instance    Istanza singleton.
     */
    private static $instance = null;

    /**
     * Connessione a PostgreSQL.
     *
     * @since    1.0.0
     * @access   private
     * @var      resource    $connection    Connessione a PostgreSQL.
     */
    private $connection = null;

    /**
     * Stato della connessione.
     *
     * @since    1.0.0
     * @access   private
     * @var      boolean    $connected    True se la connessione è attiva, false altrimenti.
     */
    private $connected = false;

    /**
     * Costruttore.
     *
     * @since    1.0.0
     */
    private function __construct() {
        // Non inizializziamo più la connessione nel costruttore
        // Sarà necessario chiamare init_connection() manualmente
    }

    /**
     * Ottiene l'istanza singleton.
     *
     * @since     1.0.0
     * @return    Risviel_GisDoc_PostGIS    Istanza singleton.
     */
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Inizializza la connessione al database PostgreSQL.
     *
     * @since    1.0.0
     * @return   boolean    True se la connessione è stabilita, false altrimenti.
     */
    public function init_connection() {
        if ($this->connection !== null) {
            return $this->is_connected();
        }

        $host = get_option('risviel_gisdoc_pg_host', 'localhost');
        $port = get_option('risviel_gisdoc_pg_port', '5432');
        $dbname = get_option('risviel_gisdoc_pg_dbname', '');
        $user = get_option('risviel_gisdoc_pg_user', '');
        $password = get_option('risviel_gisdoc_pg_password', '');

        // Verifica che tutti i parametri di connessione siano impostati
        if (empty($dbname) || empty($user)) {
            error_log('Risviel GisDoc: Parametri di connessione PostgreSQL mancanti.');
            return false;
        }

        $connection_string = "host=$host port=$port dbname=$dbname user=$user password=$password";

        // Tenta la connessione con gestione degli errori
        try {
            $this->connection = @pg_connect($connection_string);

            if ($this->connection) {
                $this->connected = true;
                return true;
            } else {
                error_log('Risviel GisDoc: Impossibile connettersi al database PostgreSQL.');
                $this->connection = null;
                $this->connected = false;
                return false;
            }
        } catch (Exception $e) {
            error_log('Risviel GisDoc: Errore di connessione al database PostgreSQL: ' . $e->getMessage());
            $this->connection = null;
            $this->connected = false;
            return false;
        }
    }

    /**
     * Restituisce l'oggetto della connessione attiva.
     *
     * @return mixed Oggetto della connessione attiva o null se non è disponibile.
     */
    public function get_connection()
    {
        return $this->connection;
    }

    /**
     * Verifica se la connessione è attiva.
     *
     * @since     1.0.0
     * @return    boolean    True se la connessione è attiva, false altrimenti.
     */
    public function is_connected() {
        if ($this->connection === null) {
            return false;
        }

        try {
            $status = @pg_connection_status($this->connection);
            $this->connected = ($status === PGSQL_CONNECTION_OK);
            return $this->connected;
        } catch (Exception $e) {
            $this->connected = false;
            return false;
        }
    }

    /**
     * Esegue una query con parametri preparati.
     *
     * @since     1.0.0
     * @param     string    $query     Query SQL.
     * @param     array     $params    Parametri della query.
     * @return    resource             Risultato della query o false in caso di errore.
     */
    public function query($query, $params = array()) {
        // Verifica se la connessione è attiva, altrimenti tenta di connettersi
        if (!$this->is_connected() && !$this->init_connection()) {
            error_log('Risviel GisDoc: Query fallita - connessione non disponibile');
            return false;
        }

        try {
            $result = false;
            if (empty($params)) {
                $result = @pg_query($this->connection, $query);
            } else {
                $result = @pg_query_params($this->connection, $query, $params);
            }

            if ($result === false) {
                $error = pg_last_error($this->connection);
                error_log('Risviel GisDoc: Errore nell\'esecuzione della query: ' . $error);
                error_log('Query: ' . $query);
                if (!empty($params)) {
                    error_log('Parametri: ' . json_encode($params));
                }
            }

            return $result;
        } catch (Exception $e) {
            error_log('Risviel GisDoc: Eccezione nell\'esecuzione della query: ' . $e->getMessage());
            error_log('Query: ' . $query);
            if (!empty($params)) {
                error_log('Parametri: ' . json_encode($params));
            }
            return false;
        }
    }

    /**
     * Verifica la connessione al database e restituisce un messaggio.
     *
     * @since     1.0.0
     * @return    array     Stato della connessione e messaggio.
     */
    public function test_connection() {
        if ($this->init_connection()) {
            try {
                $version_query = "SELECT version()";
                $result = @pg_query($this->connection, $version_query);

                if ($result) {
                    $row = pg_fetch_row($result);
                    return array(
                        'success' => true,
                        'message' => 'Connessione stabilita con successo. ' . $row[0]
                    );
                } else {
                    return array(
                        'success' => false,
                        'message' => 'Connessione stabilita ma errore nell\'esecuzione della query di test.'
                    );
                }
            } catch (Exception $e) {
                return array(
                    'success' => false,
                    'message' => 'Errore nell\'esecuzione della query di test: ' . $e->getMessage()
                );
            }
        } else {
            return array(
                'success' => false,
                'message' => 'Impossibile connettersi al database PostgreSQL. Verifica i parametri di connessione.'
            );
        }
    }

    /**
     * Restituisce una singola riga da un risultato.
     *
     * @since     1.0.0
     * @param     resource    $result    Risultato della query.
     * @return    array                  Riga come array associativo o false in caso di errore.
     */
    public function fetch_row($result) {
        if (!$result) {
            return false;
        }

        try {
            return @pg_fetch_assoc($result);
        } catch (Exception $e) {
            error_log('Risviel GisDoc: Errore nel recupero dei dati: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Restituisce tutte le righe da un risultato.
     *
     * @since     1.0.0
     * @param     resource    $result    Risultato della query.
     * @return    array                  Array di righe.
     */
    public function fetch_all($result) {
        if (!$result) {
            return array();
        }

        try {
            $rows = array();
            while ($row = @pg_fetch_assoc($result)) {
                $rows[] = $row;
            }
            return $rows;
        } catch (Exception $e) {
            error_log('Risviel GisDoc: Errore nel recupero dei dati: ' . $e->getMessage());
            return array();
        }
    }

    /**
     * Esegue una query con operazioni geografiche.
     *
     * @since     1.0.0
     * @param     string    $query     Query SQL.
     * @param     array     $params    Parametri della query.
     * @return    array                Risultato come array.
     */
    public function spatial_query($query, $params = array()) {
        $result = $this->query($query, $params);
        return $this->fetch_all($result);
    }

    /**
     * Chiude la connessione al database.
     *
     * @since    1.0.0
     */
    public function close() {
        if ($this->connection && $this->is_connected()) {
            try {
                @pg_close($this->connection);
            } catch (Exception $e) {
                error_log('Risviel GisDoc: Errore nella chiusura della connessione: ' . $e->getMessage());
            }
            $this->connection = null;
            $this->connected = false;
        }
    }

    /**
     * Gestione della chiusura alla fine dello script.
     */
    public function __destruct() {
        $this->close();
    }
}