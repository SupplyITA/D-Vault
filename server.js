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
    db.run(`ALTER TABLE schede ADD COLUMN avatar TEXT`, (err) => {}); // ignora errore se esiste già
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

// Aggiunge la colonna "avatar" al DB (se non c'è già)
db.serialize(() => {
    db.run(`ALTER TABLE schede ADD COLUMN avatar TEXT`, (err) => {
        // Ignoriamo l'errore se la colonna esiste già (è normale)
    });
});

// Rotta per legare la foto alla scheda dell'utente nel Database
app.post('/api/sheets/avatar', (req, res) => {
    const { owner, charName, avatarUrl } = req.body;
    db.run(`UPDATE schede SET avatar = ? WHERE owner = ? AND charName = ?`, [avatarUrl, owner, charName], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});


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
    const { username, email, password } = req.body; 
    try {
        const hash = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO utenti (username, email, password) VALUES (?, ?, ?)`, [username, email, hash], function(err) {
            if (err) return res.status(400).json({ message: "Username o Email già in uso!" });
            res.json({ message: "Registrazione completata!" });
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

// --- ROTTE SCHEDE ---
app.get('/api/sheets', (req, res) => {
    db.all(`SELECT * FROM schede WHERE owner = ?`, [req.query.user], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/sheets', (req, res) => {
    const { owner, charName, charClass, charRace, charLevel } = req.body;
    db.run(`INSERT INTO schede (owner, charName, charClass, charRace, charLevel) VALUES (?, ?, ?, ?, ?)`, 
    [owner, charName, charClass, charRace, charLevel], (err) => {
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

app.post('/api/campaigns', (req, res) => {
    const { owner, campName, campSetting, campPlayers, campDesc } = req.body;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    db.run(`INSERT INTO campagne (owner, campName, campSetting, campPlayers, campDesc, inviteCode, joinedPlayers) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
    [owner, campName, campSetting, campPlayers, campDesc, inviteCode, "[]"], (err) => {
        res.json({ success: true, message: "Campagna creata con successo!" });
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

// Socket Connessione alla Chat 
io.on('connection', (socket) => {
    console.log('🟢 Un utente si è connesso al tavolo virtuale!');

    // Comunicazione real time
    socket.on('invia_messaggio', (dati) => {
        socket.broadcast.emit('ricevi_messaggio', dati);
    });

    // NUOVO: Rimbalza le coordinate dei segnalini sulla mappa
    socket.on('invia_segnalino', (coordinate) => {
        socket.broadcast.emit('ricevi_segnalino', coordinate);
    });

    // Cambio mappa per tutti i giocatori connessi
    socket.on('cambia_sfondo_mappa', (url) => {
        socket.broadcast.emit('nuova_mappa_ricevuta', url);
    });

    socket.on('disconnect', () => {
        console.log('🔴 Un utente ha lasciato il tavolo.');
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