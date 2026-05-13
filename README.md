# D-Vault 

Sito costruito per simulare un ambiente di gioco per il gioco di ruolo D&D per la versione 5e

---

## Struttura del progetto

```
d-vault/
├── index.html          ← Landing page (login / registrazione)
├── dashboard.html      ← Pagina principale post-login
|── server.js             
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
- N.B.: è stato scelto node.js (e non PHP) per poter permettere anche la comunicazione via chat "live".
- Per fare la prova fare node server.js e andare su http://localhost:3000


Come installare tutto ciò che serve per avviare il server (e avviare il server) 

1. Installa il "Motore" (Node.js e NPM)
Se il nuovo computer non ha mai fatto girare un server Node.js, devi prima installarlo. Apri il terminale e lancia:

Bash
```
sudo apt update
sudo apt install nodejs npm -y
```
(Nota: ti chiederà la password del tuo utente Linux per confermare l'installazione).

2. Entra nella cartella del progetto
Devi dire al terminale di posizionarsi dentro la cartella dove hai messo i tuoi file (quella che contiene server.js).  

Usare percorso in cui è stato scaricata la repo

Bash 
```
cd ~/Desktop/D-Vault
```
3. Inizializza il progetto (Opzionale ma consigliato)
Se copiando la cartella non hai portato con te il file package.json, devi rigenerarlo. Questo file serve a Node.js per ricordarsi quali librerie usi.

Bash
```
npm init -y
```
4. Installa le librerie necessarie
Ora devi scaricare tutti i "moduli magici" che hai richiesto nel tuo file server.js (Express, SQLite, Socket.io per la chat, Multer per le immagini e Bcrypt per le password).  

Bash
```
npm install express bcrypt sqlite3 socket.io multer
```
(Problemi con NPM per la versione o altro? Se questo comando standard ti dà problemi e vuoi forzare una versione più vecchia e stabile, puoi usare 
```
npm install express bcrypt sqlite3 socket.io multer --legacy-peer-deps).
```

5. Avvia il Server
Una volta che ha finito di scaricare tutto (vedrai comparire una cartella node_modules nel tuo progetto), sei pronto ad accendere il server:

Bash
```
node server.js
```

Se tutto è andato a buon fine, il terminale ti risponderà con i tuoi messaggi:
🗄️ Database SQLite connesso con successo.
Server avviato e in ascolto!  

A questo punto, apri il browser del computer e vai su http://localhost:3000/index.html e la tua piattaforma prenderà vita! Se vuoi fermare il server in qualsiasi momento, ti basterà premere CTRL + C nel terminale.


To DO:

-Aggiungere possibilità di tirare i dadi e mostrare i risultati sulla chat con "Nome del personaggio ha ha fatto 16 !" ad esempio, usando i dadi d4, d6, d8, d10, d12, d20, d100

-Aggiungere segnalini personaggi sulla mappa interattiva

-Aggiungere possibilità di selezionare vecchie mappe e scorrere in caso siano tante con scroll, già uploadate nella barra a sinistra vicino alla mappa solo per il master nella sua campagna, caricandole dinamicamente e salvandole per l'account. 
