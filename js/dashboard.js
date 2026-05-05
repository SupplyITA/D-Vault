// --- STATO ---
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

// Variabili globali per Leaflet e Vue
let leafletMap = null;
let vueData = null; 

document.addEventListener('DOMContentLoaded', async () => {
  if ($('nav-username')) $('nav-username').textContent = State.username;
  await State.loadFromServer();
  
  // Inizializza Vue.js (Esame Vue)
  const { createApp, ref, computed } = Vue;
  createApp({
      setup() {
          const livello = ref(1);
          const bonusCompetenza = computed(() => Math.ceil(livello.value / 4) + 1);
          vueData = { livello }; // Esportiamo per aggiornarlo dinamicamente
          return { livello, bonusCompetenza };
      }
  }).mount('#vue-scheda-personaggio');

  renderDropdowns();
  renderGrid();
  bindEvents();
});

function renderDropdowns() { /* ... Stesso codice di prima ... */ }

function renderGrid() {
  const hasContent = State.sheets.length > 0 || State.campaigns.length > 0;
  if (!hasContent) {
    $('empty-state').style.display = '';
    $('content-grid').style.display = 'none';
    return;
  }
  $('empty-state').style.display = 'none';
  $('content-grid').style.display = 'grid';

  const cards = [
    ...State.sheets.map((s, i) => makeSheetCard(s, i)),
    ...State.campaigns.map((c, i) => makeCampaignCard(c, i))
  ];
  $('content-grid').innerHTML = cards.join('');
}

function makeSheetCard(sheet, i) {
  return `
    <div class="vault-card" data-type="sheet" data-index="${i}" style="cursor:pointer;">
      <button class="btn-delete" data-type="sheet" data-index="${i}" title="Elimina">×</button>
      <div class="card-tag">⚔ Scheda Personaggio</div>
      <div class="card-title">${sheet.charName}</div>
      <div class="card-sub">${sheet.charClass || '—'}</div>
      <div class="card-level">Lv ${sheet.charLevel || 1}</div>
    </div>`;
}

function makeCampaignCard(camp, i) {
  const isMaster = camp.owner === State.username;
  const btnElimina = isMaster ? `<button class="btn-delete" data-type="campaign" data-index="${i}">×</button>` : '';
  return `
    <div class="vault-card" data-type="campaign" data-index="${i}" style="cursor:pointer;">
      ${btnElimina}
      <div class="card-tag">📖 Campagna</div>
      <div class="card-title">${camp.campName}</div>
      <div class="card-sub">${camp.campSetting || 'Ambientazione libera'}</div>
    </div>`;
}

function bindEvents() {
  // GESTIONE CLICK SULLE CARTE
  $('content-grid')?.addEventListener('click', async (e) => {
    // 1. Eliminazione
    if (e.target.classList.contains('btn-delete')) {
      e.stopPropagation(); 
      const type = e.target.dataset.type;
      const index = parseInt(e.target.dataset.index);
      if (confirm('Vuoi davvero eliminare questo elemento?')) {
        if (type == 'sheet') {
          await fetch(`/api/sheets/${State.sheets[index].charName}?user=${State.username}`, { method: 'DELETE' });
          State.sheets.splice(index, 1);
        } else {
          await fetch(`/api/campaigns/${State.campaigns[index].campName}?user=${State.username}`, { method: 'DELETE' });
          State.campaigns.splice(index, 1);
        }
        renderGrid(); renderDropdowns();
      }
      return;
    }

    // 2. Apertura schermata dettaglio (Scheda o Campagna)
    const card = e.target.closest('.vault-card');
    if (card) {
      const type = card.dataset.type;
      const index = parseInt(card.dataset.index);
      if (type === 'campaign') openCampaignDetail(State.campaigns[index]);
      if (type === 'sheet') openSheetDetail(State.sheets[index]);
    }
  });

  // GESTIONE TABS DELLA CAMPAGNA
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      e.target.classList.add('active');
      const targetTab = 'tab-' + e.target.dataset.tab;
      $(targetTab).classList.add('active');

      // Se apriamo la mappa, diamo il resize a Leaflet per evitare bug grafici
      if (targetTab === 'tab-mappa' && leafletMap) {
          setTimeout(() => leafletMap.invalidateSize(), 100);
      }
      // Se apriamo il bestiario, carichiamo l'XML
      if (targetTab === 'tab-bestiario') {
          renderizzaBestiario();
      }
    });
  });

  // RITORNO ALLA HOME
  $('btn-back-campaign')?.addEventListener('click', () => closeDetails());
  $('btn-back-sheet')?.addEventListener('click', () => closeDetails());

  // SALVATAGGIO STORIA (MOCK)
  $('btn-save-story')?.addEventListener('click', () => {
     alert("Storia salvata con successo nel Vault!");
     // Qui aggiungerai la chiamata al server (es. fetch PUT) per salvare il testo
  });

  // (MANTENGO I TUOI EVENTI HAMBURGER E MODALI ORIGINALI)
  $('hamburger-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    $('dropdown-menu')?.classList.toggle('open');
  });

  // Chiudi modali e dropdowns (codice standard)
  /* ... aggiungi qui i tuoi vecchi listener per aprire/chiudere i form dei modali ... */
}

// --- FUNZIONI DI SCHERMATA ---
function openCampaignDetail(camp) {
  $('main-view').style.display = 'none';
  $('campaign-detail').style.display = 'block';
  $('campaign-detail-title').textContent = camp.campName;
  $('campaign-story-text').value = camp.story || ""; // Carica storia se esiste

  // Reset tab al primo
  document.querySelector('.tab-btn[data-tab="storia"]').click();

  // Inizializza mappa se non esiste
  if (!leafletMap) {
      leafletMap = L.map('map', { crs: L.CRS.Simple, minZoom: -2 });
      const bounds = [[0,0], [1000,1000]]; 
      L.imageOverlay('/maps/tua_mappa.jpg', bounds).addTo(leafletMap);
      leafletMap.fitBounds(bounds);
  }
}

function openSheetDetail(sheet) {
  $('main-view').style.display = 'none';
  $('sheet-detail').style.display = 'block';
  $('sheet-detail-title').textContent = sheet.charName;
  
  // Aggiorna il componente Vue dinamicamente col livello del personaggio cliccato
  if (vueData) vueData.livello.value = parseInt(sheet.charLevel) || 1;
}

function closeDetails() {
  $('campaign-detail').style.display = 'none';
  $('sheet-detail').style.display = 'none';
  $('main-view').style.display = 'block';
  renderGrid();
}

// --- XML / XSLT (Esame XML) ---
async function renderizzaBestiario() {
  const container = $('container-bestiario');
  if (container.innerHTML.trim() !== '') return; 
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