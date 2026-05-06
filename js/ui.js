import { $, escHtml } from './utils.js';
import { State } from './state.js';

export function renderDropdowns() {
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

export function renderGrid() {
  if ($('grid-heroes')) {
    if (State.sheets.length === 0) {
      $('grid-heroes').innerHTML = '<p style="color:#aaa; font-style:italic; padding: 20px;">Nessun eroe forgiato. Clicca su "+ Forgia Eroe" per iniziare.</p>';
    } else {
      $('grid-heroes').innerHTML = State.sheets.map((s, i) => makeSheetCard(s, i)).join('');
    }
  }

  const masterCamps = [];
  const playerCamps = [];
  State.campaigns.forEach((c, i) => {
    if (c.owner === State.username) masterCamps.push({ camp: c, index: i });
    else playerCamps.push({ camp: c, index: i });
  });

  if ($('grid-master')) {
    if (masterCamps.length === 0) {
      $('grid-master').innerHTML = '<p style="color:#aaa; font-style:italic; padding: 20px;">Nessuna campagna da Master. Crea un mondo tutto tuo!</p>';
    } else {
      $('grid-master').innerHTML = masterCamps.map(item => makeCampaignCard(item.camp, item.index, true)).join('');
    }
  }

  if ($('grid-player')) {
    if (playerCamps.length === 0) {
      $('grid-player').innerHTML = '<p style="color:#aaa; font-style:italic; padding: 20px;">Non partecipi a nessuna avventura. Unisciti con un codice!</p>';
    } else {
      $('grid-player').innerHTML = playerCamps.map(item => makeCampaignCard(item.camp, item.index, false)).join('');
    }
  }
}

export function makeSheetCard(sheet, i) {
  let icon = '🛡️';
  if (['Mago', 'Stregone', 'Warlock'].includes(sheet.charClass)) icon = '🔮';
  if (['Ladro', 'Monaco'].includes(sheet.charClass)) icon = '🗡️';
  if (['Bardo'].includes(sheet.charClass)) icon = '🎵';
  if (['Druido', 'Ranger'].includes(sheet.charClass)) icon = '🐺';

  // Nota: Le classi CSS inline qui andrebbero spostate nel file .css per maggiore pulizia
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

export function makeCampaignCard(camp, i, isMaster) {
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

export async function renderizzaBestiario() {
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

// Funzioni inline (richiamate direttamente dall'HTML) devono essere assegnate a window in un modulo ES6
window.espandiMostro = function(riga) {
    const rigaDettagli = riga.nextElementSibling;
    rigaDettagli.style.display = rigaDettagli.style.display === 'none' ? 'table-row' : 'none';
};

window.filtraBestiario = function() {
    const input = $('search-bestiario').value.toLowerCase();
    const table = document.querySelector('.bestiario-table');
    if (!table) return;

    const righe = table.querySelectorAll('tr[onclick]');
    righe.forEach(riga => {
        const nomeMostro = riga.cells[0].textContent.toLowerCase();
        const rigaDettagli = riga.nextElementSibling; 
        if (nomeMostro.includes(input)) {
            riga.style.display = 'table-row';
        } else {
            riga.style.display = 'none';
            if (rigaDettagli) rigaDettagli.style.display = 'none';
        }
    });
};