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

app.listen(PORT, () => {
    console.log(`Server avviato su http://localhost:${PORT}`);
});