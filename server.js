const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
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

app.use(express.json());
app.use(express.static(__dirname));

// --- SETUP DATABASE SQLITE ---
const db = new sqlite3.Database('./dvault.sqlite', (err) => {
    if (err) console.error("Errore DB:", err.message);
    else console.log('🗄️ Database SQLite connesso con successo.');
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

    db.run(`ALTER TABLE campagne ADD COLUMN mapUrl TEXT`, (err) => {}); 
    db.run('ALTER TABLE campagne ADD COLUMN activeCharacters TEXT', (err) => {});
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

// Rotta per ricevere e salvare il file PDF
/*
app.post('/api/upload-pdf', uploadPdf.single('pdfFile'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nessun file ricevuto' });
    res.json({ url: `/uploads/pdfs/${req.file.filename}`, message: 'Scheda PDF caricata!' });
});
*/



// Rotta per legare il link del PDF alla scheda nel Database
/*app.post('/api/sheets/pdf', (req, res) => {
    const { owner, charName, pdfUrl } = req.body;
    db.run(`UPDATE schede SET pdfUrl = ? WHERE owner = ? AND charName = ?`, [pdfUrl, owner, charName], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});*/


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


// Autenticazione degli utenti 
app.post('/api/registrati', async (req, res) => {
    const { username, email, password, fullName, gender } = req.body; 
    
    // Assegna un avatar di default in base al sesso dell'utente
    let defaultAvatar = '/img/avatars/other-1.jpg'; // Default per "n"
    if (gender === 'm') defaultAvatar = '/img/avatars/male-1.jpg';
    if (gender === 'f') defaultAvatar = '/img/avatars/female-1.jpg';
    try {
        const hash = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO utenti (username, email, password, fullName, gender, avatar) VALUES (?, ?, ?, ?, ?, ?)`, 
        [username, email, hash, fullName, gender, defaultAvatar], function(err) {
            if (err) return res.status(400).json({ message: "Username o Email già in uso!" });
            res.json({ message: "Registrazione completata! Benvenuto nel Vault." });
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/login', (req, res) => {
    const { identifier, password } = req.body;
    db.get(`SELECT * FROM utenti WHERE username = ? OR email = ?`, [identifier, identifier], async (err, row) => {
        if (err || !row) return res.status(401).json({ message: "Credenziali errate!" });
        
        const match = await bcrypt.compare(password, row.password);
        if (match) res.json({ message: "Bentornato!", username: row.username });
        else res.status(401).json({ message: "Credenziali errate!" });
    });
});

app.post('/api/reset-password', async (req, res) => {
    const { username, email, newPassword } = req.body;
    const hash = await bcrypt.hash(newPassword, 10);
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
    const { campName, owner, charName } = req.body;
    db.get('SELECT activeCharacters FROM campagne WHERE campName = ?', [campName], (err, row) => {
        if (err || !row) return res.status(404).send();
        
        let active = {}
        try { active = JSON.parse(row.activeCharacters || "{}");} catch(e){}
    
        active[owner] = charName; 
    
        db.run('UPDATE campagne SET activeCharacters = ? WHERE campName = ?', [JSON.stringify(active), campName], () => {
            res.json({success: true});
        });
    });
});

app.get('/api/campaigns/:campName/party', (req, res) => {
    const campName = req.params.campName;
    db.get('SELECT activeCharacters FROM campagne WHERE campName = ?', [campName], (err, row) => {
        if(err || !row) return res.status(404).json({error: "Campagna non trovata"});

        let active = {};
        try { active = JSON.parse(row.activeCharacters || "{}"); } catch(e){}

        const charNames = Object.values(active);
        if (charNames.length === 0) return res.json([]);
        const placeholders = charNames.map(() => '?').join(','); 
        db.all(`SELECT * FROM schede WHERE charName IN (${placeholders})`, charNames, (err, sheets) => {
            if (err) return res.status(500).json({error: err.message});
            const parsedSheets = (sheets || []).map(s => ({
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

// --- RINOMINA CAMPAGNA ---
app.post('/api/campaigns/rename', (req, res) => {
    const { oldName, newName, owner } = req.body;
    db.run(`UPDATE campagne SET campName = ? WHERE campName = ? AND owner = ?`, [newName, oldName, owner], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- RINOMINA EROE ---
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
                    // Se l'owner aveva come eroe attivo "vecchio nome", metti "nuovo nome"
                    if (active[owner] === oldName) {
                        active[owner] = newName;
                        db.run(`UPDATE campagne SET activeCharacters = ? WHERE id = ?`, [JSON.stringify(active), row.id]);
                    }
                } catch(e) {}
            });
            // Tutto sistemato senza fare casino!
            res.json({ success: true });
        });
    });
});

// Socket Connessione alla Chat 
io.on('connection', (socket) => {
    console.log('🟢 Un utente si è connesso al tavolo virtuale!');

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
                testo: `${socket.username} è tornato all'Archivio.`, // <-- Modificato qui
                type: 'system',
                campName: socket.campName
            });
            socket.leave(socket.campName);
            socket.campName = null; 
        }
    });

    // Quando l'utente chiude brutalmente la scheda
    socket.on('disconnect', () => {
        console.log('🔴 Un utente ha lasciato il tavolo.');
        if (socket.username && socket.campName) {
            socket.to(socket.campName).emit('ricevi_messaggio_campagna', {
                mittente: 'Taverniere',
                testo: `${socket.username} è svanito nel nulla (disconnesso).`, // <-- Modificato qui
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
});

// Ho cambiato la parte di app listener, ora usiamo server listener così da poter implementare la chat con socket.io.
// Mi stava dando problemi il sito perché non partiva con le nuove versioni di npm, quindi ne ho installata una fissata più vecchia, 
// se a voi funziona con quelle nuove top, altrimenti direi di usare questa

// Avvio server
server.listen(PORT, () => {
    console.log(`\n Server avviato e in ascolto!`);
    console.log(` Vai al link: http://localhost:${PORT}/index.html\n`);
});