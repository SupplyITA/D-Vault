import { $, escHtml } from './utils.js';
import { State } from './state.js';
import { socket } from './chat.js';
import { renderDropdowns } from './ui.js';


//Variabili per la mappa, serve per far capire al codice come
// far vedere la mappa agli utenti,  usando soltato una griglia e non coordinate geografiche
// per questo abbiamo scelto leaflet, è più "azzeccata" per questo tipo di siti

window.leafletMap = null;
window.playerLeafletMap = null;
window.currentImageOverlay = null;
window.activeTokenType = 'color';
window.activeTokenUrl = null;
window.activeTokenExtra = {};

// FUnzione per generare un colore univoco n base al nome utente (peak content)
// ci assicura che ogni utente abbia il proprio colore generato a random
window.getColorForUser = function(username) {
    if(!username) return '#aaa';
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

// Funzione per caricare i vari segnalini dei mostri dal bestiario 
// li prende proprio dal file XML e ci assicura che siano identici
window.caricaTokenMostri = async function() {
    try {
        const res = await fetch('/bestiario.xml');
        const text = await res.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, "text/xml");
        const mostri = xml.querySelectorAll('mostro');
        const container = $('master-monster-tokens');
        if(!container) return;
        
        container.innerHTML = '';
        mostri.forEach(m => {
            const nome = m.querySelector('nome').textContent;
            const avatar = m.querySelector('avatar').textContent;
            
            const img = document.createElement('img');
            img.src = avatar;
            img.title = nome;
            img.className = 'token-option';
            img.style.cssText = 'width: 35px; height: 35px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; object-fit: cover; background: #000;';
            img.onclick = function() { selezionaToken('image', avatar, this, { nome: nome, tipo: 'mostro' }); };           
            container.appendChild(img);
        });
        // Carica gli eroi del party come token selezionabili
        const campName = $('campaign-detail-title')?.dataset.campname;
        const containerEroi = $('master-hero-tokens');
        if (containerEroi && campName) {
            try {
                const res2 = await fetch(`/api/campaigns/${encodeURIComponent(campName)}/party`);
                const eroi = await res2.json();
                containerEroi.innerHTML = '';
                eroi.forEach(eroe => {
                    const avatarUrl = eroe.avatar || '/img/species/_default.jpg';
                    const img2 = document.createElement('img');
                    img2.src = avatarUrl;
                    img2.title = eroe.charName;
                    img2.className = 'token-option';
                    img2.style.cssText = 'width: 35px; height: 35px; border-radius: 50%; cursor: pointer; border: 2px solid transparent; object-fit: cover; background: #000;';
                    img2.onclick = function() { selezionaToken('image', avatarUrl, this, { nome: eroe.charName, tipo: 'eroe', ownerUsername: eroe.owner }); };
                    containerEroi.appendChild(img2);
                });
            } catch(e2) { console.error("Errore token eroi:", e2); }
        }
    } catch(e) { console.error("Errore nel caricamento dei token mostri:", e); }
}

// Funzione per selezionare il token da piazzare nella mappa 
window.selezionaToken = function(type, url, element, extra = {}) {
    activeTokenType = type;
    activeTokenUrl = url;
    activeTokenExtra = extra;
    
    // Resetta i bordi di tutti i bottoni e accende quello cliccato
    document.querySelectorAll('.token-option').forEach(el => el.style.borderColor = 'transparent');
    if (element) element.style.borderColor = '#e8c97e';
};


// Funzione che aggiunge e permette la rimozione dei segnalini con Proprietà, selezionare token personalizzati e bestiario 
// da qui gestisco tutto
window.aggiungiSegnalino = function(latlng, mappa, isLocal = true, owner = State.username, tokenInfo = null) {
    if (!tokenInfo) tokenInfo = { type: 'color', url: null };

    // Proprietario reale: per eroi piazzati dal master, è il giocatore
    const realOwner = (tokenInfo.tipo === 'eroe' && tokenInfo.ownerUsername)
        ? tokenInfo.ownerUsername : owner;
    owner = realOwner;

    // Calcola mId:
    // - mostro/npc: ID univoco con timestamp+random (illimitati, ognuno distinto)
    // - eroe/color: ID basato su colui che lo piazza +tipo (uno solo per owner)
    // - se arriva dal socket rimuove il precedente mID per evitare duplicati
    const mId = tokenInfo.markerId
        ? tokenInfo.markerId
        : (tokenInfo.tipo === 'mostro' || tokenInfo.tipo === 'npc')
            ? `${tokenInfo.tipo}_${tokenInfo.nome || 'x'}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
            : `${owner}_${tokenInfo.tipo || 'color'}_${tokenInfo.nome || owner}`;

    //Per rendere il segnalino unico, se sei il master
    // oppure se è un piazzamento locale di eroe/color
    if (tokenInfo.tipo === 'eroe' || !tokenInfo.tipo || tokenInfo.tipo === 'color') {
        if (isLocal) {
            // Controllo se ci sono duplicazioni
            let duplicato = false;
            mappa.eachLayer(layer => {
                if (layer instanceof L.Marker && layer.proprietario === owner) {
                    const tipoEsistente = layer.tokenInfo?.tipo || 'color';
                    if (tipoEsistente === (tokenInfo.tipo || 'color')) duplicato = true;
                }
            });
            if (duplicato) {
                const label = tokenInfo.tipo === 'eroe' ? 'eroe' : 'segnalino colore';
                Swal.fire({ toast: true, position: 'bottom-end', icon: 'warning',
                    title: `Hai già un ${label} sulla mappa!`,
                    showConfirmButton: false, timer: 2000,
                    background: '#1a1108', color: '#e8c97e' });
                return;
            }
        } else {
            // Aggiornamento via socket: rimuovi il precedente con stesso mId
            const toRemove = [];
            mappa.eachLayer(layer => {
                if (layer instanceof L.Marker && layer.markerId === mId) toRemove.push(layer);
            });
            toRemove.forEach(l => mappa.removeLayer(l));
        }
    }
    // mostro e npc: nessuna rimozione, ID sempre univoco per ogni mostro, così non ci sono duplicati

    // Controllo se l'utente è il master della campagna 
    const isMaster = ($('campaign-detail')?.style.display === 'block');
    const canDrag = isMaster
        || (owner === State.username)
        || (tokenInfo.ownerUsername === State.username);

    const userColor = getColorForUser(owner);
    let customIcon;

    // Icone dei vari token nella mappa
    if (tokenInfo.type === 'image' && tokenInfo.url) {
        customIcon = L.divIcon({
            html: `<img src="${tokenInfo.url}" style="width:40px;height:40px;border-radius:50%;border:3px solid ${userColor};box-shadow:0 4px 10px rgba(0,0,0,0.8);object-fit:cover;background:#111;">`,
            className: 'custom-leaflet-token', iconSize: [40,40], iconAnchor: [20,20]
        });
    } else {
        customIcon = L.divIcon({
            html: `<div style="width:24px;height:24px;background-color:${userColor};border:2px solid #fff;border-radius:50%;box-shadow:0 0 5px #000;"></div>`,
            className: 'custom-leaflet-token', iconSize: [24,24], iconAnchor: [12,12]
        });
    }

    const marker = L.marker(latlng, { icon: customIcon, draggable: canDrag }).addTo(mappa);
    marker.proprietario = owner;
    marker.tokenInfo = tokenInfo;
    marker.markerId = mId;

    // Visualizzazione nomi dei vari token con il passaggio del mouse, hit
    const isPing = !tokenInfo.tipo || tokenInfo.tipo === 'color';
    const nomeDisplay = tokenInfo.nome || owner;
    const fotoUrl = (!isPing && tokenInfo.type === 'image' && tokenInfo.url) ? tokenInfo.url : null;
    const fotoHtml = fotoUrl
        ? `<img src="${fotoUrl}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #e8c97e;display:block;margin:0 auto 6px;">`
        : '';
    const sottotitoloEroe = (tokenInfo.tipo === 'eroe' && tokenInfo.ownerUsername)
        ? `<div style="color:#aaa;font-size:0.68rem;margin-top:2px;">@${escHtml(tokenInfo.ownerUsername)}</div>`
        : '';
    const rigaNome = isPing
        ? `<div style="color:#e8c97e;font-family:'Cinzel',serif;font-size:0.78rem;">@${escHtml(owner)}</div>`
        : `<button class="marker-nome-btn" data-owner="${escHtml(owner)}" data-tipo="${escHtml(tokenInfo.tipo)}" data-nome="${escHtml(nomeDisplay)}" style="color:#e8c97e;font-family:'Cinzel',serif;font-size:0.78rem;cursor:pointer;text-decoration:underline;background:none;border:none;padding:0;">${escHtml(nomeDisplay)}</button>${sottotitoloEroe}`;

    marker.bindTooltip(
        `<div style="text-align:center;min-width:80px;background:rgba(15,8,3,0.95);padding:6px 8px;border-radius:6px;border:1px solid #e8c97e33;">
            ${fotoHtml}${rigaNome}
        </div>`,
        { permanent: false, direction: 'top', className: 'vault-marker-tooltip', opacity: 1 }
    );

    // trasporto segnalini nella mappa, così li possiamo muovere
    if (canDrag) {
        marker.on('dragend', () => {
            const newPos = marker.getLatLng();
            const campName = $('campaign-detail-title')?.dataset.campname || $('player-camp-title')?.textContent.trim();
            if (socket) socket.emit('sposta_segnalino', {
                owner, campName, tokenInfo,
                newLat: newPos.lat, newLng: newPos.lng,
                markerId: marker.markerId
            });
            latlng = newPos;
        });
    }

    // funzione per cancellare i segnalini, solo se sei il master o se sei il giocatore che l'ha piazzato
    const gestisciRimozione = () => {
        const puoRimuovere = isMaster
            || marker.proprietario === State.username
            || marker.tokenInfo?.ownerUsername === State.username;
        if (!puoRimuovere) {
            Swal.fire({ toast: true, position: 'bottom-end', icon: 'warning',
                title: 'Non puoi rimuovere questo segnalino!',
                showConfirmButton: false, timer: 2000,
                background: '#1a1108', color: '#e8c97e' });
            return;
        }
        mappa.removeLayer(marker);
        const campName = $('campaign-detail-title')?.dataset.campname || $('player-camp-title')?.textContent.trim();
        if (socket) socket.emit('rimuovi_segnalino', { markerId: marker.markerId, campName });
    };
    marker.on('contextmenu', gestisciRimozione);
    marker.on('dblclick', gestisciRimozione);
    if (isPing) marker.on('click', gestisciRimozione);

    // Collegamento col socket per il server per sincronizzare 
    if (socket && isLocal) {
        const campName = $('campaign-detail-title')?.dataset.campname || $('player-camp-title')?.textContent.trim();
        socket.emit('invia_segnalino', {
            lat: latlng.lat, lng: latlng.lng,
            owner: owner, tokenInfo: { ...tokenInfo, markerId: mId }, campName
        });
    }
}

// Funzione per barra delle mappe laterale


// Funzione per barra delle mappe laterale con history, permettendoci di salvare 
// le vecchie mappe. In questo modo è più facile spostarsi tra un'ambiente all'altro
window.renderizzaStoricoMappe = function(campName) {
    const list = $('map-history-list');
    if(!list) return;
    
    const camp = State.campaigns.find(c => c.campName === campName);
    if(!camp) return;

    let history = [];
    try { history = JSON.parse(camp.mapHistory || "[]"); } catch(e) {}
    
    // Se lo storico è ancora vuoto sul DB ma c'è una mappa iniziale attiva (es. quella di default),
    // la mostriamo dinamicamente nella barra laterale
    if(history.length === 0 && camp.mapUrl) {
        history.push(camp.mapUrl);
    }
    
    list.innerHTML = '';
    history.forEach(url => {
        const isActive = (url === camp.mapUrl);
        
        const container = document.createElement('div');
        container.style.cssText = `
            position: relative; width: 100%; height: 90px; border-radius: 4px;
            flex-shrink: 0; border: 2px solid ${isActive ? '#e8c97e' : '#333'};
            box-shadow: ${isActive ? '0 0 10px rgba(232,201,126,0.6)' : 'none'};
            transition: 0.2s; background-image: url('${url}');
            background-size: cover; background-position: center; cursor: pointer;
        `;
        
        // Al click sulla miniatura si cambia la mappa attiva
        container.onclick = (e) => {
            if (e.target.closest('.btn-delete-map-hist')) return;
            impostaMappaAttiva(url, camp.campName);
        };
        
        container.onmouseover = () => { if(!isActive) container.style.borderColor = '#aaa'; };
        container.onmouseout = () => { if(!isActive) container.style.borderColor = '#333'; };
        
        // Pulsante di cancellazione mappa (X)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete-map-hist';
        deleteBtn.innerHTML = '✕';
        deleteBtn.title = "Rimuovi questa mappa dall'archivio";
        deleteBtn.style.cssText = `
            position: absolute; top: 4px; right: 4px; width: 18px; height: 18px;
            border-radius: 50%; background: rgba(139, 26, 26, 0.85); color: white;
            border: 1px solid #8b1a1a; font-size: 10px; display: flex;
            align-items: center; justify-content: center; cursor: pointer;
            transition: 0.2s; z-index: 10; font-family: sans-serif; line-height: 1;
        `;
        
        deleteBtn.onmouseover = () => { deleteBtn.style.background = '#cc2a2a'; };
        deleteBtn.onmouseout = () => { deleteBtn.style.background = 'rgba(139, 26, 26, 0.85)'; };
        
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            rimuoviMappaDaStorico(url, camp.campName);
        };
        
        container.appendChild(deleteBtn);
        list.appendChild(container);
    });
}

// Cambia la mappa a schermo e notifica il Server e i giocatori via Socket.io
window.impostaMappaAttiva = async function(url, campName) {
    if (leafletMap) {
      if (currentImageOverlay) leafletMap.removeLayer(currentImageOverlay);
      const bounds = [[0,0], [1000,1000]];
      currentImageOverlay = L.imageOverlay(url, bounds).addTo(leafletMap);
      leafletMap.eachLayer(layer => {
          if (layer instanceof L.Marker) leafletMap.removeLayer(layer);
      })
      leafletMap.off('click');
      leafletMap.on('click', function(e) {
          const info = { type: activeTokenType, url: activeTokenUrl, ...activeTokenExtra };
          aggiungiSegnalino(e.latlng, leafletMap, true, State.username, info);
      });
  }
    
    if (socket) socket.emit('cambia_sfondo_mappa', url);
    
    const camp = State.campaigns.find(c => c.campName === campName);
    if(camp) {
        camp.mapUrl = url;
        renderizzaStoricoMappe(campName); 
        renderDropdowns();

    }

    try {
        await fetch('/api/campaigns/map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campName: campName, owner: State.username, mapUrl: url })
        });
    } catch (err) { console.error("Errore salvataggio mappa:", err); }
};


// Aggiunge un URL allo storico e lo salva nel Database
window.aggiungiMappaAStorico = async function(url, campName) {
    const camp = State.campaigns.find(c => c.campName === campName);
    if(!camp) return;

    let history = [];
    try { history = JSON.parse(camp.mapHistory || "[]"); } catch(e) {}

    if (history.length === 0 && camp.mapUrl) {
        history.push(camp.mapUrl);
    }

    if (!history.includes(url)) {
        history.push(url);
        camp.mapHistory = JSON.stringify(history);

        try {
            await fetch('/api/campaigns/map-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campName: campName, owner: State.username, mapHistory: camp.mapHistory })
            });
        } catch(e) { console.error("Errore salvataggio storico:", e); }
    }
    
    impostaMappaAttiva(url, campName);
}

// Permette di dare un senso alla X presente sulle miniature delle mappe per 
// poter cancellare le mappe dallo storico.

window.rimuoviMappaDaStorico = async function(urlDaRimuovere, campName) {
    const camp = State.campaigns.find(c => c.campName === campName);
    if(!camp) return;

    let history = [];
    try { history = JSON.parse(camp.mapHistory || "[]"); } catch(e) {}
    
    if (history.length === 0 && camp.mapUrl) {
        history.push(camp.mapUrl);
    }

    history = history.filter(url => url !== urlDaRimuovere);
    camp.mapHistory = JSON.stringify(history);

    // Se stiamo cancellando proprio la mappa correntemente mostrata sullo schermo, 
    // carichiamo la prima disponibile rimasta o torniamo a quella di base
    if (camp.mapUrl === urlDaRimuovere) {
        const prossimaMappa = history.length > 0 ? history[0] : '/maps/mappa_1.jpg';
        await impostaMappaAttiva(prossimaMappa, campName);
    }

    // Aggiorna la tabella delle campagne nel database SQLite
    try {
        await fetch('/api/campaigns/map-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campName: campName, owner: State.username, mapHistory: camp.mapHistory })
        });
        
        renderizzaStoricoMappe(campName);
        
        Swal.fire({
            toast: true, position: 'bottom-end', icon: 'success',
            title: 'Mappa rimossa dall\'archivio', showConfirmButton: false, timer: 1500,
            background: '#1a1108', color: '#e8c97e'
        });
    } catch(e) { console.error("Errore durante la rimozione della mappa:", e); }
};