import { currentDrills, userCustomDrills, selectedLevel, saveDrillsToStorage } from './state.js';
import { RANGE_CONFIG } from './constants.js';
import { sendPacket, packBall, bleState } from './bluetooth.js';
import { showToast, clamp } from './utils.js';

// --- Local State ---
let tempDrillData = null;
let editingDrillKey = null;

// --- Public Module Functions ---

export function openEditor(key) {
    editingDrillKey = key;
    
    // --- 1. SET DRILL NAME IN TITLE ---
    const titleEl = document.querySelector('.modal-title');
    if (titleEl) {
        updateTitleDisplay(titleEl, key);
    }

    // --- 2. LOAD DATA ---
    const chk = document.getElementById('chk-drill-random');
    if (chk) chk.checked = !!(currentDrills[key] && currentDrills[key].random);

    if (currentDrills[key] && currentDrills[key][selectedLevel]) {
        // Deep copy data to tempDrillData
        tempDrillData = JSON.parse(JSON.stringify(currentDrills[key][selectedLevel]));
    } else {
        // Fallback default
        tempDrillData = [[[1500, 3000, 50, 0, 50, 1]]];
    }

    renderEditor();
    
    // Disable "Delete" button if it's a standard drill (not custom)
    const btnDel = document.querySelector('.btn-delete-drill');
    if(btnDel) {
        btnDel.disabled = !key.startsWith('cust_');
        btnDel.style.opacity = key.startsWith('cust_') ? '1' : '0.5';
    }

    document.getElementById('editor-modal').classList.add('open');
}

export function closeEditor() {
    document.getElementById('editor-modal').classList.remove('open');
    editingDrillKey = null;
    tempDrillData = null;
}

export function saveDrillChanges() {
    if (!editingDrillKey || !tempDrillData) return;

    const chk = document.getElementById('chk-drill-random');
    if (chk) currentDrills[editingDrillKey].random = chk.checked;

    // Sanitize Data (Clamp all values)
    tempDrillData.forEach(step => {
        step.forEach(ball => {
            ball[0] = clamp(ball[0], 400, 7500); 
            ball[1] = clamp(ball[1], 400, 7500); 
            ball[2] = clamp(ball[2], -50, 100);  
            ball[3] = clamp(ball[3], -10, 10);   
            ball[4] = clamp(ball[4], 0, 100);    
            ball[5] = clamp(ball[5], 1, 200);
            
            // Sanitize Active Flag (Index 6)
            if(ball[6] === undefined) ball[6] = 1;
            ball[6] = ball[6] === 1 ? 1 : 0; 
        });
    });

    currentDrills[editingDrillKey][selectedLevel] = tempDrillData;
    saveDrillsToStorage();

    closeEditor();
    showToast("Configuration saved");
    document.dispatchEvent(new CustomEvent('drills-updated'));
}

// --- Renaming Logic ---

function handleRename(titleEl) {
    if (!editingDrillKey || !editingDrillKey.startsWith('cust_')) return;

    const currentDisplayName = titleEl.getAttribute('data-name') || titleEl.textContent.replace(' ✎', '');
    
    // UPDATED: Text now says Max 25 chars
    const newName = prompt("Rename Drill (Max 25 chars)\nAllowed: a-z A-Z 0-9 . - # [ ] > < + ) ( Space", currentDisplayName);

    if (!newName || newName === currentDisplayName) return;

    // Validation Limit 25
    if (newName.length > 25) { 
        showToast("Name too long (Max 25)");
        return;
    }
    
    const validRegex = /^[a-zA-Z0-9.\-#\[\]><\+\)\( ]+$/;
    if (!validRegex.test(newName)) {
        showToast("Invalid characters");
        return;
    }

    const parts = editingDrillKey.split('_'); 
    if (parts.length < 3) return;
    
    const catChar = parts[1]; 
    const catListKey = `custom-${catChar.toLowerCase()}`;
    const list = userCustomDrills[catListKey];
    
    if (!list) return;

    const newKey = `cust_${catChar}_${newName}`;
    if (currentDrills[newKey] && newKey !== editingDrillKey) {
        showToast("Name already exists");
        return;
    }

    const entry = list.find(d => d.key === editingDrillKey);
    if (entry) {
        entry.name = newName;
        entry.key = newKey;
    }

    currentDrills[newKey] = currentDrills[editingDrillKey];
    delete currentDrills[editingDrillKey];

    editingDrillKey = newKey;
    localStorage.setItem('custom_data', JSON.stringify(userCustomDrills)); 
    saveDrillsToStorage(); 

    updateTitleDisplay(titleEl, newKey);
    showToast("Renamed Successfully");
    document.dispatchEvent(new CustomEvent('drills-updated'));
}

function updateTitleDisplay(el, key) {
    let displayName = key;
    let isCustom = false;

    if (key.startsWith('cust_')) {
        isCustom = true;
        const parts = key.split('_');
        if (parts.length >= 3) {
           const catKey = `custom-${parts[1].toLowerCase()}`;
           const entry = userCustomDrills[catKey]?.find(d => d.key === key);
           displayName = entry ? entry.name : key.replace(/^cust_[A-C]_/, '');
        }
    } else {
        displayName = key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    el.setAttribute('data-name', displayName);
    el.innerHTML = ''; 
    const textSpan = document.createElement('span');
    textSpan.textContent = displayName;
    el.appendChild(textSpan);

    if (isCustom) {
        const icon = document.createElement('span');
        icon.textContent = ' ✎';
        icon.style.opacity = '0.6';
        icon.style.cursor = 'pointer';
        icon.style.marginLeft = '8px';
        icon.onclick = (e) => { e.stopPropagation(); handleRename(el); };
        el.appendChild(icon);
    }
    el.title = displayName;
}

function renderEditor() {
    const modalBody = document.getElementById('editor-body');
    modalBody.innerHTML = '';
    
    const isConnected = bleState.isConnected;

    tempDrillData.forEach((stepOptions, stepIndex) => {
        const isActive = stepOptions[0][6] === undefined ? 1 : stepOptions[0][6];

        if (stepIndex > 0) {
            const swapDiv = document.createElement('div');
            swapDiv.className = 'swap-zone';
            swapDiv.innerHTML = `<button class="btn-swap" onclick="window.handleSwapSteps(${stepIndex - 1}, ${stepIndex})" title="Swap Order">⇅</button>`;
            modalBody.appendChild(swapDiv);
        }

        const groupDiv = document.createElement('div');
        groupDiv.className = `ball-group ${isActive ? '' : 'inactive'}`;
        
        const isSingle = stepOptions.length === 1;
        const plusBtn = isSingle 
            ? `<button class="btn-add-opt" onclick="window.handleAddOption(${stepIndex})" title="Add Variation">+</button>` 
            : '';

        groupDiv.innerHTML = `
            <div class="group-title">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span>Ball ${stepIndex + 1}</span>
                    <div class="ball-toggle ${isActive ? 'active' : ''}" onclick="window.handleToggleBallActive(${stepIndex})">
                        <div class="toggle-switch"></div>
                    </div>
                </div>
                ${plusBtn}
            </div>`;

        stepOptions.forEach((ballParams, optIndex) => {
            const optDiv = document.createElement('div');
            optDiv.className = 'option-card';
            
            let gridHtml = '<div class="editor-grid">';
            RANGE_CONFIG.forEach(cfg => {
                gridHtml += `
                    <div class="editor-field">
                        <div class="field-header">
                            <label>${cfg.label}</label>
                            <span class="range-hint">${cfg.min}-${cfg.max}</span>
                        </div>
                        <input type="number" 
                               class="${cfg.class}" 
                               value="${ballParams[cfg.idx]}" 
                               min="${cfg.min}" max="${cfg.max}" step="${cfg.step}"
                               oninput="window.handleEditorInput(${stepIndex}, ${optIndex}, ${cfg.idx}, this.value)"
                               ${!isActive ? 'disabled' : ''}>
                    </div>
                `;
            });
            gridHtml += '</div>';

            const isLastBall = tempDrillData.length === 1 && stepOptions.length === 1;
            const actionsHtml = `
                <div class="card-actions">
                     <button class="btn-action btn-act-test" 
                             onclick="window.handleTestBall(${stepIndex}, ${optIndex})" 
                             ${isConnected && isActive ? '' : 'disabled'}>Test</button>
                             
                     <button class="btn-action btn-act-clone" 
                             onclick="window.handleCloneBall(${stepIndex}, ${optIndex})">Clone</button>
                             
                     <button class="btn-action btn-act-del" 
                             onclick="window.handleDeleteBall(${stepIndex}, ${optIndex})" 
                             ${isLastBall ? 'disabled' : ''}>Delete</button>
                </div>
            `;
            const label = stepOptions.length > 1 ? `<span class="option-label">Option ${optIndex + 1}</span>` : '';
            optDiv.innerHTML = label + gridHtml + actionsHtml;
            groupDiv.appendChild(optDiv);
        });
        modalBody.appendChild(groupDiv);
    });
}

// --- Window Global Handlers ---

window.handleEditorInput = (stepIdx, optIdx, paramIdx, value) => {
    if (!tempDrillData) return;
    let val = parseFloat(value);
    if (isNaN(val)) return;
    if (paramIdx !== 3) val = parseInt(value); 
    tempDrillData[stepIdx][optIdx][paramIdx] = val;
};

window.handleSwapSteps = (idxA, idxB) => {
    if (!tempDrillData) return;
    [tempDrillData[idxA], tempDrillData[idxB]] = [tempDrillData[idxB], tempDrillData[idxA]];
    renderEditor(); 
};

window.handleToggleBallActive = (stepIdx) => {
    if (!tempDrillData) return;
    const currentVal = tempDrillData[stepIdx][0][6] === undefined ? 1 : tempDrillData[stepIdx][0][6];
    const newVal = currentVal === 1 ? 0 : 1;
    tempDrillData[stepIdx].forEach(opt => opt[6] = newVal);
    renderEditor();
};

window.handleAddOption = (stepIndex) => {
    const baseOption = [...tempDrillData[stepIndex][0]];
    tempDrillData[stepIndex].push(baseOption);
    renderEditor();
};

window.handleCloneBall = (stepIdx, optIdx) => {
    const ballConfig = [...tempDrillData[stepIdx][optIdx]];
    if (tempDrillData[stepIdx].length > 1) {
        tempDrillData[stepIdx].splice(optIdx + 1, 0, ballConfig);
    } else {
        const newStep = [ballConfig];
        tempDrillData.splice(stepIdx + 1, 0, newStep);
    }
    renderEditor();
};

window.handleDeleteBall = (stepIdx, optIdx) => {
    if (tempDrillData.length <= 1 && tempDrillData[0].length <= 1) {
        showToast("Cannot delete the last ball");
        return;
    }
    tempDrillData[stepIdx].splice(optIdx, 1);
    if (tempDrillData[stepIdx].length === 0) {
        tempDrillData.splice(stepIdx, 1);
    }
    renderEditor();
};

// --- UPDATED SAVE AS LOGIC ---
window.handleSaveAsDrill = () => {
    // UPDATED: Text now says Max 25 chars
    const newName = prompt("Save New Drill As (Max 25 chars):");
    if(!newName) return;

    // Validation Limit 25
    if (newName.length > 25) { showToast("Name too long (Max 25)"); return; }
    if (!/^[a-zA-Z0-9.\-#\[\]><\+\)\( ]+$/.test(newName)) { showToast("Invalid characters"); return; }

    let targetCat = null;

    if (editingDrillKey.startsWith('cust_')) {
        const parts = editingDrillKey.split('_');
        if (parts.length >= 2) {
            const catChar = parts[1].toLowerCase(); 
            targetCat = `custom-${catChar}`;
        }
    }

    if (!targetCat) {
        if (userCustomDrills['custom-a'].length < 20) targetCat = 'custom-a';
        else if (userCustomDrills['custom-b'].length < 20) targetCat = 'custom-b';
        else if (userCustomDrills['custom-c'].length < 20) targetCat = 'custom-c';
        else { showToast("All custom banks full!"); return; }
    } else {
        const catChar = targetCat.split('-')[1].toUpperCase(); 
        const potentialKey = `cust_${catChar}_${newName.replace(/\s+/g, '_')}`;
        
        if (!currentDrills[potentialKey] && userCustomDrills[targetCat].length >= 20) {
             showToast(`Category ${catChar} is full!`);
             return;
        }
    }

    const catChar = targetCat.split('-')[1].toUpperCase(); 
    const newKey = `cust_${catChar}_${newName.replace(/\s+/g, '_')}`;

    if (currentDrills[newKey]) {
        if(!confirm(`Overwrite existing drill "${newName}" in Custom ${catChar}?`)) return;
    } else {
         userCustomDrills[targetCat].push({ name: newName, key: newKey });
    }

    let baseDrill = currentDrills[editingDrillKey];
    if (!baseDrill) baseDrill = { 1: [], 2: [], 3: [] }; 
    
    const newDrillData = JSON.parse(JSON.stringify(baseDrill));
    newDrillData[selectedLevel] = tempDrillData;
    
    const chk = document.getElementById('chk-drill-random');
    if (chk) newDrillData.random = chk.checked;

    currentDrills[newKey] = newDrillData;
    
    saveDrillsToStorage(); 
    localStorage.setItem('custom_data', JSON.stringify(userCustomDrills));

    closeEditor();
    openEditor(newKey);
    showToast(`Saved to Custom ${catChar}`);
    document.dispatchEvent(new CustomEvent('drills-updated'));
};

window.handleDeleteDrill = () => {
    if (!editingDrillKey) return;
    
    if (!editingDrillKey.startsWith('cust_')) {
        showToast("Cannot delete built-in drills");
        return;
    }

    if (!confirm("Are you sure you want to delete this drill?")) return;

    const parts = editingDrillKey.split('_');
    if(parts.length >= 2) {
        const catKey = `custom-${parts[1].toLowerCase()}`;
        if (userCustomDrills[catKey]) {
            userCustomDrills[catKey] = userCustomDrills[catKey].filter(d => d.key !== editingDrillKey);
        }
    }

    delete currentDrills[editingDrillKey];

    saveDrillsToStorage();
    localStorage.setItem('custom_data', JSON.stringify(userCustomDrills));

    closeEditor();
    showToast("Drill Deleted");
    document.dispatchEvent(new CustomEvent('drills-updated'));
};

window.handleTestBall = async (stepIdx, optIdx) => {
    if (!bleState.isConnected) { showToast("Device not connected"); return; }
    
    const d = tempDrillData[stepIdx][optIdx];
    const ballData = packBall(d[0], d[1], d[2], d[3], d[4], 1); 
    
    const buffer = new ArrayBuffer(31); 
    const view = new DataView(buffer);
    view.setUint8(0, 0x81); view.setUint16(1, 28, true); 
    view.setUint8(3, 1); view.setUint16(4, 1, true); view.setUint8(6, 0);
    new Uint8Array(buffer).set(ballData, 7);
    
    try { await sendPacket(new Uint8Array(buffer)); showToast("Test Ball Fired"); } 
    catch (e) { console.error(e); showToast("Test Failed"); }
};

window.handleTestCombo = async () => {
    if (!bleState.isConnected) { showToast("Device not connected"); return; }
    if (!tempDrillData || tempDrillData.length === 0) return;

    const balls = [];
    tempDrillData.forEach(stepOptions => {
        if (stepOptions[0][6] === 0) return;
        const d = stepOptions[0]; 
        balls.push(packBall(d[0], d[1], d[2], d[3], d[4], 1));
    });

    if (balls.length === 0) { showToast("No active balls to test"); return; }

    const totalLen = 7 + (balls.length * 24);
    const buffer = new ArrayBuffer(totalLen);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    view.setUint8(0, 0x81); view.setUint16(1, 4 + (balls.length * 24), true); 
    view.setUint8(3, 1); view.setUint16(4, 1, true); view.setUint8(6, 0);

    let offset = 7;
    balls.forEach(b => { uint8.set(b, offset); offset += 24; });

    try { await sendPacket(uint8); showToast("Testing Drill..."); } 
    catch (e) { console.error(e); showToast("Test Failed"); }
};