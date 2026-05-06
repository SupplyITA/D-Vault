import { $, escHtml } from './utils.js';

// Connessione socket esportata per essere usata nel main
export const socket = typeof io !== 'undefined' ? io() : null;

export function appendChatMessage(sender, text, type, containerId = 'chat-messages') {
  const container = $(containerId);
  if (!container) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${type}`;
  msgDiv.innerHTML = `<span class="sender">${escHtml(sender)}</span>${escHtml(text)}`;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

// Funzione unificata per evitare duplicazioni nei listener dei tasti "Invia"
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