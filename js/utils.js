export const $ = id => document.getElementById(id); // per facilitare la scrittura, serve a ritornare il primo elemento nel documento il cui attributo (l'id) è quello tra parentesi, se non esiste ritorna NULL

export function escHtml(str) { // piccole chicche di sicurezza
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function openModal(el) { 
    el?.classList.add('visible'); 
    document.body.style.overflow = 'hidden'; 
}

export function closeModal(el) { 
    el?.classList.remove('visible'); 
    document.body.style.overflow = ''; 
}

export function closeDropdown() {
    document.querySelectorAll('.nav-dd.open').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.nav-tab.open, .nav-user-btn.open').forEach(el => el.classList.remove('open'));
    $('dropdown-menu')?.classList.remove('open');
    $('hamburger-btn')?.classList.remove('open');
}

export function closeDetails() {
    if($('campaign-detail')) $('campaign-detail').style.display = 'none';
    if($('sheet-detail')) $('sheet-detail').style.display = 'none';
    if($('player-campaign-detail')) $('player-campaign-detail').style.display = 'none'; 
    if($('dash-main')) $('dash-main').style.display = 'flex';
}