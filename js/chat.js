import { $, escHtml } from './utils.js';

export const socket = typeof io !== 'undefined' ? io() : null;

// --- MEMORIA CHAT ---
const chatMemoria = {}; // Salva i messaggi: { "Nome Campagna": [ {sender, text, type}, ... ] }

export function salvaMessaggioInMemoria(campName, sender, text, type) {
    if (!chatMemoria[campName]) chatMemoria[campName] = [];
    chatMemoria[campName].push({ sender, text, type });
}

export function caricaMemoriaChat(campName, containerId) {
    const container = $(containerId);
    if (!container) return;
    
    container.innerHTML = '<div class="chat-msg system">Tavolo virtuale aperto. Pronti all\'avventura!</div>';
    if (chatMemoria[campName]) {
        chatMemoria[campName].forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-msg ${msg.type}`;
            msgDiv.innerHTML = `<span class="sender">${escHtml(msg.sender)}</span>${escHtml(msg.text)}`;
            container.appendChild(msgDiv);
        });
        container.scrollTop = container.scrollHeight;
    }
}

export function appendChatMessage(sender, text, type, containerId = 'chat-messages') {
  const container = $(containerId);
  if (!container) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${type}`;
  msgDiv.innerHTML = `<span class="sender">${escHtml(sender)}</span>${escHtml(text)}`;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

export function gestisciInvioChat(inputId, containerId, username) {
    const input = $(inputId);
    if(!input) return;
    const text = input.value.trim();
    if (text) {
        appendChatMessage(username, text, 'me', containerId);
        if (socket) socket.emit('invia_messaggio', { mittente: username, testo: text });
        input.value = '';
    }
}

export function inviaChatCampagna(inputId, containerId, username, campName) {
    const input = $(inputId);
    if(!input) return;
    const text = input.value.trim();
    if (text && campName) {
        appendChatMessage(username, text, 'me', containerId);
        salvaMessaggioInMemoria(campName, username, text, 'me'); // <--- Salva il tuo messaggio
        if (socket) socket.emit('invia_messaggio_campagna', { mittente: username, testo: text, campName: campName });
        input.value = '';
    }
}

// --- LANCIO DEI DADI ---
export function tiraDado(faccie, username, campName, containerId) {
    // Calcola il risultato (es. da 1 a 20)
    const risultato = Math.floor(Math.random() * faccie) + 1;
    
    // Formatta il messaggio
    const text = `...lancia un d${faccie} e ottiene: **${risultato}**`;
    const type = 'dice'; // Tipo speciale per il CSS

    // Mostra sùbito a te stesso
    appendChatMessage(username, text, type, containerId);
    salvaMessaggioInMemoria(campName, username, text, type);

    // Invia al server per mostrarlo agli altri
    if (socket) {
        socket.emit('invia_messaggio_campagna', { 
            mittente: username, 
            testo: text, 
            type: type, 
            campName: campName 
        });
    }
}