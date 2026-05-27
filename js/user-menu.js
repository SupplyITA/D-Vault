/* USER MENU — account / statistiche / impostazioni / tema */

(function () {
  //  Carica il theme per primac cosa, così siamo sicuri che si carichi subito
  const THEME_KEY = 'dvault_theme';
  const VALID = ['vault', 'verdant', 'azure']; // Lista dei temi permessi per sicurezza

  function applyTheme(name) {
    if (!VALID.includes(name)) name = 'vault';  // Fallback di sicurezza - se viene iniettao un tema non valido, mette il default 'vault'
    document.documentElement.setAttribute('data-theme', name);
    try { localStorage.setItem(THEME_KEY, name); } catch (_) {}
  }

  // Applica il tema appena il file viene letto
  applyTheme(localStorage.getItem(THEME_KEY) || 'vault');
  window.DVaultTheme = { apply: applyTheme, current: () => localStorage.getItem(THEME_KEY) || 'vault' };

  // Helpers - recupera username dell'utente
  const username = () => localStorage.getItem('dvault_username') || 'Avventuriero';
  
  // Recuperare tutti i dati dell'utente dal database (asincrono)
  async function fetchData() {
    const me = username();
    try {
      const [s, c] = await Promise.all([   // Promise.all esegue due richieste HTTP fetch IN PARALLELO, velocizza un po'

        //Se utilizzavamo un ciclo for per esempio, ogni chiamata doveva aspettare quella di prima, il che 
        //diventa lento con molti dati. Questo lancia tutto insieme

        fetch(`/api/sheets?user=${encodeURIComponent(me)}`).then(r => r.json()),
        fetch(`/api/campaigns?user=${encodeURIComponent(me)}`).then(r => r.json())
      ]);
      return { sheets: Array.isArray(s) ? s : [], campaigns: Array.isArray(c) ? c : [] };
    } catch (_) {
      return { sheets: [], campaigns: [] };
    }
  }

  // PArte per le statistiche: prende in input i dati estratti dal db e calcola le statistiche
  function computeStats({ sheets, campaigns }) {
    const me = username();
    const totalSheets = sheets.length;
    const totalLevel  = sheets.reduce((a, c) => a + (parseInt(c.charLevel) || 0), 0);
    const topHero     = sheets.slice().sort((a, b) => (b.charLevel || 0) - (a.charLevel || 0))[0];
    const masterCamps = campaigns.filter(c => c.owner === me).length;
    const playerCamps = campaigns.length - masterCamps;
    return { totalSheets, totalLevel, topHero, masterCamps, playerCamps };
  }

  // Parte per l'Account 
  async function openAccount() {
      const me = username();
      
      // Recupero dati reali dal server
      let userData = { email: '...', fullName: '...', avatar: '' };
      try {
          const resp = await fetch(`/api/user-info?username=${encodeURIComponent(me)}`);
          userData = await resp.json();
      } catch (e) { console.error("Errore caricamento dati utente"); }

      // Lettura delle preferenze audio salvate in locale
      const sfxEnabled = localStorage.getItem('dvault_sfx') !== 'false';
      const bgmEnabled = localStorage.getItem('dvault_bgm') !== 'false';

      Swal.fire({
        title: 'Archivio Personale',
        showCloseButton: true,
        showConfirmButton: false,
        background: '#0a0505',
        color: '#e8c97e',
        customClass: { popup: 'vault-account-popup' },
        html: `
          <div class="vault-account-container">
            <div style="text-align: center; margin-bottom: 20px;">
              <div class="user-avatar-wrapper" style="position: relative; display: inline-block; cursor: pointer;" id="trigger-avatar-options">
                <img id="user-profile-pic" src="${userData.avatar || 'https://via.placeholder.com/100'}" 
                    style="width: 110px; height: 110px; border-radius: 50%; border: 3px solid var(--gold-mid); object-fit: cover; transition: transform 0.2s;"
                    title="Clicca per gestire l'avatar">
                <div style="position: absolute; bottom: 5px; right: 5px; background: #8b1a1a; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 2px solid #000;">
                  <i class="fa-solid fa-camera" style="font-size: 0.7rem; color: white;"></i>
                </div>
              </div>
              <h3 style="margin: 10px 0 0 0; font-family: 'Cinzel', serif;">${userData.fullName}</h3>
              <p style="color: #888; font-size: 0.8rem; margin: 0;">@${me}</p>
            </div>

            <div style="text-align: left; margin-bottom: 15px;">
              <label style="color: var(--gold-dim); font-size: 0.7rem; text-transform: uppercase; display: block; margin-bottom: 5px;">Email della Locanda</label>
              <div style="display: flex; gap: 10px;">
                  <input type="email" id="acc-email-input" value="${userData.email}" style="flex: 1; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #444; color: #fff; border-radius: 4px;">
                  <button id="btn-save-email" class="btn-primary" style="margin:0; padding: 0 15px; font-size: 0.8rem;">Salva</button>
              </div>
            </div>

            <div style="text-align: left; margin-bottom: 20px; background: rgba(255,255,255,0.02); padding: 15px; border-radius: 8px; border: 1px solid rgba(212,168,67,0.1);">
              <label style="color: var(--gold-dim); font-size: 0.7rem; text-transform: uppercase; display: block; margin-bottom: 10px; letter-spacing: 1px;">Sicurezza Account</label>
              <button id="btn-change-pwd-acc" class="btn-ghost" style="width: 100%; font-size: 0.85rem; padding: 10px;">
                <i class="fa-solid fa-key" style="margin-right: 8px;"></i> Modifica Parola d'Ordine
              </button>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 6px; margin-bottom: 10px;">
              <span style="color: var(--gold-mid); font-family: 'Cinzel', serif; font-size: 0.9rem;">Suoni Interfaccia</span>
              <input type="checkbox" id="acc-toggle-sfx" ${sfxEnabled ? 'checked' : ''} style="cursor:pointer; width: 18px; height: 18px; accent-color: var(--gold-mid);">
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 6px; margin-bottom: 20px;">
              <span style="color: var(--gold-mid); font-family: 'Cinzel', serif; font-size: 0.9rem;">Musica Sottofondo</span>
              <input type="checkbox" id="acc-toggle-bgm" ${bgmEnabled ? 'checked' : ''} style="cursor:pointer; width: 18px; height: 18px; accent-color: var(--gold-mid);">
            </div>

            <div class="vault-divider" style="height: 1px; background: rgba(212,168,67,0.1); margin: 5px 0;"></div>

            <style>
              #btn-acc-delete {
                width: 100%; background: rgba(139, 26, 26, 0.05); border: 1px solid #333; color: #8b1a1a; 
                padding: 10px; cursor: pointer; border-radius: 4px; font-size: 0.75rem; margin-top: 10px; transition: all 0.3s ease;
              }
              #btn-acc-delete:hover {
                background: rgba(139, 26, 26, 0.25); border-color: #8b1a1a; color: #ff4d4d; box-shadow: 0 0 12px rgba(139, 26, 26, 0.4);
              }
            </style>
            <button id="btn-acc-delete">
                <i class="fa-solid fa-skull-crossbones"></i> Elimina Account
            </button>
          </div>
          <input type="file" id="acc-avatar-file" style="display:none;" accept="image/*">
        `,

        // didOpen chiamata da SweetAlert SOLO DOPO che l'HTML qui sopra è stato montato nel DOM.
        // Serve per poter assegnare gli EventListener, altrimenti avremmo null.
        didOpen: () => {
          // Carico file avatar
          const avatarInput = document.getElementById('acc-avatar-file');
          avatarInput.addEventListener('change', async (e) => {
              const file = e.target.files[0];
              if (!file) return;

              // FormData per gestire l'invio di un file binario via AJAX, il json stringify non può farlo
              const formData = new FormData();
              formData.append('avatar', file); 
              formData.append('username', me);

              try {
                  Swal.showLoading();
                  const resp = await fetch('/api/user/upload-avatar', { method: 'POST', body: formData });
                  const data = await resp.json();
                  if (data.success) {
                      Swal.fire({ title: 'Ritratto Caricato!', icon: 'success', timer: 1000, showConfirmButton: false });
                      setTimeout(() => location.reload(), 1000);
                  }
              } catch (err) { console.error("Errore upload:", err); }
          });

          // Parte per salvare mail
          document.getElementById('btn-save-email').addEventListener('click', async () => {
            const newEmail = document.getElementById('acc-email-input').value;
            const res = await fetch('/api/update-email', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ username: me, newEmail })
            });
            // "Toast" è per avere il popup piccolo in un angolo
            if(res.ok) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Email aggiornata!', showConfirmButton: false, timer: 1500 });
          });

          // Avatar parte di gestione
          document.getElementById('trigger-avatar-options').addEventListener('click', () => {
            Swal.fire({
              title: 'Gestisci Avatar',
              text: "Scegli come cambiare il tuo volto nel Vault",
              showDenyButton: true, showCancelButton: true,
              confirmButtonText: ' Ingrandisci', denyButtonText: ' Carica Foto', cancelButtonText: ' Galleria',
              background: '#1a1108', color: '#d4a843', customClass: { popup: 'vault-popup' }
            }).then(async (result) => {
              if (result.isConfirmed) {
                // Apre semplicemente la foto in grande
                Swal.fire({ imageUrl: userData.avatar, imageWidth: 400, background: 'rgba(0,0,0,0.9)', showConfirmButton: false });
              } else if (result.isDenied) {
                // Apre la finestra di selezione del SO
                avatarInput.click(); 
              } else if (result.dismiss === Swal.DismissReason.cancel) {

                // Immagini pre scelte
                const galleryImages = [
                  { url: '/img/avatars/male-1.jpg', label: 'Guerriero' },
                  { url: '/img/avatars/male-2.jpg', label: 'Mago' },
                  { url: '/img/avatars/female-1.jpg', label: 'Esploratrice' },
                  { url: '/img/avatars/female-2.jpg', label: 'Incantatrice' },
                  { url: '/img/avatars/other-1.jpg', label: 'Creatura' }
                ];

                // Sottomenù dinamico per stampare tutte le immagini
                Swal.fire({
                  title: 'Galleria del Vault', background: '#0a0505', color: '#e8c97e',
                  html: `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; padding: 10px;">
                      ${galleryImages.map(img => `
                        <div class="gallery-item" onclick="selectGalleryAvatar('${img.url}')" style="cursor:pointer; text-align:center;">
                          <img src="${img.url}" style="width:80px; height:80px; border-radius:50%; border:2px solid #444; object-fit:cover; transition:0.3s;">
                          <p style="font-size:0.7rem; margin-top:5px; color:#888;">${img.label}</p>
                        </div>`).join('')}
                    </div>`,
                  showConfirmButton: false, customClass: { popup: 'vault-popup' }
                });
              }
            });
          });

          // Funzione scelta galleria esposta globalmente (window) per poter essere richiamata da onclick
          window.selectGalleryAvatar = async (url) => {
              await fetch('/api/user/avatar', { 
                  method: 'POST', headers: {'Content-Type':'application/json'}, 
                  body: JSON.stringify({ username: me, avatarUrl: url }) 
              });
              location.reload();
          };

          // Gestione toggle suoni
          document.getElementById('acc-toggle-sfx').addEventListener('change', (e) => {
              if (window.DVaultAudio) window.DVaultAudio.toggleSfx(e.target.checked);
              else localStorage.setItem('dvault_sfx', e.target.checked);
          });

          document.getElementById('acc-toggle-bgm').addEventListener('change', (e) => {
              if (window.DVaultAudio) window.DVaultAudio.toggleBgm(e.target.checked);
              else localStorage.setItem('dvault_bgm', e.target.checked);
          });
          
          // Rotte per cambio password e cancellazione account
          document.getElementById('btn-change-pwd-acc').onclick = () => { Swal.close(); openChangePassword(); };
          
          // Per eliminare l'account chiede da leconda modifica
          document.getElementById('btn-acc-delete').onclick = async () => {
              const confirm = await Swal.fire({
                  title: 'AZIONE SUPREMA',
                  text: "Sei davvero pronto a cancellare la tua intera esistenza dal Vault?",
                  icon: 'warning', showCancelButton: true, confirmButtonText: 'Sì, cancellami',
                  confirmButtonColor: '#8b1a1a', background: '#0a0505', color: '#d4a843'
              });
              if (confirm.isConfirmed) {
                  const res = await fetch(`/api/delete-account?username=${encodeURIComponent(me)}`, { method: 'DELETE' });
                  if (res.ok) { localStorage.clear(); window.location.href = 'index.html'; }
              }
          };
        }
      });
  }
  
  // Cambia password con popup dalla sezione account
  function openChangePassword() {
    Swal.fire({
      title: 'Cambia Password',
      html: `
        <div style="text-align: left; display: flex; flex-direction: column; gap: 10px;">
          <label style="color: var(--gold-dim); font-size: 0.8rem;">NUOVA PASSWORD</label>
          <input id="vault-new-pwd-field" 
                 class="swal2-input" 
                 type="password" 
                 autocomplete="new-password" 
                 placeholder="Inserisci la nuova password" 
                 style="margin: 0; width: 100%;">
          <p style="font-size: 0.75rem; color: #888; margin: 5px 0 0 5px;">Minimo 4 caratteri</p>
        </div>
      `,
      confirmButtonText: 'Reimposta',
      showCancelButton: true,
      cancelButtonText: 'Annulla',
      background: '#1a1108',
      color: '#d4a843',
      customClass: { popup: 'vault-popup' },

      // Cattura i dati del popup prima di chiuderlo
      preConfirm: () => {
        const pwd = document.getElementById('vault-new-pwd-field').value;
        if (!pwd) { Swal.showValidationMessage('Inserisci una password'); return false; }
        if (pwd.length < 4) { Swal.showValidationMessage('Password troppo corta (min 4)'); return false; }
        return { pwd };
      }
    }).then(async (r) => {
      // Vede se l'utente ha premuto annulla
      if (!r.isConfirmed) return;

      try {
        // Utilizziamo la rotta reset-password esistente
        const resp = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: username(), 
            // Inviamo una stringa vuota o il nome per l'email se il server la richiede, 
            // ma dato che siamo loggati l'importante è l'username
            email: "", 
            newPassword: r.value.pwd 
          })
        });

        const data = await resp.json();

        Swal.fire({
          title: resp.ok ? 'Memoria Ripristinata!' : 'Errore',
          text: data.message,
          icon: resp.ok ? 'success' : 'error',
          background: '#1a1108',
          color: '#d4a843',
          customClass: { popup: 'vault-popup' }
        });
      } catch (_) {
        Swal.fire({ title: 'Server Irraggiungibile', icon: 'warning', customClass: { popup: 'vault-popup' } });
      }
    });
  }

  // Statistiche 
  async function openStats() {
    Swal.fire({
      title: 'Statistiche dell\'Eroe',
      html: '<p style="opacity:.7;font-style:italic">Consulto i toni del Vault…</p>',
      didOpen: () => Swal.showLoading(),
      customClass: { popup: 'vault-popup' }
    });
    const data = await fetchData();
    const s = computeStats(data);
    // Inietta il DOM nel popup aperto
    Swal.update({
      html: `
        <div class="vault-stats">
          <div class="vault-stat"><div class="v-label">Schede</div><div class="v-value">${s.totalSheets}</div></div>
          <div class="vault-stat"><div class="v-label">Livelli totali</div><div class="v-value">${s.totalLevel}</div></div>
          <div class="vault-stat"><div class="v-label">Camp. da Master</div><div class="v-value">${s.masterCamps}</div></div>
          <div class="vault-stat"><div class="v-label">Camp. da Player</div><div class="v-value">${s.playerCamps}</div></div>
        </div>
        ${s.topHero ? `<p style="margin-top:1rem;font-style:italic;opacity:.85">
          Il tuo eroe più forte è <strong style="color:var(--gold)">${s.topHero.charName}</strong>${s.topHero.charClass ? ' — '+s.topHero.charClass : ''} (Liv. ${s.topHero.charLevel || 1}).
        </p>` : '<p style="margin-top:1rem;opacity:.6">Nessun eroe ancora forgiato.</p>'}
      `
    });
    Swal.hideLoading();
    Swal.getConfirmButton().textContent = 'Chiudi';
  }

  // Temi (usando popup)
  function openTheme() {
    const cur = window.DVaultTheme.current();
    // I quadratini d'anteprima
    const themes = [
      { id: 'vault',   name: 'Vault',    a: '#5a0f0f', b: '#e8c97e', c: '#1a0a0a' },
      { id: 'verdant', name: 'Verdant',  a: '#8a2756', b: '#7be0a8', c: '#0c1f17' },
      { id: 'azure',   name: 'Azure',    a: '#2a6fb0', b: '#f4faff', c: '#0d1b2c' },
    ];
    const html = `
      <p style="opacity:.8;font-style:italic;margin-bottom:.4rem">Scegli la palette del Vault.</p>
      <div class="theme-picker">
        ${themes.map(t => `
          <div class="theme-card ${t.id===cur?'is-active':''}" data-theme="${t.id}">
            <div class="theme-swatch">
              <span style="background:${t.c}"></span>
              <span style="background:${t.a}"></span>
              <span style="background:${t.b}"></span>
            </div>
            <div class="theme-name">${t.name}</div>
          </div>
        `).join('')}
      </div>
    `;
    Swal.fire({
      title: 'Cambia Tema',
      html,
      showConfirmButton: true,
      showCloseButton: false,
      confirmButtonText: 'Chiudi',
      customClass: { popup: 'vault-popup' },
      // Applica l'EventListener ad ogni card di tema per innescare lo switch in tempo reale
      didOpen: () => {
        document.querySelectorAll('.theme-card').forEach(card => {
          card.addEventListener('click', () => {
            const t = card.dataset.theme;
            applyTheme(t);
            // Aggiorna il bordo oro della card attiva
            document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('is-active'));
            card.classList.add('is-active');
          });
        });
      }
    });
  }

  // Impostazioni 
  function openSettings() {
    Swal.fire({
      title: 'Impostazioni',
      html: `
        <div style="display:flex;flex-direction:column;gap:.5rem;text-align:left">
          <button id="set-clear-sheets" class="swal2-styled swal2-cancel" style="width:100%">
            <i class="fa-solid fa-shield-halved"></i> Cancella tutte le mie schede
          </button>
          <button id="set-clear-camps" class="swal2-styled swal2-cancel" style="width:100%">
            <i class="fa-solid fa-dragon"></i> Cancella tutte le mie campagne (Master)
          </button>
          <button id="set-clear-notes" class="swal2-styled swal2-cancel" style="width:100%">
            <i class="fa-solid fa-feather-pointed"></i> Reset note giocatore
          </button>
          <button id="set-theme" class="swal2-styled swal2-confirm" style="width:100%">
            <i class="fa-solid fa-palette"></i> Cambia tema
          </button>
        </div>
        <p style="margin-top:.8rem;font-size:.78rem;opacity:.65;font-style:italic">
          Le azioni distruttive richiedono conferma.
        </p>
      `,
      showConfirmButton: true,
      showCloseButton: false,
      cancelButtonText: 'Chiudi',
      customClass: { popup: 'vault-popup' },
      didOpen: () => {
        // Routing verso il gestore temi
        document.getElementById('set-theme').addEventListener('click', () => { Swal.close(); openTheme(); });

        // Logica per svuotare tutto l'array delle note di TUTTO
        document.getElementById('set-clear-notes').addEventListener('click', async () => {
          
          const result = await Swal.fire({
            title: 'Sei sicuro?',
            text: "Tutti gli appunti di tutti i tuoi eroi verranno cancellati per sempre. Confermi l'azione?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sì, cancella tutto!',
            cancelButtonText: 'Annulla',
            background: '#1a1108',
            color: '#d4a843',
            confirmButtonColor: '#8b1a1a',
            customClass: { popup: 'vault-popup' }
          });

          // Se l'utente clicca annulla
          if (!result.isConfirmed) return;

          try {
            const resp = await fetch('/api/sheets/reset-all-notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ owner: username() })
            });

            if (resp.ok) {
              
              const ta = document.getElementById('player-notes');
              if (ta) ta.value = '';

              Swal.fire({ 
                title: 'Note ripulite!', 
                text: 'L\'Archivio è tornato immacolato.',
                icon: 'success', 
                timer: 2000, 
                showConfirmButton: false, 
                customClass: { popup: 'vault-popup' } 
              });
              setTimeout(() => location.reload(), 2000);
            }
          } catch (e) {
            Swal.fire({ title: 'Errore magico', text: 'Non è stato possibile comunicare con il Vault.', icon: 'error' });
          }
        });
        // Eventi per l'eliminazione di Schede o Campagne
        document.getElementById('set-clear-sheets').addEventListener('click', () => confirmAndDelete('schede'));
        document.getElementById('set-clear-camps').addEventListener('click',  () => confirmAndDelete('campagne'));
      }
    });
    Swal.hideLoading();
    Swal.getConfirmButton().textContent = 'Chiudi';
  }

  // Funzione ricorsiva per l'eliminazione di tutto
  async function confirmAndDelete(kind) {
    const me = username();
    const data = await fetchData();
    const items = kind === 'schede'
      ? data.sheets
      : data.campaigns.filter(c => c.owner === me);
    // Se non ci sono elementi, avvisa l'utente ed esce dalla funzione
    if (!items.length) return Swal.fire({ title: 'Niente da cancellare', icon: 'info', customClass: { popup: 'vault-popup' } });

    const ok = await Swal.fire({
      title: 'Sei sicuro?',
      text: `Verranno eliminat${kind==='schede'?'e tutte le tue schede':'e tutte le campagne create da te'} (${items.length}). Operazione irreversibile.`,
      icon: 'warning', showCancelButton: true,
      confirmButtonText: 'Sì, distruggi', cancelButtonText: 'Annulla',
      customClass: { popup: 'vault-popup' }
    });
    if (!ok.isConfirmed) return;

    try {
      // Promise.all combinato con array.map()
      // Comodo, lancia tutte le richieste di delete contemporaneamente (una chiamata API per ogni scheda e campagna)
      // e aspetta che tutte siano andate a buon fine prima di continuare, veloce e sicuro
      if (kind === 'schede') {
        await Promise.all(items.map(it =>
          fetch(`/api/sheets/${encodeURIComponent(it.charName)}?user=${encodeURIComponent(me)}`, { method: 'DELETE' })
        ));
      } else {
        await Promise.all(items.map(it =>
          fetch(`/api/campaigns/${encodeURIComponent(it.campName)}?user=${encodeURIComponent(me)}`, { method: 'DELETE' })
        ));
      }
      Swal.fire({ title: 'Vault ripulito', icon: 'success', timer: 1500, showConfirmButton: false, customClass: { popup: 'vault-popup' } });
      setTimeout(() => location.reload(), 1500);
    } catch (e) {
      Swal.fire({ title: 'Errore', text: 'Qualcosa è andato storto.', icon: 'error', customClass: { popup: 'vault-popup' } });
    }
  }

  // Unisce i dati da dashboard e server 

  // Invece di fare un AddEventListener per 50 bottoni diversi, usa un solo listener 
  // sul documento root che "intercetta" i click. Risparmia RAm
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-user-action]');
    if (!el) return;
    e.preventDefault();
    const action = el.dataset.userAction;

    // Chiude tutti i menu a tendina aperti resettando la classe 'open'
    document.querySelectorAll('.nav-dd.open, [data-dd-target].open').forEach(n => n.classList.remove('open'));
    if (action === 'account')  return openAccount();
    if (action === 'stats')    return openStats();
    if (action === 'settings') return openSettings();
    if (action === 'theme')    return openTheme();
  });
})();
