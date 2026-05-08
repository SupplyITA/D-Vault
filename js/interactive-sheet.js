import { $, escHtml } from './utils.js';
import { State } from './state.js';

let sheetHTML = '';

async function fetchSheetTemplate() {
    if (sheetHTML) return sheetHTML;
    const response = await fetch('/components/interactive-sheet.html');
    sheetHTML = await response.text();
    return sheetHTML;
}

export async function costruisciSchedaInterattiva(containerId, sheetData, isReadOnly = false) {
    const container = $(containerId);
    if (!container) return;

    const html = await fetchSheetTemplate();
    container.innerHTML = html;

    const form = container.querySelector('.dnd-sheet-form');
    
    // Gestione Sub-Tabs
    const subTabBtns = container.querySelectorAll('.dnd-subtab-btn');
    subTabBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.preventDefault();
            subTabBtns.forEach(b => b.classList.remove('active'));
            container.querySelectorAll('.dnd-subtab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            container.querySelector(`#subtab-${btn.dataset.subtab}`).classList.add('active');
        };
    });

    // Popola i dati salvati (compresi i checkbox)
    if (sheetData.sheetDataDetails) {
        const details = sheetData.sheetDataDetails;
        Array.from(form.elements).forEach(input => {
            if (!input.name) return;
            if (input.type === 'checkbox') {
                input.checked = (details[input.name] === 'on' || details[input.name] === true);
            } else if (details[input.name] !== undefined) {
                input.value = details[input.name];
            }
        });
    }

    const saveBtn = container.querySelector('#btn-manual-save');

    if (isReadOnly) {
        form.classList.add('readonly-sheet');
        Array.from(form.elements).forEach(el => el.disabled = true);
        if (saveBtn) saveBtn.style.display = 'none';
    } else {
        // Funzione di salvataggio
        const salvaDati = async (mostraPopup = false) => {
            const updatedData = {};
            Array.from(form.elements).forEach(el => {
                if (el.name) {
                    updatedData[el.name] = el.type === 'checkbox' ? (el.checked ? 'on' : 'off') : el.value;
                }
            });

            try {
                const response = await fetch('/api/sheets/update-details', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        owner: State.username, 
                        charName: sheetData.charName, 
                        details: updatedData 
                    })
                });

                if (response.ok) {
                    sheetData.sheetDataDetails = updatedData;
                    if (mostraPopup) {
                        Swal.fire({
                            toast: true, position: 'bottom-end',
                            icon: 'success', title: 'Scheda Salvata!',
                            showConfirmButton: false, timer: 2000,
                            background: '#1a1108', color: '#d4a843'
                        });
                    }
                } else {
                    Swal.fire('Errore', 'Il server ha rifiutato il salvataggio.', 'error');
                }
            } catch (e) {
                console.error("Errore salvataggio:", e);
            }
        };

        // Salvataggio Manuale col bottone
        if (saveBtn) {
            saveBtn.onclick = (e) => {
                e.preventDefault();
                salvaDati(true);
            };
        }
        // Autosave automatico quando si compila la scheda
        let debounceTimer;

        form.addEventListener('input', (e) => {
            // Ignora le checkbox per evitare conflitti con il change event sotto
            if (e.target.type === 'checkbox') return;
            
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => salvaDati(false), 800); // Salva in automatico dopo 800 millisecondi di inattività
        });

        // Salva immediatamente quando si spunta una checkbox o si preme invio
        form.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') salvaDati(false);
        });

    }
}