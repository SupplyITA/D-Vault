import { $, escHtml, openModal, closeModal, closeDropdown, closeDetails } from './utils.js';
import { State } from './state.js';
import { socket, appendChatMessage, gestisciInvioChat, inviaChatCampagna, caricaMemoriaChat, tiraDado } from './chat.js';
import { renderDropdowns, renderGrid, renderizzaBestiario } from './ui.js';
import { costruisciSchedaInterattiva } from './interactive-sheet.js';
import { dndData } from './dnd-data.js';
import { PDFDocument } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import { AudioManager } from './audio.js';

// Variabili globali per Map e Vue
let leafletMap = null;
let playerLeafletMap = null; 
let vueData = null; 
let currentImageOverlay = null;

let activeTokenType = 'color'; // Può essere 'color' o 'image'
let activeTokenUrl = null;

// FUnzione per generare un colore univoco n base al nome utente (peak content)
function getColorForUser(username) {
    if(!username) return '#aaa';
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

// Funzione per nascondere tutto e mostrare solo ciò che si vuole vedere
function hideAllSections() {
  const sections = ['dash-main', 'campaign-detail', 'sheet-detail', 'player-campaign-detail'];
  sections.forEach(id => {
    const el = $(id);
    if (el) el.style.display = 'none';
  });
}

// Funzione per caricare i vari segnalini dei mostri dal bestiario 
async function caricaTokenMostri() {
    try {
        const res = await fetch('/bestiario.xml');
        const text = await res.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");
        const mostri = xml.querySelectorAll('mostro');
        const container = $('master-monster-tokens');
        if(!container) return;
        
        container.innerHTML = '';
        mostri.forEach(m => {
            const nome = m.querySelector('nome').textContent;
            const avatar = m.querySelector('avatar').textContent;
            
            const img = document.createElement('img');
            img.src = avatar;
            img.title = nome;
            img.className = 'token-option';
            img.style.cssText = 'width: 35px; height: 35px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; object-fit: cover; background: #000;';
            img.onclick = function() { selezionaToken('image', avatar, this); };
            container.appendChild(img);
        });
    } catch(e) { console.error("Errore nel caricamento dei token mostri:", e); }
}

// Gestione ingresso del giocatore 
function handlePlayerCampaignClick(camp) {
  let activeChars = {};
  try { activeChars = JSON.parse(camp.activeCharacters || "{}"); } catch(e){}
  
  if (activeChars[State.username]) {
      const charName = activeChars[State.username];
      const sheetIndex = State.sheets.findIndex(s => s.charName === charName);
      
      if (sheetIndex !== -1) {
          enterPlayerCampaign(sheetIndex, camp.campName);
          return;
      }
  }
  window.openCharacterSelectorForCampaign(camp);
}

// Funzione per selezionare il token da piazzare nella mappa 
window.selezionaToken = function(type, url, element) {
    activeTokenType = type;
    activeTokenUrl = url;
    
    // Resetta i bordi di tutti i bottoni e accende quello cliccato
    document.querySelectorAll('.token-option').forEach(el => el.style.borderColor = 'transparent');
    if (element) element.style.borderColor = '#e8c97e';
};

window.openCharacterSelectorForCampaign = function(camp) {
    const listContainer = $('char-selection-list');
    if (State.sheets.length === 0) {
        listContainer.innerHTML = '<p style="color:#aaa;">Non hai nessun eroe. Forgiane uno prima di unirti al tavolo!</p>';
    } else {
        listContainer.innerHTML = State.sheets.map((sheet, i) => `
            <button class="btn-ghost" style="text-align: left; padding: 10px; display: flex; justify-content: space-between;" onclick="enterPlayerCampaign(${i}, '${escHtml(camp.campName)}')">
                <span> ${escHtml(sheet.charName)} (Liv ${sheet.charLevel})</span>
                <span style="color:#e8c97e;">Scegli ➔</span>
            </button>
        `).join('');
    }
    openModal($('modal-select-char-backdrop'));
};

window.enterPlayerCampaign = async function(sheetIndex, campName) {
  closeModal($('modal-select-char-backdrop'));
  const sheet = State.sheets[sheetIndex];

  const camp = State.campaigns.find(c => c.campName === campName);

  // Pulisce le altre schermate
  if (typeof hideAllSections === 'function') hideAllSections(); 
  
  // Ripristina la memoria della chat
  if($('pc-chat-messages')) caricaMemoriaChat(campName, 'pc-chat-messages');

  if($('dash-main')) $('dash-main').style.display = 'none';
  if($('player-campaign-detail')) $('player-campaign-detail').style.display = 'block';
  
  if($('player-camp-title')) $('player-camp-title').textContent = campName;
  if($('player-camp-char')) {
      $('player-camp-char').textContent = "Eroe: " + sheet.charName;
      $('player-camp-char').dataset.charname = sheet.charName; 
  }

  if($('pc-avatar-img')) $('pc-avatar-img').src = sheet.avatar || '/img/species/_default.jpg';

  if ($('tab-pc-mappa')) {
      $('tab-pc-mappa').style.display = 'block';
      $('tab-pc-mappa').style.height = '100%';
      $('tab-pc-mappa').style.width = '100%';
  }

  costruisciSchedaInterattiva('pc-sheet-container', sheet, false);

  // Gestisce chat giocatore 
  const pcTarget = $('pc-chat-target');
  if (pcTarget && camp) {
      pcTarget.innerHTML = `<option value="Tutti">Tutti</option><option value="${camp.owner}">Master (${camp.owner})</option>`;
      const players = camp.joinedPlayers || [];
      players.forEach(p => {
          if (p !== State.username) pcTarget.innerHTML += `<option value="${p}">${p}</option>`;
      });
  }

  // Gestisce la mappa del giocatore
  const mapUrl = (camp && camp.mapUrl) ? camp.mapUrl : '/maps/mappa_1.jpg';

  // Inizializza la mappa Leaflet solo la prima volta
  if (!playerLeafletMap && $('pc-map')) {
      playerLeafletMap = L.map('pc-map', { crs: L.CRS.Simple, minZoom: -2 });
      playerLeafletMap.on('click', function(e) {
          aggiungiSegnalino(e.latlng, playerLeafletMap, true);
      });
      $('pc-map').addEventListener('contextmenu', e => e.preventDefault());
  }

  //sezione per poter mettere segnalini personalizzati con immagine personaggio e colore
  const myColor = getColorForUser(State.username);
  if($('player-color-marker')) $('player-color-marker').style.backgroundColor = myColor;
  
  const avatarUrl = sheet.avatar || '/img/species/_default.jpg';
  if($('pc-avatar-img')) $('pc-avatar-img').src = avatarUrl;
  if($('player-token-avatar')) $('player-token-avatar').src = avatarUrl;

  $('player-camp-char').innerHTML = `Eroe: ${sheet.charName} <span style="display:inline-block;width:15px;height:15px;border-radius:50%;background-color:${myColor};vertical-align:middle;margin-left:10px;border:1px solid #fff;box-shadow:0 0 5px #000;" title="Il tuo colore identificativo"></span>`;

  selezionaToken('color', null, document.querySelector('#player-token-sidebar .token-option'));

  if (playerLeafletMap) {
      playerLeafletMap.off('click');
      playerLeafletMap.on('click', function(e) {
          let urlToUse = activeTokenUrl;
          if (activeTokenType === 'image') urlToUse = $('pc-avatar-img').src; 

          const info = { type: activeTokenType, url: urlToUse };
          aggiungiSegnalino(e.latlng, playerLeafletMap, true, State.username, info);
      });
  }

  // Aggiorna l'immagine 
  if (playerLeafletMap) {
      playerLeafletMap.eachLayer(layer => {
          if (layer instanceof L.ImageOverlay) playerLeafletMap.removeLayer(layer);
      });
      const bounds = [[0,0], [1000,1000]]; 
      L.imageOverlay(mapUrl, bounds).addTo(playerLeafletMap);
    }

  document.querySelector('.player-tab-btn[data-tab="pc-scheda"]')?.click();
  
  if (socket) socket.emit('entra_stanza_campagna', { campName: campName, username: State.username });

  try {
      await fetch('/api/campaigns/set-active-char', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ campName: campName, owner: State.username, charName: sheet.charName })
      });
      
      // Aggiorna la memoria locale
      if (camp) {
          let active = {};
          try { active = JSON.parse(camp.activeCharacters || "{}"); } catch(e){}
          active[State.username] = sheet.charName;
          camp.activeCharacters = JSON.stringify(active);
      }
  } catch(e) { console.error("Errore salvataggio eroe in background:", e); }

  AudioManager.updateBackgroundMusic(true);
};

// Inizializza la pagina
document.addEventListener('DOMContentLoaded', async () => {
  AudioManager.init();
  if ($('nav-username')) $('nav-username').textContent = State.username;
  await State.loadFromServer();
  
  if (typeof Vue !== 'undefined') {
      const { createApp, ref, computed, watch } = Vue;
      createApp({
          setup() {
              const livello = ref(1);
              const bonusCompetenza = computed(() => Math.ceil(livello.value / 4) + 1);
              vueData = { livello }; 
              
              watch(livello, async (nuovoLivello) => {
                  const charName = $('sheet-detail-title')?.textContent;
                  if (!charName) return;

                  const sheet = State.sheets.find(s => s.charName === charName);
                  const livelloParsato = parseInt(nuovoLivello) || 1;
                  const container = document.getElementById('base-sheet-container') || document.getElementById('pc-sheet-container');

                  if (sheet && sheet.charLevel !== livelloParsato) {
                      sheet.charLevel = livelloParsato;
                      try {
                          await fetch('/api/sheets/update-level', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ owner: State.username, charName: charName, charLevel: livelloParsato })
                          });
                      } catch(e) { console.error(e); }
                  }
                  
                 if (container) {
                    const form = container.querySelector('form');
                    if (form) form.dispatchEvent(new Event('input'));
                 }
              });

              return { livello, bonusCompetenza };
          }
      }).mount('#vue-scheda-personaggio');
  }

  renderDropdowns();
  renderGrid();
  applicaTilt3D();
  bindEvents();
});

function openCampaignDetail(camp) {
  hideAllSections(); 
  if($('dm-chat-messages')) caricaMemoriaChat(camp.campName, 'dm-chat-messages');
  if($('dash-main')) $('dash-main').style.display = 'none'; 
  if($('campaign-detail')) $('campaign-detail').style.display = 'block';
  if($('campaign-detail-title')) $('campaign-detail-title').textContent = camp.campName;
  //Salvataggio della storia
  if($('campaign-story-text')) $('campaign-story-text').value = camp.campDesc || '';

  const inviteContainer = $('campaign-invite-container');
  const inviteCodeEl = $('campaign-invite-code');
  const toggleBtn = $('btn-toggle-invite');

  // Carica gli eroi nella tab party
  caricaEroiParty(camp.campName);

  // Per caricare le mappe salvate
  renderizzaStoricoMappe(camp.campName);

  if (inviteContainer && inviteCodeEl && toggleBtn) {
      if (camp.owner === State.username) {
          inviteContainer.style.display = 'flex';
          inviteCodeEl.textContent = camp.inviteCode;
          inviteCodeEl.style.filter = 'blur(5px)'; 
          toggleBtn.innerHTML = '<i class="fa-solid fa-eye-slash" style="color: #aaa;"></i>'; 
          toggleBtn.dataset.visible = 'false'; 
      } else {
          inviteContainer.style.display = 'none'; 
      }
  }


  // Chat privata del master con altra gente 
  const dmTarget = $('dm-chat-target');
  if (dmTarget) {
      dmTarget.innerHTML = '<option value="Tutti">Tutti</option>';
      const players = camp.joinedPlayers || [];
      players.forEach(p => dmTarget.innerHTML += `<option value="${p}">${p}</option>`);
  }

  // Per associare il colore del master alla campagna ed ai segnalini
  const myColor = getColorForUser(State.username);
  if($('master-color-marker')) $('master-color-marker').style.backgroundColor = myColor;
  $('campaign-detail-title').innerHTML = `${camp.campName} <span style="display:inline-block;width:15px;height:15px;border-radius:50%;background-color:${myColor};vertical-align:middle;margin-left:10px;border:1px solid #fff;box-shadow:0 0 5px #000;" title="Il tuo colore identificativo"></span>`;
  
  selezionaToken('color', null, document.querySelector('#master-token-sidebar .token-option'));
  caricaTokenMostri();

  const btnToggleInvite = $('btn-toggle-invite');
  if (btnToggleInvite) {
      btnToggleInvite.onclick = function() {
          const codeEl = $('campaign-invite-code');
          const iconEl = this.querySelector('i');
          if (this.dataset.visible === 'false') {
              codeEl.style.filter = 'none';
              iconEl.className = 'fa-solid fa-eye';
              iconEl.style.color = '#e8c97e';
              this.dataset.visible = 'true'; 
          } else {
              codeEl.style.filter = 'blur(5px)';
              iconEl.className = 'fa-solid fa-eye-slash';
              iconEl.style.color = '#aaa';
              this.dataset.visible = 'false'; 
          }
      };
  }

  const primoTab = document.querySelector('.tab-btn[data-tab="storia"]');
  if(primoTab) primoTab.click();

  // Creazione e Mappa 
  const mapUrl = camp.mapUrl || '/maps/mappa_1.jpg'; 

  // Inizializza la mappa Leaflet solo la prima volta
  if (!leafletMap && $('map')) {
      leafletMap = L.map('map', { crs: L.CRS.Simple, minZoom: -2 });
      
      // Usa la nuova funzione per mettere i segnalini
      leafletMap.on('click', function(e) {
          aggiungiSegnalino(e.latlng, leafletMap, true);
      });
      
      // Disabilita il menu del tasto destro
      $('map').addEventListener('contextmenu', e => e.preventDefault());
  }

  // Aggiorna SEMPRE l'immagine
  if (leafletMap) {
      if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay);
      const bounds = [[0,0], [1000,1000]];
      currentImageOverlay = L.imageOverlay(mapUrl, bounds).addTo(leafletMap);
      leafletMap.fitBounds(bounds);
      setTimeout(() => leafletMap.invalidateSize(), 100);

      leafletMap.off('click');
      leafletMap.on('click', function(e) {
          const info = { type: activeTokenType, url: activeTokenUrl };
          aggiungiSegnalino(e.latlng, leafletMap, true, State.username, info);
      });
  }

  if (socket) socket.emit('entra_stanza_campagna', { campName: camp.campName, username: State.username });

  AudioManager.updateBackgroundMusic(true);
}

// Funzione che aggiunge e permette la rimozione dei segnalini con Proprietà, selezionare token personalizzati e bestiario 
function aggiungiSegnalino(latlng, mappa, isLocal = true, owner = State.username, tokenInfo = null) {
    
    if (!tokenInfo) {
        tokenInfo = { type: 'color', url: null };
    }

    const userColor = getColorForUser(owner);
    let customIcon;

    // Se è un'immagine usiamo il DivIcon di Leaflet per iniettare HTML personalizzato
    if (tokenInfo.type === 'image' && tokenInfo.url) {
        customIcon = L.divIcon({
            html: `<img src="${tokenInfo.url}" style="width:40px;height:40px;border-radius:50%;border:3px solid ${userColor};box-shadow: 0 4px 10px rgba(0,0,0,0.8);object-fit:cover;background:#111;">`,
            className: 'custom-leaflet-token',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
    } else {
        // Altrimenti usiamo il semplice pallino colorato
        customIcon = L.divIcon({
            html: `<div style="width:24px;height:24px;background-color:${userColor};border:2px solid #fff;border-radius:50%;box-shadow:0 0 5px #000;"></div>`,
            className: 'custom-leaflet-token',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }

    const marker = L.marker(latlng, { icon: customIcon }).addTo(mappa);
    marker.proprietario = owner; 
    
    marker.on('contextmenu', () => {
        // Controllo autorizzazioni
        const isMaster = $('campaign-detail') && $('campaign-detail').style.display === 'block';
        if (!isMaster && marker.proprietario !== State.username) {
            Swal.fire({
                toast: true, position: 'bottom-end', icon: 'warning', 
                title: 'Puoi rimuovere solo i tuoi segnalini!', 
                showConfirmButton: false, timer: 2000, background: '#1a1108', color: '#e8c97e'
            });
            return;
        }
        mappa.removeLayer(marker);
        if (socket) socket.emit('rimuovi_segnalino', latlng);
    });

    // Invia al socket includendo il tipo di token
    if (socket && isLocal) {
        socket.emit('invia_segnalino', { lat: latlng.lat, lng: latlng.lng, owner: State.username, tokenInfo: tokenInfo });
    }
}

// Funzione per barra delle mappe laterale con history
function renderizzaStoricoMappe(campName) {
    const list = $('map-history-list');
    if(!list) return;
    
    const camp = State.campaigns.find(c => c.campName === campName);
    if(!camp) return;

    let history = [];
    try { history = JSON.parse(camp.mapHistory || "[]"); } catch(e) {}
    
    // Se lo storico è ancora vuoto sul DB ma c'è una mappa iniziale attiva (es. quella di default),
    // la mostriamo dinamicamente nella barra laterale
    if(history.length === 0 && camp.mapUrl) {
        history.push(camp.mapUrl);
    }
    
    list.innerHTML = '';
    history.forEach(url => {
        const isActive = (url === camp.mapUrl);
        
        const container = document.createElement('div');
        container.style.cssText = `
            position: relative; width: 100%; height: 90px; border-radius: 4px;
            flex-shrink: 0; border: 2px solid ${isActive ? '#e8c97e' : '#333'};
            box-shadow: ${isActive ? '0 0 10px rgba(232,201,126,0.6)' : 'none'};
            transition: 0.2s; background-image: url('${url}');
            background-size: cover; background-position: center; cursor: pointer;
        `;
        
        // Al click sulla miniatura si cambia la mappa attiva
        container.onclick = (e) => {
            if (e.target.closest('.btn-delete-map-hist')) return;
            impostaMappaAttiva(url, camp.campName);
        };
        
        container.onmouseover = () => { if(!isActive) container.style.borderColor = '#aaa'; };
        container.onmouseout = () => { if(!isActive) container.style.borderColor = '#333'; };
        
        // Pulsante di cancellazione mappa (X)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete-map-hist';
        deleteBtn.innerHTML = '✕';
        deleteBtn.title = "Rimuovi questa mappa dall'archivio";
        deleteBtn.style.cssText = `
            position: absolute; top: 4px; right: 4px; width: 18px; height: 18px;
            border-radius: 50%; background: rgba(139, 26, 26, 0.85); color: white;
            border: 1px solid #8b1a1a; font-size: 10px; display: flex;
            align-items: center; justify-content: center; cursor: pointer;
            transition: 0.2s; z-index: 10; font-family: sans-serif; line-height: 1;
        `;
        
        deleteBtn.onmouseover = () => { deleteBtn.style.background = '#cc2a2a'; };
        deleteBtn.onmouseout = () => { deleteBtn.style.background = 'rgba(139, 26, 26, 0.85)'; };
        
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); // Impedisce al click di propagarsi al container della mappa
            rimuoviMappaDaStorico(url, camp.campName);
        };
        
        container.appendChild(deleteBtn);
        list.appendChild(container);
    });
}

// Cambia la mappa a schermo e notifica il Server e i giocatori via Socket.io
window.impostaMappaAttiva = async function(url, campName) {
    if (leafletMap) {
      if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay);
      const bounds = [[0,0], [1000,1000]];
      currentImageOverlay = L.imageOverlay(url, bounds).addTo(leafletMap);
      leafletMap.eachLayer(layer => {
          if (layer instanceof L.Marker) leafletMap.removeLayer(layer);
      })
      leafletMap.off('click');
      leafletMap.on('click', function(e) {
          const info = { type: activeTokenType, url: activeTokenUrl };
          aggiungiSegnalino(e.latlng, leafletMap, true, State.username, info);
      });
  }
    
    if (socket) socket.emit('cambia_sfondo_mappa', url);
    
    const camp = State.campaigns.find(c => c.campName === campName);
    if(camp) {
        camp.mapUrl = url;
        renderizzaStoricoMappe(campName); 
    }

    try {
        await fetch('/api/campaigns/map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campName: campName, owner: State.username, mapUrl: url })
        });
    } catch (err) { console.error("Errore salvataggio mappa:", err); }
};

// Aggiunge un URL allo storico e lo salva nel Database
async function aggiungiMappaAStorico(url, campName) {
    const camp = State.campaigns.find(c => c.campName === campName);
    if(!camp) return;

    let history = [];
    try { history = JSON.parse(camp.mapHistory || "[]"); } catch(e) {}

    if (history.length === 0 && camp.mapUrl) {
        history.push(camp.mapUrl);
    }

    if (!history.includes(url)) {
        history.push(url);
        camp.mapHistory = JSON.stringify(history);

        try {
            await fetch('/api/campaigns/map-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campName: campName, owner: State.username, mapHistory: camp.mapHistory })
            });
        } catch(e) { console.error("Errore salvataggio storico:", e); }
    }
    
    impostaMappaAttiva(url, campName);
}


window.rimuoviMappaDaStorico = async function(urlDaRimuovere, campName) {
    const camp = State.campaigns.find(c => c.campName === campName);
    if(!camp) return;

    let history = [];
    try { history = JSON.parse(camp.mapHistory || "[]"); } catch(e) {}
    
    if (history.length === 0 && camp.mapUrl) {
        history.push(camp.mapUrl);
    }

    history = history.filter(url => url !== urlDaRimuovere);
    camp.mapHistory = JSON.stringify(history);

    // Se stiamo cancellando proprio la mappa correntemente mostrata sullo schermo, 
    // carichiamo la prima disponibile rimasta o torniamo a quella di base
    if (camp.mapUrl === urlDaRimuovere) {
        const prossimaMappa = history.length > 0 ? history[0] : '/maps/mappa_1.jpg';
        await impostaMappaAttiva(prossimaMappa, campName);
    }

    // Aggiorna la tabella delle campagne nel database SQLite
    try {
        await fetch('/api/campaigns/map-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campName: campName, owner: State.username, mapHistory: camp.mapHistory })
        });
        
        renderizzaStoricoMappe(campName);
        
        Swal.fire({
            toast: true, position: 'bottom-end', icon: 'success',
            title: 'Mappa rimossa dall\'archivio', showConfirmButton: false, timer: 1500,
            background: '#1a1108', color: '#e8c97e'
        });
    } catch(e) { console.error("Errore durante la rimozione della mappa:", e); }
};

async function caricaEroiParty(campName) {
    const listContainer = $('party-list-container');
    const iframe = $('party-pdf-iframe');
    if(iframe) iframe.src = ''; 

    const camp = State.campaigns.find(c => c.campName === campName);
    const isMaster = camp && camp.owner === State.username;
    
    try {
        const response = await fetch(`/api/campaigns/${campName}/party`);
        const eroi = await response.json();
        
        if (!eroi || eroi.length === 0) {
            listContainer.innerHTML = '<p style="color: #aaa; font-style: italic;">Nessun eroe si è ancora unito al tavolo.</p>';
            return;
        }
        
        listContainer.innerHTML = eroi.map(eroe => `
            <div class="party-hero-card" style="position: relative;">
                <div onclick="visualizzaSchedaParty('${eroe.charName}')" style="cursor: pointer; padding-right: 25px;">
                    <div class="party-hero-name">🛡️ ${escHtml(eroe.charName)}</div>
                    <div class="party-hero-sub">Liv: ${eroe.charLevel} | Giocatore: ${escHtml(eroe.owner)}</div>
                </div>
                ${isMaster && eroe.owner !== State.username ? 
                    `<button onclick="cacciaGiocatore('${escHtml(eroe.owner)}', '${escHtml(campName)}')" style="position: absolute; top: 10px; right: 10px; background: transparent; border: none; color: #8b1a1a; cursor: pointer; font-size: 1.1rem;" title="Caccia dal tavolo"><i class="fa-solid fa-user-slash"></i></button>` 
                : ''}
            </div>
        `).join('');
    } catch (e) {
        listContainer.innerHTML = '<p style="color: #8b1a1a;">Errore: Impossibile caricare il party. (L\'API server esiste?)</p>';
    }
}
 // Per cacciare un giocatore dalla campagna 
window.cacciaGiocatore = async function(giocatore, campName) {
    const camp = State.campaigns.find(c => c.campName === campName);
    if (!camp) return;

    const result = await Swal.fire({
        title: 'Esiliare dal tavolo?',
        text: `Vuoi davvero cacciare ${giocatore} dalla campagna? L'azione è irreversibile.`,
        icon: 'warning',
        showCancelButton: true,
        background: '#1a1a1a', color: '#e8c97e', confirmButtonColor: '#8b1a1a',
        confirmButtonText: 'Esilia', cancelButtonText: 'Annulla'
    });

    if (result.isConfirmed) {
        try {
            const res = await fetch('/api/campaigns/leave', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inviteCode: camp.inviteCode, username: giocatore })
            });
            
            if (res.ok) {
                if (socket) socket.emit('invia_messaggio_campagna', {
                    mittente: 'Taverniere', testo: `${giocatore} è stato esiliato dal Master.`, type: 'system', campName: campName
                });
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Giocatore esiliato!', showConfirmButton: false, timer: 1500, background: '#1a1108', color: '#e8c97e' });
                caricaEroiParty(campName); 
            }
        } catch(e) { console.error("Errore durante l'esilio:", e); }
    }
};

// Funzione globale chiamata dal click HTML
window.visualizzaSchedaParty = function(charName) {
    const container = $('master-party-sheet-container');

    container.innerHTML = `<p style="color: #aaa; text-align: center; margin-top: 50px;"> Caricamento scheda di <b>${escHtml(charName)}</b>...</p>`;

    fetch(`/api/sheets/by-name?charName=${encodeURIComponent(charName)}`)
      .then(res => res.json())
      .then(sheetData => {
        if (!sheetData || sheetData.error) {
            container.innerHTML = '<p style="color: red; text-align: center;">Errore nel caricamento eroe.</p>';
            return;
        }
          costruisciSchedaInterattiva('master-party-sheet-container', sheetData, true);
      })
      .catch (err=> {
        console.error("Errore di recupero scheda:", err);
        container.innerHTML = '<p style="color: red; text-align: center;">Errore di connessione al server </p>';
      });
};

function openSheetDetail(sheet) {
  if (!sheet) return;
  hideAllSections(); 
  
  if($('dash-main')) $('dash-main').style.display = 'none'; 
  if($('sheet-detail')) $('sheet-detail').style.display = 'block';
  if($('sheet-detail-title')) $('sheet-detail-title').textContent = sheet.charName;

  // Carica le note del giocatore
  const notesArea = $('player-notes');
  if(notesArea) {
      // Richiamo sheet.playerNotes
      notesArea.value = sheet.playerNotes || (sheet.sheetDataDetails && sheet.sheetDataDetails.playerNotes) || '';
  }

  if($('char-avatar-img')) {
      $('char-avatar-img').src = sheet.avatar || 'img/species/_default.jpg';
  }

  costruisciSchedaInterattiva('base-sheet-container', sheet, false);
  if (vueData) vueData.livello.value = parseInt(sheet.charLevel) || 1;
}

function refreshMap(map) {
    if (map) {
        requestAnimationFrame(() => {
            map.invalidateSize();
            // Forza il fitBounds per resettare la vista
            if(currentImageOverlay) map.fitBounds(currentImageOverlay.getBounds());
        });
    }
}

function bindEvents() {

// tasto pulisci mappa
    $('btn-clear-tokens')?.addEventListener('click', () => {
      if (!leafletMap) return;
      Swal.fire({
          title: 'Pulisci Mappa?',
          text: 'Vuoi davvero rimuovere tutti i segnalini?',
          icon: 'warning',
          showCancelButton: true,
          background: '#1a1a1a', color: '#e8c97e', confirmButtonColor: '#8b1a1a',
          confirmButtonText: 'Sì, pulisci'
      }).then((result) => {
          if (result.isConfirmed) {
              // Iteriamo su tutti i marker e li rimuoviamo, avvisando anche il socket per aggiornare i giocatori
              leafletMap.eachLayer(layer => {
                  if (layer instanceof L.Marker) {
                      const pos = layer.getLatLng();
                      leafletMap.removeLayer(layer);
                      if (socket) socket.emit('rimuovi_segnalino', pos);
                  }
              });
              Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: 'Mappa immacolata!', showConfirmButton: false, timer: 1500, background: '#1a1108', color: '#e8c97e' });
          }
      });
  });

  $('dash-main')?.addEventListener('click', async (e) => {
    
    const btnCopy = e.target.closest('.copy-code');
    if (btnCopy) {
        e.stopPropagation(); 
        await navigator.clipboard.writeText(btnCopy.dataset.code);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Codice copiato!', showConfirmButton: false, timer: 1500, background: '#1a1108', color: '#e8c97e' });
        return;
    }

    // Eliminazione ed uscita
    const btnDel = e.target.closest('.btn-delete') || e.target.closest('.btn-leave');
    if (btnDel) {
      e.stopPropagation(); 
      const type = btnDel.dataset.type; 
      const index = parseInt(btnDel.dataset.index);
      
      const isLeaving = (type === 'leave-campaign' || btnDel.classList.contains('btn-leave'));
      const camp = (isLeaving || type === 'campaign') ? State.campaigns[index] : null;

      // Testi dinamici in base a quello che stiamo facendo
      const title = isLeaving ? 'Abbandonare il Party?' : 'Sei sicuro?';
      const text = isLeaving ? `Vuoi lasciare l'avventura "${camp.campName}"?` : "Questa magia distruttiva non può essere annullata!";
      const confirmText = isLeaving ? 'Sì, esci' : 'Sì, distruggi!';

      const result = await Swal.fire({
        title: title, text: text, icon: 'warning', showCancelButton: true,
        background: '#1a1a1a', color: '#e8c97e', confirmButtonColor: '#8b1a1a', cancelButtonColor: '#444',
        confirmButtonText: confirmText, cancelButtonText: 'Annulla'
      });

      if (result.isConfirmed) {
        // Chiamata al database 
        if (type === 'sheet') {
          await fetch(`/api/sheets/${encodeURIComponent(State.sheets[index].charName)}?user=${encodeURIComponent(State.username)}`, { method: 'DELETE' });
        } else if (type === 'campaign') {
          await fetch(`/api/campaigns/${encodeURIComponent(camp.campName)}?user=${encodeURIComponent(State.username)}`, { method: 'DELETE' });
        } else if (isLeaving) {
          await fetch('/api/campaigns/leave', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inviteCode: camp.inviteCode, username: State.username })
          });
        }

        // Sincronizzazione server
        await State.loadFromServer();
        renderGrid(); 
        if(typeof renderDropdowns === 'function') renderDropdowns();
        if(typeof applicaTilt3D === 'function') applicaTilt3D();

        Swal.fire({ icon: 'success', title: 'Vault Aggiornato', showConfirmButton: false, timer: 1500, background: '#1a1a1a', color: '#e8c97e' });
      }
      return; 
    }

    // Apertura Card campagna o scheda
    const card = e.target.closest('.vault-card');
    if (card) {
      const type = card.dataset.type;
      const index = parseInt(card.dataset.index);
      if (type === 'campaign') {
          const camp = State.campaigns[index];
          if (camp.owner === State.username) openCampaignDetail(camp);
          else handlePlayerCampaignClick(camp);
      }
      if (type === 'sheet') openSheetDetail(State.sheets[index]);
    }
  });

  // Rinomina Campagna
  $('btn-rename-camp')?.addEventListener('click', async () => {
    const titleEl = $('campaign-detail-title');
    const oldName = titleEl.textContent.trim();

    const { value: newName } = await Swal.fire({
      title: 'Rinomina Campagna',
      input: 'text',
      inputValue: oldName,
      showCancelButton: true,
      background: '#1a1a1a', color: '#e8c97e', confirmButtonColor: '#4a90e2',
      inputValidator: (value) => { if (!value) return "Devi inserire un nome!" }
    });

    if (newName && newName !== oldName) {
      const res = await fetch('/api/campaigns/rename', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: oldName, newName: newName, owner: State.username })
      });
      if (res.ok) {
        titleEl.textContent = newName;
        await State.loadFromServer(); 
        renderGrid(); renderDropdowns();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Rinominata!', showConfirmButton: false, timer: 1500, background: '#1a1108', color: '#e8c97e' });
      }
    }
  });

  // Rinomina Scheda
  $('btn-rename-sheet')?.addEventListener('click', async () => {
    const titleEl = $('sheet-detail-title');
    const oldName = titleEl.textContent.trim();

    const { value: newName } = await Swal.fire({
      title: 'Rinomina Eroe',
      input: 'text',
      inputValue: oldName,
      showCancelButton: true,
      background: '#1a1a1a', color: '#e8c97e', confirmButtonColor: '#4a90e2',
      inputValidator: (value) => { if (!value) return "L'eroe ha bisogno di un nome!" }
    });

    if (newName && newName !== oldName) {
      const res = await fetch('/api/sheets/rename', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: oldName, newName: newName, owner: State.username })
      });
      if (res.ok) {
        titleEl.textContent = newName;
        await State.loadFromServer();
        renderGrid(); renderDropdowns();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Nuova identità forgiata!', showConfirmButton: false, timer: 1500, background: '#1a1108', color: '#e8c97e' });
      }
    }
  });

  // Gestione tab Master
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.classList.contains('player-tab-btn')) return; 

    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn:not(.player-tab-btn)').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content:not(.player-tab-content)').forEach(c => {
          c.classList.remove('active');
          c.style.display = 'none';
      });

      
      e.target.classList.add('active');
      const targetTab = 'tab-' + e.target.dataset.tab;
      const targetElement = $(targetTab);

        if (targetElement) {
              targetElement.classList.add('active');
              if (targetTab === 'tab-mappa') {
                targetElement.classList.add('active');
                targetElement.style.display = 'flex';
                refreshMap(leafletMap);
              } else {
                  targetElement.style.display = 'block';
              }
          }

      if (targetTab === 'tab-mappa' && leafletMap) {
          setTimeout(() => {
              leafletMap.invalidateSize();
              leafletMap.fitBounds([[0,0], [1000,1000]]);
          }, 100);
      }
      if (targetTab === 'tab-bestiario') renderizzaBestiario();
    });
  });

  // Mappa Master Cambio URL
  $('btn-change-map')?.addEventListener('click', async () => {
      const url = $('map-url-input').value.trim();
      const campName = $('campaign-detail-title').textContent.trim();

      if (url && leafletMap) {
          $('map-url-input').value = ''; // svuota l'input
          await aggiungiMappaAStorico(url, campName); // Salva nell'archivio e la imposta attiva
      }
  });

  // Mappa Master: Carica File
  $('btn-upload-map')?.addEventListener('click', async () => {
      const fileInput = $('map-file-input');
      const file = fileInput.files[0];
      const campName = $('campaign-detail-title').textContent.trim();
      
      if (!file) return alert("Seleziona prima un'immagine dal tuo PC!");

      const formData = new FormData();
      formData.append('mapImage', file);
      formData.append('username', State.username); 

      try {
          const response = await fetch('/api/upload-map', { method: 'POST', body: formData });
          const data = await response.json();
          
          if (data.url && leafletMap) {
              fileInput.value = ''; // svuota l'input
              await aggiungiMappaAStorico(data.url, campName); // Salva l'URL ritornato dal server
          }
      } catch (err) { 
          console.error("Errore upload mappa:", err); 
          alert("Errore durante il caricamento."); 
      }
  });

  // Pulsanti indietro (Modificati per avvisare l'uscita dalla chat)
  const esciDalTavolo = () => {
      if (socket) socket.emit('esci_stanza_campagna');
      AudioManager.updateBackgroundMusic(false);
      renderGrid(); applicaTilt3D(); closeDetails();
  };
  
  $('btn-back-campaign')?.addEventListener('click', esciDalTavolo);
  $('btn-back-sheet')?.addEventListener('click', esciDalTavolo);
  $('btn-back-player-camp')?.addEventListener('click', esciDalTavolo);
  
  // Gestione click sulle voci dei Dropdown 
  document.addEventListener('click', (e) => {
    const item = e.target.closest('.nav-dd .dropdown-item');
    if (!item) return;
    const type = item.dataset.type;
    const index = parseInt(item.dataset.index); 
    
    if (type === 'sheet') {
      // Invece di usare l'indice, peschiamo il nome esatto e lo cerchiamo nello State.
      const charName = item.querySelector('.dd-item-label').textContent.trim();
      const sheet = State.sheets.find(s => s.charName === charName);
      if (sheet) openSheetDetail(sheet);
      
    } else if (type === 'campaign') {
      const camp = State.campaigns[index];
      if (camp.owner === State.username) {
        openCampaignDetail(camp);
      } else {
        handlePlayerCampaignClick(camp);
      }
    }
    
    closeDropdown();
  });

  // SEzione chat- gestione private etc:

  $('btn-send-dm-chat')?.addEventListener('click', () => inviaChatCampagna('dm-chat-input', 'dm-chat-messages', State.username, $('campaign-detail-title').textContent, 'dm-chat-target'));
  $('dm-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-send-dm-chat').click(); });

  $('btn-pc-send-chat')?.addEventListener('click', () => inviaChatCampagna('pc-chat-input', 'pc-chat-messages', State.username, $('player-camp-title').textContent, 'pc-chat-target'));
  $('pc-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-pc-send-chat').click(); });

  // Apertura dropdown navbar (Personaggi / Master / Utente)
  document.querySelectorAll('[data-dd-target]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.dataset.ddTarget;
      const target = document.getElementById(targetId);
      const wasOpen = target?.classList.contains('open');
      closeDropdown();
      if (!wasOpen) {
        target?.classList.add('open');
        btn.classList.add('open');
      }
    });
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('.nav-dd') || e.target.closest('[data-dd-target]')) return;
    closeDropdown();
  });

  // Modali
  $('btn-add-sheet-main')?.addEventListener('click', () => openModal($('modal-sheet-backdrop')));
  $('btn-add-camp-main')?.addEventListener('click', () => openModal($('modal-campaign-backdrop')));
  $('btn-join-camp-main')?.addEventListener('click', () => openModal($('modal-join-backdrop')));
  $('btn-add-sheet')?.addEventListener('click', () => { closeDropdown(); openModal($('modal-sheet-backdrop')); });
  $('btn-add-campaign')?.addEventListener('click', () => { closeDropdown(); openModal($('modal-campaign-backdrop')); });
  $('btn-join-campaign-dd')?.addEventListener('click', () => { closeDropdown(); openModal($('modal-join-backdrop')); });
  $('modal-master-sheet-close')?.addEventListener('click', () => closeModal($('modal-master-sheet-backdrop')));
  
  const modals = [
    { bg: 'modal-backdrop', closeBtn: 'modal-close', cancelBtn: null },
    { bg: 'modal-sheet-backdrop', closeBtn: 'modal-sheet-close', cancelBtn: 'btn-sheet-cancel' },
    { bg: 'modal-campaign-backdrop', closeBtn: 'modal-campaign-close', cancelBtn: 'btn-campaign-cancel' },
    { bg: 'modal-join-backdrop', closeBtn: 'modal-join-close', cancelBtn: 'btn-join-cancel' },
    { bg: 'modal-select-char-backdrop', closeBtn: 'modal-select-char-close', cancelBtn: null }
  ];
  modals.forEach(m => {
    $(m.closeBtn)?.addEventListener('click', () => closeModal($(m.bg)));
    $(m.cancelBtn)?.addEventListener('click', () => closeModal($(m.bg)));
    $(m.bg)?.addEventListener('click', (e) => { if (e.target === $(m.bg)) closeModal($(m.bg)); });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modals.forEach(m => closeModal($(m.bg))); });
  // Trova il menu a tendina delle razze e l'immagine di anteprima
    const raceSelect = document.querySelector('#form-add-sheet select[name="charRace"]');
    const genderSelect = document.querySelector('#form-add-sheet select[name="charGender"]');
    const previewImg = document.getElementById('new-hero-preview');

    // Funzione che aggiorna l'immagine combinando razza e sesso
    const updatePreview = () => {
        if (!raceSelect || !genderSelect || !previewImg) return;
        const raceSlug = raceSelect.value.toLowerCase().replace(/\s+/g, '-');
        const genderSlug = genderSelect.value; // sarà "m" o "f"
        previewImg.src = `img/species/${raceSlug}-${genderSlug}.jpg`; 
    };

    if (raceSelect && genderSelect && previewImg) {
        raceSelect.addEventListener('change', updatePreview);
        genderSelect.addEventListener('change', updatePreview);
        // Imposta l'immagine base all'apertura
        previewImg.src = `img/species/umano-m.jpg`; 
    }
    const btnTriggerImport = $('btn-trigger-import');
    const fileInputImport = $('pdf-import-input');

    btnTriggerImport?.addEventListener('click', () => fileInputImport.click());

    fileInputImport?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        Swal.fire({ title: 'Lettura PDF...', text: 'Estraendo i dati dell\'eroe...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const formPdf = pdfDoc.getForm();

            // Helper per leggere i campi in modo sicuro
            const getT = (name) => {
                try { return formPdf.getTextField(name).getText() || ''; } catch(e) { return ''; }
            };

            // Estrazione dati base
            const fullClassLevel = getT('ClassLevel'); 
            const classParts = fullClassLevel.split(' ');
            const charLevel = parseInt(classParts.pop()) || 1;
            const charClass = classParts.join(' ') || 'Guerriero';

            const rawData = {
                owner: State.username,
                charName: getT('CharacterName') || 'Eroe Senza Nome',
                charClass: charClass,
                charRace: getT('Race ').trim() || 'Umano',
                charGender: 'm', // Default
                charLevel: charLevel,
                avatar: `img/species/umano-m.jpg`
            };

            // Estrazione Dettagli (mappatura nomi scanner -> database)
            const details = {
                str: getT('STR'), dex: getT('DEX'), con: getT('CON'),
                int: getT('INT'), wis: getT('WIS'), cha: getT('CHA'),
                hpMax: getT('HPMax'), hpCurrent: getT('HPCurrent'),
                speed: getT('Speed'), initiative: getT('Initiative'),
                traits: getT('PersonalityTraits '), ideals: getT('Ideals'),
                bonds: getT('Bonds'), flaws: getT('Flaws'),
                features: getT('Features and Traits'),
                headerBackground: getT('Background'),
                headerAlignment: getT('Alignment'),
                headerXP: getT('XP')
            };

            // Salvataggio nel Database
            const res1 = await fetch('/api/sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rawData)
            });

            if (res1.ok) {
                await fetch('/api/sheets/update-details', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ owner: State.username, charName: rawData.charName, details: details })
                });

                await State.loadFromServer();
                renderGrid();
                closeModal($('modal-sheet-backdrop'));
                Swal.fire('Eroe Importato!', `${rawData.charName} è ora nel tuo Vault.`, 'success');
            }

        } catch (err) {
            console.error(err);
            Swal.fire('Errore', 'Impossibile leggere questo file PDF.', 'error');
        }
        e.target.value = ''; 
    });
  // Invio del form
$('form-add-sheet')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData($('form-add-sheet')));
    data.owner = State.username;
    
    const slug = data.charRace.toLowerCase().replace(/\s+/g, '-');
    const gender = data.charGender; 
    data.avatar = `img/species/${slug}-${gender}.jpg`;

    // Crea la scheda base nel Database
    await fetch('/api/sheets', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(data) 
    });

    // Calcola le statistiche iniziali basate su dnd-data.js
    const razzaDati = dndData.razze[data.charRace] || {};
    const classeDati = dndData.classi[data.charClass] || {};
    
    const baseCon = 10 + (razzaDati.con || 0);
    const conMod = Math.floor((baseCon - 10) / 2);

    const initialDetails = {

        headerClassLevel: `${data.charClass} ${data.charLevel}`,
        headerBackground: "Avventuriero",

        str: 10 + (razzaDati.str || 0),
        dex: 10 + (razzaDati.dex || 0),
        con: baseCon,
        int: 10 + (razzaDati.int || 0),
        wis: 10 + (razzaDati.wis || 0),
        cha: 10 + (razzaDati.cha || 0),
        hitDice: `${data.charLevel}${classeDati.hitDice || 'd8'}`,
        hpMax: (classeDati.hpBase || 10) + conMod, 
        hpCurrent: (classeDati.hpBase || 10) + conMod,
        features: razzaDati.traits || ''
    };

    // Spunta automaticamente i Tiri Salvezza della classe
    if (classeDati.saves) {
        classeDati.saves.forEach(save => initialDetails[save] = 'on');
    }

    // Salva i dettagli iniziali 
    await fetch('/api/sheets/update-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: State.username, charName: data.charName, details: initialDetails })
    });

    await State.loadFromServer(); 
    $('form-add-sheet').reset();
    
    const previewImg = document.getElementById('new-hero-preview');
    if(previewImg) previewImg.src = `img/species/umano-m.jpg`;
    
    closeModal($('modal-sheet-backdrop'));
    renderGrid(); 
});

// Creazione Nuova Campagna 
  $('form-add-campaign')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Per prendere i dati dai form
    const data = Object.fromEntries(new FormData($('form-add-campaign')));
    data.owner = State.username;

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (res.ok) {
        // Se va a buon fine, ricarica tutto e aggiorna la grafica
        await State.loadFromServer();
        $('form-add-campaign').reset();
        closeModal($('modal-campaign-backdrop'));
        renderGrid();
        renderDropdowns();
        if (typeof applicaTilt3D === 'function') applicaTilt3D();
        
        Swal.fire({ 
            toast: true, position: 'top-end', icon: 'success', 
            title: 'Campagna creata!', showConfirmButton: false, timer: 1500, 
            background: '#1a1108', color: '#e8c97e' 
        });
      } else {
        const err = await res.json();
        Swal.fire('Errore', err.message || 'Impossibile creare la campagna.', 'error');
      }
    } catch (err) {
      console.error("Errore creazione campagna:", err);
    }
  });

  // Permette di usare il codice per entrare nella campagna
  $('form-join-campaign')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData($('form-join-campaign')));
    data.username = State.username; //questa parte si basa sull'username della persona loggata per capire chi sta entrando e con quale personaggio

    try {
      const res = await fetch('/api/campaigns/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await res.json();
      
      if (res.ok) {
        Swal.fire({ 
            title: 'Benvenuto nel Party!', 
            text: result.message, 
            icon: 'success', 
            background: '#1a1108', color: '#d4a843', confirmButtonColor: '#4a90e2' 
        });
        await State.loadFromServer();
        $('form-join-campaign').reset();
        closeModal($('modal-join-backdrop'));
        renderDropdowns(); 
        renderGrid();
        applicaTilt3D();
      } else {
        Swal.fire({ title: 'Accesso Negato', text: result.message, icon: 'error', background: '#1a1108', color: '#d4a843', confirmButtonColor: '#8b1a1a' });
      }
    } catch (err) {
      console.error("Errore join campagna:", err);
    }
  });

  // Salva Storia del Master
  $('btn-save-story')?.addEventListener('click', async () => {
    const story = $('campaign-story-text').value;
    const campName = $('campaign-detail-title').textContent;
    
    try {
      const res = await fetch('/api/campaigns/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campName, owner: State.username, story })
      });
      if (res.ok) {
        // Aggiorniamo la memoria locale di State
        const camp = State.campaigns.find(c => c.campName === campName);
        if (camp) camp.campDesc = story;

        Swal.fire({
          toast: true, position: 'bottom-end', icon: 'success',
          title: 'Cronache salvate!', showConfirmButton: false, timer: 2000,
          background: '#1a1108', color: '#d4a843'
        });
      }
    } catch (e) { console.error(e); }
  });

// Salva gli appunti del giocatore in manuale
  $('btn-save-notes')?.addEventListener('click', async () => {
    const notes = $('player-notes').value;
    const charName = $('sheet-detail-title').textContent.trim();
    
    try {
      const res = await fetch('/api/sheets/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ charName: charName, owner: State.username, notes: notes })
      });
      
      if (res.ok) {
        // Aggiorniamo la memoria locale di State (esattamente come la storia)
        const sheet = State.sheets.find(s => s.charName === charName);
        if (sheet) sheet.playerNotes = notes;

        // Stesso magico popup dorato della storia!
        Swal.fire({
          toast: true, position: 'bottom-end', icon: 'success',
          title: 'Appunti salvati!', showConfirmButton: false, timer: 2000,
          background: '#1a1108', color: '#d4a843'
        });
      }
    } catch (e) { 
      console.error("Errore salvataggio appunti:", e); 
    }
  });

  // Gestione unificata Chat:
  $('btn-send-chat')?.addEventListener('click', () => gestisciInvioChat('chat-input', 'chat-messages', State.username));
  $('chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-send-chat').click(); });

  $('btn-send-dm-chat')?.addEventListener('click', () => inviaChatCampagna('dm-chat-input', 'dm-chat-messages', State.username, $('campaign-detail-title').textContent));
  $('dm-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-send-dm-chat').click(); });

  $('btn-pc-send-chat')?.addEventListener('click', () => inviaChatCampagna('pc-chat-input', 'pc-chat-messages', State.username, $('player-camp-title').textContent));
  $('pc-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-pc-send-chat').click(); });

// Per i dadi (Bottoni)
  document.querySelectorAll('.btn-dice').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const faccie = parseInt(e.target.dataset.dice);
          const isMaster = $('campaign-detail').style.display === 'block';
          
          // Capisce se sei Master o Giocatore per usare i dati corretti
          const campName = isMaster ? $('campaign-detail-title').textContent : $('player-camp-title').textContent;
          const containerId = isMaster ? 'dm-chat-messages' : 'pc-chat-messages';

          tiraDado(faccie, State.username, campName, containerId);
      });
  });

// Avatar Base + aggiungi immagine + ripristina default
  function initAvatarMenu(imgId, inputId, getCharName) {
      const imgEl = $(imgId);
      const menu = $('avatar-context-menu');
      const zoomOverlay = $('avatar-zoom-overlay');

      if (!imgEl) return;

      imgEl.onclick = (e) => {
          e.stopPropagation();
          menu.style.top = `${e.clientY}px`;
          menu.style.left = `${e.clientX}px`;
          menu.style.display = 'block';

          $('menu-view-avatar').onclick = (e) => {
              e.stopPropagation(); 
              $('zoomed-avatar-img').src = imgEl.src;
              zoomOverlay.style.display = 'flex';
              menu.style.display = 'none';
          };

          $('menu-upload-avatar').onclick = (e) => {
              e.stopPropagation(); 
              $(inputId).click();
              menu.style.display = 'none';
          };

          // reset Default
          $('menu-reset-avatar').onclick = async (e) => {
              e.stopPropagation();
              menu.style.display = 'none';

              const charName = getCharName(); 
              if (!charName) return;

              const sheet = State.sheets.find(s => s.charName === charName);
              if (!sheet) return;

              const slug = sheet.charRace.toLowerCase().replace(/\s+/g, '-');
              const gender = sheet.charGender || 'm';
              const defaultAvatarUrl = `/img/species/${slug}-${gender}.jpg`; 

              imgEl.src = defaultAvatarUrl;

              // Salva su database
              try {
                  await fetch('/api/sheets/avatar', { 
                      method: 'POST', 
                      headers: { 'Content-Type': 'application/json' }, 
                      body: JSON.stringify({ 
                          owner: State.username, 
                          charName: charName, 
                          avatarUrl: defaultAvatarUrl 
                      }) 
                  });
                  sheet.avatar = defaultAvatarUrl;

                  Swal.fire({ 
                      title: 'Magia annullata!', 
                      text: 'Ritratto di default ripristinato.',
                      icon: 'success', 
                      customClass: { popup: 'vault-popup' }, 
                      timer: 1500, 
                      showConfirmButton: false 
                  });
              } catch (err) { 
                  Swal.fire({ title: 'Errore', text: "Impossibile ripristinare l'avatar.", icon: 'error', customClass: { popup: 'vault-popup' } });
              }
          };
      };
  }

  // Come trovare il nome
  initAvatarMenu('char-avatar-img', 'char-avatar-input', () => $('sheet-detail-title').textContent);
  initAvatarMenu('pc-avatar-img', 'pc-avatar-input', () => $('player-camp-char').dataset.charname);

  document.addEventListener('click', () => {
      if($('avatar-context-menu')) $('avatar-context-menu').style.display = 'none';
      if($('avatar-zoom-overlay')) $('avatar-zoom-overlay').style.display = 'none';
  });

  // Ritaglio e Upload Avatar
  let cropper; 
  let pendingAvatarData = { charName: null, isPlayerCamp: false, imgEl: null };

  const handleAvatarFileSelection = (e, charNameSource, isPlayerCamp, imgElementId) => {
      const file = e.target.files[0];
      if (!file) return;

      const charName = charNameSource(); 
      if (!charName) return;

      pendingAvatarData = { charName, isPlayerCamp, imgEl: $(imgElementId) };

      const reader = new FileReader();
      reader.onload = (event) => {
          const cropperImg = $('cropper-image');
          if (!cropperImg) {
              alert("Errore: Manca la modale del cropper nell'HTML!");
              return;
          }
          cropperImg.src = event.target.result;
          openModal($('modal-cropper-backdrop'));

          if (cropper) cropper.destroy(); 
          
          cropper = new Cropper(cropperImg, {
              aspectRatio: 1, 
              viewMode: 1,
              autoCropArea: 1,
              background: false,
          });
      };
      reader.readAsDataURL(file);
      e.target.value = ''; 
  };

  $('char-avatar-input')?.addEventListener('change', (e) => {
      handleAvatarFileSelection(e, () => $('sheet-detail-title').textContent, false, 'char-avatar-img');
  });

  $('pc-avatar-input')?.addEventListener('change', (e) => {
      handleAvatarFileSelection(e, () => $('player-camp-char').dataset.charname, true, 'pc-avatar-img');
  });

  const chiudiCropper = () => {
      closeModal($('modal-cropper-backdrop'));
      if (cropper) {
          cropper.destroy();
          cropper = null;
      }
  };
  $('modal-cropper-close')?.addEventListener('click', chiudiCropper);
  $('btn-cropper-cancel')?.addEventListener('click', chiudiCropper);

  $('btn-cropper-save')?.addEventListener('click', async () => {
      if (!cropper) return;
      
      cropper.getCroppedCanvas({ width: 300, height: 300 }).toBlob(async (blob) => {
          const formData = new FormData();
          formData.append('avatarImage', blob, 'avatar-ritagliato.png');

          try {
              const res = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
              const data = await res.json();
              
              if (data.url) {
                  if (pendingAvatarData.imgEl) pendingAvatarData.imgEl.src = data.url;
                  
                  await fetch('/api/sheets/avatar', { 
                      method: 'POST', 
                      headers: { 'Content-Type': 'application/json' }, 
                      body: JSON.stringify({ 
                          owner: State.username, 
                          charName: pendingAvatarData.charName, 
                          avatarUrl: data.url 
                      }) 
                  });

                  const sheet = State.sheets.find(s => s.charName === pendingAvatarData.charName);
                  if (sheet) sheet.avatar = data.url;

                  Swal.fire({ title: 'Ritratto aggiornato!', icon: 'success', customClass: { popup: 'vault-popup' }, timer: 1500, showConfirmButton: false });
              }
          } catch (err) { 
              Swal.fire({ title: 'Errore', text: "Impossibile salvare l'avatar.", icon: 'error', customClass: { popup: 'vault-popup' } });
          } finally {
              chiudiCropper();
          }
      }, 'image/png');
  });


  // Upload PDF Partita
  $('btn-pc-upload-pdf')?.addEventListener('click', () => $('pc-pdf-input').click());
  $('pc-pdf-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData(); formData.append('pdfFile', file);
      try {
          const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.url) {
              $('pc-pdf-iframe').src = data.url;
              const pureCharName = $('player-camp-char').dataset.charname; 
              await fetch('/api/sheets/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: State.username, charName: pureCharName, pdfUrl: data.url }) });
              const currentSheet = State.sheets.find(s => s.charName === pureCharName);
              if (currentSheet) currentSheet.pdfUrl = data.url;
              Swal.fire({ title: 'Scheda Salvata!', icon: 'success', background: '#1a1a1a', color: '#e8c97e', timer: 1500, showConfirmButton: false });
          }
      } catch (err) { Swal.fire({ title: 'Errore', text: "Impossibile salvare la scheda.", icon: 'error', background: '#1a1a1a', color: '#e8c97e' }); }
  });

  // TTab per giocatori in partita
  document.querySelectorAll('.player-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const clickedBtn = e.currentTarget;
          document.querySelectorAll('.player-tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.player-tab-content').forEach(c => { c.classList.remove('active'); c.style.display = 'none'; });
          
          clickedBtn.classList.add('active');
          const targetTabId = 'tab-' + clickedBtn.dataset.tab;
          const targetTabElement = $(targetTabId);
          
            if (targetTabElement) {
                  targetTabElement.classList.add('active');
                  
                 if (targetTabId === 'tab-pc-mappa') {
                    targetTabElement.classList.add('active');
                    targetTabElement.style.display = 'flex';
                    refreshMap(playerLeafletMap);

                  } else {
                      targetTabElement.style.display = 'flex';
                  }
            }
          if (clickedBtn.dataset.tab === 'pc-mappa' && playerLeafletMap) {
              setTimeout(() => { playerLeafletMap.invalidateSize(); playerLeafletMap.fitBounds([[0,0], [1000,1000]]); }, 100);
          }
      });
  });

  // Per far copiare il codice della campagna nella sezione del master
  $('campaign-invite-code')?.addEventListener('click', async (e) => {
      const text = e.target.textContent;
      if (text && !text.includes('*')) {
          await navigator.clipboard.writeText(text);
          Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Codice copiato!', showConfirmButton: false, timer: 1500, background: '#1a1108', color: '#e8c97e' });
      }
  });

  // Ricezione Eventi Socket
  if (socket) {
      socket.on('ricevi_messaggio_campagna', (dati) => {
          // Prende il tipo dal server (dice, system), altrimenti usa 'other'
          const tipoMessaggio = dati.type || 'other';

          // Stampalo a video SOLO SE hai aperta esattamente quella campagna
          if ($('campaign-detail').style.display === 'block' && $('campaign-detail-title').textContent === dati.campName) {
              appendChatMessage(dati.mittente, dati.testo, tipoMessaggio, 'dm-chat-messages');
          } else if ($('player-campaign-detail').style.display === 'block' && $('player-camp-title').textContent === dati.campName) {
              appendChatMessage(dati.mittente, dati.testo, tipoMessaggio, 'pc-chat-messages');
          }
      });

      // CHat messaggi privati master players
      socket.on('ricevi_messaggio_privato', (dati) => {
          const isMaster = $('campaign-detail').style.display === 'block';
          const isPlayer = $('player-campaign-detail').style.display === 'block';
          if (!isMaster && !isPlayer) return;

          const containerId = isMaster ? 'dm-chat-messages' : 'pc-chat-messages';
          const msgDiv = document.createElement('div');
          msgDiv.className = `chat-msg private`;
          msgDiv.innerHTML = `<span class="sender">${escHtml(dati.mittente)} (sussurra)</span>${escHtml(dati.testo)}`;
          $(containerId).appendChild(msgDiv);
          $(containerId).scrollTop = $(containerId).scrollHeight;
      });

      socket.on('indicatore_sussurro', (dati) => {
          const isMaster = $('campaign-detail').style.display === 'block';
          const isPlayer = $('player-campaign-detail').style.display === 'block';
          if (!isMaster && !isPlayer) return;

          // Non avvisarti se sei tu il destinatario, hai già il messaggio!
          if (dati.destinatario === State.username) return;

          const boxId = isMaster ? 'dm-whisper-box' : 'pc-whisper-box';
          const box = $(boxId);
          if(box) {
              box.innerHTML = `🔒 <em>${escHtml(dati.mittente)} sta sussurrando a ${escHtml(dati.destinatario)}...</em>`;
              setTimeout(() => { box.innerHTML = ''; }, 4500);
          }
      });

      //Per inserire i segnalini sulla mappa
      socket.on('ricevi_segnalino', (dati) => {
        const latlng = { lat: dati.lat, lng: dati.lng };
        if (leafletMap) aggiungiSegnalino(latlng, leafletMap, false, dati.owner, dati.tokenInfo);
        if (playerLeafletMap) aggiungiSegnalino(latlng, playerLeafletMap, false, dati.owner, dati.tokenInfo);
      });

      // Per rimuovere i segnalini
      socket.on('segnalino_rimosso', (latlng) => {
          const rimuoviDaMappa = (mappa) => {
              if(!mappa) return;
              mappa.eachLayer(layer => {
                  if (layer instanceof L.Marker) {
                      const pos = layer.getLatLng();
                      if (Math.abs(pos.lat - latlng.lat) < 0.001 && Math.abs(pos.lng - latlng.lng) < 0.001) {
                          mappa.removeLayer(layer);
                      }
                  }
              });
          };
          rimuoviDaMappa(leafletMap);
          rimuoviDaMappa(playerLeafletMap);
      });

      socket.on('nuova_mappa_ricevuta', (url) => {
          const bounds = [[0,0], [1000,1000]];
          if (leafletMap) {
              if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay);
              currentImageOverlay = L.imageOverlay(url, bounds).addTo(leafletMap);
              leafletMap.eachLayer(layer => {
                  if (layer instanceof L.Marker) leafletMap.removeLayer(layer);
              });
              leafletMap.fitBounds(bounds);
              setTimeout(() => leafletMap.invalidateSize(), 100);
          }
          if (playerLeafletMap) {           
              playerLeafletMap.eachLayer(layer => {
                  if (layer instanceof L.ImageOverlay || layer instanceof L.Marker) {
                      playerLeafletMap.removeLayer(layer);
                  }
              });
    
              L.imageOverlay(url, bounds).addTo(playerLeafletMap);
              playerLeafletMap.fitBounds(bounds);
              setTimeout(() => playerLeafletMap.invalidateSize(), 100); 
          }
      });
  }
}

// Effetto Tilt 3D per le carte di lusso per evitare che lagghi troppo
function applicaTilt3D() {
  document.querySelectorAll('.vault-card.luxury').forEach(card => {
    if(card.__luxBound) return;
    card.__luxBound = true;
    const MAX = 6; 
    card.addEventListener('mousemove', (e) => {
      // Usiamo requestAnimationFrame per non sovraccaricare il rendering
      requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top)  / r.height;
        const rx = (0.5 - y) * MAX;
        const ry = (x - 0.5) * MAX;
        card.style.transform = `translateY(-6px) perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      });
    });
    card.addEventListener('mouseleave', () => {
      requestAnimationFrame(() => card.style.transform = '');
    });
  });


    import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm').then(async ({ PDFDocument }) => {
        async function scopriNomiCampiPDF() {
            console.log(" Avvio scansione del PDF...");
            try {
                const url = '/pdf/scheda_dnd_5e.pdf'; 
                
                const res = await fetch(url);
                if (!res.ok) throw new Error("Non riesco a trovare il PDF all'indirizzo: " + url);
                
                const arrayBuffer = await res.arrayBuffer();
                const pdfDoc = await PDFDocument.load(arrayBuffer);
                const form = pdfDoc.getForm();
                
                const campi = form.getFields();
                console.log("- INIZIO LISTA CAMPI PDF -");
                campi.forEach(campo => {
                    console.log(`Nome Interno: "${campo.getName()}" | Tipo: ${campo.constructor.name}`);
                });
                console.log("- FINE LISTA CAMPI PDF -");
                console.log("Ci sono in totale " + campi.length + " campi compilabili.");
                
            } catch (e) {
                console.error("- Errore lettura PDF:", e);
            }
        }
        
        // Questa riga fa partire fisicamente la funzione
        scopriNomiCampiPDF();
    });
}