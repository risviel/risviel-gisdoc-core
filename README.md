# Risviel GisDoc Core
Sistema avanzato di documentazione geografica interattiva per WordPress con supporto per mappe, panorami 360° e contenuti multilingua.

---

## 📋 Indice
- [Descrizione](#-descrizione)
- [Caratteristiche Principali](#-caratteristiche-principali)
- [Requisiti](#-requisiti)
- [Installazione](#-installazione)
- [Configurazione](#-configurazione)
- [Utilizzo](#-utilizzo)
- [Shortcode](#-shortcode)
- [Database](#-database)
- [Struttura del Plugin](#-struttura-del-plugin)
- [Supporto Multilingua](#-supporto-multilingua)
- [Sviluppo](#-sviluppo)
- [FAQ](#-faq)
- [Licenza](#-licenza)

---

## 🎯 Descrizione
**Risviel GisDoc Core** è un plugin WordPress professionale che consente di creare esperienze geografiche interattive attraverso:
- 🗺️ **Mappe interattive** con punti di interesse personalizzabili
- 🌐 **Panorami 360°** completamente navigabili con Three.js
- 🎵 **Contenuti multimediali** (audio, video, PDF, immagini)
- 🌍 **Supporto multilingua** completo (Italiano, English, Sardo)
- 📊 **Database PostgreSQL/PostGIS** per dati geografici avanzati
- 🎨 **Categorie personalizzabili** con filtri dinamici

---

## ✨ Caratteristiche Principali
### Gestione Mappe
- Integrazione **Leaflet.js** per mappe interattive
- Supporto **PostGIS** per operazioni geografiche avanzate
- Punti di interesse con icone personalizzabili
- Sistema di **categorie e filtri** dinamici
- Popup informativi con contenuti multimediali

### Panorami 360°
- Visualizzatore basato su **Three.js**
- Navigazione fluida con controlli touch e mouse
- Sistema di **orientamento nord** personalizzabile
- Bussola dinamica per orientamento
- Transizioni animate tra panorami

### Contenuti Multilingua
- Supporto completo per **3 lingue**: Italiano, English, Sardo
- Editor **TinyMCE** integrato per descrizioni ricche
- Audio localizzati per accessibilità
- Fallback automatico su lingua predefinita

### Sistema di Categorie
- Categorie illimitate per punti mappa
- Colori e icone personalizzabili
- Filtri frontend interattivi
- Ordinamento e gestione avanzata

---

## 📦 Requisiti
### Server
- **WordPress**: 6.7 o superiore
- **PHP**: 7.2 o superiore
- **PostgreSQL**: 12 o superiore
- **Estensione PostGIS**: 3.0 o superiore

### PHP Extensions
``` bash
- php-pgsql
- php-json
- php-mbstring
```

### Browser (Frontend)
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

---

## 🚀 Installazione
### 1. Upload del Plugin
``` bash
# Via WordPress Admin
Dashboard → Plugin → Aggiungi nuovo → Carica plugin
Seleziona file .zip → Installa → Attiva

# Via FTP/SSH
cd /percorso-wordpress/wp-content/plugins/
unzip risviel-gisdoc-core.zip
```

### 2. Configurazione Database PostgreSQL
``` sql
-- Crea il database
CREATE DATABASE gisdoc_db;

-- Connettiti al database
\c gisdoc_db

-- Abilita PostGIS
CREATE EXTENSION postgis;

-- Verifica installazione
SELECT PostGIS_Version();
```

### 3. Attivazione Plugin
1. Vai su Plugin → Plugin installati
2. Trova Risviel GisDoc Core
3. Clicca su Attiva
4. Il sistema creerà automaticamente il ruolo utente risviel_gisdoc_user

---

## ⚙️ Configurazione
### Prima Configurazione
Dopo l'attivazione, vai su **GisDoc** → **Impostazioni**:

### 1. Connessione Database
``` 
Host:           localhost
Porta:          5432
Database:       gisdoc_db
Utente:         postgres
Password:       ********
```

Clicca su **Testa Connessione** per verificare.

### 2. Crea Tabelle
Clicca su **Crea Tabelle Database** per generare la struttura necessaria:
- `map_points` - Punti sulla mappa
- `panoramas` - Panorami 360°
- `gisdoc_categories` - Categorie
- `gisdoc_point_categories` - Relazioni punti-categorie

### 3. Impostazioni Mappa
``` 
Latitudine centro:    40.29    # Sardegna
Longitudine centro:   9.61     # Sardegna
Zoom predefinito:     13
```

### 4. Lingua Predefinita
Seleziona tra: `Italiano`, `English`, `Sardo`

### Configurazione Permalink

⚠️ IMPORTANTE: Imposta la struttura permalink su Nome articolo:

``` 
Dashboard → Impostazioni → Permalink
Seleziona: ● Nome articolo
```

---

## 📖 Utilizzo
### Gestione Punti Mappa
1. **GisDoc** → **Punti Mappa**
2. Clicca sulla mappa per aggiungere un punto
3. Compila i campi multilingua:
   - Titolo (obbligatorio in italiano)
   - Descrizione (supporta HTML)
   - File audio
   - Panorama associato
   - Categorie 
4. Salva punto

### Gestione Panorami
1. **GisDoc** → **Panorami**
2. **Nuovo Panorama** o seleziona esistente
3. Carica immagine equirettangolare 360°
4. Compila informazioni multilingua
5. **Imposta Nord** per orientamento corretto
6. **Salva panorama**

### Gestione Categorie
1. **GisDoc** → **Categorie**
2. **Aggiungi Nuova Categoria**
3. Imposta:
   - Nome
   - Slug (URL-friendly)
   - Colore (esadecimale)
   - Icona personalizzata
   - Ordinamento
 
---

## 🔧 Shortcode
### Mappa Interattiva
``` php
[risviel_map width="100%" height="600px" lang="it" show_filter="true"]
```

**Parametri**:
- `width` - Larghezza (default: `100%`)
- `height` - Altezza (default: `600px`)
- `lang` - Lingua (`it`, `en`, `sa`)
- `show_filter` - Mostra filtro categorie (`true`/`false`)
- `for_totem` - Modalità totem touchscreen (`true`/`false`)

**Esempio**:
``` html
<!-- Mappa con filtro categorie -->
[risviel_map height="700px" show_filter="true"]

<!-- Mappa per totem touchscreen -->
[risviel_map height="1080px" for_totem="true"]
```

### Panorama 360°
``` php
[risviel_gisdoc_panorama id="1" width="100%" height="600px" lang="it"]
```

**Parametri**:
- `id` - ID del panorama (obbligatorio)
- `width` - Larghezza (default: `100%`)
- `height` - Altezza (default: `600px`)
- `lang` - Lingua (`it`, `en`, `sa`)

**Esempio**:
``` html
<!-- Panorama full-screen -->
[risviel_gisdoc_panorama id="5" height="100vh"]

<!-- Panorama con lingua inglese -->
[risviel_gisdoc_panorama id="3" lang="en"]
```

### Configurazione Pagina Panorama
Per navigazione automatica da mappa a panorama:
1. Crea pagina con slug: foto-panoramica-360-it 
2. Aggiungi shortcode: [risviel_gisdoc_panorama]
3. Il plugin passerà automaticamente ?id=X&lang=Y nell'URL
 
---

## 🗄️ Database
### Schema Tabelle
`map_points`
``` sql
CREATE TABLE map_points (
    id SERIAL PRIMARY KEY,
    title_it VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) DEFAULT '',
    title_sa VARCHAR(255) DEFAULT '',
    description_it TEXT DEFAULT '',
    description_en TEXT DEFAULT '',
    description_sa TEXT DEFAULT '',
    audio_it VARCHAR(500) DEFAULT '',
    audio_en VARCHAR(500) DEFAULT '',
    audio_sa VARCHAR(500) DEFAULT '',
    panorama_id INTEGER,
    geom GEOMETRY(POINT, 4326),
    custom_icon VARCHAR(500) DEFAULT '',
    visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

`panoramas`
``` sql
CREATE TABLE panoramas (
    id SERIAL PRIMARY KEY,
    title_it VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) DEFAULT '',
    title_sa VARCHAR(255) DEFAULT '',
    description_it TEXT DEFAULT '',
    description_en TEXT DEFAULT '',
    description_sa TEXT DEFAULT '',
    audio_url_it TEXT DEFAULT '',
    audio_url_en TEXT DEFAULT '',
    audio_url_sa TEXT DEFAULT '',
    north_offset NUMERIC DEFAULT 0,
    image_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

`gisdoc_categories`
``` sql
CREATE TABLE gisdoc_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    color VARCHAR(7) DEFAULT '#3388ff',
    icon VARCHAR(500) DEFAULT '',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

`gisdoc_point_categories`
``` sql
CREATE TABLE gisdoc_point_categories (
    point_id INT NOT NULL,
    category_id INT NOT NULL,
    PRIMARY KEY (point_id, category_id),
    FOREIGN KEY (category_id) REFERENCES gisdoc_categories(id) ON DELETE CASCADE
);
```

---
 
## 📁 Struttura del Plugin
``` 
risviel-gisdoc-core/
├── admin/                          # Backend amministrativo
│   ├── css/                        # Stili admin
│   ├── js/                         # Script admin
│   ├── partials/                   # Template admin
│   └── class-risviel-gisdoc-admin.php
├── assets/                         # Risorse statiche
│   ├── aton/                       # Framework ATON
│   ├── images/                     # Immagini plugin
│   ├── leaflet/                    # Libreria Leaflet + plugin
│   └── threejs/                    # Libreria Three.js
├── includes/                       # Classi core
│   ├── class-risviel-gisdoc.php
│   ├── class-risviel-gisdoc-db.php
│   ├── class-risviel-gisdoc-map-point.php
│   ├── class-risviel-gisdoc-panorama.php
│   └── class-risviel-gisdoc-categories-db.php
├── public/                         # Frontend pubblico
│   ├── css/                        # Stili frontend
│   ├── js/                         # Script frontend
│   └── class-risviel-gisdoc-public.php
├── vendor/                         # Dipendenze
│   └── plugin-update-checker/
├── config.php                      # Configurazione
├── risviel-gisdoc-core.php        # File principale
├── update.php                      # Sistema aggiornamenti
└── README.md                       # Questo file
```

---
 
## 🌍 Supporto Multilingua
## Lingue Supportate

| Codice | Lingua | Utilizzo |
|--------|--------|----------|
| `it` | Italiano | Lingua predefinita |
| `en` | English | Lingua secondaria |
| `sa` | Sardo | Lingua regionale/turistica |

### Gestione Traduzioni
Ogni contenuto supporta tutte e 3 le lingue:
``` php
// Esempio punto mappa
Titolo IT:       "Chiesa di San Pietro"
Titolo EN:       "Church of Saint Peter"
Titolo SA:       "Cresia de Santu Pedru"

// Fallback automatico
Se manca traduzione EN → usa IT
Se manca traduzione SA → usa IT
```

### Sistema Fallback
``` javascript
// Logica frontend
const title = data.title_en || data.title_it || 'Punto ' + data.id;
```

---
 
## 👥 Ruoli Utente
### Ruolo `risviel_gisdoc_user`
Ruolo personalizzato con accesso limitato:

**Capacità**:
- ✅ read - Lettura base
- ✅ risviel_gisdoc_view - Visualizzazione GisDoc
- ✅ risviel_gisdoc_edit - Modifica punti/panorami
- ✅ risviel_gisdoc_manage - Gestione completa

**Restrizioni**:
- ❌ Nessun accesso a post/pagine WordPress
- ❌ Nessun accesso a temi/plugin
- ❌ Dashboard personalizzata solo GisDoc

Creazione utente:
``` php
// Programmaticamente
$user_id = wp_create_user('gisdoc_editor', 'password123', 'editor@example.com');
$user = new WP_User($user_id);
$user->set_role('risviel_gisdoc_user');
```

---
 
## 🛠️ Sviluppo
### Tecnologie Utilizzate
| Tecnologia | Versione | Utilizzo         |
|------------|----------|------------------|
| Leaflet.js | 1.7.1 | Rendering mappe  |
| Three.js | r128 | Panorami 3D |
| jQuery | 3.1.1 | Manipolazione DOM |
| ATON | Custom | Framework 3D avanzato |
| PostCSS | 8.5.6 | Processing CSS |

### Minificazione Asset
Il plugin include asset minificati per performance ottimali:
``` bash
# Struttura file
admin/js/risviel-gisdoc-admin.js      # Sviluppo
admin/js/risviel-gisdoc-admin.min.js  # Produzione (usato)

public/css/risviel-gisdoc-public.css      # Sviluppo
public/css/risviel-gisdoc-public.min.css  # Produzione (usato)
```

### Build System
Il plugin utilizza **npm** con **PostCSS** per il processing CSS:
``` json
// package.json presente nella root
{
  "devDependencies": {
    "postcss": "8.5.6",
    "postcss-cli": "11.0.1",
    "cssnano": "7.1.2",
    "@wordpress/browserslist-config": "6.34.0"
  }
}
```

### API JavaScript Pubblica
``` javascript
// Accesso ai viewer panorama
window.panoramaViewers['viewer-id']

// API pulizia
window.panoramaAPI.cleanupOverlays();
window.panoramaAPI.closeAllMediaPanels();
window.panoramaAPI.debugOverlays();
window.panoramaAPI.forceCleanup();

// Navigazione
window.loadPanoramaData(containerId, panoramaId, language);
```

---
 
## 🔌 AJAX Endpoints
### Backend (Admin)
``` javascript
// Punti mappa
risviel_gisdoc_save_map_point
risviel_gisdoc_get_all_map_points
risviel_gisdoc_get_map_point
risviel_gisdoc_delete_map_point

// Panorami
risviel_gisdoc_save_panorama
risviel_gisdoc_get_all_panoramas
risviel_gisdoc_admin_get_panorama
risviel_gisdoc_delete_panorama
risviel_gisdoc_set_panorama_north_offset

// Database
risviel_gisdoc_test_connection
risviel_gisdoc_create_tables
```

### Frontend (Public)
``` javascript
// Dati pubblici
risviel_gisdoc_get_map_points
risviel_gisdoc_get_panorama
risviel_gisdoc_get_filter_categories
```

---
 
## 🎨 Personalizzazione CSS
### Temi Supportati
``` css
/* Dark theme (predefinito) */
[data-theme="dark"] {
    --risviel-bg-color: #1a1a1a;
    --risviel-text-color: #fff;
    --risviel-border-color: #333;
}

/* Light theme */
[data-theme="light"] {
    --risviel-bg-color: #fff;
    --risviel-text-color: #000;
    --risviel-border-color: #e8e8e8;
}
```

### Override Stili
``` css
/* Nel tuo tema */
.risviel-map-container {
    border-radius: 16px !important;
}

.leaflet-popup-content-wrapper {
    background: #custom-color !important;
}
```

---
 
## 🔄 Sistema Aggiornamenti
Il plugin include un sistema di aggiornamenti automatici tramite server remoto:
``` php
// update.php
define('RISVIEL_PLUGIN_UPDATE_URL', 
    'https://risviel.com/_update/wp/preview.php?slug=risviel-gisdoc-core'
);
```

Verifica aggiornamenti: **Dashboard** → **Aggiornamenti**

---

## 🐛 Debug e Log
### Modalità Debug
Abilita debug nei file JavaScript:
``` javascript
// risviel-gisdoc-panorama.js
const panoramaConfig = {
    debug: true,  // Abilita log console
    defaultFOV: 75
};
```

### Log PHP
Errori sono registrati in:
``` bash
/wp-content/debug.log  # Se WP_DEBUG_LOG attivo
```

Abilita debug WordPress in wp-config.php:
``` php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

---
 
## 🔐 Sicurezza
### Nonce Verification
Tutte le richieste AJAX sono protette:
``` javascript
// Frontend
nonce: risviel_gisdoc_public.nonce

// Backend
nonce: risviel_gisdoc_admin.nonce
```

### Sanitizzazione Dati
``` php
// Testo
sanitize_text_field($input)

// HTML (per descrizioni)
wp_kses_post($input)

// URL
esc_url_raw($url)

// Textarea
sanitize_textarea_field($input)
```

---
 
## 📱 Responsive Design
Il plugin è completamente responsive:
``` css
/* Tablet */
@media (max-width: 768px) {
    .risviel-map-container { height: 400px; }
}

/* Mobile */
@media (max-width: 480px) {
    .risviel-map-container { height: 300px; }
}
```

---
 
## ❓ FAQ
### Come cambio il centro della mappa?
**GisDoc** → **Impostazioni** → **Configurazione Mappa** Inserisci latitudine e longitudine desiderate.
### Come carico immagini panoramiche?
Le immagini devono essere in formato **equirettangolare** (2:1 ratio). Risoluzione consigliata: **4096×2048px** o superiore.
### Posso usare MySQL invece di PostgreSQL?
No, il plugin richiede **PostgreSQL con PostGIS** per le funzionalità geografiche avanzate.
### Come funziona il sistema categorie?
Usa filtri OR: selezionando più categorie mostra punti che appartengono ad almeno una categoria selezionata.
### Gli shortcode funzionano con page builder?
Sì, testato con:
- ✅ Elementor
- ✅ Gutenberg
- ✅ Classic Editor
- ✅ WPBakery
### Come gestisco le prestazioni?
Il plugin carica asset **solo quando necessario**:
- Rilevamento automatico shortcode
- Minificazione CSS/JS
- Lazy loading texture
- Cleanup memoria automatico
 
---

## 📄 Licenza
Questo plugin è rilasciato sotto licenza MIT.
``` 
MIT License

Copyright (c) 2025 Antonio Sanna - RISVIEL

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files...
```

Vedi file LICENSE per dettagli completi.
 
---

## 👨‍💻 Autore
Antonio Sanna
Full Stack Developer
[RISVIEL](https://risviel.com)

## Contatti
🌐 Website: [risviel.com](https://risviel.com)
📧 Email: [info@risviel.com](mailto:info@risviel.com)
 
---

## 🙏 Credits
### Librerie Open Source
- **Leaflet** - BSD-2-Clause License
- **Three.js** - MIT License
- **ATON** - Custom Framework
- **Plugin Update Checker** - MIT License

### Risorse
- Icone: Custom design
- Logo progetto: RISVIEL
 
---

## 📝 Changelog
### Version 1.0.0 (2025-02-04)
- 🎉 **Release iniziale**
- ✅ Sistema mappe Leaflet
- ✅ Panorami 360° Three.js
- ✅ Supporto multilingua (IT/EN/SA)
- ✅ Sistema categorie
- ✅ Filtri dinamici
- ✅ Ruoli utente personalizzati
- ✅ Dashboard ottimizzata
- ✅ Sistema aggiornamenti automatici
 
--- 

## 🆘 Supporto
Per assistenza:
1. Documentazione: Leggi questo README
2. Issue: Apri ticket su repository
3. Email: Contatta [info@risviel.com](mailto:info@risviel.com)
 
---

**Made with** ❤️ by **RISVIEL**

Trasformiamo luoghi in storie interattive
Website • Documentation • Updates