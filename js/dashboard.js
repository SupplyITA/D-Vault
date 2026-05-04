// --- NUOVO STATO GESTITO DAL SERVER ---
const State = {
  // Prendiamo lo username salvato al momento del login
  username:  localStorage.getItem('dvault_username') || 'Avventuriero',
  sheets:    [],
  campaigns: [],

  // Funzione per caricare i dati dal server all'avvio
  async loadFromServer() {
      try {
          // Chiediamo al server le schede dell'utente attuale
          const resSheets = await fetch(`/api/sheets?user=${this.username}`);
          this.sheets = await resSheets.json();

          // Chiediamo al server le campagne dell'utente attuale
          const resCamps = await fetch(`/api/campaigns?user=${this.username}`);
          this.campaigns = await resCamps.json();
      } catch (e) {
          console.error("Errore nel caricamento dal server:", e);
      }
  }
};
 
const $ = id => document.getElementById(id);

// Navigation bar
const hamburgerBtn       = $('hamburger-btn');
const dropdownMenu       = $('dropdown-menu');
const navUsername        = $('nav-username');
const dropdownSheetsList   = $('dropdown-sheets-list');
const dropdownCampaignsList= $('dropdown-campaigns-list');
const btnAddSheetDD      = $('btn-add-sheet');
const btnAddCampaignDD   = $('btn-add-campaign');

// Parte del main
const emptyState         = $('empty-state');
const contentGrid        = $('content-grid');
const btnOpenModal       = $('btn-open-modal');

// Roba scelta ruolo
const modalBackdrop      = $('modal-backdrop');
const modalBox           = $('modal-box');
const modalClose         = $('modal-close');
const choicePlayer       = $('choice-player');
const choiceMaster       = $('choice-master');

// Roba scheda
const modalSheetBackdrop = $('modal-sheet-backdrop');
const modalSheetClose    = $('modal-sheet-close');
const formAddSheet       = $('form-add-sheet');
const btnSheetCancel     = $('btn-sheet-cancel');

// Roba campagna
const modalCampaignBackdrop = $('modal-campaign-backdrop');
const modalCampaignClose    = $('modal-campaign-close');
const formAddCampaign       = $('form-add-campaign');
const btnCampaignCancel     = $('btn-campaign-cancel');

// Roba unisciti campagna
const modalJoinBackdrop  = $('modal-join-backdrop');
const modalJoinClose     = $('modal-join-close');
const formJoinCampaign   = $('form-join-campaign');
const btnJoinCancel      = $('btn-join-cancel');
const btnJoinCampaignDD  = $('btn-join-campaign-dd');

// ---  INIT ---
document.addEventListener('DOMContentLoaded', async () => {
  if (navUsername) navUsername.textContent = State.username;
  
  // Aspettiamo che il server ci dia i dati prima di disegnare la pagina!
  await State.loadFromServer();
  
  renderDropdowns();
  renderGrid();
  bindEvents();
});

// Ci fa funzionare il dropdown 
function renderDropdowns() {
  // Schede
  if (dropdownSheetsList) {
    if (State.sheets.length === 0) {
      dropdownSheetsList.innerHTML = '<li class="dropdown-empty">Nessuna scheda</li>';
    } else {
      dropdownSheetsList.innerHTML = State.sheets.map((s, i) =>
        `<li class="dropdown-item" data-type="sheet" data-index="${i}">
           🛡 ${escHtml(s.charName)} <em style="font-size:.75rem;opacity:.5;margin-left:.3rem">(${escHtml(s.charClass)||'—'})</em>
         </li>`
      ).join('');
    }
  }

  // Campagne
  if (dropdownCampaignsList) {
    if (State.campaigns.length === 0) {
      dropdownCampaignsList.innerHTML = '<li class="dropdown-empty">Nessuna campagna</li>';
    } else {
      dropdownCampaignsList.innerHTML = State.campaigns.map((c, i) =>
        `<li class="dropdown-item" data-type="campaign" data-index="${i}">
           📖 ${escHtml(c.campName)}
         </li>`
      ).join('');
    }
  }
}

// Griglia per la selezione campagna o personaggio
function renderGrid() {
  const hasContent = State.sheets.length > 0 || State.campaigns.length > 0;

  if (!hasContent) {
    if (emptyState)   emptyState.style.display  = '';
    if (contentGrid)  contentGrid.style.display = 'none';
    return;
  }

  if (emptyState)  emptyState.style.display  = 'none';
  if (contentGrid) contentGrid.style.display = '';

  const cards = [
    ...State.sheets.map((s, i) => makeSheetCard(s, i)),
    ...State.campaigns.map((c, i) => makeCampaignCard(c, i))
  ];

  contentGrid.innerHTML = cards.join('');
}

function makeSheetCard(sheet, i) {
  return `
    <div class="vault-card" data-type="sheet" data-index="${i}">
    <button class="btn-delete" data-type="sheet" data-index="${i}" title="Elimina">×</button>
      <div class="card-tag">⚔ Scheda Personaggio</div>
      <div class="card-title">${escHtml(sheet.charName)}</div>
      <div class="card-sub">${escHtml(sheet.charClass)||'—'} · ${escHtml(sheet.charRace)||'—'}</div>
      <div class="card-level">Lv ${escHtml(String(sheet.charLevel||1))}</div>
    </div>`;
}

function makeCampaignCard(camp, i) {
  // Controlliamo se chi guarda è il creatore (Master)
  const isMaster = camp.owner === State.username;
  
  // Se è il Master, gli diamo il tasto elimina e gli mostriamo il codice
  const btnElimina = isMaster ? `<button class="btn-delete" data-type="campaign" data-index="${i}" title="Elimina">×</button>` : '';
  const infoRuolo = isMaster 
      ? `<div style="color: #e8c97e; margin-top: 10px; font-weight: bold; border-top: 1px solid #8b1a1a; padding-top: 5px;">Codice Invito: ${camp.inviteCode}</div>` 
      : `<div style="color: #aaa; margin-top: 10px; font-style: italic;">Ruolo: Giocatore</div>`;

  return `
    <div class="vault-card" data-type="campaign" data-index="${i}">
      ${btnElimina}
      <div class="card-tag">📖 Campagna</div>
      <div class="card-title">${escHtml(camp.campName)}</div>
      <div class="card-sub">${escHtml(camp.campSetting)||'Ambientazione libera'}</div>
      <div class="card-level">${escHtml(String(camp.campPlayers||4))} giocatori max</div>
      ${infoRuolo}
    </div>`;
}

function openModal(el) {
  el?.classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeModal(el) {
  el?.classList.remove('visible');
  document.body.style.overflow = '';
}
function closeAllModals() {
  [modalBackdrop, modalSheetBackdrop, modalCampaignBackdrop]
    .forEach(m => closeModal(m));
}

//  Click Events -- fa funzionare il click del mouse 
function bindEvents() {

// --- ELIMINAZIONE COLLEGATA AL SERVER ---
  contentGrid?.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-delete')) {
      e.stopPropagation(); 
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);

      if (confirm('Vuoi davvero eliminare questo elemento definitivamente?')) {
        
        if (type == 'sheet') {
          const nomeScheda = State.sheets[index].charName;
          // Mandiamo il segnale DELETE al server per questa specifica scheda
          await fetch(`/api/sheets/${nomeScheda}?user=${State.username}`, { method: 'DELETE' });
          // La togliamo dallo schermo
          State.sheets.splice(index, 1);
        } else {
          const nomeCampagna = State.campaigns[index].campName;
          // Mandiamo il segnale DELETE al server per questa specifica campagna
          await fetch(`/api/campaigns/${nomeCampagna}?user=${State.username}`, { method: 'DELETE' });
          // La togliamo dallo schermo
          State.campaigns.splice(index, 1);
        }
        
        renderGrid();
        renderDropdowns();
      }
    }
  });
  
  // Hamburger toggle
  hamburgerBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdownMenu?.classList.toggle('open');
    hamburgerBtn.classList.toggle('open', open);
  });

  // Chiudi dropdown cliccando fuori
  document.addEventListener('click', (e) => {
    if (!dropdownMenu?.contains(e.target) && e.target !== hamburgerBtn) {
      dropdownMenu?.classList.remove('open');
      hamburgerBtn?.classList.remove('open');
    }
  });

  // Pulsanti "Aggiungi" nel dropdown
  btnAddSheetDD?.addEventListener('click', () => {
    closeDropdown();
    openModal(modalSheetBackdrop);
  });
  btnAddCampaignDD?.addEventListener('click', () => {
    closeDropdown();
    openModal(modalCampaignBackdrop);
  });

  // Apri modal ruolo (empty state)
  btnOpenModal?.addEventListener('click', () => openModal(modalBackdrop));

  // Chiudi modal scelta ruolo
  modalClose?.addEventListener('click', () => closeModal(modalBackdrop));
  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal(modalBackdrop);
  });

  // Scelta Player → apri form scheda
  choicePlayer?.addEventListener('click', () => {
    closeModal(modalBackdrop);
    openModal(modalSheetBackdrop);
  });

  // Scelta Master → apri form campagna
  choiceMaster?.addEventListener('click', () => {
    closeModal(modalBackdrop);
    openModal(modalCampaignBackdrop);
  });

  // Chiudi modal scheda
  modalSheetClose?.addEventListener('click', () => closeModal(modalSheetBackdrop));
  btnSheetCancel?.addEventListener('click', () => closeModal(modalSheetBackdrop));
  modalSheetBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalSheetBackdrop) closeModal(modalSheetBackdrop);
  });

  // Chiudi modal campagna
  modalCampaignClose?.addEventListener('click', () => closeModal(modalCampaignBackdrop));
  btnCampaignCancel?.addEventListener('click',  () => closeModal(modalCampaignBackdrop));
  modalCampaignBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalCampaignBackdrop) closeModal(modalCampaignBackdrop);
  });

  // --- SUBMIT: AGGIUNGI SCHEDA AL SERVER ---
  formAddSheet?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formAddSheet));
    
    // Aggiungiamo l'informazione su CHI ha creato la scheda
    data.owner = State.username;

    // Inviamo al Backend
    await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    // Aggiorniamo la vista
    // Ricarichiamo i dati dal server per prendere eventuali modifiche o ID generati
    await State.loadFromServer(); 
    formAddSheet.reset();
    closeModal(modalSheetBackdrop);
    renderDropdowns();
    renderGrid();
  });

  // --- SUBMIT: AGGIUNGI CAMPAGNA AL SERVER ---
  formAddCampaign?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formAddCampaign));
    
    // Aggiungiamo l'informazione su CHI ha creato la campagna
    data.owner = State.username;

    // Inviamo al Backend
    await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    // diciamo al browser di ricaricare tutto dal server per prendere il nuovo Codice Invito!
    await State.loadFromServer();

    // Aggiorniamo la vista
    formAddCampaign.reset();
    closeModal(modalCampaignBackdrop);
    renderDropdowns();
    renderGrid();
  });

  // ESC per chiudere modali
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });

  // --- GESTIONE MODALE UNISCITI ---
  btnJoinCampaignDD?.addEventListener('click', () => {
    closeDropdown();
    openModal(modalJoinBackdrop);
  });

  modalJoinClose?.addEventListener('click', () => closeModal(modalJoinBackdrop));
  btnJoinCancel?.addEventListener('click', () => closeModal(modalJoinBackdrop));
  modalJoinBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalJoinBackdrop) closeModal(modalJoinBackdrop);
  });

  // Aggiungi modalJoinBackdrop alla lista in closeAllModals()
  // Puoi ignorarlo se lo chiudi solo con il tasto ESC!

  // --- SUBMIT: UNISCITI CON CODICE ---
  formJoinCampaign?.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Recuperiamo il codice, rimuoviamo gli spazi e lo facciamo MAIUSCOLO
    const inviteCode = formJoinCampaign.querySelector('[name="inviteCode"]').value.trim().toUpperCase();

    try {
      const response = await fetch('/api/campaigns/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode: inviteCode, username: State.username })
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(result.message);
        formJoinCampaign.reset();
        closeModal(modalJoinBackdrop);
        
        // Ricarichiamo i dati dal server per far apparire la nuova carta!
        await State.loadFromServer();
        renderDropdowns();
        renderGrid();
      } else {
        alert(result.message); // Es. "Codice non valido"
      }
    } catch (error) {
      console.error("Errore:", error);
    }
  });
}

function closeDropdown() {
  dropdownMenu?.classList.remove('open');
  hamburgerBtn?.classList.remove('open');
}

// ── Utils ────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}