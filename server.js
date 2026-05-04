const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'utenti.json');

// Crea il database se non esiste
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// ROTTA REGISTRAZIONE
app.post('/api/registrati', (req, res) => {
    // Riceviamo i dati esatti del tuo form: username, email, password
    const { username, email, password } = req.body; 

    const utenti = JSON.parse(fs.readFileSync(DB_FILE));

    // Controlla se username o email esistono già
    if (utenti.find(u => u.username === username || u.email === email)) {
        return res.status(400).json({ message: "Username o Email già in uso!" });
    }

    // Salva nel file
    utenti.push({ username, email, password });
    fs.writeFileSync(DB_FILE, JSON.stringify(utenti, null, 2));
    
    res.json({ message: "Registrazione completata!" });
});

// ROTTA LOGIN
app.post('/api/login', (req, res) => {
    // Dal tuo HTML, l'input "Email o Username" si chiama "identifier"
    const { identifier, password } = req.body;
    
    const utenti = JSON.parse(fs.readFileSync(DB_FILE));
    
    // Cerca qualcuno che abbia quella password E che combaci con username o email
    const utenteEsistente = utenti.find(u => 
        (u.username === identifier || u.email === identifier) && u.password === password
    );

    if (utenteEsistente) {
        // Rimandiamo indietro il vero username per la dashboard
        res.json({ message: "Bentornato!", username: utenteEsistente.username });
    } else {
        res.status(401).json({ message: "Credenziali errate!" });
    }
});

// ROTTA RESET PASSWORD
app.post('/api/reset-password', (req, res) => {
    // Riceviamo username, email e la nuova password dal form
    const { username, email, newPassword } = req.body;
    
    // Leggiamo tutti gli utenti
    const utenti = JSON.parse(fs.readFileSync(DB_FILE));
    
    // Cerchiamo la POSIZIONE (index) dell'utente che ha esattamente quel nome E quell'email
    const indexUtente = utenti.findIndex(u => u.username === username && u.email === email);

    if (indexUtente !== -1) {
        // Se lo troviamo (l'index non è -1), gli cambiamo la password
        utenti[indexUtente].password = newPassword;
        
        // Salviamo il file aggiornato
        fs.writeFileSync(DB_FILE, JSON.stringify(utenti, null, 2));
        
        res.json({ message: "Password aggiornata con successo! La magia ha funzionato." });
    } else {
        res.status(404).json({ message: "Username o Email non corrispondenti ai nostri archivi." });
    }
});

// --- DATABASE SCHEDE E CAMPAGNE ---
const SHEETS_FILE = path.join(__dirname, 'schede.json');
const CAMPAIGNS_FILE = path.join(__dirname, 'campagne.json');

// Creiamo i file se non esistono
if (!fs.existsSync(SHEETS_FILE)) fs.writeFileSync(SHEETS_FILE, JSON.stringify([]));
if (!fs.existsSync(CAMPAIGNS_FILE)) fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify([]));

// ROTTA PER LEGGERE LE SCHEDE DI UN UTENTE
app.get('/api/sheets', (req, res) => {
    // Prendiamo lo username che il frontend ci passerà nell'URL (es: /api/sheets?user=Avventuriero)
    const user = req.query.user; 
    const sheets = JSON.parse(fs.readFileSync(SHEETS_FILE));
    
    // Filtriamo solo le schede appartenenti a questo utente
    const userSheets = sheets.filter(s => s.owner === user);
    res.json(userSheets);
});

// ROTTA PER SALVARE UNA NUOVA SCHEDA
app.post('/api/sheets', (req, res) => {
    const data = req.body;
    const sheets = JSON.parse(fs.readFileSync(SHEETS_FILE));
    
    sheets.push(data);
    fs.writeFileSync(SHEETS_FILE, JSON.stringify(sheets, null, 2));
    
    res.json({ success: true, message: "Scheda forgiata con successo!" });
});

// ROTTA PER LEGGERE LE CAMPAGNE DI UN UTENTE 
app.get('/api/campaigns', (req, res) => {
    const user = req.query.user;
    const campaigns = JSON.parse(fs.readFileSync(CAMPAIGNS_FILE));
    
    // Filtriamo: sei il proprietario OPPURE sei nella lista joinedPlayers
    const userCampaigns = campaigns.filter(c => 
        c.owner === user || (c.joinedPlayers && c.joinedPlayers.includes(user))
    );
    res.json(userCampaigns);
});

// ROTTA PER SALVARE UNA NUOVA CAMPAGNA
app.post('/api/campaigns', (req, res) => {
    const data = req.body;
    const campaigns = JSON.parse(fs.readFileSync(CAMPAIGNS_FILE));
    
    // Generiamo un codice alfanumerico casuale di 6 caratteri (es. X7Y9Z1)
    data.inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Creiamo una lista vuota per i futuri giocatori
    data.joinedPlayers = []; 
    
    campaigns.push(data);
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
    
    res.json({ success: true, message: "Campagna creata con successo!" });
});

// ROTTA PER ELIMINARE UNA SCHEDA
app.delete('/api/sheets/:name', (req, res) => {
    const user = req.query.user; // Chi sta chiedendo l'eliminazione
    const charName = req.params.name; // Il nome del personaggio da eliminare
    
    let sheets = JSON.parse(fs.readFileSync(SHEETS_FILE));
    
    // Filtriamo l'array: teniamo tutte le schede TRANNE quella con questo nome e proprietario
    sheets = sheets.filter(s => !(s.owner === user && s.charName === charName));
    
    fs.writeFileSync(SHEETS_FILE, JSON.stringify(sheets, null, 2));
    res.json({ message: "Scheda eliminata!" });
});

// ROTTA PER ELIMINARE UNA CAMPAGNA
app.delete('/api/campaigns/:name', (req, res) => {
    const user = req.query.user;
    const campName = req.params.name;
    
    let campaigns = JSON.parse(fs.readFileSync(CAMPAIGNS_FILE));
    
    // Stessa cosa: teniamo tutto tranne questa specifica campagna
    campaigns = campaigns.filter(c => !(c.owner === user && c.campName === campName));
    
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
    res.json({ message: "Campagna eliminata!" });
});

// ROTTA PER UNIRSI A UNA CAMPAGNA CON IL CODICE
app.post('/api/campaigns/join', (req, res) => {
    const { inviteCode, username } = req.body;
    const campaigns = JSON.parse(fs.readFileSync(CAMPAIGNS_FILE));
    
    // Cerchiamo la campagna che ha esattamente questo codice
    const campaign = campaigns.find(c => c.inviteCode === inviteCode);

    if (!campaign) {
        return res.status(404).json({ message: "Codice invito non valido! È un'illusione!" });
    }

    if (campaign.owner === username) {
        return res.status(400).json({ message: "Sei già il Master di questa campagna!" });
    }

    // Se l'array non esiste (per vecchie campagne), lo creiamo
    if (!campaign.joinedPlayers) campaign.joinedPlayers = [];

    if (campaign.joinedPlayers.includes(username)) {
        return res.status(400).json({ message: "Sei già nel party di questa avventura!" });
    }

    // Aggiungiamo il giocatore alla lista e salviamo
    campaign.joinedPlayers.push(username);
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));

    res.json({ message: "Ti sei unito alla campagna con successo! Prepara i dadi." });
});


app.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
});