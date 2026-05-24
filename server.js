const express = require('express'); // Express è il framework che ci permette di creare un server in Node.js in modo semplice, gestisce le rotte, 
// le richieste e le risposte HTTP, così da poter comunicare con il nostro frontend facilmente e senza dover scrivere troppo codice per gestire tutto a mano.
const path = require('path');
const bcrypt = require('bcrypt'); // Bcrypt è una libreria fighissima, permette di hashare le password in modo sicuro, così che vengano immediatamente trasformate in codice
// incomprensibile prima di essere salvate nel database, così da renderlo sicuro ed evitare che vengano viste le password da coloro che possono leggere il database
// Nel codice, bcrypt semplicemente legge la password già hashata e la confronta , così permette di loggarsi senza problemi

const sqlite3 = require('sqlite3').verbose();
const http = require('http'); 
const { Server } = require('socket.io'); 
const multer = require('multer'); // questo e quello sotto servono per gestire l'upload delle immagini della mappa, sono fissato con sta roba mi dispiace aggiungo tanto
// spero non esploda il server per via del peso
const fs = require('fs');

const app = express();
const server = http.createServer(app); // Questo è per express in un server HTTP
const io = new Server(server); // Questo è per Socket.io
const PORT = 3000;

app.use(express.json()); // Questo serve ad Express per capire se i dati sono in formato json, prima di passarli alle varie funzioni (login/register etc)
app.use(express.static(__dirname));

// Database SQLite
const db = new sqlite3.Database('./dvault.sqlite', (err) => {
    if (err) console.error("Errore DB:", err.message);
    else console.log(' Database SQLite connesso con successo.'); 
});


// Creazione Tabelle Relazionali
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS utenti (
        id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, email TEXT UNIQUE, password TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS schede (
        id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT, charName TEXT, charClass TEXT, charRace TEXT, charLevel INTEGER
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS campagne (
        id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT, campName TEXT, campSetting TEXT, campPlayers INTEGER, campDesc TEXT, inviteCode TEXT UNIQUE, joinedPlayers TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS chat_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, campName TEXT, sender TEXT, target TEXT, testo TEXT, type TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`ALTER TABLE schede ADD COLUMN avatar TEXT`, (err) => {});
    db.run(`ALTER TABLE schede ADD COLUMN charGender TEXT`, (err) => {}); 
    
    //per poter caricare le mappe da url
    db.run(`ALTER TABLE campagne ADD COLUMN mapUrl TEXT`, (err) => {}); 

    // per visualizzare i player in campagna
    db.run('ALTER TABLE campagne ADD COLUMN activeCharacters TEXT', (err) => {});

    //per salvare le mappe caricate in precedenza
    db.run(`ALTER TABLE campagne ADD COLUMN mapHistory TEXT DEFAULT '[]'`, (err) => {});
});

// QUesto è per uploadare l'avatar del personaggio.
const avatarDir = path.join(__dirname, 'uploads', 'avatars');
// Crea la cartella automaticamente
if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true });
}

// Configurazione Multer per i ritratti
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarDir),
    filename: (req, file, cb) => {
        const nomeUnico = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + nomeUnico + path.extname(file.originalname));
    }
});
const uploadAvatar = multer({ storage: avatarStorage });

// Rotta per ricevere e salvare la foto del personaggio
app.post('/api/upload-avatar', uploadAvatar.single('avatarImage'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nessun file ricevuto' });
    res.json({ url: `/uploads/avatars/${req.file.filename}`, message: 'Ritratto caricato!' });
});

// Aggiunge la colonna "avatar", "pdfUrl", "details" e "playerNotes" al DB
db.serialize(() => {
    db.run(`ALTER TABLE schede ADD COLUMN avatar TEXT`, (err) => {});
    db.run(`ALTER TABLE schede ADD COLUMN pdfUrl TEXT`, (err) => {});
    db.run(`ALTER TABLE schede ADD COLUMN details TEXT`, (err) => {});
    db.run(`ALTER TABLE schede ADD COLUMN playerNotes TEXT`, (err) => {});

    db.run(`ALTER TABLE utenti ADD COLUMN fullName TEXT`, (err) => {});
    db.run(`ALTER TABLE utenti ADD COLUMN gender TEXT`, (err) => {});
    db.run(`ALTER TABLE utenti ADD COLUMN avatar TEXT`, (err) => {});
});

// Rotta per legare la foto alla scheda dell'utente nel Database
app.post('/api/sheets/avatar', (req, res) => {
    const { owner, charName, avatarUrl } = req.body;
    db.run(`UPDATE schede SET avatar = ? WHERE owner = ? AND charName = ?`, [avatarUrl, owner, charName], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Upload schede in PDF, stessa cosa di sopra ma con i PDF, così i giocatori possono caricare la scheda compilata e averla sempre a portata di mano nella dashboard, senza doverla ricompilare ogni volta.
const pdfDir = path.join(__dirname, 'uploads', 'pdfs');
// Crea la cartella automaticamente
if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
}

// Configurazione Multer per i file PDF
const pdfStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, pdfDir),
    filename: (req, file, cb) => {
        const nomeUnico = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'scheda-' + nomeUnico + '.pdf');
    }
});

// Configurazione Multer per gli Avatar
const storageAvatar = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/avatars'; // Cartella corretta
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadPdf = multer({ storage: pdfStorage });

const uploadDir = path.join(__dirname, 'uploads', 'maps');
// Crea la cartella in maniera dinamica (figata)
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Questo è per decidere dove e come chiamare il file da caricare
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        // Genera un nome unico per evitare che due master sovrascrivano "mappa.jpg"
        const nomeUnico = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.body.username + '-' + nomeUnico + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Questo ci permette di ricevere i file caricati dal master e salvarli in cartelle dinamiche per ogni master
app.post('/api/upload-map', upload.single('mapImage'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nessun file ricevuto' });
    
    // Costruisce l'URL pubblico dell'immagine appena salvata
    const fileUrl = `/uploads/maps/${req.file.filename}`;
    res.json({ url: fileUrl, message: 'Mappa caricata con successo!' });
});

// Upload delle canzoni per il master
const audioDir = path.join(__dirname, 'uploads', 'audio');
if (!fs.existsSync(audioDir)) { fs.mkdirSync(audioDir, { recursive: true }); }

const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, audioDir),
    filename: (req, file, cb) => {
        const nomeUnico = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'bardo-' + nomeUnico + path.extname(file.originalname));
    }
});
const uploadAudio = multer({ storage: audioStorage });

app.post('/api/upload-audio', uploadAudio.single('audioFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nessun file ricevuto' });
    res.json({ url: `/uploads/audio/${req.file.filename}`, message: 'Brano caricato!' });
});

// Registrazione degli utenti 
app.post('/api/registrati', async (req, res) => {
    const { username, email, password, fullName, gender } = req.body; 
    
    // Assegna un avatar di default in base al sesso dell'utente
    let defaultAvatar = '/img/avatars/other-1.jpg'; // Default per "n"
    if (gender === 'm') defaultAvatar = '/img/avatars/male-1.jpg';
    if (gender === 'f') defaultAvatar = '/img/avatars/female-1.jpg';
    try {
        const hash = await bcrypt.hash(password, 10); // bcrypt è la libreria più figa, permette di eseguire 
        // un hashing delle password per evitare che vengano viste

        db.run(`INSERT INTO utenti (username, email, password, fullName, gender, avatar) VALUES (?, ?, ?, ?, ?, ?)`, 
        [username, email, hash, fullName, gender, defaultAvatar], function(err) {
            if (err) return res.status(400).json({ message: "Username o Email già in uso!" });
            res.json({ message: "Registrazione completata! Benvenuto nel Vault." });
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Login degli utenti
app.post('/api/login', (req, res) => {
    const { identifier, password } = req.body;
    db.get(`SELECT * FROM utenti WHERE username = ? OR email = ?`, [identifier, identifier], async (err, row) => {
        if (err || !row) return res.status(401).json({ message: "Credenziali errate!" });
        
        const match = await bcrypt.compare(password, row.password); // Confronta la password inserita con l'hash salvato in sqlite, 
        // così da non riscoprire la password originale nemmeno nel database. E' molto più sicuro (il corso di cybesecurity è servito a qualcosa)

        if (match) res.json({ message: "Bentornato!", username: row.username });
        else res.status(401).json({ message: "Credenziali errate!" });
    });
});

app.post('/api/reset-password', async (req, res) => {
    const { username, email, newPassword } = req.body;
    const hash = await bcrypt.hash(newPassword, 10); // Esegue un Hash della password appena scritta prima di salvarla, verrà poi salvata nel database per il login, 
    // identico a come funziona per la registrazione
    db.run(`UPDATE utenti SET password = ? WHERE username = ? AND email = ?`, [hash, username, email], function(err) {
        if (this.changes > 0) res.json({ message: "Password aggiornata con successo! La magia ha funzionato." });
        else res.status(404).json({ message: "Username o Email non corrispondenti." });
    });
});

// Recupera le informazioni complete dell'utente per la sezione Account
app.get('/api/user-info', (req, res) => {
    const { username } = req.query;
    db.get(`SELECT email, fullName, gender, avatar FROM utenti WHERE username = ?`, [username], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Utente non trovato" });
        res.json(row);
    });
});

// ELIMINAZIONE TOTALE ACCOUNT
app.delete('/api/delete-account', (req, res) => {
    const { username } = req.query;
    
    db.serialize(() => {
        // Cancella l'utente dal database
        db.run(`DELETE FROM utenti WHERE username = ?`, [username]);
        // Cancella tutte le schede che ha creato
        db.run(`DELETE FROM schede WHERE owner = ?`, [username]);
        // Cancella tutte le campagne in cui era Master
        db.run(`DELETE FROM campagne WHERE owner = ?`, [username]);
        
        // Cerca in TUTTE le campagne rimaste e rimuovilo se era ospite
        db.all(`SELECT id, joinedPlayers, activeCharacters FROM campagne`, [], (err, rows) => {
            if (!err && rows) {
                rows.forEach(row => {
                    let needsUpdate = false;
                    
                    // Rimuove il giocatore dalla lista degli invitati
                    let players = [];
                    try { players = JSON.parse(row.joinedPlayers || "[]"); } catch(e){}
                    if (players.includes(username)) {
                        players = players.filter(p => p !== username);
                        needsUpdate = true;
                    }

                    // Rimuove il suo eroe dai personaggi attivi al tavolo
                    let active = {};
                    try { active = JSON.parse(row.activeCharacters || "{}"); } catch(e){}
                    if (active[username]) {
                        delete active[username];
                        needsUpdate = true;
                    }

                    // Se abbiamo trovato e rimosso l'utente, aggiorniamo quella campagna
                    if (needsUpdate) {
                        db.run(`UPDATE campagne SET joinedPlayers = ?, activeCharacters = ? WHERE id = ?`, 
                            [JSON.stringify(players), JSON.stringify(active), row.id]);
                    }
                });
            }
            // Risponde al browser solo quando la pulizia globale è finita
            res.json({ success: true, message: "Account epurato dal Vault e da tutte le taverne." });
        });
    });
});

// AGGIORNA EMAIL UTENTE
app.post('/api/update-email', (req, res) => {
    const { username, newEmail } = req.body;
    db.run(`UPDATE utenti SET email = ? WHERE username = ?`, [newEmail, username], function(err) {
        if (err) return res.status(400).json({ message: "Email già in uso o non valida." });
        res.json({ success: true, message: "Email aggiornata!" });
    });
});

// AGGIORNA AVATAR UTENTE 
app.post('/api/user/avatar', (req, res) => {
    const { username, avatarUrl } = req.body;
    db.run(`UPDATE utenti SET avatar = ? WHERE username = ?`, [avatarUrl, username], (err) => {
        if (err) return res.status(500).json({ error: "Errore salvataggio avatar" });
        res.json({ success: true });
    });
});

// ROTTA PER CARICARE L'AVATAR PERSONALE
app.post('/api/user/upload-avatar', uploadAvatar.single('avatar'), (req, res) => {
    const { username } = req.body;
    if (!req.file) return res.status(400).json({ message: "Nessun file caricato" });

    const avatarPath = `/uploads/avatars/${req.file.filename}`;

    // Aggiorna il database con il nuovo percorso
    db.run(`UPDATE utenti SET avatar = ? WHERE username = ?`, [avatarPath, username], (err) => {
        if (err) return res.status(500).json({ message: "Errore database" });
        res.json({ success: true, avatarUrl: avatarPath });
    });
});

app.post('/api/sheets', (req, res) => {
    const { owner, charName, charClass, charRace, charGender, charLevel, avatar } = req.body;
    db.run(`INSERT INTO schede (owner, charName, charClass, charRace, charGender, charLevel, avatar) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
    [owner, charName, charClass, charRace, charGender, charLevel, avatar], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Scheda forgiata con successo!" });
    });
});

app.delete('/api/sheets/:name', (req, res) => {
    db.run(`DELETE FROM schede WHERE owner = ? AND charName = ?`, [req.query.user, req.params.name], (err) => {
        res.json({ message: "Scheda eliminata!" });
    });
});

// Indirizzamento campagne 
app.get('/api/campaigns', (req, res) => {
    const user = req.query.user;
    db.all(`SELECT * FROM campagne`, [], (err, rows) => {
        if (!rows) return res.json([]);
        const parsedRows = rows.map(r => ({...r, joinedPlayers: JSON.parse(r.joinedPlayers || "[]")}));
        const userCampaigns = parsedRows.filter(c => c.owner === user || c.joinedPlayers.includes(user));
        res.json(userCampaigns);
    });
});

// Rotta per CREARE una nuova campagna
app.post('/api/campaigns', (req, res) => {
    // Aggiunto campPlayers che arriva dal form
    const { campName, campSetting, campPlayers, owner } = req.body;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const defaultMap = '/maps/mappa_1.jpg'; // La tua mappa di default

    // Inseriamo campPlayers nella query (se è vuoto, usa 4 di default)
    db.run(`INSERT INTO campagne (owner, campName, campSetting, campPlayers, inviteCode, joinedPlayers, mapUrl) VALUES (?, ?, ?, ?, ?, '[]', ?)`, 
    [owner, campName, campSetting, campPlayers || 4, inviteCode, defaultMap], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Campagna creata con successo!" });
    });
});

// Rotta per AGGIORNARE la mappa esistente
app.post('/api/campaigns/map', (req, res) => {
    const { campName, owner, mapUrl } = req.body;
    db.run(`UPDATE campagne SET mapUrl = ? WHERE campName = ? AND owner = ?`, 
    [mapUrl, campName, owner], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Mappa salvata nel DB!" });
    });
});

app.delete('/api/campaigns/:name', (req, res) => {
    db.run(`DELETE FROM campagne WHERE owner = ? AND campName = ?`, [req.query.user, req.params.name], (err) => {
        res.json({ message: "Campagna eliminata!" });
    });
});

app.post('/api/campaigns/join', (req, res) => {
    const { inviteCode, username } = req.body;
    db.get(`SELECT * FROM campagne WHERE inviteCode = ?`, [inviteCode], (err, row) => {
        if (!row) return res.status(404).json({ message: "Codice invito non valido!" });
        if (row.owner === username) return res.status(400).json({ message: "Sei già il Master di questa campagna!" });
        
        let players = JSON.parse(row.joinedPlayers || "[]");
        if (players.includes(username)) return res.status(400).json({ message: "Sei già nel party!" });
        
        players.push(username);
        db.run(`UPDATE campagne SET joinedPlayers = ? WHERE id = ?`, [JSON.stringify(players), row.id], (err) => {
            res.json({ message: "Ti sei unito alla campagna con successo!" });
        });
    });
});

app.post('/api/campaigns/leave', (req, res) => {
    const { inviteCode, username } = req.body;
    
    db.get(`SELECT * FROM campagne WHERE inviteCode = ?`, [inviteCode], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Campagna non trovata" });
        
        // Rimuove il giocatore dalla lista dei partecipanti
        let players = JSON.parse(row.joinedPlayers || "[]");
        players = players.filter(p => p !== username); 
        
        // Rimuove l'eroe eventualmente selezionato per evitare "fantasmi" al tavolo
        let active = {};
        try { active = JSON.parse(row.activeCharacters || "{}"); } catch(e){}
        delete active[username];
        
        // Salva tutto in modo pulito
        db.run(`UPDATE campagne SET joinedPlayers = ?, activeCharacters = ? WHERE id = ?`, 
        [JSON.stringify(players), JSON.stringify(active), row.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: "Hai abbandonato la campagna." });
        });
    });
});

// Salva i campi interattivi della scheda
app.get('/api/sheets', (req, res) => {
    db.all(`SELECT * FROM schede WHERE owner = ?`, [req.query.user], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Traduce il testo salvato nel DB in un vero oggetto per la scheda interattiva
        const parsedRows = (rows || []).map(r => ({
            ...r,
            sheetDataDetails: r.details ? JSON.parse(r.details) : {}
        }));
        res.json(parsedRows);
    });
});

// Mostra le schede dei giocatori iscritti alla campagna al Master
app.post('/api/campaigns/set-active-char', (req, res) => {
    // Questa parte è per selezionare il giocatore e ricollegarlo a quale personaggio sta giocando
    const { campName, owner, charName } = req.body;
    // Qui invece il server ottiene lo username del player e il nome dell'eroe
    db.get('SELECT activeCharacters FROM campagne WHERE campName = ?', [campName], (err, row) => {
        if (err || !row) return res.status(404).send();
        
        // Q questo punto il server chiede alla tabella campagne quali giocatori sono connessi (attivi), la qualke contiene una stringa JSON con tutti i dettagli
        let active = {}
        try { active = JSON.parse(row.activeCharacters || "{}");} catch(e){}
    
        // Qui facciamo un controllo per assicurarci che la stringa da Database venga convertita in oggetto Javascript con .parse (come facciamo per il Lab di Ing inf). Se la colonna
        // è vuota, usiamo {}

        // po sovrascriviamo o aggiungiamo la chiave dell'utente con il nome del pg, ovvero se vogliamo cambiare personaggio quando ci colleghiamo alla campagna (Anche se non accade praticamente mai)

        active[owner] = charName; 
    
        // INfine l'oggetto viene ritrasformato in stringa di testo puro con stringify ed inviato al file SQL
        db.run('UPDATE campagne SET activeCharacters = ? WHERE campName = ?', [JSON.stringify(active), campName], () => {
            res.json({success: true});
        });
    });
});

// questo invece serve al master per poter visualizzare le schede dei player 
app.get('/api/campaigns/:campName/party', (req, res) => {

    // qui prende i vari payload e li analizza per capire quali giocatori sta considerando, chi sono etc, presi da SQL
    const campName = req.params.campName;
    db.get('SELECT activeCharacters FROM campagne WHERE campName = ?', [campName], (err, row) => {
        if(err || !row) return res.status(404).json({error: "Campagna non trovata"});

        let active = {};
        try { active = JSON.parse(row.activeCharacters || "{}"); } catch(e){}

        // a questo punto estrae i nomi dei personaggi (di tuttti i giocatori insomma), li salva in array permettendogli poi di visualizzarli
        const charNames = Object.values(active);
        if (charNames.length === 0) return res.json([]);

        // piccola chicca, questo ci assicura che il server non sappia quanti player ci siano a priori, visto che la campagna può avere dai 3 ai 6 / 7 giocatori 
        // (o di più ma vorrei conoscere il party che ha così tanti giocatori), quindi si assicura che non cerchi di capire quante persone ci sono, inserisce solo dei ? per l'array di giocatori
        const placeholders = charNames.map(() => '?').join(','); 
        db.all(`SELECT * FROM schede WHERE charName IN (${placeholders})`, charNames, (err, sheets) => {
            if (err) return res.status(500).json({error: err.message});
            const parsedSheets = (sheets || []).map(s => ({ // la funzione map estrae la lunghissima riga di testo che contiene tutti i dati della scheda e li inserisce in sheetdataDetails 
            // (quella  che contiene tutti i dettagli delle schede)
                ...s,
                sheetDataDetails: s.details ? JSON.parse(s.details) : {}
            }));
            res.json(parsedSheets);
        });
    });
});

// Salva i campi interattivi della scheda su SQLITE
app.post('/api/sheets/update-details', (req, res) => {
    const { owner, charName, details } = req.body;
    const detailsJson = JSON.stringify(details); // Trasforma i dati in stringa per il DB
    
    db.run(`UPDATE schede SET details = ? WHERE owner = ? AND charName = ?`, [detailsJson, owner, charName], function(err) {
        if (err) {
            console.error("Errore Database:", err);
            return res.status(500).json({ error: "Errore interno" });
        }
        if (this.changes > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Scheda non trovata" });
        }
    });
});

// per salvare il livello del personaggio
app.post('/api/sheets/update-level', (req, res) => {
    const { owner, charName, charLevel } = req.body;
    
    db.run(`UPDATE schede SET charLevel = ? WHERE owner = ? AND charName = ?`, [charLevel, owner, charName], function(err) {
        if (err) return res.status(500).json({ error: "Errore interno" });
        res.json({ success: true });
    });
});

// Recupera una scheda singola (per il Master)
app.get('/api/sheets/by-name', (req, res) => {
    const charName = req.query.charName;
    db.get(`SELECT * FROM schede WHERE charName = ?`, [charName], (err, row) => {
        if (err) return res.status(500).json({ error: "Errore server" });
        if (row) {
            row.sheetDataDetails = row.details ? JSON.parse(row.details) : {};
            res.json(row);
        } else {
            res.status(404).json({ error: "Non trovato" });
        }
    });
});

// Rotta per salvare la Storia/Appunti del Master
app.post('/api/campaigns/story', (req, res) => {
    const { campName, owner, story } = req.body;
    db.run(`UPDATE campagne SET campDesc = ? WHERE campName = ? AND owner = ?`, 
    [story, campName, owner], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Rotta per salvare gli Appunti del Personaggio 
app.post('/api/sheets/notes', (req, res) => {
    const { owner, charName, notes } = req.body;
    db.run(`UPDATE schede SET playerNotes = ? WHERE owner = ? AND charName = ?`, 
    [notes, owner, charName], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Rotta per resettare TUTTE le note di un utente in un colpo solo
app.post('/api/sheets/reset-all-notes', (req, res) => {
    const { owner } = req.body;
    db.run(`UPDATE schede SET playerNotes = '' WHERE owner = ?`, [owner], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Tutte le pergamene sono state ripulite." });
    });
});

// Per salvare la chat
app.get('/api/chat/:campName', (req, res) => {
    db.all(`SELECT * FROM chat_logs WHERE campName = ? ORDER BY id ASC`, [req.params.campName], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Per rinominare la campagna
app.post('/api/campaigns/rename', (req, res) => {
    const { oldName, newName, owner } = req.body;
    db.run(`UPDATE campagne SET campName = ? WHERE campName = ? AND owner = ?`, [newName, oldName, owner], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

//Per mettere una storia delle mappe

app.post('/api/campaigns/map-history', (req, res) => {
    const { campName, owner, mapHistory } = req.body;
    db.run(`UPDATE campagne SET mapHistory = ? WHERE campName = ? AND owner = ?`, 
    [mapHistory, campName, owner], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: "Storico mappe aggiornato nel DB!" });
    });
});

// Pere rinomnare la scheda
app.post('/api/sheets/rename', (req, res) => {
    const { oldName, newName, owner } = req.body;
    
    // Cambia il nome nella tabella schede
    db.run(`UPDATE schede SET charName = ? WHERE charName = ? AND owner = ?`, [newName, oldName, owner], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Vai a cercare in TUTTE le campagne se questo giocatore stava usando il vecchio nome
        db.all(`SELECT id, activeCharacters FROM campagne`, [], (err, rows) => {
            if (err || !rows) return res.json({ success: true }); 
            
            rows.forEach(row => {
                try {
                    let active = JSON.parse(row.activeCharacters || "{}");
                    if (active[owner] === oldName) {
                        active[owner] = newName;
                        db.run(`UPDATE campagne SET activeCharacters = ? WHERE id = ?`, [JSON.stringify(active), row.id]);
                    }
                } catch(e) {}
            });
            res.json({ success: true });
        });
    });
});

// Socket Connessione alla Chat 
io.on('connection', (socket) => {
    console.log('Un utente si è connesso al tavolo virtuale! ✔✔✔  ');

    // Comunicazione real time
    socket.on('invia_messaggio', (dati) => {
        socket.broadcast.emit('ricevi_messaggio', dati);
    });

    // Rimbalza le coordinate dei segnalini sulla mappa
    socket.on('invia_segnalino', (coordinate) => {
        socket.broadcast.emit('ricevi_segnalino', coordinate);
    });

    socket.on('rimuovi_segnalino', (latlng) => {
    // Rimbalza l'ordine di rimozione a tutti gli altri client
    socket.broadcast.emit('segnalino_rimosso', latlng);
    });

    // Cambio mappa per tutti i giocatori connessi
    socket.on('cambia_sfondo_mappa', (url) => {
        socket.broadcast.emit('nuova_mappa_ricevuta', url);
    });

    // Entra in una stanza specifica
    socket.on('entra_stanza_campagna', (dati) => {
        const { campName, username } = dati;
        socket.join(campName);
        socket.join(`${campName}_${username}`);
        
        socket.username = username;
        socket.campName = campName;

        socket.to(campName).emit('ricevi_messaggio_campagna', {
            mittente: 'Taverniere',
            testo: `${username} ha varcato la soglia del tavolo.`, 
            type: 'system',
            campName: campName
        });
    });

    // Quando l'utente preme "Torna all'archivio"
    socket.on('esci_stanza_campagna', () => {
        if (socket.username && socket.campName) {
            socket.to(socket.campName).emit('ricevi_messaggio_campagna', {
                mittente: 'Taverniere',
                testo: `${socket.username} è tornato all'Archivio.`,
                type: 'system',
                campName: socket.campName
            });
            socket.leave(socket.campName);
            socket.campName = null; 
        }
    });

    // Quando l'utente chiude brutalmente la scheda
    socket.on('disconnect', () => {
        console.log('Un utente ha lasciato il tavolo. XXX');
        if (socket.username && socket.campName) {
            socket.to(socket.campName).emit('ricevi_messaggio_campagna', {
                mittente: 'Taverniere',
                testo: `${socket.username} è svanito nel nulla (disconnesso).`, 
                type: 'system',
                campName: socket.campName
            });
        }
    });

    // Invia un messaggio SOLO a chi è dentro la stanza
    socket.on('invia_messaggio_campagna', (dati) => {
        // Salva in SQLite
        db.run(`INSERT INTO chat_logs (campName, sender, target, testo, type) VALUES (?, ?, 'Tutti', ?, ?)`, 
            [dati.campName, dati.mittente, dati.testo, dati.type || 'other']);
            
        socket.to(dati.campName).emit('ricevi_messaggio_campagna', dati);
    });

    // Invia un SUSSURRO PRIVATO
    socket.on('invia_messaggio_privato', (dati) => {
        const { campName, mittente, destinatario, testo } = dati;
        
        // Salva in SQLite
        db.run(`INSERT INTO chat_logs (campName, sender, target, testo, type) VALUES (?, ?, ?, ?, 'private')`, 
            [campName, mittente, destinatario, testo]);

        // Invia al destinatario specifico tramite la sua stanza privata
        socket.to(`${campName}_${destinatario}`).emit('ricevi_messaggio_privato', dati);
        
        // Invia indicatore a tutta la stanza
        socket.to(campName).emit('indicatore_sussurro', { mittente, destinatario });
    });

    // Invia un messaggio quando il master aggiorna/elimina la campagna
    socket.on('forza_aggiornamento_globale', () => {
        socket.broadcast.emit('ricarica_dati');
    });

    // Messaggio al giocatore esiliato dal Master
    socket.on('esilia_giocatore', (dati) => {
        socket.to(dati.campName).emit('ricevi_esilio', dati);
    });

    // Aggiorna la lista degli eroi (Master)
    socket.on('player_scelto_eroe', (dati) => {
        socket.to(dati.campName).emit('aggiorna_lista_party', dati);
    });

    // Cambio musica per tutti i giocatori della campagna
    socket.on('cambia_musica_campagna', (dati) => {
        socket.to(dati.campName).emit('nuova_musica_ricevuta', dati.url);
    });
});

// Ho cambiato la parte di app listener, ora usiamo server listener così da poter implementare la chat con socket.io.
// Mi stava dando problemi il sito perché non partiva con le nuove versioni di npm, quindi ne ho installata una fissata più vecchia, 
// se a voi funziona con quelle nuove top, altrimenti direi di usare questa

// Avvio server
server.listen(PORT, () => {
    console.log(`\n Server avviato e in ascolto!`);
    console.log(` Vai al link: http://localhost:${PORT}/index.html\n`);
});