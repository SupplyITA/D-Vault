# D-Vault 

Sito costruito per simulare un ambiente di gioco per il gioco di ruolo D&D per la versione 5e

---

## Struttura del progetto

```
d-vault/
├── index.html          ← Landing page (login / registrazione)
├── dashboard.html      ← Pagina principale post-login
├── css/
│   ├── style.css       ← Stili globali + landing page
│   └── dashboard.css   ← Stili dashboard (navbar, modali, grid)
├── js/
│   ├── main.js         ← Logica landing (tab auth, particelle, form stub)
│   └── dashboard.js    ← Logica dashboard (menu, modali, schede, campagne)
└── README.md
```

---

## Funzionalità implementate

### `index.html` — Landing page
- Background con immagine del manuale 5e sfocata
- Titolo **D-Vault** in grande con effetti glow
- Box login / registrazione con tab animati
- Particelle animate


### `dashboard.html` — Dashboard
- **Navbar** fissa con logo, sezione attiva e menu hamburger
- **Dropdown menu** (☰ in alto a destra) con:
  - Lista schede personaggio (Player)
  - Lista campagne (Master)
  - Pulsanti rapidi per aggiungere
- **Grid** di card che mostra schede e campagne
- **Modal scelta ruolo**: box centrale con selezione Player / Master, con hover che ingrandisce la metà scelta
- **Modal form scheda**: nome, classe, razza, livello, campagna
- **Modal form campagna**: nome, ambientazione, n° giocatori, descrizione
- **Parte mancante**: Non è stato aggiunto un tasto per cancellare le campagne correnti / schede correnti
---

---

## Note sul design

- **Font**: Cinzel e Crimson Text (corpo)
- **Colori dominanti**: Rosso scuro `#8b1a1a`, Rosso acceso `#c0392b`, Oro `#e8c97e`, sfondi quasi neri
- **Background landing**: immagine del PHB 5e presa da Wikipedia
- I dati sono attualmente salvati in `localStorage`

## Note sul server 

- Per il momento solo Login e Registrati - Serve node.js e scaricare express con npm install (se non funziona provate npm install express ws). (Per favore non pushate i 600 file che scarica, per non pusharli c'è il file .gitignore)

- Per fare la prova fare node server.js e andare su http://localhost:3000

