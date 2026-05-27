import { $, escHtml } from './utils.js';
import { State } from './state.js';

function emptyState({ icon, title, subtitle }) {
  return `
    <div class="lux-empty">
      <div class="lux-empty-sigil" aria-hidden="true">
        <svg viewBox="0 0 120 120">
          <defs>
            <linearGradient id="leg-${Math.random().toString(36).slice(2,8)}" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stop-color="#f5d98e"/><stop offset="1" stop-color="#7a5c20"/>
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(212,168,67,.35)" stroke-width="1"/>
          <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(212,168,67,.18)" stroke-width="1" stroke-dasharray="3 5"/>
          <path d="M60 18 L66 60 L60 102 L54 60 Z" fill="rgba(245,217,142,.12)"/>
          <path d="M18 60 L60 54 L102 60 L60 66 Z" fill="rgba(245,217,142,.08)"/>
          <circle cx="60" cy="60" r="3" fill="rgba(245,217,142,.6)"/>
        </svg>
        <i class="${icon} lux-empty-icon" aria-hidden="true"></i>
      </div>
      <p class="lux-empty-title">${title}</p>
      <p class="lux-empty-sub">${subtitle}</p>
    </div>`;
}

// DOPO
function dropdownItemHtml(label, type, i, extra = null) {
  if (type === 'sheet' && extra) {
    const slug = (extra.charRace || 'umano').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'umano';
    const gender = extra.charGender || 'm';
    const src = extra.avatar || `img/species/${slug}-${gender}.jpg`;
    return `<li class="dropdown-item" data-type="${type}" data-index="${i}">
      <img class="dd-item-avatar" src="${escHtml(src)}"
           onerror="this.onerror=null;this.src='img/species/_default.jpg';"
           alt="${escHtml(label)}" />
      <span class="dd-item-label">${escHtml(label)}</span>
    </li>`;
  }
  if (type === 'campaign' && extra) {
    const mapSrc = extra.mapUrl || extra.campMap || '/maps/mappa_1.jpg';
    return `<li class="dropdown-item" data-type="${type}" data-index="${i}">
      <img class="dd-item-map" src="${escHtml(mapSrc)}"
           onerror="this.onerror=null;this.src='/maps/mappa_1.jpg';"
           alt="${escHtml(label)}" />
      <span class="dd-item-label">${escHtml(label)}</span>
    </li>`;
  }
  const ico = type === 'sheet' ? 'fa-shield-halved' : 'fa-dragon';
  return `<li class="dropdown-item" data-type="${type}" data-index="${i}">
    <i class="fa-solid ${ico} dd-item-ico"></i><span class="dd-item-label">${escHtml(label)}</span>
  </li>`;
}

export function renderDropdowns() {
  const dropdownSheetsList = $('dropdown-sheets-list');
  const dropdownMasterList = $('dropdown-master-list'); 
  const dropdownPlayerList = $('dropdown-player-list');

  if (dropdownSheetsList) {
    if (State.sheets.length === 0) {
      dropdownSheetsList.innerHTML = '<li class="dropdown-empty"><i class="fa-solid fa-feather"></i> Nessuna scheda</li>';
    } else {
      dropdownSheetsList.innerHTML = State.sheets.map((s, i) => dropdownItemHtml(s.charName, 'sheet', i, s)).join('');
    }
  }

  const masterCamps = [];
  const playerCamps = [];
  State.campaigns.forEach((c, i) => {
    if (c.owner === State.username) {
        masterCamps.push({ camp: c, index: i });
    } else {
        const players = c.joinedPlayers || [];
        if (players.includes(State.username)) {
            playerCamps.push({ camp: c, index: i });
        }
    }
  });

  if (dropdownMasterList) {
    if (masterCamps.length === 0) {
      dropdownMasterList.innerHTML = '<li class="dropdown-empty"><i class="fa-solid fa-feather"></i> Nessuna campagna</li>';
    } else {
      dropdownMasterList.innerHTML = masterCamps.map(item => dropdownItemHtml(item.camp.campName, 'campaign', item.index, item.camp)).join('');
    }
  }

  if (dropdownPlayerList) {
    if (playerCamps.length === 0) {
      dropdownPlayerList.innerHTML = '<li class="dropdown-empty"><i class="fa-solid fa-feather"></i> Nessuna avventura</li>';
    } else {
      dropdownPlayerList.innerHTML = playerCamps.map(item => dropdownItemHtml(item.camp.campName, 'campaign', item.index, item.camp)).join('');
    }
  }
}

export function renderGrid() {
  if ($('grid-heroes')) {
    if (State.sheets.length === 0) {
      $('grid-heroes').innerHTML = emptyState({
        icon: 'fa-solid fa-shield-halved',
        title: 'Nessun eroe ancora forgiato',
        subtitle: 'L\'incudine è fredda. Clicca su <em>“+ Forgia Eroe”</em> per dare vita al tuo primo campione.'
      });
    } else {
      $('grid-heroes').innerHTML = State.sheets.map((s, i) => makeSheetCard(s, i)).join('');
    }
  }

  const masterCamps = [];
  const playerCamps = [];
  State.campaigns.forEach((c, i) => {
    if (c.owner === State.username) {
        masterCamps.push({ camp: c, index: i });
    } else {
        const players = c.joinedPlayers || [];
        if (players.includes(State.username)) {
            playerCamps.push({ camp: c, index: i });
        }
    }
  });

  if ($('grid-master')) {
    if (masterCamps.length === 0) {
      $('grid-master').innerHTML = emptyState({
        icon: 'fa-solid fa-dragon',
        title: 'Il trono del Master attende',
        subtitle: 'Nessun mondo plasmato dalla tua mano. Forgia una nuova campagna e siedi al capotavola.'
      });
    } else {
      $('grid-master').innerHTML = masterCamps.map(item => makeCampaignCard(item.camp, item.index, true)).join('');
    }
  }

  if ($('grid-player')) {
    if (playerCamps.length === 0) {
      $('grid-player').innerHTML = emptyState({
        icon: 'fa-solid fa-scroll',
        title: 'Nessuna avventura in corso',
        subtitle: 'Le taverne sono piene di voci. Unisciti a un tavolo con il <em>codice invito</em> del tuo Master.'
      });
    } else {
      $('grid-player').innerHTML = playerCamps.map(item => makeCampaignCard(item.camp, item.index, false)).join('');
    }
  }
}

function monogram(name) {
  const ch = (name || '?').trim().charAt(0).toUpperCase();
  return escHtml(ch || '?');
}

function speciesSlug(name) {
  return (name || 'umano').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'umano';
}

export function makeSheetCard(sheet, i) {
  const slug = speciesSlug(sheet.charRace);
  const gender = sheet.charGender || 'm';
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
  
  // Il Master può eliminare (tasto rosso con ×), il Giocatore può abbandonare (tasto rosso con ✕)
  const btnDelete = isMaster 
    ? `<button class="btn-delete" data-type="campaign" data-index="${i}" title="Elimina Campagna">×</button>` 
    : `<button class="btn-delete btn-leave" data-index="${i}" title="Abbandona Campagna">✕</button>`;
  
  let myCharInfo = '';
  if (!isMaster) {
      let active = {};
      try { active = JSON.parse(camp.activeCharacters || "{}"); } catch(e){}
      const charName = active[State.username];

      if (charName) {
          myCharInfo = `<div class="lux-meta" style="margin-top: 4px; color: #d4a843;">In gioco con · <strong style="color: #f5d98e;">${escHtml(charName)}</strong></div>`;
      } else {
          myCharInfo = `<div class="lux-meta" style="margin-top: 4px; color: #888; font-style: italic;">Nessun eroe selezionato</div>`;
      }
  }

  // Aggiunto blur-code e copy-code per copiare il codice segreto con un tap
  const inviteInfo = isMaster
      ? `<div class="lux-invite">Codice <strong class="blur-code copy-code" data-code="${escHtml(String(camp.inviteCode||''))}" title="Clicca per copiare">${escHtml(String(camp.inviteCode||''))}</strong></div>`
      : `<div class="lux-meta">Master · <strong>${escHtml(camp.owner)}</strong></div>${myCharInfo}`;

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