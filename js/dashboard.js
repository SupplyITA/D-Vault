import { $, escHtml, openModal, closeModal, closeDropdown, closeDetails } from './utils.js';
import { State } from './state.js';
import { socket, appendChatMessage, gestisciInvioChat } from './chat.js';
import { renderDropdowns, renderGrid, renderizzaBestiario } from './ui.js';

// Variabili globali per Map e Vue
let leafletMap = null;
let playerLeafletMap = null; 
let vueData = null; 
let currentImageOverlay = null;

document.addEventListener('DOMContentLoaded', async () => {
  if ($('nav-username')) $('nav-username').textContent = State.username;
  await State.loadFromServer();
  
  // Inizializzazione Vue.js
  if (typeof Vue !== 'undefined') {
      const { createApp, ref, computed } = Vue;
      createApp({
          setup() {
              const livello = ref(1);
              const bonusCompetenza = computed(() => Math.ceil(livello.value / 4) + 1);
              vueData = { livello }; 
              return { livello, bonusCompetenza };
          }
      }).mount('#vue-scheda-personaggio');
  }

  renderDropdowns();
  renderGrid();
  bindEvents();
});


// Assegnazione globale delle funzioni HTML inline
window.openCharacterSelectorForCampaign = function(camp) {
    const listContainer = $('char-selection-list');
    if (State.sheets.length === 0) {
        listContainer.innerHTML = '<p style="color:#aaa;">Non hai nessun eroe. Forgiane uno prima di unirti al tavolo!</p>';
    } else {
        listContainer.innerHTML = State.sheets.map((sheet, i) => `
            <button class="btn-ghost" style="text-align: left; padding: 10px; display: flex; justify-content: space-between;" onclick="enterPlayerCampaign(${i}, '${escHtml(camp.campName)}')">
                <span>🛡️ ${escHtml(sheet.charName)} (Liv ${sheet.charLevel})</span>
                <span style="color:#e8c97e;">Scegli ➔</span>
            </button>
        `).join('');
    }
    openModal($('modal-select-char-backdrop'));
};

window.enterPlayerCampaign = function(sheetIndex, campName) {
  closeModal($('modal-select-char-backdrop'));
  const sheet = State.sheets[sheetIndex];
  
  if($('dash-main')) $('dash-main').style.display = 'none';
  if($('player-campaign-detail')) $('player-campaign-detail').style.display = 'block';
  
  if($('player-camp-title')) $('player-camp-title').textContent = campName;
  if($('player-camp-char')) {
      $('player-camp-char').textContent = "Eroe: " + sheet.charName;
      $('player-camp-char').dataset.charname = sheet.charName; 
  }

  if($('pc-avatar-img')) $('pc-avatar-img').src = sheet.avatar || 'https://via.placeholder.com/150/111111/e8c97e?text=Click';
  if($('pc-pdf-iframe')) $('pc-pdf-iframe').src = sheet.pdfUrl || '/pdf/scheda_dnd_5e.pdf';

  if ($('tab-pc-mappa')) {
      $('tab-pc-mappa').style.display = 'block';
      $('tab-pc-mappa').style.height = '100%';
      $('tab-pc-mappa').style.width = '100%';
  }

  // --- CREAZIONE E GESTIONE MAPPA GIOCATORE ---
  if (!playerLeafletMap && $('pc-map')) {
      playerLeafletMap = L.map('pc-map', { crs: L.CRS.Simple, minZoom: -2 });
      const bounds = [[0,0], [1000,1000]]; 
      L.imageOverlay('/maps/mappa_1.jpg', bounds).addTo(playerLeafletMap);
      playerLeafletMap.fitBounds(bounds);

      // Permetti al giocatore di mettere i segnalini cliccando
      playerLeafletMap.on('click', function(e) {
          aggiungiSegnalino(e.latlng, playerLeafletMap, true);
      });
      
      // Disabilita il menu del tasto destro per permettere la rimozione
      $('pc-map').addEventListener('contextmenu', e => e.preventDefault());
  }
  
  document.querySelector('.player-tab-btn[data-tab="pc-scheda"]')?.click();
};

function openCampaignDetail(camp) {
  if($('dash-main')) $('dash-main').style.display = 'none'; 
  if($('campaign-detail')) $('campaign-detail').style.display = 'block';
  if($('campaign-detail-title')) $('campaign-detail-title').textContent = camp.campName;

  const inviteContainer = $('campaign-invite-container');
  const inviteCodeEl = $('campaign-invite-code');
  const toggleBtn = $('btn-toggle-invite');

  // Carica gli eroi nella tab party
  caricaEroiParty(camp.campName);

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

  // --- CREAZIONE E GESTIONE MAPPA MASTER ---
  if (!leafletMap && $('map')) {
      leafletMap = L.map('map', { crs: L.CRS.Simple, minZoom: -2 });
      const bounds = [[0,0], [1000,1000]]; 
      
      currentImageOverlay = L.imageOverlay('/maps/mappa_1.jpg', bounds).addTo(leafletMap);
      leafletMap.fitBounds(bounds);

      // Usa la nuova funzione per mettere i segnalini
      leafletMap.on('click', function(e) {
          aggiungiSegnalino(e.latlng, leafletMap, true);
      });
      
      // Disabilita il menu del tasto destro
      $('map').addEventListener('contextmenu', e => e.preventDefault());
  }
}

// Funzione che aggiunge e permette la rimozione dei segnalini
function aggiungiSegnalino(latlng, mappa, isLocal = true) {
    const marker = L.marker(latlng).addTo(mappa);
    
    // Al click destro (contextmenu) sul segnalino, lo rimuoviamo
    marker.on('contextmenu', () => {
        mappa.removeLayer(marker);
        // Invia sempre al server la direttiva di rimozione (anche se sei stato tu a metterlo o qualcun altro)
        if (socket) socket.emit('rimuovi_segnalino', latlng);
    });

    // Se è un segnalino messo localmente (nuovo), lo inviamo agli altri
    if (socket && isLocal) socket.emit('invia_segnalino', latlng);
}

async function caricaEroiParty(campName) {
    const listContainer = $('party-list-container');
    const iframe = $('party-pdf-iframe');
    if(iframe) iframe.src = ''; 
    
    try {
        const response = await fetch(`/api/campaigns/${campName}/party`);
        const eroi = await response.json();
        
        if (!eroi || eroi.length === 0) {
            listContainer.innerHTML = '<p style="color: #aaa; font-style: italic;">Nessun eroe si è ancora unito al tavolo.</p>';
            return;
        }
        
        listContainer.innerHTML = eroi.map(eroe => `
            <div class="party-hero-card" onclick="visualizzaSchedaParty('${eroe.pdfUrl || '/pdf/scheda_dnd_5e.pdf'}')">
                <div class="party-hero-name">🛡️ ${escHtml(eroe.charName)}</div>
                <div class="party-hero-sub">Liv: ${eroe.charLevel} | Giocatore: ${escHtml(eroe.owner)}</div>
            </div>
        `).join('');
    } catch (e) {
        listContainer.innerHTML = '<p style="color: #8b1a1a;">Errore: Impossibile caricare il party. (L\'API server esiste?)</p>';
    }
}

// Funzione globale chiamata dal click HTML
window.visualizzaSchedaParty = function(pdfUrl) {
    const iframe = $('party-pdf-iframe');
    if (iframe) iframe.src = pdfUrl;
};

function openSheetDetail(sheet) {
  if($('dash-main')) $('dash-main').style.display = 'none'; 
  if($('sheet-detail')) $('sheet-detail').style.display = 'block';
  if($('sheet-detail-title')) $('sheet-detail-title').textContent = sheet.charName;

  if($('char-avatar-img')) {
      $('char-avatar-img').src = sheet.avatar || 'https://via.placeholder.com/150/111111/e8c97e?text=Click';
  }
  if (vueData) vueData.livello.value = parseInt(sheet.charLevel) || 1;
}

function bindEvents() {
  
  $('dash-main')?.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-delete')) {
      e.stopPropagation(); 
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      
      const result = await Swal.fire({
        title: 'Sei sicuro?',
        text: "Questa magia distruttiva non può essere annullata!",
        icon: 'warning',
        showCancelButton: true,
        background: '#1a1a1a', 
        color: '#e8c97e',      
        confirmButtonColor: '#8b1a1a', 
        cancelButtonColor: '#444',
        confirmButtonText: 'Sì, distruggi!',
        cancelButtonText: 'Annulla'
      });

      if (result.isConfirmed) {
        if (type == 'sheet') {
          await fetch(`/api/sheets/${State.sheets[index].charName}?user=${State.username}`, { method: 'DELETE' });
          State.sheets.splice(index, 1);
        } else {
          await fetch(`/api/campaigns/${State.campaigns[index].campName}?user=${State.username}`, { method: 'DELETE' });
          State.campaigns.splice(index, 1);
        }
        renderGrid(); 
        renderDropdowns();

        Swal.fire({ title: 'Incenerito!', text: 'L\'elemento è stato eliminato dal Vault.', icon: 'success', background: '#1a1a1a', color: '#e8c97e', confirmButtonColor: '#4a90e2' });
      }
      return; 
    }

    const card = e.target.closest('.vault-card');
    if (card) {
      const type = card.dataset.type;
      const index = parseInt(card.dataset.index);
      if (type === 'campaign') {
          const camp = State.campaigns[index];
          if (camp.owner === State.username) openCampaignDetail(camp);
          else openCharacterSelectorForCampaign(camp);
      }
      if (type === 'sheet') openSheetDetail(State.sheets[index]);
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
          targetElement.style.display = 'block';
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

  // Mappa Master: Cambio URL
  $('btn-change-map')?.addEventListener('click', () => {
      const url = $('map-url-input').value.trim();
      if (url && leafletMap) {
          if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay);
          const bounds = [[0,0], [1000,1000]];
          currentImageOverlay = L.imageOverlay(url, bounds).addTo(leafletMap);
          leafletMap.fitBounds(bounds);
          if (socket) socket.emit('cambia_sfondo_mappa', url);
          $('map-url-input').value = '';
      }
  });

  // Mappa Master: Carica File
  $('btn-upload-map')?.addEventListener('click', async () => {
      const fileInput = $('map-file-input');
      const file = fileInput.files[0];
      if (!file) return alert("Seleziona prima un'immagine dal tuo PC!");

      const formData = new FormData();
      formData.append('mapImage', file);
      formData.append('username', State.username); 

      try {
          const response = await fetch('/api/upload-map', { method: 'POST', body: formData });
          const data = await response.json();
          if (data.url && leafletMap) {
              if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay);
              const bounds = [[0,0], [1000,1000]];
              currentImageOverlay = L.imageOverlay(data.url, bounds).addTo(leafletMap);
              leafletMap.fitBounds(bounds);
              if (socket) socket.emit('cambia_sfondo_mappa', data.url);
              fileInput.value = '';
          }
      } catch (err) { console.error("Errore upload mappa:", err); alert("Errore durante il caricamento."); }
  });

  // Pulsanti indietro
  $('btn-back-campaign')?.addEventListener('click', () => { renderGrid(); closeDetails(); });
  $('btn-back-sheet')?.addEventListener('click', () => { renderGrid(); closeDetails(); });
  $('btn-back-player-camp')?.addEventListener('click', () => { renderGrid(); closeDetails(); });

  // Menu
  $('hamburger-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = $('dropdown-menu')?.classList.toggle('open');
    $('hamburger-btn').classList.toggle('open', isOpen);
  });
  document.addEventListener('click', (e) => {
    if (!$('dropdown-menu')?.contains(e.target) && e.target !== $('hamburger-btn')) closeDropdown();
  });

  // Modali
  $('btn-add-sheet-main')?.addEventListener('click', () => openModal($('modal-sheet-backdrop')));
  $('btn-add-camp-main')?.addEventListener('click', () => openModal($('modal-campaign-backdrop')));
  $('btn-join-camp-main')?.addEventListener('click', () => openModal($('modal-join-backdrop')));
  $('btn-add-sheet')?.addEventListener('click', () => { closeDropdown(); openModal($('modal-sheet-backdrop')); });
  $('btn-add-campaign')?.addEventListener('click', () => { closeDropdown(); openModal($('modal-campaign-backdrop')); });
  $('btn-join-campaign-dd')?.addEventListener('click', () => { closeDropdown(); openModal($('modal-join-backdrop')); });

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

  // Forms
  $('form-add-sheet')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData($('form-add-sheet')));
    data.owner = State.username;
    await fetch('/api/sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    await State.loadFromServer(); 
    $('form-add-sheet').reset();
    closeModal($('modal-sheet-backdrop'));
    renderDropdowns(); renderGrid();
  });

  $('form-add-campaign')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData($('form-add-campaign')));
    data.owner = State.username;
    await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    await State.loadFromServer();
    $('form-add-campaign').reset();
    closeModal($('modal-campaign-backdrop'));
    renderDropdowns(); renderGrid();
  });

  $('form-join-campaign')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inviteCode = $('form-join-campaign').querySelector('[name="inviteCode"]').value.trim().toUpperCase();
    try {
        const response = await fetch('/api/campaigns/join', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inviteCode: inviteCode, username: State.username })
        });
        const result = await response.json();
        Swal.fire({ title: response.ok ? 'Benvenuto nel Party!' : 'Magia Fallita!', text: result.message, icon: response.ok ? 'success' : 'error', background: '#1a1a1a', color: '#e8c97e', confirmButtonColor: '#e8c97e' });
        if (response.ok) {
          $('form-join-campaign').reset();
          closeModal($('modal-join-backdrop'));
          await State.loadFromServer();
          renderDropdowns(); renderGrid();
        }
    } catch (error) { Swal.fire({ title: 'Errore Server!', text: 'I server sono infestati dai goblin.', icon: 'error', background: '#1a1a1a', color: '#e8c97e', confirmButtonColor: '#8b1a1a' }); }
  });

  // Gestione unificata Chat:
  $('btn-send-chat')?.addEventListener('click', () => gestisciInvioChat('chat-input', 'chat-messages', State.username));
  $('chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-send-chat').click(); });

  $('btn-send-dm-chat')?.addEventListener('click', () => gestisciInvioChat('dm-chat-input', 'dm-chat-messages', State.username));
  $('dm-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-send-dm-chat').click(); });

  $('btn-pc-send-chat')?.addEventListener('click', () => gestisciInvioChat('pc-chat-input', 'pc-chat-messages', State.username));
  $('pc-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-pc-send-chat').click(); });

  // Avatar Base
  const avatarImg = $('char-avatar-img');
  const avatarInput = $('char-avatar-input');
  if (avatarImg && avatarInput) {
      avatarImg.onclick = () => avatarInput.click();
      avatarInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const formData = new FormData(); formData.append('avatarImage', file);
          try {
              const res = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
              const data = await res.json();
              if (data.url) {
                  avatarImg.src = data.url;
                  await fetch('/api/sheets/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: State.username, charName: $('sheet-detail-title').textContent, avatarUrl: data.url }) });
                  const currentSheet = State.sheets.find(s => s.charName === $('sheet-detail-title').textContent);
                  if (currentSheet) currentSheet.avatar = data.url;
              }
          } catch (err) { alert("Errore caricamento avatar."); }
      };
  }

  // Avatar Partita
  $('pc-avatar-img')?.addEventListener('click', () => $('pc-avatar-input').click());
  $('pc-avatar-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData(); formData.append('avatarImage', file);
      try {
          const res = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
          const data = await res.json();
          if (data.url) {
              $('pc-avatar-img').src = data.url;
              const pureCharName = $('player-camp-char').dataset.charname;
              await fetch('/api/sheets/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: State.username, charName: pureCharName, avatarUrl: data.url }) });
              const sheet = State.sheets.find(s => s.charName === pureCharName);
              if (sheet) sheet.avatar = data.url;
          }
      } catch(err) { console.error(err); }
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

  // TABS GIOCATORE IN PARTITA
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
                  targetTabElement.style.display = 'block'; targetTabElement.style.height = '100%'; targetTabElement.style.width = '100%';
              } else {
                  targetTabElement.style.display = 'flex';
              }
          }
          if (clickedBtn.dataset.tab === 'pc-mappa' && playerLeafletMap) {
              setTimeout(() => { playerLeafletMap.invalidateSize(); playerLeafletMap.fitBounds([[0,0], [1000,1000]]); }, 100);
          }
      });
  });

  // Ricezione Eventi Socket
  if (socket) {
      socket.on('ricevi_messaggio', (dati) => {
          appendChatMessage(dati.mittente, dati.testo, 'other', 'chat-messages');
          appendChatMessage(dati.mittente, dati.testo, 'other', 'dm-chat-messages');
          appendChatMessage(dati.mittente, dati.testo, 'other', 'pc-chat-messages'); 
      });

      socket.on('ricevi_segnalino', (latlng) => {
        if (leafletMap) aggiungiSegnalino(latlng, leafletMap, false);
        if (playerLeafletMap) aggiungiSegnalino(latlng, playerLeafletMap, false);
      });

      // RIMOZIONE: Aggiunto fix con la tolleranza!
      socket.on('segnalino_rimosso', (latlng) => {
          const rimuoviDaMappa = (mappa) => {
              if(!mappa) return;
              mappa.eachLayer(layer => {
                  if (layer instanceof L.Marker) {
                      const pos = layer.getLatLng();
                      // TOLLERANZA: Se la posizione differisce per millesimi (errore di rete JSON), eliminalo
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
              leafletMap.fitBounds(bounds);
          }
          if (playerLeafletMap) { 
              playerLeafletMap.eachLayer(layer => playerLeafletMap.removeLayer(layer));
              L.imageOverlay(url, bounds).addTo(playerLeafletMap);
              playerLeafletMap.fitBounds(bounds);
          }
      });
  }
}