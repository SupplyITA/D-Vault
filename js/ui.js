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
        `<li class="dropdown-item" data-type="sheet" data-index="${i}"> ${escHtml(s.charName)}</li>`
      ).join('');
    }
  }

  if (dropdownCampaignsList) {
    if (State.campaigns.length === 0) {
      dropdownCampaignsList.innerHTML = '<li class="dropdown-empty">Nessuna campagna</li>';
    } else {
      dropdownCampaignsList.innerHTML = State.campaigns.map((c, i) =>
        `<li class="dropdown-item" data-type="campaign" data-index="${i}"> ${escHtml(c.campName)}</li>`
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

// Monogramma tipografico (prima lettera del nome) usato come "sigillo" nobile.
function monogram(name) {
  const ch = (name || '?').trim().charAt(0).toUpperCase();
  return escHtml(ch || '?');
}

// Slug per nome file specie (es. "Mezzorco" → "mezzorco")
function speciesSlug(name) {
  return (name || 'umano').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'umano';
}

export function makeSheetCard(sheet, i) {
  const slug = speciesSlug(sheet.charRace);
  const gender = sheet.charGender || 'm'; // Di default mette maschio se l'eroe è vecchio e non ha il sesso
  const portraitSrc = sheet.avatar || `img/species/${slug}-${gender}.jpg`;
  const fallback = `this.onerror=null;this.src='img/species/_default.jpg';this.classList.add('is-fallback');`;
  return `
    <div class="vault-card luxury luxury-hero" data-type="sheet" data-index="${i}">
      <span class="lux-paper"></span>
      <span class="lux-shine"></span>
      <span class="lux-corner lux-corner-tl"></span>
      <span class="lux-corner lux-corner-tr"></span>
      <span class="lux-corner lux-corner-bl"></span>
      <span class="lux-corner lux-corner-br"></span>
      <button class="btn-delete" data-type="sheet" data-index="${i}" title="Elimina Eroe">×</button>
      <div class="lux-portrait-wrap">
        <div class="lux-portrait-frame">
          <img class="lux-portrait-img" src="${escHtml(portraitSrc)}" alt="${escHtml(sheet.charName)}" onerror="${fallback}" loading="lazy" />
          <span class="lux-portrait-shine"></span>
        </div>
        <div class="lux-species-tag">${escHtml(sheet.charRace)||'—'}</div>
      </div>
      <div class="lux-head">
        <div class="lux-sigil"><span>${monogram(sheet.charName)}</span></div>
        <div class="lux-head-text">
          <div class="card-tag">Eroe</div>
          <div class="card-title">${escHtml(sheet.charName)}</div>
        </div>
      </div>
      <div class="lux-divider"></div>
      <div class="card-sub">${escHtml(sheet.charClass)||'—'}</div>
      <div class="card-level">Liv. ${escHtml(String(sheet.charLevel||1))}</div>
      <div class="lux-actions">
        <button class="btn-primary lux-btn">Apri Scheda</button>
      </div>
    </div>`;
}

export function makeCampaignCard(camp, i, isMaster) {
  const variant = isMaster ? 'luxury-master' : 'luxury-player';
  const tagText = isMaster ? 'Master' : 'Giocatore';
  const btnDelete = isMaster ? `<button class="btn-delete" data-type="campaign" data-index="${i}" title="Elimina">×</button>` : '';
  
  // --- Cerca l'eroe del giocatore ---
  let myCharInfo = '';
  if (!isMaster) {
      let active = {};
      try { active = JSON.parse(camp.activeCharacters || "{}"); } catch(e){}
      const charName = active[State.username];

      if (charName) {
          // Se hai già scelto l'eroe, lo scrive in oro
          myCharInfo = `<div class="lux-meta" style="margin-top: 4px; color: #d4a843;">In gioco con · <strong style="color: #f5d98e;">${escHtml(charName)}</strong></div>`;
      } else {
          // Se non lo hai ancora scelto, te lo ricorda
          myCharInfo = `<div class="lux-meta" style="margin-top: 4px; color: #888; font-style: italic;">Nessun eroe selezionato</div>`;
      }
  }

  // Info eroe
  const inviteInfo = isMaster
      ? `<div class="lux-invite">Codice <strong>${escHtml(String(camp.inviteCode||''))}</strong></div>`
      : `<div class="lux-meta">Master · <strong>${escHtml(camp.owner)}</strong></div>
         ${myCharInfo}`;

  const mapSrc = camp.mapUrl || camp.campMap || '/maps/mappa_1.jpg';
  const mapBlock = mapSrc
    ? `<div class="lux-map-thumb" style="background-image:url('${escHtml(mapSrc)}')"></div>`
    : `<div class="lux-map-thumb lux-map-empty" aria-label="Nessuna mappa">
         <svg viewBox="0 0 64 64" aria-hidden="true">
           <defs><linearGradient id="g${i}" x1="0" x2="1" y1="0" y2="1">
             <stop offset="0" stop-color="#f5d98e"/><stop offset="1" stop-color="#7a5c20"/>
           </linearGradient></defs>
           <circle cx="32" cy="32" r="22" fill="none" stroke="url(#g${i})" stroke-width="1.5"/>
           <path d="M32 8 L36 32 L32 56 L28 32 Z" fill="url(#g${i})" opacity=".9"/>
           <path d="M8 32 L32 28 L56 32 L32 36 Z" fill="url(#g${i})" opacity=".55"/>
           <circle cx="32" cy="32" r="2" fill="#0a0604"/>
         </svg>
       </div>`;

  // --- CALCOLO DEI POSTI LIBERI ---
  const totali = camp.campPlayers || 4;
  const occupati = camp.joinedPlayers ? camp.joinedPlayers.length : 0;
  const liberi = totali - occupati;

  return `
    <div class="vault-card luxury ${variant}" data-type="campaign" data-index="${i}">
      <span class="lux-paper"></span>
      <span class="lux-shine"></span>
      <span class="lux-corner lux-corner-tl"></span>
      <span class="lux-corner lux-corner-tr"></span>
      <span class="lux-corner lux-corner-bl"></span>
      <span class="lux-corner lux-corner-br"></span>
      ${btnDelete}
      <div class="lux-head lux-head-camp">
        <div class="lux-sigil"><span>${monogram(camp.campName)}</span></div>
        ${mapBlock}
        <div class="lux-head-text">
          <div class="card-tag">${tagText}</div>
          <div class="card-title">${escHtml(camp.campName)}</div>
        </div>
      </div>
      <div class="lux-divider"></div>
      <div class="card-sub">${escHtml(camp.campSetting)||'Ambientazione libera'}</div>
      
      <div class="card-level">${liberi} posti liberi</div>
      
      ${inviteInfo}
      <div class="lux-actions">
        <button class="btn-primary lux-btn">Entra al Tavolo</button>
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
