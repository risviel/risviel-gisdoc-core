<?php
/**
 * Registra tutti gli hook del plugin.
 *
 * @since      1.0.0
 */
class Risviel_GisDoc_Loader {

    /**
     * Array di azioni registrate con WordPress.
     *
     * @since    1.0.0
     * @access   protected
     * @var      array    $actions    Le azioni registrate con WordPress.
     */
    protected $actions;

    /**
     * Array di filtri registrati con WordPress.
     *
     * @since    1.0.0
     * @access   protected
     * @var      array    $filters    I filtri registrati con WordPress.
     */
    protected $filters;

    /**
     * Inizializza le collezioni usate per mantenere le azioni e i filtri.
     *
     * @since    1.0.0
     */
    public function __construct() {
        $this->actions = array();
        $this->filters = array();
    }

    /**
     * Aggiunge una nuova azione alla collezione di azioni da registrare con WordPress.
     *
     * @since    1.0.0
     * @param    string               $hook             Il nome dell'azione di WordPress a cui collegarsi.
     * @param    object               $component        Un riferimento all'istanza dell'oggetto in cui l'azione è definita.
     * @param    string               $callback         Il nome della funzione definita in $component.
     * @param    int                  $priority         Opzionale. La priorità con cui eseguire la funzione. Default 10.
     * @param    int                  $accepted_args    Opzionale. Il numero di argomenti che la funzione accetta. Default 1.
     */
    public function add_action($hook, $component, $callback, $priority = 10, $accepted_args = 1) {
        $this->actions = $this->add($this->actions, $hook, $component, $callback, $priority, $accepted_args);
    }

    /**
     * Aggiunge un nuovo filtro alla collezione di filtri da registrare con WordPress.
     *
     * @since    1.0.0
     * @param    string               $hook             Il nome del filtro di WordPress a cui collegarsi.
     * @param    object               $component        Un riferimento all'istanza dell'oggetto in cui il filtro è definito.
     * @param    string               $callback         Il nome della funzione definita in $component.
     * @param    int                  $priority         Opzionale. La priorità con cui eseguire la funzione. Default 10.
     * @param    int                  $accepted_args    Opzionale. Il numero di argomenti che la funzione accetta. Default 1.
     */
    public function add_filter($hook, $component, $callback, $priority = 10, $accepted_args = 1) {
        $this->filters = $this->add($this->filters, $hook, $component, $callback, $priority, $accepted_args);
    }

    /**
     * Utility usata per registrare le azioni e i filtri in una singola collezione.
     *
     * @since    1.0.0
     * @access   private
     * @param    array                $hooks            Collezione di hook da cui si sta registrando.
     * @param    string               $hook             Il nome del filtro di WordPress a cui collegarsi.
     * @param    object               $component        Un riferimento all'istanza dell'oggetto in cui il filtro è definito.
     * @param    string               $callback         Il nome della funzione definita in $component.
     * @param    int                  $priority         La priorità con cui eseguire la funzione.
     * @param    int                  $accepted_args    Il numero di argomenti che la funzione accetta.
     * @return   array                                  La collezione di azioni e filtri registrati con WordPress.
     */
    private function add($hooks, $hook, $component, $callback, $priority, $accepted_args) {
        $hooks[] = array(
            'hook'          => $hook,
            'component'     => $component,
            'callback'      => $callback,
            'priority'      => $priority,
            'accepted_args' => $accepted_args
        );

        return $hooks;
    }

    /**
     * Registra gli hook con WordPress.
     *
     * @since    1.0.0
     */
    public function run() {
        foreach ($this->filters as $hook) {
            add_filter($hook['hook'], array($hook['component'], $hook['callback']), $hook['priority'], $hook['accepted_args']);
        }

        foreach ($this->actions as $hook) {
            add_action($hook['hook'], array($hook['component'], $hook['callback']), $hook['priority'], $hook['accepted_args']);
        }
    }
}