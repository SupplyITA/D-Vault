export const $ = id => document.getElementById(id);

export function escHtml(str) {
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
    $('dropdown-menu')?.classList.remove('open'); 
    $('hamburger-btn')?.classList.remove('open'); 
}

export function closeDetails() {
    if($('campaign-detail')) $('campaign-detail').style.display = 'none';
    if($('sheet-detail')) $('sheet-detail').style.display = 'none';
    if($('player-campaign-detail')) $('player-campaign-detail').style.display = 'none'; 
    if($('dash-main')) $('dash-main').style.display = 'flex';
}