
const socket = typeof io !== 'undefined' ? io() : null;
 // questo è per socket.io e per fare la chat, è la parte per far si che il bottone
 // capisca a cosa collegarsi. sta sopra così è più facile da debuggare

// --- STATO DEL FRONTEND ---
const State = {
  username: localStorage.getItem('dvault_username') || 'Avventuriero',
  sheets: [],
  campaigns: [],

  async loadFromServer() {
      try {
          const resSheets = await fetch(`/api/sheets?user=${this.username}`);
          this.sheets = await resSheets.json();
          const resCamps = await fetch(`/api/campaigns?user=${this.username}`);
          this.campaigns = await resCamps.json();
      } catch (e) {
          console.error("Errore nel caricamento dal server:", e);
      }
  }
};

const $ = id => document.getElementById(id);

// Variabili globali per mantenere i riferimenti alle librerie
let leafletMap = null;
let vueData = null; 
let currentImageOverlay = null;

document.addEventListener('DOMContentLoaded', async () => {
  if ($('nav-username')) $('nav-username').textContent = State.username;
  await State.loadFromServer();
  
  // Vue.js per l ascheda personaggio, serve ad aggiornare il il bonus competenza in automatico (QOL)
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

// Render interfaccia e dropdown
function renderDropdowns() {
  const dropdownSheetsList = $('dropdown-sheets-list');
  const dropdownCampaignsList = $('dropdown-campaigns-list');

  if (dropdownSheetsList) {
    if (State.sheets.length === 0) {
      dropdownSheetsList.innerHTML = '<li class="dropdown-empty">Nessuna scheda</li>';
    } else {
      dropdownSheetsList.innerHTML = State.sheets.map((s, i) =>
        `<li class="dropdown-item" data-type="sheet" data-index="${i}">🛡 ${escHtml(s.charName)}</li>`
      ).join('');
    }
  }

  if (dropdownCampaignsList) {
    if (State.campaigns.length === 0) {
      dropdownCampaignsList.innerHTML = '<li class="dropdown-empty">Nessuna campagna</li>';
    } else {
      dropdownCampaignsList.innerHTML = State.campaigns.map((c, i) =>
        `<li class="dropdown-item" data-type="campaign" data-index="${i}">📖 ${escHtml(c.campName)}</li>`
      ).join('');
    }
  }
}

function renderGrid() {
  // 1. Riempiamo la riga degli Eroi
  if ($('grid-heroes')) {
    if (State.sheets.length === 0) {
      $('grid-heroes').innerHTML = '<p style="color:#aaa; font-style:italic; padding: 20px;">Nessun eroe forgiato. Clicca su "+ Forgia Eroe" per iniziare.</p>';
    } else {
      $('grid-heroes').innerHTML = State.sheets.map((s, i) => makeSheetCard(s, i)).join('');
    }
  }

  // Dividiamo le campagne in Master e Player
  const masterCamps = [];
  const playerCamps = [];
  State.campaigns.forEach((c, i) => {
    if (c.owner === State.username) masterCamps.push({ camp: c, index: i });
    else playerCamps.push({ camp: c, index: i });
  });

  // 2. Riempiamo la riga Master
  if ($('grid-master')) {
    if (masterCamps.length === 0) {
      $('grid-master').innerHTML = '<p style="color:#aaa; font-style:italic; padding: 20px;">Nessuna campagna da Master. Crea un mondo tutto tuo!</p>';
    } else {
      $('grid-master').innerHTML = masterCamps.map(item => makeCampaignCard(item.camp, item.index, true)).join('');
    }
  }

  // 3. Riempiamo la riga Giocatore
  if ($('grid-player')) {
    if (playerCamps.length === 0) {
      $('grid-player').innerHTML = '<p style="color:#aaa; font-style:italic; padding: 20px;">Non partecipi a nessuna avventura. Unisciti con un codice!</p>';
    } else {
      $('grid-player').innerHTML = playerCamps.map(item => makeCampaignCard(item.camp, item.index, false)).join('');
    }
  }
}

function makeSheetCard(sheet, i) {
  let icon = '🛡️';
  if (['Mago', 'Stregone', 'Warlock'].includes(sheet.charClass)) icon = '🔮';
  if (['Ladro', 'Monaco'].includes(sheet.charClass)) icon = '🗡️';
  if (['Bardo'].includes(sheet.charClass)) icon = '🎵';
  if (['Druido', 'Ranger'].includes(sheet.charClass)) icon = '🐺';

  return `
    <div class="vault-card" data-type="sheet" data-index="${i}" style="border-left: 4px solid #4a90e2; display: flex; flex-direction: column; min-height: 220px; cursor:pointer; transition: transform 0.2s;">
      <button class="btn-delete" data-type="sheet" data-index="${i}" title="Elimina Eroe">×</button>
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        <div style="font-size: 2.2rem; margin-right: 15px; background: rgba(0,0,0,0.6); border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border: 1px solid #4a90e2;">${icon}</div>
        <div>
          <div class="card-tag" style="color: #4a90e2;">Eroe</div>
          <div class="card-title">${escHtml(sheet.charName)}</div>
        </div>
      </div>
      <div class="card-sub">${escHtml(sheet.charClass)||'—'} · ${escHtml(sheet.charRace)||'—'}</div>
      <div class="card-level">Livello ${escHtml(String(sheet.charLevel||1))}</div>
      <div style="margin-top: auto; padding-top: 15px;">
        <button class="btn-primary" style="width: 100%; padding: 8px; font-size: 0.9rem;">✦ Apri Scheda</button>
      </div>
    </div>`;
}

function makeCampaignCard(camp, i, isMaster) {
  const borderColor = isMaster ? '#8b1a1a' : '#27ae60';
  const tagText = isMaster ? 'Master' : 'Giocatore';
  const icon = isMaster ? '🐉' : '🗺️';
  const btnDelete = isMaster ? `<button class="btn-delete" data-type="campaign" data-index="${i}" title="Elimina">×</button>` : '';
  const inviteInfo = isMaster 
      ? `<div style="margin-top: 10px; font-size: 0.85rem; background: rgba(232, 201, 126, 0.1); padding: 6px; border-radius: 4px; text-align: center; border: 1px dashed #e8c97e; color: #e8c97e;">Codice: <strong style="letter-spacing: 2px;">${camp.inviteCode}</strong></div>` 
      : `<div style="color: #aaa; margin-top: 10px; font-size: 0.85rem; text-align: center;">Master: <strong>${escHtml(camp.owner)}</strong></div>`;

  return `
    <div class="vault-card" data-type="campaign" data-index="${i}" style="border-left: 4px solid ${borderColor}; display: flex; flex-direction: column; min-height: 220px; cursor:pointer; transition: transform 0.2s;">
      ${btnDelete}
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        <div style="font-size: 2.2rem; margin-right: 15px; background: rgba(0,0,0,0.6); border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border: 1px solid ${borderColor};">${icon}</div>
        <div>
          <div class="card-tag" style="color: ${borderColor};">${tagText}</div>
          <div class="card-title">${escHtml(camp.campName)}</div>
        </div>
      </div>
      <div class="card-sub">${escHtml(camp.campSetting)||'Ambientazione libera'}</div>
      <div class="card-level">${escHtml(String(camp.campPlayers||4))} giocatori massimi</div>
      ${inviteInfo}
      <div style="margin-top: auto; padding-top: 15px;">
        <button class="btn-primary" style="width: 100%; padding: 8px; font-size: 0.9rem;">✦ Entra al Tavolo</button>
      </div>
    </div>`;
}

// Parte per il dropdown e modali 
function openModal(el) { el?.classList.add('visible'); document.body.style.overflow = 'hidden'; }
function closeModal(el) { el?.classList.remove('visible'); document.body.style.overflow = ''; }
function closeDropdown() { $('dropdown-menu')?.classList.remove('open'); $('hamburger-btn')?.classList.remove('open'); }


// Event Listener Funzioni
function bindEvents() {
  
  // Click sulla x 
  // Invece di ascoltare una sola griglia, ascoltiamo tutto il "dash-main" che le contiene tutte e tre!
  $('dash-main')?.addEventListener('click', async (e) => {
    
    // Se clicchiamo la X --- usando la libreria sweet alert2
    if (e.target.classList.contains('btn-delete')) {
      e.stopPropagation(); 
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      
      // IL NUOVO POPUP DI CONFERMA STILE D-VAULT
      const result = await Swal.fire({
        title: 'Sei sicuro?',
        text: "Questa magia distruttiva non può essere annullata!",
        icon: 'warning',
        showCancelButton: true,
        background: '#1a1a1a', // Sfondo scuro
        color: '#e8c97e',      // Testo dorato
        confirmButtonColor: '#8b1a1a', // Rosso sangue per distruggere
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

        // Messaggio di successo post-eliminazione
        Swal.fire({
          title: 'Incenerito!',
          text: 'L\'elemento è stato eliminato dal Vault.',
          icon: 'success',
          background: '#1a1a1a',
          color: '#e8c97e',
          confirmButtonColor: '#4a90e2' // Blu eroe
        });
      }
      return; 
    }

    // Se clicchiamo sul resto della carta (apriamo i dettagli)
    const card = e.target.closest('.vault-card');
    if (card) {
      const type = card.dataset.type;
      const index = parseInt(card.dataset.index);
      if (type === 'campaign') {
          const camp = State.campaigns[index];
          if (camp.owner === State.username) {
              openCampaignDetail(camp); // Se sei Master apri normalmente
          } else {
              openCharacterSelectorForCampaign(camp); // Se sei Giocatore, scegli prima l'eroe!
          }
      }
      if (type === 'sheet') openSheetDetail(State.sheets[index]);
    }
  });

  // Parte per la gestione del Master
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      const targetTab = 'tab-' + e.target.dataset.tab;
      $(targetTab)?.classList.add('active');

      if (targetTab === 'tab-mappa' && leafletMap) {
          setTimeout(() => leafletMap.invalidateSize(), 100);
      }
      if (targetTab === 'tab-bestiario') {
          renderizzaBestiario();
      }
    });
  });

  // Gestione cambio mappa da parte del Master
let currentImageOverlay = null; // Memorizza la mappa attuale

  // Carica mappa tramite URL
  $('btn-change-map')?.addEventListener('click', () => {
      const url = $('map-url-input').value.trim();
      if (url && leafletMap) {
          if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay); // Togli vecchia mappa
          
          const bounds = [[0,0], [1000,1000]];
          currentImageOverlay = L.imageOverlay(url, bounds).addTo(leafletMap);
          leafletMap.fitBounds(bounds);
          
          if (socket) socket.emit('cambia_sfondo_mappa', url); // Sincronizza
          $('map-url-input').value = '';
      }
  });

  // Carica mappa tramite file dal PC
  $('btn-upload-map')?.addEventListener('click', async () => {
      const fileInput = $('map-file-input');
      const file = fileInput.files[0];
      
      if (!file) return alert("Seleziona prima un'immagine dal tuo PC!");

      const formData = new FormData();
      formData.append('mapImage', file);
      formData.append('username', State.username); 

      try {
          const response = await fetch('/api/upload-map', {
              method: 'POST',
              body: formData
          });
          const data = await response.json();

          if (data.url && leafletMap) {
              if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay); // Togli vecchia mappa
              
              const bounds = [[0,0], [1000,1000]];
              currentImageOverlay = L.imageOverlay(data.url, bounds).addTo(leafletMap);
              leafletMap.fitBounds(bounds);
              
              if (socket) socket.emit('cambia_sfondo_mappa', data.url); // Sincronizza
              fileInput.value = '';
          }
      } catch (err) {
          console.error("Errore durante il caricamento della mappa:", err);
          alert("Errore durante il caricamento.");
      }
  });


  //  Pulsanti "Indietro" per tornare alla home
  $('btn-back-campaign')?.addEventListener('click', () => closeDetails());
  $('btn-back-sheet')?.addEventListener('click', () => closeDetails());

  // Dropdown menu
  $('hamburger-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = $('dropdown-menu')?.classList.toggle('open');
    $('hamburger-btn').classList.toggle('open', isOpen);
  });
  document.addEventListener('click', (e) => {
    if (!$('dropdown-menu')?.contains(e.target) && e.target !== $('hamburger-btn')) closeDropdown();
  });

  // Apertura e chiusura MOdali : nuova griglia
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
    { bg: 'modal-join-backdrop', closeBtn: 'modal-join-close', cancelBtn: 'btn-join-cancel' }
  ];
  modals.forEach(m => {
    $(m.closeBtn)?.addEventListener('click', () => closeModal($(m.bg)));
    $(m.cancelBtn)?.addEventListener('click', () => closeModal($(m.bg)));
    $(m.bg)?.addEventListener('click', (e) => { if (e.target === $(m.bg)) closeModal($(m.bg)); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modals.forEach(m => closeModal($(m.bg)));
  });

  // Parte per mandare i dati al server di scheda o campagna 
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

  // Unisciti alla campagna tab   libreria sweet alert2
  $('form-join-campaign')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inviteCode = $('form-join-campaign').querySelector('[name="inviteCode"]').value.trim().toUpperCase();
    
    try {
        const response = await fetch('/api/campaigns/join', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inviteCode: inviteCode, username: State.username })
        });
        const result = await response.json();
        
        // Popup successo o fallimento
        Swal.fire({
            title: response.ok ? 'Benvenuto nel Party!' : 'Magia Fallita!',
            text: result.message,
            icon: response.ok ? 'success' : 'error',
            background: '#1a1a1a',
            color: '#e8c97e',
            confirmButtonColor: '#e8c97e'
        });

        if (response.ok) {
          $('form-join-campaign').reset();
          closeModal($('modal-join-backdrop'));
          await State.loadFromServer();
          renderDropdowns(); 
          renderGrid();
        }
    } catch (error) {
        Swal.fire({
            title: 'Errore Server!',
            text: 'I server sono infestati dai goblin. Riprova più tardi.',
            icon: 'error',
            background: '#1a1a1a',
            color: '#e8c97e',
            confirmButtonColor: '#8b1a1a'
        });
    }
  });

  // Gestione chat (non ho mai usato questa libreria prima ne sta roba quindi potrebbe esplodere tutto) Invio
  $('btn-send-chat')?.addEventListener('click', () => {
    const input = $('chat-input');
    const text = input.value.trim();
    if (text) {
      appendChatMessage(State.username, text, 'me'); // Mostra a te stesso
      if (socket) {
          socket.emit('invia_messaggio', { mittente: State.username, testo: text }); // Invia agli altri
      }
      input.value = '';
    }
  });

  $('chat-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') $('btn-send-chat').click();
  });

  // Gestione Mappa: Clicca per mettere un segnalino
  $('map')?.addEventListener('click', () => {
  });

  const avatarImg = $('char-avatar-img');
  const avatarInput = $('char-avatar-input');

  if (avatarImg && avatarInput) {
      // Cliccando l'immagine, è come se cliccassimo l'input file nascosto
      
      avatarImg.onclick = () => avatarInput.click();
      avatarInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const formData = new FormData();
          formData.append('avatarImage', file);

          try {
              // Carica fisicamente l'immagine sul server
              const res = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
              const data = await res.json();

              if (data.url) {
                  avatarImg.src = data.url;

                  // Salva il link nel database associandolo a questo personaggio
                  await fetch('/api/sheets/avatar', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                          owner: State.username, 
                          charName: $('sheet-detail-title').textContent, 
                          avatarUrl: data.url 
                      })
                  });

                  const currentSheet = State.sheets.find(s => s.charName === $('sheet-detail-title').textContent);
                  if (currentSheet) currentSheet.avatar = data.url;
              }
          } catch (err) {
              console.error("Errore upload avatar:", err);
              alert("Errore nel caricamento dell'immagine.");
          }
      };
  }

  // Funzione per aprire il selettore di personaggio quando un giocatore clicca su una campagna a cui partecipa, così da scegliere con quale eroe entrare al tavolo
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

  $('modal-select-char-close')?.addEventListener('click', () => closeModal($('modal-select-char-backdrop')));

  // Tab Giocatore
  document.querySelectorAll('.tab-btn-player').forEach(btn => {
      btn.addEventListener('click', (e) => {
          document.querySelectorAll('.tab-btn-player').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.tab-content-player').forEach(c => {
              c.classList.remove('active');
              c.style.display = 'none';
          });
          
          e.target.classList.add('active');
          const targetTab = $(e.target.dataset.tab);
          if (targetTab) {
              targetTab.classList.add('active');
              targetTab.style.display = 'flex'; // per tab intatto 
          }

          if (e.target.dataset.tab === 'player-mappa' && playerLeafletMap) {
              setTimeout(() => playerLeafletMap.invalidateSize(), 100);
          }
      });
  });

  document.querySelectorAll('.player-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
          // Rimuovi classe attiva a tutti i bottoni e contenuti del giocatore
          document.querySelectorAll('.player-tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.player-tab-content').forEach(c => c.classList.remove('active'));
          
          // Attiva il bottone cliccato e il suo pannello
          e.target.classList.add('active');
          const targetTabId = 'tab-' + e.target.dataset.tab;
          $(targetTabId).classList.add('active');

          // FIX BUG MAPPA: Quando la mappa diventa visibile, deve ridimensionarsi
          if (e.target.dataset.tab === 'pc-mappa' && playerLeafletMap) {
              setTimeout(() => playerLeafletMap.invalidateSize(), 100);
          }
      });
  });

  // Pulsante indietro tab giocatore 
  $('btn-back-player-camp')?.addEventListener('click', () => closeDetails());

  // Invio della chat giocatore
  $('btn-pc-send-chat')?.addEventListener('click', () => {
      const input = $('pc-chat-input');
      const text = input.value.trim();
      if (text) {
          appendChatMessage(State.username, text, 'me', 'pc-chat-messages');
          if (socket) socket.emit('invia_messaggio', { mittente: State.username, testo: text });
          input.value = '';
      }
  });
  $('pc-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-pc-send-chat').click(); });

  //  Upload PDF personalizzato 
  $('btn-upload-pdf')?.addEventListener('click', () => $('char-pdf-input').click());
  $('char-pdf-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('pdfFile', file);

      try {
          const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
          const data = await res.json();

          if (data.url) {
              // Salva nel DB
              await fetch('/api/sheets/pdf', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                      owner: State.username, 
                      charName: $('sheet-detail-title').textContent.split(' - ')[1], // Estrae il nome eroe dal titolo
                      pdfUrl: data.url 
                  })
              });

              // Aggiorna iframe e stato coso 
              $('player-pdf-iframe').src = data.url;
              const currentSheet = State.sheets.find(s => s.charName === $('sheet-detail-title').textContent.split(' - ')[1]);
              if (currentSheet) currentSheet.pdfUrl = data.url;

              Swal.fire({ title: 'Scheda Salvata!', icon: 'success', background: '#1a1a1a', color: '#e8c97e', timer: 1500, showConfirmButton: false });
          }
      } catch (err) {
          console.error("Errore upload PDF:", err);
          Swal.fire({ title: 'Errore', text: "Impossibile salvare la scheda.", icon: 'error', background: '#1a1a1a', color: '#e8c97e' });
      }
  });

// --- TABS GIOCATORE IN PARTITA ---
  document.querySelectorAll('.player-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
          document.querySelectorAll('.player-tab-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.player-tab-content').forEach(c => {
              c.classList.remove('active');
              c.style.display = 'none'; // Nascondiamo per congelare il PDF
          });
          
          e.target.classList.add('active');
          const targetTabId = 'tab-' + e.target.dataset.tab;
          const targetTabElement = $(targetTabId);
          if (targetTabElement) {
              targetTabElement.classList.add('active');
              targetTabElement.style.display = 'flex';
          }

          if (e.target.dataset.tab === 'pc-mappa' && playerLeafletMap) {
              setTimeout(() => playerLeafletMap.invalidateSize(), 100);
          }
      });
  });

  // --- TASTO INDIETRO E CHAT GIOCATORE ---
  $('btn-back-player-camp')?.addEventListener('click', () => closeDetails());

  $('btn-pc-send-chat')?.addEventListener('click', () => {
      const input = $('pc-chat-input');
      const text = input.value.trim();
      if (text) {
          appendChatMessage(State.username, text, 'me', 'pc-chat-messages');
          if (socket) socket.emit('invia_messaggio', { mittente: State.username, testo: text });
          input.value = '';
      }
  });
  $('pc-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') $('btn-pc-send-chat').click(); });
}


// Chat recezione
if (socket) {
    socket.on('ricevi_messaggio', (dati) => {
        appendChatMessage(dati.mittente, dati.testo, 'other', 'chat-messages');
        appendChatMessage(dati.mittente, dati.testo, 'other', 'dm-chat-messages');
        appendChatMessage(dati.mittente, dati.testo, 'other', 'pc-chat-messages'); 
    });

    socket.on('ricevi_segnalino', (latlng) => {
        if (leafletMap) L.marker(latlng).addTo(leafletMap);
        if (playerLeafletMap) L.marker(latlng).addTo(playerLeafletMap); 
    });

    socket.on('nuova_mappa_ricevuta', (url) => {
        const bounds = [[0,0], [1000,1000]];
        if (leafletMap) {
            if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay);
            currentImageOverlay = L.imageOverlay(url, bounds).addTo(leafletMap);
            leafletMap.fitBounds(bounds);
        }
        if (playerLeafletMap) { // NUOVA
            playerLeafletMap.eachLayer(layer => playerLeafletMap.removeLayer(layer));
            L.imageOverlay(url, bounds).addTo(playerLeafletMap);
            playerLeafletMap.fitBounds(bounds);
        }
    });
}
// Chat per la parte del Master
$('btn-send-dm-chat')?.addEventListener('click', () => {
    const input = $('dm-chat-input');
    const text = input.value.trim();
    if (text) {
      appendChatMessage(State.username, text, 'me', 'dm-chat-messages'); 
      if (socket) socket.emit('invia_messaggio', { mittente: State.username, testo: text });
      input.value = '';
    }
  });
  $('dm-chat-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') $('btn-send-dm-chat').click();
  });

function appendChatMessage(sender, text, type, containerId = 'chat-messages') {
  const container = $(containerId);
  if (!container) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${type}`;
  msgDiv.innerHTML = `<span class="sender">${escHtml(sender)}</span>${escHtml(text)}`;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}


// Parte per dettagli campagna o scheda
function openCampaignDetail(camp) {
  if($('dash-main')) $('dash-main').style.display = 'none'; // Sostituito main-view
  if($('campaign-detail')) $('campaign-detail').style.display = 'block';
  if($('campaign-detail-title')) $('campaign-detail-title').textContent = camp.campName;

  // Mostra codice invito solo al Master, con possibilità di toggle per sfocarlo, così mi assicuro che funzioni anche se 
  // esco e rientro dalla schermata cliccando su torna alla dashboard e riapro la campagna (bug fix, se non funziona esplodo)
  const inviteContainer = $('campaign-invite-container');
  const inviteCodeEl = $('campaign-invite-code');
  const toggleBtn = $('btn-toggle-invite');

  if (inviteContainer && inviteCodeEl && toggleBtn) {
      if (camp.owner === State.username) {
          inviteContainer.style.display = 'flex';
          inviteCodeEl.textContent = camp.inviteCode;
          inviteCodeEl.style.filter = 'blur(5px)'; 
          toggleBtn.innerHTML = '<i class="fa-solid fa-eye-slash" style="color: #aaa;"></i>'; 
          toggleBtn.dataset.visible = 'false'; // QUESTO SPERO FUNZIONI 
      } else {
          inviteContainer.style.display = 'none'; 
      }
  }

  // Questo si assicura che il pulsante mostri/nasconda il codice invito, sfocandolo o no e cambiando l'icona di conseguenza
  // bug fix n.231435346534 continua a non funzionare non capisco perché. Provo con questo singolo 

  // FUNZIONAAAAAAAAAAAAAAAAAAAAAAAAAaa
  const btnToggleInvite = $('btn-toggle-invite');
    if (btnToggleInvite) {
        // Usiamo .onclick invece di addEventListener per evitare cloni del comando!
        btnToggleInvite.onclick = function() {
            const codeEl = $('campaign-invite-code');
            const iconEl = this.querySelector('i');
            
            // Controlliamo la nostra variabile sicura "data-visible"
            if (this.dataset.visible === 'false') {
                // Riveliamo
                codeEl.style.filter = 'none';
                iconEl.className = 'fa-solid fa-eye';
                iconEl.style.color = '#e8c97e';
                this.dataset.visible = 'true'; // Aggiorniamo lo stato
            } else {
                // Nascondiamo
                codeEl.style.filter = 'blur(5px)';
                iconEl.className = 'fa-solid fa-eye-slash';
                iconEl.style.color = '#aaa';
                this.dataset.visible = 'false'; // Aggiorniamo lo stato
            }
        };
    }

  // Se è il Master, apre direttamente la tab della mappa, altrimenti quella della storia (o quella che vuoi)
  const primoTab = document.querySelector('.tab-btn[data-tab="storia"]');
  if(primoTab) primoTab.click();

  if (!leafletMap && $('map')) {
      leafletMap = L.map('map', { crs: L.CRS.Simple, minZoom: -2 });
      const bounds = [[0,0], [1000,1000]]; 
      
      currentImageOverlay = L.imageOverlay('/maps/mappa_1.jpg', bounds).addTo(leafletMap);
      leafletMap.fitBounds(bounds);

      leafletMap.on('click', function(e) {
          L.marker(e.latlng).addTo(leafletMap);
          if (socket) socket.emit('invia_segnalino', e.latlng);
      });
  }
}

function openSheetDetail(sheet) {
  if($('dash-main')) $('dash-main').style.display = 'none'; // Sostituito main-view
  if($('sheet-detail')) $('sheet-detail').style.display = 'block';
  if($('sheet-detail-title')) $('sheet-detail-title').textContent = sheet.charName;

  if($('char-avatar-img')) {
      $('char-avatar-img').src = sheet.avatar || 'https://via.placeholder.com/150/111111/e8c97e?text=Click';
  }
  
  // Aggiorna il livello in Vue, così da aggiornare anche il bonus competenza
  if (vueData) vueData.livello.value = parseInt(sheet.charLevel) || 1;
}

let playerLeafletMap = null;

// Apre il modale per scegliere l'eroe
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

$('modal-select-char-close')?.addEventListener('click', () => closeModal($('modal-select-char-backdrop')));

// Fa entrare l'eroe in partita
window.enterPlayerCampaign = function(sheetIndex, campName) {
    closeModal($('modal-select-char-backdrop'));
    const sheet = State.sheets[sheetIndex];
    
    if($('dash-main')) $('dash-main').style.display = 'none';
    if($('player-campaign-detail')) $('player-campaign-detail').style.display = 'block';
    
    if($('player-camp-title')) $('player-camp-title').textContent = campName;
    if($('player-camp-char')) {
        $('player-camp-char').textContent = "Eroe: " + sheet.charName;
        $('player-camp-char').dataset.charname = sheet.charName; // NOME SICURO PER IL DATABASE
    }

    if($('pc-avatar-img')) $('pc-avatar-img').src = sheet.avatar || 'https://via.placeholder.com/150/111111/e8c97e?text=Click';
    if($('pc-pdf-iframe')) $('pc-pdf-iframe').src = sheet.pdfUrl || '/pdf/scheda_dnd_5e.pdf';

    // Fix mappa: la mappa ora è visibile per 1 millisecondo per farla calcolare a Leaflet
    $('tab-pc-mappa').style.display = 'flex'; 

    if (!playerLeafletMap && $('pc-map')) {
        playerLeafletMap = L.map('pc-map', { crs: L.CRS.Simple, minZoom: -2 });
        const bounds = [[0,0], [1000,1000]]; 
        L.imageOverlay('https://via.placeholder.com/1000x1000/111111/444444?text=In+attesa+del+Master...', bounds).addTo(playerLeafletMap);
        playerLeafletMap.fitBounds(bounds);
    }

    // Ora clicchiamo sulla tab della scheda per rimettere la mappa al suo posto (in background)
    document.querySelector('.player-tab-btn[data-tab="pc-scheda"]')?.click();
};

// Salvataggio Avatar in partita
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
            await fetch('/api/sheets/avatar', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner: State.username, charName: pureCharName, avatarUrl: data.url })
            });
            const sheet = State.sheets.find(s => s.charName === pureCharName);
            if (sheet) sheet.avatar = data.url;
        }
    } catch(err) { console.error(err); }
});

// Salvataggio PDF in partita
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
            await fetch('/api/sheets/pdf', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ owner: State.username, charName: pureCharName, pdfUrl: data.url })
            });
            const sheet = State.sheets.find(s => s.charName === pureCharName);
            if (sheet) sheet.pdfUrl = data.url;
            Swal.fire({ title: 'Scheda Salvata!', icon: 'success', background: '#1a1a1a', color: '#e8c97e', timer: 1500, showConfirmButton: false });
        }
    } catch(err) { console.error(err); }
});


function closeDetails() {
  if($('campaign-detail')) $('campaign-detail').style.display = 'none';
  if($('sheet-detail')) $('sheet-detail').style.display = 'none';
  if($('player-campaign-detail')) $('player-campaign-detail').style.display = 'none'; // <-- AGGIUNGI QUESTA
  if($('dash-main')) $('dash-main').style.display = 'flex';
  renderGrid();
}


// Bestiario con XML e XSLT 
async function renderizzaBestiario() {
  const container = $('container-bestiario');
  if (!container || container.innerHTML.trim() !== '') return; 
  try {
      const xmlResp = await fetch('/bestiario.xml');
      const xmlText = await xmlResp.text();
      const xml = new window.DOMParser().parseFromString(xmlText, "text/xml");

      const xsltResp = await fetch('/mostri.xslt');
      const xsltText = await xsltResp.text();
      const xslt = new window.DOMParser().parseFromString(xsltText, "text/xml");

      const xsltProcessor = new XSLTProcessor();
      xsltProcessor.importStylesheet(xslt);
      const frammento = xsltProcessor.transformToFragment(xml, document);
      container.appendChild(frammento);
  } catch (e) {
      container.innerHTML = "<p><em>Assicurati di creare i file bestiario.xml e mostri.xslt nella root del server.</em></p>";
  }
}


// questo è per ricevere i messaggi dagli altri utenti e mostrarli nella chat (se aperta, altrimenti li vedi quando la apri)

if (socket) {
    socket.on('ricevi_messaggio', (dati) => {
        // Li manda in tutte le chat, così li vedi in qualsiasi schermata ti trovi
        appendChatMessage(dati.mittente, dati.testo, 'other', 'chat-messages');
        appendChatMessage(dati.mittente, dati.testo, 'other', 'dm-chat-messages');
        appendChatMessage(dati.mittente, dati.testo, 'other', 'pc-chat-messages'); // Chat Giocatore
    });

    socket.on('ricevi_segnalino', (latlng) => {
        if (leafletMap) L.marker(latlng).addTo(leafletMap);
        if (playerLeafletMap) L.marker(latlng).addTo(playerLeafletMap); // Segnalino Giocatore
    });

    socket.on('nuova_mappa_ricevuta', (url) => {
        const bounds = [[0,0], [1000,1000]];
        if (leafletMap) {
            // Aggiorna mappa Master
            if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay);
            currentImageOverlay = L.imageOverlay(url, bounds).addTo(leafletMap);
            leafletMap.fitBounds(bounds);
        }
        if (playerLeafletMap) {
            // Aggiorna mappa Giocatore in tempo reale!
            playerLeafletMap.eachLayer(layer => playerLeafletMap.removeLayer(layer));
            L.imageOverlay(url, bounds).addTo(playerLeafletMap);
            playerLeafletMap.fitBounds(bounds);
        }
    });
}



//questa funzione invece è per espandere i mostri, ovvero quando clicchiamo sul nome, si espande e fa vedere l'immagine del mostro 
//con la scheda tecnica etc.

function espandiMostro(riga) {
    // Trova la riga successiva (che contiene l'immagine nascosta) e la mostra/nasconde
    const rigaDettagli = riga.nextElementSibling;
    if (rigaDettagli.style.display === 'none') {
        rigaDettagli.style.display = 'table-row';
    } else {
        rigaDettagli.style.display = 'none';
    }
}




//  Utility, pare sia estremamente necessario visto che è la 213123 volta che me lo consiglia e alla fine lo metto
// Funzione per ripulire l'input e prevenire attacchi XSS
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


