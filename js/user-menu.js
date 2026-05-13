/* ════════════════════════════════════════════════
   USER MENU — Account / Statistiche / Impostazioni / Tema
   ════════════════════════════════════════════════ */
(function () {
  // ---- Tema: applica subito (anche prima che parta la dashboard) ----
  const THEME_KEY = 'dvault_theme';
  const VALID = ['vault', 'verdant', 'azure'];
  function applyTheme(name) {
    if (!VALID.includes(name)) name = 'vault';
    document.documentElement.setAttribute('data-theme', name);
    try { localStorage.setItem(THEME_KEY, name); } catch (_) {}
  }
  applyTheme(localStorage.getItem(THEME_KEY) || 'vault');
  window.DVaultTheme = { apply: applyTheme, current: () => localStorage.getItem(THEME_KEY) || 'vault' };

  // ---- Helpers ----
  const username = () => localStorage.getItem('dvault_username') || 'Avventuriero';

  async function fetchData() {
    const me = username();
    try {
      const [s, c] = await Promise.all([
        fetch(`/api/sheets?user=${encodeURIComponent(me)}`).then(r => r.json()),
        fetch(`/api/campaigns?user=${encodeURIComponent(me)}`).then(r => r.json())
      ]);
      return { sheets: Array.isArray(s) ? s : [], campaigns: Array.isArray(c) ? c : [] };
    } catch (_) {
      return { sheets: [], campaigns: [] };
    }
  }

  function computeStats({ sheets, campaigns }) {
    const me = username();
    const totalSheets = sheets.length;
    const totalLevel  = sheets.reduce((a, c) => a + (parseInt(c.charLevel) || 0), 0);
    const topHero     = sheets.slice().sort((a, b) => (b.charLevel || 0) - (a.charLevel || 0))[0];
    const masterCamps = campaigns.filter(c => c.owner === me).length;
    const playerCamps = campaigns.length - masterCamps;
    return { totalSheets, totalLevel, topHero, masterCamps, playerCamps };
  }

  // ---- POPUP: Account ----
  function openAccount() {
    const me = username();
    Swal.fire({
      title: 'Il tuo Account',
      html: `
        <div style="text-align:left">
          <div class="vault-account-row"><span class="k">Username</span><span class="v">${me}</span></div>
          <div class="vault-account-row"><span class="k">Email</span><span class="v" style="font-style:italic;opacity:.7">protetta</span></div>
          <div class="vault-account-row"><span class="k">Password</span><span class="v">••••••••</span></div>
        </div>
        <p style="margin-top:.9rem;font-style:italic;opacity:.75;font-size:.85rem">
          Per cambiare la password ti verranno chiesti email + nuova password.
        </p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Cambia password',
      cancelButtonText: 'Chiudi',
      customClass: { popup: 'vault-popup' }
    }).then((r) => {
      if (r.isConfirmed) openChangePassword();
    });
  }

  function openChangePassword() {
    Swal.fire({
      title: 'Cambia Password',
      html: `
        <input id="cp-email" class="swal2-input" type="email" placeholder="La tua email" />
        <input id="cp-pwd"   class="swal2-input" type="password" placeholder="Nuova password" />
      `,
      confirmButtonText: 'Reimposta',
      showCancelButton: true,
      cancelButtonText: 'Annulla',
      customClass: { popup: 'vault-popup' },
      preConfirm: () => {
        const email = document.getElementById('cp-email').value.trim();
        const pwd   = document.getElementById('cp-pwd').value;
        if (!email || !pwd) { Swal.showValidationMessage('Compila entrambi i campi'); return false; }
        if (pwd.length < 4) { Swal.showValidationMessage('Password troppo corta'); return false; }
        return { email, pwd };
      }
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        const resp = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username(), email: r.value.email, newPassword: r.value.pwd })
        });
        const data = await resp.json();
        Swal.fire({
          title: resp.ok ? 'Memoria Ripristinata!' : 'Pergamena Vuota',
          text: data.message,
          icon: resp.ok ? 'success' : 'error',
          customClass: { popup: 'vault-popup' }
        });
      } catch (_) {
        Swal.fire({ title: 'Server Irraggiungibile', icon: 'warning', customClass: { popup: 'vault-popup' } });
      }
    });
  }

  // ---- POPUP: Statistiche ----
  async function openStats() {
    Swal.fire({
      title: 'Statistiche dell\'Eroe',
      html: '<p style="opacity:.7;font-style:italic">Consulto i toni del Vault…</p>',
      didOpen: () => Swal.showLoading(),
      customClass: { popup: 'vault-popup' }
    });
    const data = await fetchData();
    const s = computeStats(data);
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

  // ---- POPUP: Tema ----
  function openTheme() {
    const cur = window.DVaultTheme.current();
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
      didOpen: () => {
        document.querySelectorAll('.theme-card').forEach(card => {
          card.addEventListener('click', () => {
            const t = card.dataset.theme;
            applyTheme(t);
            document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('is-active'));
            card.classList.add('is-active');
          });
        });
      }
    });
  }

  // ---- POPUP: Impostazioni ----
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
        document.getElementById('set-theme').addEventListener('click', () => { Swal.close(); openTheme(); });
        document.getElementById('set-clear-notes').addEventListener('click', async () => {
          // CHIEDIAMO CONFERMA
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

          // Se l'utente clicca annulla, ci fermiamo qui
          if (!result.isConfirmed) return;

          try {
            //CHIAMIAMO IL SERVER
            const resp = await fetch('/api/sheets/reset-all-notes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ owner: username() })
            });

            if (resp.ok) {
              //PULIAMO LA UI IMMEDIATAMENTE
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
        document.getElementById('set-clear-sheets').addEventListener('click', () => confirmAndDelete('schede'));
        document.getElementById('set-clear-camps').addEventListener('click',  () => confirmAndDelete('campagne'));
      }
    });
    Swal.hideLoading();
    Swal.getConfirmButton().textContent = 'Chiudi';
  }

  async function confirmAndDelete(kind) {
    const me = username();
    const data = await fetchData();
    const items = kind === 'schede'
      ? data.sheets
      : data.campaigns.filter(c => c.owner === me);
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

  // ---- Wire-up: aggancia ai data-action delle voci aggiunte in dashboard.html ----
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-user-action]');
    if (!el) return;
    e.preventDefault();
    const action = el.dataset.userAction;
    // chiudi il dropdown se presente
    document.querySelectorAll('.nav-dd.open, [data-dd-target].open').forEach(n => n.classList.remove('open'));
    if (action === 'account')  return openAccount();
    if (action === 'stats')    return openStats();
    if (action === 'settings') return openSettings();
    if (action === 'theme')    return openTheme();
  });
})();
