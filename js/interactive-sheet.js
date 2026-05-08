import { $, escHtml } from './utils.js';
import { State } from './state.js';
import { dndData } from './dnd-data.js'; 

let sheetHTML = '';

async function fetchSheetTemplate() {
    if (sheetHTML) return sheetHTML;
    const response = await fetch('/components/interactive-sheet.html');
    sheetHTML = await response.text();
    return sheetHTML;
}

// Mappa delle statistiche per le abilità e dei tiri salvezza
const abilitàMappa = {
    skillAcrobatics: 'dex', skillAnimal: 'wis', skillArcana: 'int',
    skillAthletics: 'str', skillStealth: 'dex', skillInvestigation: 'int',
    skillDeception: 'cha', skillIntimidation: 'cha', skillPerformance: 'cha',
    skillSleight: 'dex', skillMedicine: 'wis', skillNature: 'int',
    skillPerception: 'wis', skillPersuasion: 'cha', skillReligion: 'int',
    skillInsight: 'wis', skillSurvival: 'wis'
};

const tiriSalvezzaMappa = {
    saveStr: 'str', saveDex: 'dex', saveCon: 'con',
    saveInt: 'int', saveWis: 'wis', saveCha: 'cha'
};

function calcolaModificatore(valore) {
    const val = parseInt(valore);
    if (isNaN(val)) return 0; 
    return Math.floor((val - 10) / 2);
}

export async function costruisciSchedaInterattiva(containerId, sheetData, isReadOnly = false) {
    const container = $(containerId);
    if (!container) return;

    const html = await fetchSheetTemplate();
    container.innerHTML = html;

    const form = container.querySelector('.dnd-sheet-form');

    // --- INIZIO GENERATORE DELLA GRIGLIA INCANTESIMI (STILE UFFICIALE) ---
    // Viene eseguito prima di caricare i dati per far sì che i campi esistano già
    const spellsContainer = form.querySelector('.dnd-spells-grid');
    if (spellsContainer && !spellsContainer.dataset.generated) {
        let spellsHTML = '';

        // Trucchetti (Livello 0)
        spellsHTML += `
        <div class="spell-level-box">
            <div class="spell-header">
                <div class="spell-level-num">0</div>
                <div class="spell-title">TRUCCHETTI</div>
            </div>
            <div class="spell-list">
                ${Array(8).fill(0).map((_, i) => `
                    <div class="spell-row">
                        <input type="text" name="spell0_${i}" class="spell-name-input">
                    </div>
                `).join('')}
            </div>
        </div>`;

        // Livelli da 1 a 9
        for (let lvl = 1; lvl <= 9; lvl++) {
            spellsHTML += `
            <div class="spell-level-box">
                <div class="spell-header">
                    <div class="spell-level-num">${lvl}</div>
                    <div class="spell-slots">
                        <label>SLOT TOTALI <input type="number" name="slotsTotal${lvl}" readonly></label>
                        <label>SLOT SPESI <input type="number" name="slotsExpended${lvl}"></label>
                    </div>
                </div>
                <div class="spell-list">
                    ${Array(13).fill(0).map((_, i) => `
                        <div class="spell-row">
                            <input type="checkbox" name="prep${lvl}_${i}" class="spell-prep-check">
                            <input type="text" name="spell${lvl}_${i}" class="spell-name-input">
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }
        spellsContainer.innerHTML = spellsHTML;
        spellsContainer.dataset.generated = "true";
    }
    // --- FINE GENERATORE ---

const aggiornaTuttiICalcoli = () => {
        const livelloInput = document.querySelector('#vue-scheda-personaggio input[type="number"]');
        const livello = livelloInput ? parseInt(livelloInput.value) : (parseInt(sheetData.charLevel) || 1);
        const profBonus = Math.ceil(livello / 4) + 1;

        const classeNome = sheetData.charClass;
        const infoClasse = dndData.classi[classeNome] || {};

        ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(stat => {
            const input = form.elements[stat];
            if (input) {
                if (input.value > 20) input.value = 20;
                if (input.value !== "" && input.value < 1) input.value = 1;
            }
        });

        const mods = {
            str: calcolaModificatore(form.elements['str'].value || 10),
            dex: calcolaModificatore(form.elements['dex'].value || 10),
            con: calcolaModificatore(form.elements['con'].value || 10),
            int: calcolaModificatore(form.elements['int'].value || 10),
            wis: calcolaModificatore(form.elements['wis'].value || 10),
            cha: calcolaModificatore(form.elements['cha'].value || 10)
        };

        Object.keys(mods).forEach(key => {
            const modEl = form.elements[key + 'Mod'];
            if (modEl) modEl.value = (mods[key] >= 0 ? '+' : '') + mods[key];
        });

        const spellAttrName = infoClasse.spellAttribute || 'int';
        const spellMod = mods[spellAttrName] || 0;
        
        // Aggiunto il Bonus Competenza al limite preparabile.
        // Questo dà ampio respiro a Paladini, Chierici e Druidi per spuntare
        // sia i preparati standard che gli Incantesimi Bonus di Dominio/Giuramento.
        const maxPrepared = Math.max(1, spellMod + livello + profBonus); 

        if ($('max-prepared')) $('max-prepared').textContent = maxPrepared;
        if (form.elements['spellAbility']) form.elements['spellAbility'].value = spellAttrName.toUpperCase();

        Object.keys(tiriSalvezzaMappa).forEach(saveKey => {
            const stat = tiriSalvezzaMappa[saveKey];
            const isProficient = form.elements[saveKey].checked;
            const valEl = form.elements['val' + saveKey.charAt(0).toUpperCase() + saveKey.slice(1)];
            if (valEl) valEl.value = mods[stat] + (isProficient ? profBonus : 0);
        });

        Object.keys(abilitàMappa).forEach(skillKey => {
            const stat = abilitàMappa[skillKey];
            const isProficient = form.elements[skillKey].checked;
            const valEl = form.elements['val' + skillKey.replace('skill', '')];
            if (valEl) valEl.value = mods[stat] + (isProficient ? profBonus : 0);
        });

        if(form.elements['initiative']) form.elements['initiative'].value = mods.dex;
        if(form.elements['ac'] && !form.elements['ac'].value) form.elements['ac'].value = 10 + mods.dex;

        if(form.elements['spellDC']) form.elements['spellDC'].value = 8 + profBonus + spellMod;
        if(form.elements['spellBonus']) form.elements['spellBonus'].value = (profBonus + spellMod >= 0 ? '+' : '') + (profBonus + spellMod);

        if (form.elements['hitDice']) {
            form.elements['hitDice'].value = `${livello}${infoClasse.hitDice || 'd8'}`;
        }
        
        if (form.elements['hpMax']) {
            const hpLivello1 = (infoClasse.hpBase || 8) + mods.con;
            const hpLivelliSucc = (livello - 1) * ((infoClasse.hpPerLevel || 5) + mods.con);
            form.elements['hpMax'].value = hpLivello1 + hpLivelliSucc;
        }

        //  GESTIONE MEZZ'INCANTATORI E SLOT TOTALI 
        let slots = [];
        if (infoClasse.fullCaster) {
            slots = dndData.spellSlots[livello] || [];
        } else if (classeNome === 'Paladino' || classeNome === 'Ranger') {
            // I Paladini e Ranger seguono la tabella degli incantesimi a metà del loro livello
            // (Es: Un Paladino di liv. 5 avrà gli stessi slot di un Mago di liv. 3)
            const livelloDimezzato = Math.ceil(livello / 2);
            slots = dndData.spellSlots[livelloDimezzato] || [];
        }

        for (let i = 1; i <= 9; i++) {
            const totalInput = form.elements[`slotsTotal${i}`];
            if (totalInput) totalInput.value = slots[i-1] || 0;
        }

        const allPrepChecks = Array.from(form.querySelectorAll('.spell-prep-check'));
        const currentPreparedCount = allPrepChecks.filter(c => c.checked).length;

        if ($('current-prepared')) $('current-prepared').textContent = currentPreparedCount;

        allPrepChecks.forEach(check => {
            if (currentPreparedCount >= maxPrepared && !check.checked) {
                check.disabled = true;
                check.parentElement.style.opacity = "0.5";
            } else {
                check.disabled = isReadOnly; 
                check.parentElement.style.opacity = "1";
            }
        });
    };

    form.addEventListener('input', aggiornaTuttiICalcoli);
    
    // Gestione della navigazione tra le varie sezioni della scheda
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

    // Salva i dati nel database (Carica i checkbox generati dinamicamente!)
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

    // Esegue i calcoli ogni volta sui dati trovati nel database, così se ad esempio si aggiorna il livello o la classe si aggiornano da soli tutti i valori senza dover fare refresh o altro
    aggiornaTuttiICalcoli(); 

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
            if (e.target.type === 'checkbox') return;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => salvaDati(false), 800); 
        });

        // Salva immediatamente quando si spunta una checkbox o si preme invio
        form.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') salvaDati(false);
        });
    }
}