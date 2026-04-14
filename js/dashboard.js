//  Stato locale 
const State = {
  username:  localStorage.getItem('dvault_username')  || 'Avventuriero',
  sheets:    JSON.parse(localStorage.getItem('dvault_sheets')    || '[]'),
  campaigns: JSON.parse(localStorage.getItem('dvault_campaigns') || '[]'),

  save() {
    localStorage.setItem('dvault_sheets',    JSON.stringify(this.sheets));
    localStorage.setItem('dvault_campaigns', JSON.stringify(this.campaigns));
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

// Init 
document.addEventListener('DOMContentLoaded', () => {
  if (navUsername) navUsername.textContent = State.username;
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
  return `
    <div class="vault-card" data-type="campaign" data-index="${i}">
      <div class="card-tag">📖 Campagna</div>
      <div class="card-title">${escHtml(camp.campName)}</div>
      <div class="card-sub">${escHtml(camp.campSetting)||'Ambientazione libera'}</div>
      <div class="card-level">${escHtml(String(camp.campPlayers||4))} giocatori</div>
    </div>`;
}

// 
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

  // permette di eliminare schede o campagne
  contentGrid?.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-delete')) {
      e.stopPropagation(); //Questo comando ci evita di aprre schede se clicchiamo sulla X
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);

      if (confirm('Vuoi davvero eliminare questo elemento?')) {
        if (type == 'sheet') {
          State.sheets.splice(index, 1);}
        else {
          State.campaigns.splice(index, 1);}
        State.save()
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

  // Submit: Aggiungi scheda
  formAddSheet?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formAddSheet));

    // TODO: invia al backend
    // await fetch('/api/sheets', { method:'POST', ... })

    State.sheets.push(data);
    State.save();
    formAddSheet.reset();
    closeModal(modalSheetBackdrop);
    renderDropdowns();
    renderGrid();
  });

  // Submit: Aggiungi campagna
  formAddCampaign?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(formAddCampaign));

    // TODO: invia al backend
    // await fetch('/api/campaigns', { method:'POST', ... })

    State.campaigns.push(data);
    State.save();
    formAddCampaign.reset();
    closeModal(modalCampaignBackdrop);
    renderDropdowns();
    renderGrid();
  });

  // ESC per chiudere modali
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
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
