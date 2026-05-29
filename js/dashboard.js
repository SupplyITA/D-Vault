import { $, escHtml, openModal, closeModal, closeDropdown, closeDetails } from './utils.js';
import { State } from './state.js';
import { socket, appendChatMessage, gestisciInvioChat, inviaChatCampagna, caricaMemoriaChat, tiraDado } from './chat.js';
import { renderDropdowns, renderGrid, renderizzaBestiario } from './ui.js';
import { costruisciSchedaInterattiva } from './interactive-sheet.js';
import { dndData } from './dnd-data.js';
import { PDFDocument } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';
import { AudioManager } from './audio.js';
import './map.js';

let vueData = null; 
let leafletMap = null;
let playerLeafletMap = null;
let currentImageOverlay = null;


// FUnzione per generare un colore univoco n base al nome utente (peak content)
function getColorForUser(username) {
    if(!username) return '#aaa';
    // Tavolozza di 15 colori
    const palette = [
        '#ff4444', '#032c13', '#33b5e5', '#aa66cc', '#ffbb33', 
        '#ff6699', '#00FFFF', '#ff8800', '#ccff00', '#dc143c', 
        '#ffd700', '#950d51', '#00ff00', '#205f9e', '#ff1493'
    ];
    let sum = 0;
    for (let i = 0; i < username.length; i++) {
        sum += username.charCodeAt(i) * (i + 1); 
    }
    return palette[sum % palette.length];
}

// Funzione per nascondere tutto e mostrare solo ciò che si vuole vedere
function hideAllSections() {
  const sections = ['dash-main', 'campaign-detail', 'sheet-detail', 'player-campaign-detail'];
  sections.forEach(id => {
    const el = $(id);
    if (el) el.style.display = 'none';
  });
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

// Funzione richiamata sotto per aprire la forgiatura del primo eroe
window.apriForgiaEroeDaVuoto = function() {
    closeModal($('modal-select-char-backdrop')); 
    openModal($('modal-sheet-backdrop'));
};

window.openCharacterSelectorForCampaign = function(camp) {
    const listContainer = $('char-selection-list');
    if (State.sheets.length === 0) {
        // Se non ci sono eroi, il messaggio reindirizza alla forgiatura del primo eroe
        listContainer.innerHTML = `
            <p style="color:#aaa;">Non hai nessun eroe. 
                <a href="#" style="color:#e8c97e; text-decoration:underline; font-weight:bold;" 
                   onclick="window.apriForgiaEroeDaVuoto(); return false;">
                   Forgiane uno
                </a> prima di unirti al tavolo!
            </p>`;
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
  await State.loadFromServer();
  const sheet = State.sheets[sheetIndex];
  const camp = State.campaigns.find(c => c.campName === campName);

  // Pulisce tutte le schermate
  if (typeof hideAllSections === 'function') hideAllSections(); 
  
  // Ripristina la memoria della chat
  if($('pc-chat-messages')) caricaMemoriaChat(campName, 'pc-chat-messages');

  //Accende solo la schermata del giocatore
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
  attivaOverlayLandscape();
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
    playerLeafletMap = L.map('pc-map', { crs: L.CRS.Simple, minZoom: -2, maxZoom: 2, dragging: true });
    window.playerLeafletMap = playerLeafletMap;
    playerLeafletMap.on('click', function(e) {
          aggiungiSegnalino(e.latlng, playerLeafletMap, true);
      });
      $('pc-map').addEventListener('contextmenu', e => e.preventDefault());
  }

  //sezione per poter mettere segnalini personalizzati con immagine personaggio e colore
    const myColor = window.getColorForUser ? window.getColorForUser(State.username) : '#aaa';
  if($('player-color-marker')) $('player-color-marker').style.backgroundColor = myColor;
  
  const avatarUrl = sheet.avatar || '/img/species/_default.jpg';
  if($('pc-avatar-img')) $('pc-avatar-img').src = avatarUrl;
  if($('player-token-avatar')) $('player-token-avatar').src = avatarUrl;

  $('player-camp-char').innerHTML = `Eroe: ${sheet.charName} <span style="display:inline-block;width:15px;height:15px;border-radius:50%;background-color:${myColor};vertical-align:middle;margin-left:10px;border:1px solid #fff;box-shadow:0 0 5px #000;" title="Il tuo colore identificativo"></span>`;

    selezionaToken('color', null, document.querySelector('#player-token-sidebar .token-option'), { tipo: 'color' });

if (playerLeafletMap) {
    playerLeafletMap.off('click');
    playerLeafletMap.on('click', function(e) {
        const avatarUrl = $('pc-avatar-img')?.src || '/img/species/_default.jpg';
        const charName = $('player-camp-char')?.dataset.charname || State.username;

        let info;
        if (window.activeTokenType === 'color') {
            info = { type: 'color', url: null, tipo: 'color' };
        } else {
            info = { type: 'image', url: avatarUrl, nome: charName, tipo: 'eroe', ownerUsername: State.username };
        }

        // Se sta piazzando un eroe, rimuove il vecchio eroe prima
        if (info.tipo === 'eroe') {
            playerLeafletMap.eachLayer(layer => {
                if (layer instanceof L.Marker &&
                    layer.proprietario === State.username &&
                    layer.tokenInfo?.tipo === 'eroe') {
                    playerLeafletMap.removeLayer(layer);
                    const pos = layer.getLatLng();
                    const campName = $('player-camp-title')?.textContent.trim();
                    if (socket) socket.emit('rimuovi_segnalino', { lat: pos.lat, lng: pos.lng, campName });
                }
            });
        }

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
          renderGrid(); renderDropdowns();
      }
      //Aggiorna lista eroi subito
      if (socket) {
          socket.emit('player_scelto_eroe', { campName: campName });
      }
  } catch(e) { console.error("Errore salvataggio eroe in background:", e); }

  AudioManager.updateBackgroundMusic(true);
};

// Inizializza la pagina
document.addEventListener('DOMContentLoaded', async () => {
  AudioManager.init();
  if ($('nav-username')) $('nav-username').textContent = State.username;
  await State.loadFromServer();

  // Carica avatar e nome reale utente nel menu in alto a destra
  (async () => {
      try {
          const resp = await fetch(`/api/user-info?username=${encodeURIComponent(State.username)}`);
          const userData = await resp.json();
          const avatarImg = document.getElementById('nav-user-avatar');
          const avatarIcon = document.getElementById('nav-user-icon');
          const ddLabel = document.getElementById('dd-user-label');
          if (userData.avatar && avatarImg) {
              avatarImg.src = userData.avatar;
              avatarImg.style.display = 'inline-block';
              if (avatarIcon) avatarIcon.style.display = 'none';
          }
          if (ddLabel) {
              ddLabel.innerHTML = `<img src="${userData.avatar || ''}" 
                  style="width:18px;height:18px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px;border:1px solid rgba(212,168,67,0.4);"
                  onerror="this.style.display='none'">
                  ${State.username}`;
          }
      } catch(_) {}
  })();

  // Entra subito in tutte le stanze delle proprie campagne
  // così gli eventi socket (rename, ecc.) arrivano anche dalla dashboard
  if (socket) {
      State.campaigns.forEach(c => {
          socket.emit('entra_stanza_campagna', { campName: c.campName, username: State.username });
      });
  }

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
async function caricaTokenEroi(campName) {
    const container = document.getElementById('master-hero-tokens');
    if (!container) return;
    container.innerHTML = '';
    try {
        const res = await fetch(`/api/campaigns/${encodeURIComponent(campName)}/party`);
        const eroi = await res.json();
        if (eroi.length === 0) {
            container.innerHTML = '<span style="color:#666;font-size:0.75rem;font-style:italic;">Nessun eroe al tavolo</span>';
            return;
        }
        eroi.forEach(eroe => {
            const src = eroe.avatar || `img/species/_default.jpg`;
            const img = document.createElement('img');
            img.src = src;
            img.title = eroe.charName;
            img.className = 'token-option';
            img.style.cssText = 'width:35px;height:35px;border-radius:50%;cursor:pointer;border:2px solid transparent;object-fit:cover;background:#000;';
            img.onerror = function() { this.src = 'img/species/_default.jpg'; };
            img.onclick = function() { selezionaToken('image', src, this); };
            container.appendChild(img);
        });
    } catch(e) { console.error('Errore caricamento token eroi:', e); }
}

// Overlay globale (fuori dal flusso di pagina) che garantisce che l'avviso "Ruota il dispositivo" 
// sia sempre visibile indipendentemente dal livello di scroll nella dashboard.

let _inCampagna = false;

function attivaOverlayLandscape() {
  const overlay = document.getElementById('global-landscape-overlay');
  if (!overlay) return;

  _inCampagna = true;

  const isLandscape = window.screen.orientation?.type?.includes('landscape') || window.innerWidth > window.innerHeight;
  if (!isLandscape) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    overlay.classList.add('active-lock');
    document.body.classList.add('lock-scroll');
  }

  if (overlay._resizeHandler) {
    window.removeEventListener('resize', overlay._resizeHandler);
    window.removeEventListener('orientationchange', overlay._resizeHandler);
  }

  const handler = () => {
    if (!_inCampagna) return; // se non siamo in campagna, non fare nulla
    setTimeout(() => {
      const isLandscape = window.screen.orientation?.type?.includes('landscape') || window.innerWidth > window.innerHeight;
      if (isLandscape) {
        overlay.classList.remove('active-lock');
        document.body.classList.remove('lock-scroll');
        document.body.classList.add('is-landscape-game');
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' });
        overlay.classList.add('active-lock');
        document.body.classList.add('lock-scroll');
        document.body.classList.remove('is-landscape-game');
      }
    }, 300);
  };

  window.addEventListener('orientationchange', handler);
  window.addEventListener('resize', handler);
  overlay._resizeHandler = handler;
}

window.disattivaOverlayLandscape = function() {
  _inCampagna = false;
  const overlay = document.getElementById('global-landscape-overlay');
  if (!overlay) return;
  overlay.classList.remove('active-lock');
  document.body.classList.remove('lock-scroll');
  document.body.classList.remove('is-landscape-game');
  if (overlay._resizeHandler) {
    window.removeEventListener('resize', overlay._resizeHandler);
    window.removeEventListener('orientationchange', overlay._resizeHandler);
    delete overlay._resizeHandler;
  }
}

const esciDalTavolo = () => {
    if (socket) socket.emit('esci_stanza_campagna');
    AudioManager.updateBackgroundMusic(false);
    disattivaOverlayLandscape();
    renderGrid(); applicaTilt3D(); closeDetails();
};
window.esciDalTavolo = esciDalTavolo;

function openCampaignDetail(camp) {
  hideAllSections(); 
  if($('dm-chat-messages')) caricaMemoriaChat(camp.campName, 'dm-chat-messages');
  attivaOverlayLandscape(); 

  //Attiva solo la schermata del master
  if($('campaign-detail')) $('campaign-detail').style.display = 'block';
  if($('campaign-detail-title')) $('campaign-detail-title').textContent = camp.campName; $('campaign-detail-title').dataset.campname = camp.campName;
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
    const myColor = window.getColorForUser ? window.getColorForUser(State.username) : '#aaa';
  if($('master-color-marker')) $('master-color-marker').style.backgroundColor = myColor;
  $('campaign-detail-title').innerHTML = `${camp.campName}<span style="display:inline-block;width:15px;height:15px;border-radius:50%;background-color:${myColor};vertical-align:middle;margin-left:10px;border:1px solid #fff;box-shadow:0 0 5px #000;" title="Il tuo colore identificativo"></span>`;  
  $('campaign-detail-title').dataset.campname = camp.campName;
  selezionaToken('color', null, document.querySelector('#master-token-sidebar .token-option'));
  caricaTokenMostri();
  caricaTokenEroi(camp.campName);

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
      leafletMap = L.map('map', { crs: L.CRS.Simple, minZoom: -2, maxZoom: 2 });
      window.leafletMap = leafletMap;
      
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
        const info = { 
            type: window.activeTokenType, 
            url: window.activeTokenUrl, 
            ...window.activeTokenExtra 
        };

       // Scegliamo chi è il proprietario del segnalino
        // Se è un eroe, l'owner deve essere il giocatore (ownerUsername), altrimenti è il Master (State.username)
        const effettivoOwner = (info.tipo === 'eroe' && info.ownerUsername) ? info.ownerUsername : State.username;
        info.markerId = `${effettivoOwner}_${info.tipo || 'color'}_${info.nome || effettivoOwner}`;
        aggiungiSegnalino(e.latlng, leafletMap, true, effettivoOwner, info);
    });
  }

  if (socket) socket.emit('entra_stanza_campagna', { campName: camp.campName, username: State.username });

  AudioManager.updateBackgroundMusic(true);
}

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
                    <div style="display:flex;align-items:center;gap:10px;">
                        <img src="${eroe.avatar || `img/species/${(eroe.charRace||'umano').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||'umano'}-${eroe.charGender||'m'}.jpg`}"
                             onerror="this.onerror=null;this.src='img/species/_default.jpg';"
                             style="width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:top center;border:2px solid rgba(212,168,67,0.4);flex-shrink:0;">
                        <div>
                            <div class="party-hero-name">${escHtml(eroe.charName)}</div>
                            <div class="party-hero-sub">Liv: ${eroe.charLevel} | Giocatore: ${escHtml(eroe.owner)}</div>
                        </div>
                    </div>
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
                if (socket) {
                    socket.emit('invia_messaggio_campagna', {
                        mittente: 'Taverniere', testo: `${giocatore} è stato esiliato dal Master.`, type: 'system', campName: campName
                    });
                    socket.emit('esilia_giocatore', { campName: campName, username: giocatore });
                }
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
  disattivaOverlayLandscape();
  
  if($('sheet-detail')) $('sheet-detail').style.display = 'block';
  if($('sheet-detail-title')) $('sheet-detail-title').textContent = sheet.charName;

  // Carica le note del giocatore
  const notesArea = $('player-notes');
  if(notesArea) {
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
            if(currentImageOverlay) map.fitBounds(currentImageOverlay.getBounds());
        });
    }
}

function bindEvents() {

  // Gestione apertura/chiusura chat laterale
  document.querySelectorAll('.btn-collapse-chat').forEach(btn => {
      btn.addEventListener('click', function(e) {
          e.preventDefault();
          // Prende il contenitore destro
          const rightColumn = this.closest('.sheet-right');
          if (!rightColumn) return;
          // Aggiunge/toglie la classe collapsed
          rightColumn.classList.toggle('collapsed');
          // Aggiorna la mappa aspetta 300ms e leaflet riempie lo spazio
          setTimeout(() => {
              if (window.leafletMap) {
                  window.leafletMap.invalidateSize();
              }
              if (window.playerLeafletMap) {
                  window.playerLeafletMap.invalidateSize();
              }
          }, 320); 
      });
  });

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
              const campName = $('campaign-detail-title')?.dataset.campname;
              const markers = [];
              leafletMap.eachLayer(layer => {
                    if (layer instanceof L.Marker) markers.push(layer);
                });
                markers.forEach(layer => {
                    leafletMap.removeLayer(layer);
                    if (socket) socket.emit('rimuovi_segnalino', { markerId: layer.markerId, campName });
                });
                if (socket && campName) socket.emit('pulisci_mappa', { campName });

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
        // Notifica gli altri giocatori
        if (socket) socket.emit('forza_aggiornamento_globale');

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
        if (socket) socket.emit('forza_aggiornamento_globale');
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
          $('map-url-input').value = ''; 
          await aggiungiMappaAStorico(url, campName);
      }
  });

  // Mappa Master: Carica File
  $('btn-upload-map')?.addEventListener('click', async () => {
      const fileInput = $('map-file-input');
      const file = fileInput.files[0];
      const campName = $('campaign-detail-title').textContent.trim();
      
      if (!file) return alert("Seleziona prima un'immagine dal tuo PC!");
      
      // Come per la gestione dellr immagini degli avatar, non possiamo usare  json stringify per file binari
      const formData = new FormData();
      formData.append('mapImage', file);
      formData.append('username', State.username); 

      try {
          const response = await fetch('/api/upload-map', { method: 'POST', body: formData });
          const data = await response.json();
          
          if (data.url && leafletMap) {
              fileInput.value = ''; 
              await aggiungiMappaAStorico(data.url, campName); 
          }
      } catch (err) { 
          console.error("Errore upload mappa:", err); 
          alert("Errore durante il caricamento."); 
      }
  });

  // Pulsanti indietro (Modificati per avvisare l'uscita dalla chat)
  const esciDalTavolo = async () => {
      if (socket) socket.emit('esci_stanza_campagna');
      AudioManager.updateBackgroundMusic(false);
      await State.loadFromServer();
      closeDetails();
      renderGrid();
      renderDropdowns();
      applicaTilt3D();
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
    renderDropdowns();

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
    data.username = State.username; 
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
        await State.loadFromServer();
        const camp = State.campaigns.find(c => c.campName === campName);
        if (camp) camp.campDesc = story; 
        // Pulisce le altre schermate
        if (typeof hideAllSections === 'function') hideAllSections();

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
          const campName = isMaster ? $('campaign-detail-title').textContent.trim() : $('player-camp-title').textContent.trim(); //bea ho aggiunto .trim perché sennò c'erano un sacco di spazi inutili
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
                  renderGrid(); renderDropdowns();


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
                  renderGrid(); renderDropdowns();

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

  //Funzione per il Jukebox Musicale
function openJukebox() {
    const campName = $('campaign-detail-title').textContent;

    Swal.fire({
        title: 'Jukeboard della Taverna',
        html: `
            <div style="text-align: left; display: flex; flex-direction: column; gap: 10px;">
                <p style="color: var(--gold-dim); font-size: 0.9rem; margin-bottom: 5px;">Ordina al Bardo una melodia:</p>
                <button class="btn-ghost btn-track" data-src="/audio/campaign.mp3" style="text-align: left;"> Tema Principale (Default)</button>
                <button class="btn-ghost btn-track" data-src="/audio/taverna.mp3" style="text-align: left;"> Locanda Affollata</button>
                <button class="btn-ghost btn-track" data-src="/audio/avventura.mp3" style="text-align: left;"> Viaggio Epico</button>
                <button class="btn-ghost btn-track" data-src="/audio/attacco.mp3" style="text-align: left;"> Combattimento</button>
                
                <div class="vault-divider" style="margin: 15px 0; background: rgba(212,168,67,0.2);"></div>
                
                <p style="color: var(--gold-dim); font-size: 0.9rem; margin-bottom: 5px;">O fornisci tu uno spartito magico (File MP3):</p>
                <input type="file" id="jukebox-upload" accept="audio/*" style="background: rgba(0,0,0,0.5); color: white; padding: 10px; border: 1px solid #444; border-radius: 4px; width: 100%;">
            </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        background: '#1a1108',
        color: '#e8c97e',
        customClass: { popup: 'vault-popup' },
        didOpen: () => {
            // Gestisce i bottoni della libreria
            document.querySelectorAll('.btn-track').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const url = e.target.dataset.src;
                    if (AudioManager) AudioManager.changeCampaignTrack(url);
                    if (socket) socket.emit('cambia_musica_campagna', { campName, url });
                    
                    Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: 'Melodia inviata al party!', showConfirmButton: false, timer: 1500, background: '#1a1108', color: '#e8c97e' });
                });
            });

            // Gestisce l'upload del file al server
            document.getElementById('jukebox-upload').addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                Swal.fire({ title: 'Addestrando il Bardo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

                const formData = new FormData();
                formData.append('audioFile', file);

                try {
                    const res = await fetch('/api/upload-audio', { method: 'POST', body: formData });
                    const data = await res.json();
                    
                    if (data.url) {
                        if (AudioManager) AudioManager.changeCampaignTrack(data.url);
                        if (socket) socket.emit('cambia_musica_campagna', { campName, url: data.url });
                        
                        Swal.fire({ toast: true, position: 'bottom-end', icon: 'success', title: 'Nuova traccia diffusa!', showConfirmButton: false, timer: 1500, background: '#1a1108', color: '#e8c97e' });
                    }
                } catch (err) {
                    Swal.fire('Errore', 'Impossibile caricare il file audio.', 'error');
                }
            });
        }
    });
  }

  $('btn-master-jukebox')?.addEventListener('click', openJukebox);

  // Ricezione Eventi Socket
  if (socket) {
      socket.on('ricevi_messaggio_campagna', (dati) => {
          // Prende il tipo dal server (dice, system), altrimenti usa 'other'
          const tipoMessaggio = dati.type || 'other';

          // Stampalo a video SOLO SE hai aperta esattamente quella campagna
         if ($('campaign-detail').style.display === 'block' && $('campaign-detail-title').textContent.trim() === dati.campName) { // anche qui ho aggiunto trim per lo stesso motivo di prima, evito spazi inutili
              appendChatMessage(dati.mittente, dati.testo, tipoMessaggio, 'dm-chat-messages');
          } else if ($('player-campaign-detail').style.display === 'block' && $('player-camp-title').textContent.trim() === dati.campName) { // e qui, anche perché da problemi con i nomi sennò
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
        // Quando ricevo un segnalino da qualcun altro (Master o Player), 
        // uso la funzione aggiungiSegnalino che ora ha il "killer di duplicati" integrato
        socket.on('ricevi_segnalino', (dati) => {
            const masterAperto = $('campaign-detail')?.style.display === 'block';
            const playerAperto = $('player-campaign-detail')?.style.display === 'block';
            if (leafletMap && masterAperto) aggiungiSegnalino(L.latLng(dati.lat, dati.lng), leafletMap, false, dati.owner, dati.tokenInfo);
            if (playerLeafletMap && playerAperto) aggiungiSegnalino(L.latLng(dati.lat, dati.lng), playerLeafletMap, false, dati.owner, dati.tokenInfo);
        });

            // Per rimuovere i segnalini
            socket.on('segnalino_rimosso', (dati) => {
            const masterAperto = $('campaign-detail')?.style.display === 'block';
            const playerAperto = $('player-campaign-detail')?.style.display === 'block';
            
            const rimuoviDaMappa = (mappa) => {
                if(!mappa) return;
                mappa.eachLayer(layer => {
                    // Rimuoviamo cercando l'ID univoco che abbiamo creato in map.js
                    if (layer instanceof L.Marker && layer.markerId === dati.markerId) {
                        mappa.removeLayer(layer);
                    }
                });
            };

            if (masterAperto) rimuoviDaMappa(window.leafletMap);
            if (playerAperto) rimuoviDaMappa(window.playerLeafletMap);
        });
    
      // Per spostare i segnalini
        socket.on('sposta_segnalino', (dati) => {
            const masterAperto = $('campaign-detail')?.style.display === 'block';
            const playerAperto = $('player-campaign-detail')?.style.display === 'block';
            // Aggiorna TUTTE le mappe aperte (sia master che player)
            // Leaflet non duplica se il layer è già alla posizione giusta
            const mappe = [
                window.leafletMap,
                window.playerLeafletMap
            ].filter(Boolean);
            mappe.forEach(mappa => {
                mappa.eachLayer(layer => {
                    if (!(layer instanceof L.Marker)) return;
                    const matchId = dati.markerId && layer.markerId === dati.markerId;
                    const matchPos = !dati.markerId &&
                        layer.proprietario === dati.owner &&
                        Math.abs(layer.getLatLng().lat - dati.oldLat) < 0.5 &&
                        Math.abs(layer.getLatLng().lng - dati.oldLng) < 0.5;
                    if (matchId || matchPos) {
                        layer.setLatLng([dati.newLat, dati.newLng]);
                    }
                });
            });
        });

      socket.on('pulisci_mappa', () => {
            // Questa versione è più potente: cicla su tutte le mappe possibili e pulisce tutto
            const mappe = [window.leafletMap, window.playerLeafletMap].filter(Boolean);
            
            mappe.forEach(mappa => {
                const markersDaRimuovere = [];
                mappa.eachLayer(layer => {
                    if (layer instanceof L.Marker) {
                        markersDaRimuovere.push(layer);
                    }
                });
                markersDaRimuovere.forEach(m => mappa.removeLayer(m));
            });
        });


      // Sezione per ricevere mappa e caricarla da link, la salva per la history delle mappe
      socket.on('nuova_mappa_ricevuta', (url) => {
          const campName = $('player-camp-title')?.textContent.trim();
          if (campName) {
              const camp = State.campaigns.find(c => c.campName === campName);
              if (camp) { camp.mapUrl = url; renderDropdowns(); renderGrid(); }
          }
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




        // Rinomina campagna
      socket.on('campagna_rinominata', async ({ oldName, newName }) => {
          await State.loadFromServer();
          renderGrid();
          renderDropdowns();
          // Aggiorna il titolo se il giocatore è dentro quella sezione
          const titleEl = $('player-camp-title');
          if (titleEl && titleEl.textContent.trim() === oldName) {
              titleEl.textContent = newName;
          }
      });

      // Eliminazione campagna dal master
      socket.on('ricarica_dati', async () => {
          // Ricarica i dati in background
          await State.loadFromServer();
          
          // Caso in cui il giocatore stava sulla dashboard
          if ($('dash-main').style.display !== 'none') {
              renderGrid();
              if (typeof renderDropdowns === 'function') renderDropdowns();
              if (typeof applicaTilt3D === 'function') applicaTilt3D();
          }

          // Caso in cui il giocatore stava nella scheda della campagna eliminata
          const isPlayerInCamp = $('player-campaign-detail').style.display === 'block';
          if (isPlayerInCamp) {
              const currentCamp = $('player-camp-title').textContent.trim();
              // Controlla se la campagna in cui si trova esiste ancora
              const campExists = State.campaigns.some(c => c.campName === currentCamp);
              if (!campExists) {
                  esciDalTavolo(); //Fa uscire il giocatore
                  Swal.fire({
                      title: 'Mondo Dissolto',
                      text: 'Il Master ha cancellato questa campagna.',
                      icon: 'info',
                      background: '#1a1108', color: '#e8c97e'
                  });
              }
          }
      });

      // Gestione esilio dal Master
      socket.on('ricevi_esilio', async (dati) => {
          // Controlla se sono io l'utente esiliato
          if (State.username === dati.username) {
              const isPlayerInCamp = $('player-campaign-detail').style.display === 'block';
              
              if (isPlayerInCamp && $('player-camp-title').textContent.trim() === dati.campName) {
                  await State.loadFromServer();
                  
                  // Toglie la campagna dal menù a tendina
                  if (typeof renderDropdowns === 'function') renderDropdowns();
                  
                  esciDalTavolo(); 
                  
                  Swal.fire({
                      title: 'Sei stato esiliato',
                      text: 'Il Master ti ha rimosso permanentemente da questa campagna.',
                      icon: 'error',
                      background: '#1a1108', color: '#e8c97e'
                  });
              } else {
                  await State.loadFromServer();
                  renderGrid();
                  if (typeof renderDropdowns === 'function') renderDropdowns();
                  if (typeof applicaTilt3D === 'function') applicaTilt3D();
              }
          }
      });

      // Ricezione della nuova musica dal Master
      socket.on('nuova_musica_ricevuta', (url) => {
          if (AudioManager) {
              AudioManager.changeCampaignTrack(url);
              
              // Mostra un piccolo avviso al giocatore
              const isPlayer = $('player-campaign-detail').style.display === 'block';
              if (isPlayer) {
                  Swal.fire({ 
                      toast: true, position: 'top-end', icon: 'info', 
                      title: 'Il Master ha cambiato la musica!', 
                      showConfirmButton: false, timer: 2000, 
                      background: '#1a1108', color: '#e8c97e' 
                  });
              }
          }
      });

      //Aggiorna lista eroi (Master)
      socket.on('aggiorna_lista_party', async (dati) => {
          const isMasterCamp = $('campaign-detail') && $('campaign-detail').style.display === 'block';
          if (isMasterCamp && $('campaign-detail-title').textContent.trim() === dati.campName) {
              // Scarica i dati dell'eroe
              await State.loadFromServer();
              // Modifica la lista
              caricaEroiParty(dati.campName);
              caricaTokenEroi(dati.campName);
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