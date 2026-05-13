import { $, escHtml } from './utils.js';
import { State } from './state.js';

export const socket = typeof io !== 'undefined' ? io() : null;

// --- MEMORIA CHAT ---
const chatMemoria = {}; // Salva i messaggi: { "Nome Campagna": [ {sender, text, type}, ... ] }

export async function caricaMemoriaChat(campName, containerId) {
    const container = $(containerId);
    if (!container) return;
    
    container.innerHTML = '<div class="chat-msg system">Tavolo virtuale aperto. Pronti all\'avventura!</div>';
    
    try {
        const res = await fetch(`/api/chat/${encodeURIComponent(campName)}`);
        const messaggi = await res.json();
        
        messaggi.forEach(msg => {
            // Nascondi i sussurri altrui a cui non partecipi
            if (msg.type === 'private' && msg.sender !== State.username && msg.target !== State.username) {
                return; 
            }

            const cssClass = msg.sender === State.username ? 'me' : (msg.type === 'private' ? 'private' : msg.type);
            const privacyTag = msg.type === 'private' ? ` (a ${escHtml(msg.target)})` : '';

            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-msg ${cssClass}`;

            const testoSicuro = (msg.type === 'dice' || msg.type === 'system') ? msg.testo : escHtml(msg.testo);

            msgDiv.innerHTML = `<span class="sender">${escHtml(msg.sender)}${privacyTag}</span>${testoSicuro}`;
            container.appendChild(msgDiv);
        });
        container.scrollTop = container.scrollHeight;
    } catch(e) { console.error("Errore DB Chat:", e); }
}

export function appendChatMessage(sender, text, type, containerId = 'chat-messages') {
  const container = $(containerId);
  if (!container) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${type}`;

  const testoSicuro = (type === 'dice' || type === 'system') ? text : escHtml(text);
  msgDiv.innerHTML = `<span class="sender">${escHtml(sender)}</span>${testoSicuro}`;
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

export function inviaChatCampagna(inputId, containerId, username, campName, targetId) {
    const input = $(inputId);
    const targetSelect = $(targetId);
    if(!input) return;

    const text = input.value.trim();
    const target = targetSelect ? targetSelect.value : 'Tutti';

    if (text && campName) {
        const isPrivate = target !== 'Tutti';
        const type = isPrivate ? 'private' : 'me';
        const privacyTag = isPrivate ? ` (a ${target})` : '';

        // Append localmente per farti vedere cosa hai mandato
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg me`; 
        msgDiv.innerHTML = `<span class="sender">${escHtml(username)}${privacyTag}</span>${escHtml(text)}`;
        $(containerId).appendChild(msgDiv);
        $(containerId).scrollTop = $(containerId).scrollHeight;

        if (socket) {
            if (isPrivate) {
                socket.emit('invia_messaggio_privato', { campName, mittente: username, destinatario: target, testo: text });
            } else {
                socket.emit('invia_messaggio_campagna', { campName, mittente: username, testo: text });
            }
        }
        input.value = '';
    }
}

// Lancio Dadi
export function tiraDado(faccie, username, campName, containerId) {
    // Calcola il risultato (es. da 1 a 20)
    const risultato = Math.floor(Math.random() * faccie) + 1;
    
    // Formatta il messaggio
    const text = `...lancia un d${faccie} e ottiene: <strong>${risultato}</strong>`;
    const type = 'dice'; // Tipo speciale per il CSS

    // Mostra sùbito a te stesso
    appendChatMessage(username, text, type, containerId);

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