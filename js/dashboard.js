import { $, escHtml, openModal, closeModal, closeDropdown, closeDetails } from './utils.js';
import { State } from './state.js';
import { socket, appendChatMessage, gestisciInvioChat, inviaChatCampagna, salvaMessaggioInMemoria, caricaMemoriaChat } from './chat.js';
import { renderDropdowns, renderGrid, renderizzaBestiario } from './ui.js';
import { costruisciSchedaInterattiva } from './interactive-sheet.js';
import { dndData } from './dnd-data.js';
import { PDFDocument } from 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm';

// Variabili globali per Map e Vue
let leafletMap = null;
let playerLeafletMap = null; 
let vueData = null; 
let currentImageOverlay = null;

// --- 1. FUNZIONE SPAZZINA UNICA E GLOBALE ---
function hideAllSections() {
  const sections = ['dash-main', 'campaign-detail', 'sheet-detail', 'player-campaign-detail'];
  sections.forEach(id => {
    const el = $(id);
    if (el) el.style.display = 'none';
  });
}

// --- 2. GESTIONE INGRESSO CAMPAGNA GIOCATORE ---
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
  
  // Definiamo subito 'camp'
  const camp = State.campaigns.find(c => c.campName === campName);

  // 1. Pulisce le altre schermate
  if (typeof hideAllSections === 'function') hideAllSections(); 
  
  // 2. Ripristina la memoria della chat!
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

  // --- GESTIONE MAPPA GIOCATORE (LA TUA ORIGINALE, RIPRISTINATA!) ---
  const mapUrl = (camp && camp.mapUrl) ? camp.mapUrl : '/maps/mappa_1.jpg';

  // Inizializza la mappa Leaflet solo la prima volta
  if (!playerLeafletMap && $('pc-map')) {
      playerLeafletMap = L.map('pc-map', { crs: L.CRS.Simple, minZoom: -2 });
      playerLeafletMap.on('click', function(e) {
          aggiungiSegnalino(e.latlng, playerLeafletMap, true);
      });
      $('pc-map').addEventListener('contextmenu', e => e.preventDefault());
  }

  // Aggiorna SEMPRE l'immagine 
  if (playerLeafletMap) {
      playerLeafletMap.eachLayer(layer => {
          if (layer instanceof L.ImageOverlay) playerLeafletMap.removeLayer(layer);
      });
      const bounds = [[0,0], [1000,1000]]; 
      L.imageOverlay(mapUrl, bounds).addTo(playerLeafletMap);
      playerLeafletMap.fitBounds(bounds);
      setTimeout(() => playerLeafletMap.invalidateSize(), 100);
  }
  // -----------------------------------------------------------------

  document.querySelector('.player-tab-btn[data-tab="pc-scheda"]')?.click();
  
  // Entra nella stanza segreta della chat
  if (socket) socket.emit('entra_stanza_campagna', campName);

  // --- SALVATAGGIO IN BACKGROUND BLINDATO ---
  try {
      await fetch('/api/campaigns/set-active-char', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ campName: campName, owner: State.username, charName: sheet.charName })
      });
      
      // Aggiorna la memoria locale così se chiudi e riapri entra da solo!
      if (camp) {
          let active = {};
          try { active = JSON.parse(camp.activeCharacters || "{}"); } catch(e){}
          active[State.username] = sheet.charName;
          camp.activeCharacters = JSON.stringify(active);
      }
  } catch(e) { console.error("Errore salvataggio eroe in background:", e); }
};

// --- 4. INIZIALIZZAZIONE DELLA PAGINA (VUE E DATI) ---
document.addEventListener('DOMContentLoaded', async () => {
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

// IL RESTO DEL FILE CONTINUA QUI DA openCampaignDetail(camp)...

function openCampaignDetail(camp) {
  hideAllSections(); // <-- Pulisce tutto prima
  if($('dm-chat-messages')) caricaMemoriaChat(camp.campName, 'dm-chat-messages');
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

  // --- CREAZIONE E GESTIONE MAPPA MASTER (AGGIORNATA) ---
  const mapUrl = camp.mapUrl || '/maps/mappa_1.jpg'; // Prende la mappa della campagna o quella base

  // 1. Inizializza la mappa Leaflet solo la prima volta
  if (!leafletMap && $('map')) {
      leafletMap = L.map('map', { crs: L.CRS.Simple, minZoom: -2 });
      
      // Usa la nuova funzione per mettere i segnalini
      leafletMap.on('click', function(e) {
          aggiungiSegnalino(e.latlng, leafletMap, true);
      });
      
      // Disabilita il menu del tasto destro
      $('map').addEventListener('contextmenu', e => e.preventDefault());
  }

  // 2. Aggiorna SEMPRE l'immagine (anche se la mappa Leaflet esisteva già)
  if (leafletMap) {
      // Togliamo l'immagine vecchia
      if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay);
      
      // Mettiamo l'immagine della campagna in cui siamo appena entrati
      const bounds = [[0,0], [1000,1000]]; 
      currentImageOverlay = L.imageOverlay(mapUrl, bounds).addTo(leafletMap);
      leafletMap.fitBounds(bounds);
      
      // Assicura che le dimensioni si calcolino correttamente senza ricaricare la pagina
      setTimeout(() => leafletMap.invalidateSize(), 100);
  }

  if (socket) socket.emit('entra_stanza_campagna', camp.campName);
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
            <div class="party-hero-card" onclick="visualizzaSchedaParty('${eroe.charName}')">
                <div class="party-hero-name">🛡️ ${escHtml(eroe.charName)}</div>
                <div class="party-hero-sub">Liv: ${eroe.charLevel} | Giocatore: ${escHtml(eroe.owner)}</div>
            </div>
        `).join('');
    } catch (e) {
        listContainer.innerHTML = '<p style="color: #8b1a1a;">Errore: Impossibile caricare il party. (L\'API server esiste?)</p>';
    }
}

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
          //$('master-sheet-title').textContent = `Scheda di ${sheetData.charName} (Liv. ${sheetData.charLevel})`;
          
          // Costruisce la scheda IN SOLA LETTURA (true)
          costruisciSchedaInterattiva('master-sheet-container', sheetData, true);
          //openModal($('modal-master-sheet-backdrop'));
      });
};

function openSheetDetail(sheet) {
  hideAllSections(); // <-- Pulisce tutto prima
  if($('dash-main')) $('dash-main').style.display = 'none'; 
  if($('sheet-detail')) $('sheet-detail').style.display = 'block';
  if($('sheet-detail-title')) $('sheet-detail-title').textContent = sheet.charName;

  if($('char-avatar-img')) {
      $('char-avatar-img').src = sheet.avatar || 'https://via.placeholder.com/150/111111/e8c97e?text=Click';
  }
  // Costruisce la scheda interattiva con i dati del personaggio
  costruisciSchedaInterattiva('base-sheet-container', sheet, false);

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
        applicaTilt3D();
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
          else handlePlayerCampaignClick(camp);
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
  $('btn-change-map')?.addEventListener('click', async () => {
      const url = $('map-url-input').value.trim();
      const campName = $('campaign-detail-title').textContent.trim();

      if (url && leafletMap) {
          if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay);
          const bounds = [[0,0], [1000,1000]];
          currentImageOverlay = L.imageOverlay(url, bounds).addTo(leafletMap);
          leafletMap.fitBounds(bounds);
          if (socket) socket.emit('cambia_sfondo_mappa', url);
          $('map-url-input').value = '';

          // SALVATAGGIO BLINDATO NEL DATABASE
          try {
              await fetch('/api/campaigns/map', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ campName: campName, owner: State.username, mapUrl: url })
              });
              
              //  Forza il ricaricamento dal server per essere sicuri al 100%
              await State.loadFromServer();
              renderGrid(); 
          } catch (err) {
              console.error("Errore salvataggio mappa:", err);
          }
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
              if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay);
              const bounds = [[0,0], [1000,1000]];
              currentImageOverlay = L.imageOverlay(data.url, bounds).addTo(leafletMap);
              leafletMap.fitBounds(bounds);
              if (socket) socket.emit('cambia_sfondo_mappa', data.url);
              fileInput.value = '';

              // SALVATAGGIO BLINDATO NEL DATABASE
              await fetch('/api/campaigns/map', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ campName: campName, owner: State.username, mapUrl: data.url })
              });
              
              // Forza il ricaricamento dal server
              await State.loadFromServer();
              renderGrid();
          }
      } catch (err) { 
          console.error("Errore upload mappa:", err); 
          alert("Errore durante il caricamento."); 
      }
  });

  // Pulsanti indietro
  $('btn-back-campaign')?.addEventListener('click', () => { renderGrid(); applicaTilt3D(); closeDetails(); });
  $('btn-back-sheet')?.addEventListener('click', () => { renderGrid(); applicaTilt3D(); closeDetails(); });
  $('btn-back-player-camp')?.addEventListener('click', () => { renderGrid(); applicaTilt3D(); closeDetails(); });
  
  // --- Gestione click sulle voci del Dropdown ---
  $('dropdown-menu')?.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;

    const type = item.dataset.type;
    const index = parseInt(item.dataset.index);

    if (type === 'sheet') {
      // Se clicco su un eroe, apro la sua scheda
      openSheetDetail(State.sheets[index]);
    } else if (type === 'campaign') {
      // Se clicco su una campagna, uso la logica esistente (Master o Giocatore)
      const camp = State.campaigns[index];
      if (camp.owner === State.username) {
        openCampaignDetail(camp);
      } else {
        handlePlayerCampaignClick(camp);
      }
    }
    
    // Chiudiamo il menu dopo il click
    closeDropdown();
  });

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

            // 1. Estrazione dati base
            const fullClassLevel = getT('ClassLevel'); // Es: "Guerriero 5"
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

            // 2. Estrazione Dettagli (mappatura nomi scanner -> database)
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

            // 3. Salvataggio nel Database (Processo in due step come la creazione manuale)
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
        e.target.value = ''; // Reset input
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

  $('form-add-campaign')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData($('form-add-campaign')));
    data.owner = State.username;
    await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    await State.loadFromServer();
    $('form-add-campaign').reset();
    closeModal($('modal-campaign-backdrop'));
    renderDropdowns(); 
    renderGrid();
    applicaTilt3D();
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
          applicaTilt3D();
        }
    } catch (error) { Swal.fire({ title: 'Errore Server!', text: 'I server sono infestati dai goblin.', icon: 'error', background: '#1a1a1a', color: '#e8c97e', confirmButtonColor: '#8b1a1a' }); }
  });

  // Gestione unificata Chat:
  $('btn-send-chat')?.addEventListener('click', () => gestisciInvioChat('chat-input', 'chat-messages', State.username));
  $('chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-send-chat').click(); });

  $('btn-send-dm-chat')?.addEventListener('click', () => inviaChatCampagna('dm-chat-input', 'dm-chat-messages', State.username, $('campaign-detail-title').textContent));
  $('dm-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-send-dm-chat').click(); });

  $('btn-pc-send-chat')?.addEventListener('click', () => inviaChatCampagna('pc-chat-input', 'pc-chat-messages', State.username, $('player-camp-title').textContent));
  $('pc-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-pc-send-chat').click(); });

// Avatar Base + aggiungi immagine + ripristina default
  function initAvatarMenu(imgId, inputId, getCharName) { // <-- Aggiunto getCharName
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

          // --- RIPRISTINA DEFAULT ---
          $('menu-reset-avatar').onclick = async (e) => {
              e.stopPropagation();
              menu.style.display = 'none';

              const charName = getCharName(); // Recuperiamo il nome dell'eroe
              if (!charName) return;

              // Troviamo la scheda nei dati locali
              const sheet = State.sheets.find(s => s.charName === charName);
              if (!sheet) return;

              // Ricostruiamo il percorso di default esatto
              const slug = sheet.charRace.toLowerCase().replace(/\s+/g, '-');
              const gender = sheet.charGender || 'm';
              // Usiamo lo slash iniziale per la "root giusta" che abbiamo sistemato prima!
              const defaultAvatarUrl = `/img/species/${slug}-${gender}.jpg`; 

              // Aggiorniamo l'immagine a schermo
              imgEl.src = defaultAvatarUrl;

              // Salviamo la modifica nel database usando la rotta esistente
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

                  // Aggiorniamo lo stato locale
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
      socket.on('ricevi_messaggio_campagna', (dati) => {
          // 1. Salva il messaggio in memoria a prescindere da dove ti trovi
          salvaMessaggioInMemoria(dati.campName, dati.mittente, dati.testo, 'other');

          // 2. Stampalo a video SOLO SE hai aperta esattamente quella campagna in questo momento
          if ($('campaign-detail').style.display === 'block' && $('campaign-detail-title').textContent === dati.campName) {
              appendChatMessage(dati.mittente, dati.testo, 'other', 'dm-chat-messages');
          } else if ($('player-campaign-detail').style.display === 'block' && $('player-camp-title').textContent === dati.campName) {
              appendChatMessage(dati.mittente, dati.testo, 'other', 'pc-chat-messages');
          }
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
                // Assicurati che il percorso sia corretto! 
                // Se lo hai messo nella cartella uploads, cambia in '/uploads/pdf/5E_...'
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
        
        // Questa riga fa partire fisicamente la funzione!
        scopriNomiCampiPDF();
    });
}