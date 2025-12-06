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
    if (chk) chk.checked = !!currentDrills[key].random;

    if (currentDrills[key] && currentDrills[key][selectedLevel]) {
        // Deep copy data to tempDrillData
        tempDrillData = JSON.parse(JSON.stringify(currentDrills[key][selectedLevel]));
    } else {
        // Fallback default
        tempDrillData = [[[1500, 3000, 50, 0, 50, 1]]];
    }

    renderEditor();
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
        });
    });

    currentDrills[editingDrillKey][selectedLevel] = tempDrillData;
    saveDrillsToStorage();

    closeEditor();
    
    // Unified Save Message
    showToast("Configuration saved");
    
    // Notify main to refresh UI
    document.dispatchEvent(new CustomEvent('drills-updated'));
}

// --- Renaming Logic ---

function handleRename(titleEl) {
    if (!editingDrillKey || !editingDrillKey.startsWith('cust_')) return;

    const currentDisplayName = titleEl.getAttribute('data-name') || titleEl.textContent.replace(' ✎', '');
    const newName = prompt("Rename Drill (Max 32 chars)\nAllowed: a-z A-Z 0-9 . - # [ ] > < + ) ( Space", currentDisplayName);

    if (!newName || newName === currentDisplayName) return;

    // 1. Validation
    if (newName.length > 32) { 
        showToast("Name too long (Max 32)");
        return;
    }
    
    const validRegex = /^[a-zA-Z0-9.\-#\[\]><\+\)\( ]+$/;
    if (!validRegex.test(newName)) {
        showToast("Invalid characters");
        return;
    }

    // 2. Identify Category
    const parts = editingDrillKey.split('_'); 
    if (parts.length < 3) return;
    
    const catChar = parts[1]; 
    const catListKey = `custom-${catChar.toLowerCase()}`;
    const list = userCustomDrills[catListKey];
    
    if (!list) return;

    // 3. Check Uniqueness
    const newKey = `cust_${catChar}_${newName}`;
    if (currentDrills[newKey] && newKey !== editingDrillKey) {
        showToast("Name already exists");
        return;
    }

    // 4. Update Data
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
    
    // Store raw name for reference
    el.setAttribute('data-name', displayName);
    el.innerHTML = ''; // Clear current content
    
    // Create Text Node
    const textSpan = document.createElement('span');
    textSpan.textContent = displayName;
    el.appendChild(textSpan);

    // Add explicit Edit Icon for custom drills
    if (isCustom) {
        const icon = document.createElement('span');
        icon.textContent = ' ✎';
        icon.style.opacity = '0.6';
        icon.style.cursor = 'pointer';
        icon.style.marginLeft = '8px';
        icon.onclick = (e) => {
            e.stopPropagation();
            handleRename(el);
        };
        el.appendChild(icon);
    }
    
    el.title = displayName;
}

// --- Internal Rendering Logic ---

function renderEditor() {
    const modalBody = document.getElementById('editor-body');
    modalBody.innerHTML = '';
    
    const isConnected = bleState.isConnected;

    tempDrillData.forEach((stepOptions, stepIndex) => {
        // Swap Zone
        if (stepIndex > 0) {
            const swapDiv = document.createElement('div');
            swapDiv.className = 'swap-zone';
            swapDiv.innerHTML = `<button class="btn-swap" onclick="window.handleSwapSteps(${stepIndex - 1}, ${stepIndex})" title="Swap Order">⇅</button>`;
            modalBody.appendChild(swapDiv);
        }

        // Group Header
        const groupDiv = document.createElement('div');
        groupDiv.className = 'ball-group';
        
        const isSingle = stepOptions.length === 1;
        const plusBtn = isSingle 
            ? `<button class="btn-add-opt" onclick="window.handleAddOption(${stepIndex})" title="Add Variation">+</button>` 
            : '';

        groupDiv.innerHTML = `
            <div class="group-title">
                <span>Ball ${stepIndex + 1}</span>
                ${plusBtn}
            </div>`;

        // Render Options
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
                               oninput="window.handleEditorInput(${stepIndex}, ${optIndex}, ${cfg.idx}, this.value)">
                    </div>
                `;
            });
            gridHtml += '</div>';

            const isLastBall = tempDrillData.length === 1 && stepOptions.length === 1;

            const actionsHtml = `
                <div class="card-actions">
                     <button class="btn-action btn-act-test" 
                             onclick="window.handleTestBall(${stepIndex}, ${optIndex})" 
                             ${isConnected ? '' : 'disabled'}>Test</button>
                             
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

window.handleTestBall = async (stepIdx, optIdx) => {
    if (!bleState.isConnected) {
        showToast("Device not connected");
        return;
    }
    
    const d = tempDrillData[stepIdx][optIdx];
    
    // Construct Packet manually (Protocol Header + Ball Data)
    const ballData = packBall(d[0], d[1], d[2], d[3], d[4], 1); 
    
    const buffer = new ArrayBuffer(31); 
    const view = new DataView(buffer);
    
    // Header
    view.setUint8(0, 0x81); 
    view.setUint16(1, 28, true); // Length (4 + 24)
    view.setUint8(3, 1); 
    view.setUint16(4, 1, true); 
    view.setUint8(6, 0);
    
    // Payload
    new Uint8Array(buffer).set(ballData, 7);
    
    try {
        await sendPacket(new Uint8Array(buffer));
        showToast("Test Ball Fired");
    } catch (e) {
        console.error(e);
        showToast("Test Failed");
    }
};

window.handleTestCombo = async () => {
    if (!bleState.isConnected) {
        showToast("Device not connected");
        return;
    }

    if (!tempDrillData || tempDrillData.length === 0) return;

    // Collect 1 option per step, ensuring Reps = 1
    const balls = [];
    
    tempDrillData.forEach(stepOptions => {
        // Use the first option for deterministic testing
        const d = stepOptions[0]; 
        
        // params: top, bot, hgt, drop, freq, REPS=1
        balls.push(packBall(d[0], d[1], d[2], d[3], d[4], 1));
    });

    // Construct Full Sequence Packet
    // Header (7) + Payload (balls * 24)
    const totalLen = 7 + (balls.length * 24);
    const buffer = new ArrayBuffer(totalLen);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    // Protocol Header
    view.setUint8(0, 0x81); 
    view.setUint16(1, 4 + (balls.length * 24), true); // Payload length
    view.setUint8(3, 1); 
    view.setUint16(4, 1, true); 
    view.setUint8(6, 0);

    // Append Balls
    let offset = 7;
    balls.forEach(b => {
        uint8.set(b, offset);
        offset += 24;
    });

    try {
        await sendPacket(uint8);
        showToast("Testing Full Sequence...");
    } catch (e) {
        console.error(e);
        showToast("Test Failed");
    }
};