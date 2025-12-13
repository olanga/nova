import { currentDrills, userCustomDrills, selectedLevel, saveDrillsToStorage } from './state.js';
import { SPIN_LIMITS, RPM_MIN, RPM_MAX } from './constants.js';
import { sendPacket, packBall, bleState } from './bluetooth.js';
import { showToast, clamp } from './utils.js';
import { uploadDrill } from './cloud.js';

// --- Local State ---
let tempDrillData = null;
let editingDrillKey = null;
let selectedSaveCat = 'custom-a'; // Default for Save As Modal

// --- Public Module Functions ---

export function openEditor(key) {
    editingDrillKey = key;
    
    // Set Title
    const titleEl = document.querySelector('.modal-title');
    if (titleEl) updateTitleDisplay(titleEl, key);

    // Random
    const chk = document.getElementById('chk-drill-random');
    if (chk) chk.checked = !!(currentDrills[key] && currentDrills[key].random);

    // Load Data
    if (currentDrills[key] && currentDrills[key][selectedLevel]) {
        tempDrillData = JSON.parse(JSON.stringify(currentDrills[key][selectedLevel]));
    } else {
        const def = calculateRPMs(5, 2, 'top');
        tempDrillData = [[[def.top, def.bot, 50, 0, 50, 1, 1, 5, 2, 'top']]];
    }

    renderEditor();
    
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

    tempDrillData.forEach(step => {
        step.forEach(ball => {
            if(ball[7] === undefined) { 
                const r = reverseCalculate(ball[0], ball[1]);
                ball[7]=r.speed; ball[8]=r.spin; ball[9]=r.type;
            }
            const maxSpin = SPIN_LIMITS[ball[7].toString()] ?? 10;
            if(ball[8] > maxSpin) ball[8] = maxSpin;

            const res = calculateRPMs(ball[7], ball[8], ball[9]);
            ball[0] = res.top; 
            ball[1] = res.bot;
            
            ball[2] = clamp(ball[2], -50, 100);  
            ball[3] = clamp(ball[3], -10, 10);   
            ball[4] = clamp(ball[4], 0, 100);    
            ball[5] = clamp(ball[5], 1, 200);
            
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

// --- CORE PHYSICS LOGIC ---

function calculateRPMs(speed, spin, type) {
    const baseSpeed = 970 + (630.5 * speed);
    const spinFactor = 342 * spin;
    let top, bot;
    if (type === 'top') { top = baseSpeed + spinFactor; bot = baseSpeed - spinFactor; } 
    else { top = baseSpeed - spinFactor; bot = baseSpeed + spinFactor; }
    return { top: Math.round(clamp(top, RPM_MIN, RPM_MAX)), bot: Math.round(clamp(bot, RPM_MIN, RPM_MAX)) };
}

function reverseCalculate(top, bot) {
    const type = top >= bot ? 'top' : 'back';
    const baseSpeed = (top + bot) / 2;
    const speedRaw = (baseSpeed - 970) / 630.5;
    const diff = Math.abs(top - bot) / 2;
    const spinRaw = diff / 342;
    return { speed: Math.round(speedRaw * 2) / 2, spin: Math.round(spinRaw * 2) / 2, type: type };
}

// --- RENDER EDITOR ---

function renderEditor() {
    const modalBody = document.getElementById('editor-body');
    modalBody.innerHTML = '';
    const isConnected = bleState.isConnected;

    tempDrillData.forEach((stepOptions, stepIndex) => {
        const isActive = stepOptions[0][6] === undefined ? 1 : stepOptions[0][6];

        if (stepIndex > 0) {
            const swapDiv = document.createElement('div');
            swapDiv.className = 'swap-zone';
            swapDiv.innerHTML = `<button class="btn-swap" onclick="window.handleSwapSteps(${stepIndex - 1}, ${stepIndex})">⇅</button>`;
            modalBody.appendChild(swapDiv);
        }

        const groupDiv = document.createElement('div');
        groupDiv.className = `ball-group ${isActive ? '' : 'inactive'}`;
        
        const isSingle = stepOptions.length === 1;
        
        // Check for RND flag at index 10
        const isRnd = isSingle && !!stepOptions[0][10];

        const plusBtn = isSingle 
            ? `<button class="btn-add-opt" onclick="window.handleAddOption(${stepIndex})">+</button>` 
            : '';

        // RND Toggle Layout (Right side, separated by border)
        const rndHtml = isSingle ? `
            <div style="display:flex; align-items:center; gap:8px; margin-left:45px;">
                <span style="font-size:0.75rem; font-weight:800; color:var(--text-light); opacity:1.0;">RND</span>
                <div class="ball-toggle ${isRnd ? 'active' : ''}" onclick="window.handleRndToggle(${stepIndex})">
                    <div class="toggle-switch"></div>
                </div>
            </div>` : '';

        groupDiv.innerHTML = `
            <div class="group-title">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span>Ball ${stepIndex + 1}</span>
                    <div class="ball-toggle ${isActive ? 'active' : ''}" onclick="window.handleToggleBallActive(${stepIndex})">
                        <div class="toggle-switch"></div>
                    </div>
                    ${rndHtml}
                </div>
                ${plusBtn}
            </div>`;

        stepOptions.forEach((ballParams, optIndex) => {
            if (ballParams[7] === undefined) {
                const rev = reverseCalculate(ballParams[0], ballParams[1]);
                ballParams[7] = clamp(rev.speed, 0, 10);
                ballParams[8] = clamp(rev.spin, 0, 10);
                ballParams[9] = rev.type;
            }

            const speed = ballParams[7];
            const spin = ballParams[8];
            const type = ballParams[9];
            const currentMaxSpin = SPIN_LIMITS[speed.toString()] ?? 10;

            const optDiv = document.createElement('div');
            optDiv.className = 'option-card';

            const toggleHtml = `
                <div class="spin-row">
                    <span class="spin-label">Rotation:</span>
                    <div class="spin-capsule">
                        <div class="sc-opt ${type === 'top' ? 'active' : ''}" 
                             onclick="window.handleTypeToggle(${stepIndex}, ${optIndex}, 'top')">TOP</div>
                        <div class="sc-opt ${type === 'back' ? 'active' : ''}" 
                             onclick="window.handleTypeToggle(${stepIndex}, ${optIndex}, 'back')">BACK</div>
                    </div>
                </div>`;

            const inputsHtml = `
                <div class="editor-grid">
                    <div class="editor-field">
                        <div class="field-header"><label>Speed</label><span class="range-hint">0-10</span></div>
                        <input type="number" id="inp-speed-${stepIndex}-${optIndex}" value="${speed}" step="0.5" min="0" max="10"
                            oninput="window.handleEditorInput(${stepIndex}, ${optIndex}, 7, this.value)">
                    </div>
                    <div class="editor-field">
                        <div class="field-header"><label>Spin</label><span class="range-hint" id="lbl-spin-${stepIndex}-${optIndex}">Max ${currentMaxSpin}</span></div>
                        <input type="number" id="inp-spin-${stepIndex}-${optIndex}" value="${spin}" step="0.5" min="0" max="${currentMaxSpin}"
                            oninput="window.handleEditorInput(${stepIndex}, ${optIndex}, 8, this.value)">
                    </div>
                    <div class="editor-field">
                        <div class="field-header"><label>Height</label><span class="range-hint">-50/100</span></div>
                        <input type="number" value="${ballParams[2]}" step="1" min="-50" max="100"
                            oninput="window.handleEditorInput(${stepIndex}, ${optIndex}, 2, this.value)">
                    </div>
                    <div class="editor-field">
                        <div class="field-header"><label>Drop</label><span class="range-hint">L/R</span></div>
                        <input type="number" value="${ballParams[3]}" step="0.5" min="-10" max="10"
                            oninput="window.handleEditorInput(${stepIndex}, ${optIndex}, 3, this.value)">
                    </div>
                    <div class="editor-field">
                        <div class="field-header"><label>Freq</label><span class="range-hint">0-100</span></div>
                        <input type="number" value="${ballParams[4]}" step="10" min="0" max="100"
                            oninput="window.handleEditorInput(${stepIndex}, ${optIndex}, 4, this.value)">
                    </div>
                    <div class="editor-field">
                        <div class="field-header"><label>Reps</label><span class="range-hint">#</span></div>
                        <input type="number" value="${ballParams[5]}" step="1" min="1" max="100"
                            oninput="window.handleEditorInput(${stepIndex}, ${optIndex}, 5, this.value)">
                    </div>
                </div>`;

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
            optDiv.innerHTML = label + toggleHtml + inputsHtml + actionsHtml;
            groupDiv.appendChild(optDiv);
        });
        modalBody.appendChild(groupDiv);
    });
}

// --- HANDLERS ---

window.handleEditorInput = (stepIdx, optIdx, paramIdx, value) => {
    if (!tempDrillData) return;
    const ball = tempDrillData[stepIdx][optIdx];
    let val = parseFloat(value);
    if(isNaN(val)) val = 0;
    ball[paramIdx] = val;

    if (paramIdx === 7) { 
        const maxAllowed = SPIN_LIMITS[val.toString()] ?? 10;
        if (ball[8] > maxAllowed) ball[8] = maxAllowed;
        
        const spinInput = document.getElementById(`inp-spin-${stepIdx}-${optIdx}`);
        const spinLabel = document.getElementById(`lbl-spin-${stepIdx}-${optIdx}`);
        if (spinInput) { spinInput.max = maxAllowed; spinInput.value = ball[8]; }
        if (spinLabel) spinLabel.textContent = `Max ${maxAllowed}`;
    }

    if (paramIdx === 7 || paramIdx === 8) {
        const res = calculateRPMs(ball[7], ball[8], ball[9]);
        ball[0] = res.top; ball[1] = res.bot;
    }
};

window.handleTypeToggle = (stepIdx, optIdx, newType) => {
    if (!tempDrillData) return;
    const ball = tempDrillData[stepIdx][optIdx];
    if(ball[9] === newType) return;
    ball[9] = newType;
    const res = calculateRPMs(ball[7], ball[8], ball[9]);
    ball[0] = res.top; ball[1] = res.bot;
    renderEditor(); 
};

window.handleSwapSteps = (idxA, idxB) => {
    if (!tempDrillData) return;
    [tempDrillData[idxA], tempDrillData[idxB]] = [tempDrillData[idxB], tempDrillData[idxA]];
    renderEditor(); 
};

window.handleToggleBallActive = (stepIdx) => {
    if (!tempDrillData) return;
    const currentVal = tempDrillData[stepIdx][0][6] === undefined ? 1 : tempDrillData[stepIdx][0][6];
    tempDrillData[stepIdx].forEach(opt => opt[6] = currentVal === 1 ? 0 : 1);
    renderEditor();
};

window.handleRndToggle = (stepIdx) => {
    if (!tempDrillData) return;
    const ball = tempDrillData[stepIdx][0];
    ball[10] = !ball[10];
    renderEditor();
};

window.handleAddOption = (stepIndex) => {
    const baseOption = JSON.parse(JSON.stringify(tempDrillData[stepIndex][0]));
    // Copy the RND flag if present, or clear it? Usually options disable RND logic in UI.
    // The UI hides RND toggle if >1 options anyway.
    tempDrillData[stepIndex].push(baseOption);
    renderEditor();
};

window.handleCloneBall = (stepIdx, optIdx) => {
    const ballConfig = JSON.parse(JSON.stringify(tempDrillData[stepIdx][optIdx]));
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
        showToast("Cannot delete last ball"); return;
    }
    tempDrillData[stepIdx].splice(optIdx, 1);
    if (tempDrillData[stepIdx].length === 0) tempDrillData.splice(stepIdx, 1);
    renderEditor();
};

// --- SAVE AS HANDLERS (UPDATED) ---

window.handleSaveAsDrill = () => {
    // 1. Open Modal
    selectedSaveCat = 'custom-a';
    const nameInput = document.getElementById('save-name');
    if (nameInput) nameInput.value = '';
    
    // Reset UI Switch
    const switchEl = document.getElementById('save-cat-switch');
    if(switchEl) {
        Array.from(switchEl.children).forEach(c => c.classList.remove('active'));
        if(switchEl.children[0]) switchEl.children[0].classList.add('active');
    }

    document.getElementById('save-as-modal').classList.add('open');
    setTimeout(() => { if(nameInput) nameInput.focus(); }, 100);
};

window.closeSaveAsModal = () => {
    document.getElementById('save-as-modal').classList.remove('open');
};

window.selectSaveCategory = (val, btn) => {
    selectedSaveCat = val;
    const parent = btn.parentElement;
    Array.from(parent.children).forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
};

window.performSaveAs = () => {
    const newName = document.getElementById('save-name').value.trim();
    if(!newName) { showToast("Enter a name"); return; }
    if (newName.length > 25) { showToast("Name too long"); return; }
    if (!/^[a-zA-Z0-9.\-#\[\]><\+\)\( ]+$/.test(newName)) { showToast("Invalid characters"); return; }

    const targetCat = selectedSaveCat;

    // Check Capacity
    if (userCustomDrills[targetCat].length >= 20) { 
        showToast("That bank is full (Max 20)!"); 
        return; 
    }

    const catChar = targetCat.split('-')[1].toUpperCase(); 
    const newKey = `cust_${catChar}_${newName.replace(/\s+/g, '_')}_${Date.now()}`;

    // Add to User Custom List
    userCustomDrills[targetCat].push({ name: newName, key: newKey });

    // Prepare Data
    let baseDrill = currentDrills[editingDrillKey] || { 1: [], 2: [], 3: [] }; 
    const newDrillData = JSON.parse(JSON.stringify(baseDrill));
    newDrillData[selectedLevel] = tempDrillData;
    
    const chk = document.getElementById('chk-drill-random');
    if (chk) newDrillData.random = chk.checked;

    // Save and Persist
    currentDrills[newKey] = newDrillData;
    saveDrillsToStorage(); 
    localStorage.setItem('custom_data', JSON.stringify(userCustomDrills));

    // Cleanup and Switch
    window.closeSaveAsModal();
    closeEditor();
    openEditor(newKey);
    
    // Update main buttons
    document.dispatchEvent(new CustomEvent('drills-updated'));
    
    // Switch main UI tab to where we just saved
    const tabBtn = document.querySelector(`.tab-btn[onclick*="${targetCat}"]`);
    if (tabBtn) switchTab(targetCat, tabBtn);
    
    showToast(`Saved to ${catChar}`);
};

// --- DELETE & RENAME ---

window.handleDeleteDrill = () => {
    if (!editingDrillKey || !editingDrillKey.startsWith('cust_')) return;
    if (!confirm("Delete this drill?")) return;

    const parts = editingDrillKey.split('_');
    const catKey = `custom-${parts[1].toLowerCase()}`;
    if (userCustomDrills[catKey]) {
        userCustomDrills[catKey] = userCustomDrills[catKey].filter(d => d.key !== editingDrillKey);
    }

    delete currentDrills[editingDrillKey];
    saveDrillsToStorage();
    localStorage.setItem('custom_data', JSON.stringify(userCustomDrills));

    closeEditor();
    showToast("Drill Deleted");
    document.dispatchEvent(new CustomEvent('drills-updated'));
};

window.handleRenameDrill = () => {
    if (!editingDrillKey || !editingDrillKey.startsWith('cust_')) return;
    const titleEl = document.querySelector('.modal-title');
    handleRename(titleEl);
};

function handleRename(titleEl) {
    const currentName = titleEl.textContent.replace(' ✎', '');
    const newName = prompt("Rename Drill:", currentName);
    if (!newName || newName === currentName) return;
    if (newName.length > 25) { showToast("Name too long"); return; }

    const parts = editingDrillKey.split('_'); 
    const catChar = parts[1]; 
    const catListKey = `custom-${catChar.toLowerCase()}`;
    
    const newKey = `cust_${catChar}_${newName.replace(/\s+/g, '_')}_${Date.now()}`;
    
    const list = userCustomDrills[catListKey];
    const entry = list.find(d => d.key === editingDrillKey);
    
    if (entry) {
        entry.name = newName;
        entry.key = newKey;
        currentDrills[newKey] = currentDrills[editingDrillKey];
        delete currentDrills[editingDrillKey];

        editingDrillKey = newKey;
        localStorage.setItem('custom_data', JSON.stringify(userCustomDrills)); 
        saveDrillsToStorage(); 
        updateTitleDisplay(titleEl, newKey);
        showToast("Renamed");
        document.dispatchEvent(new CustomEvent('drills-updated'));
    }
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
    el.innerHTML = displayName + (key.startsWith('cust_') ? ' <span style="opacity:0.5;font-size:0.8em">✎</span>' : '');
    if(key.startsWith('cust_')) el.onclick = () => window.handleRenameDrill();
}

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
        
        // Clone for safety to not mutate editor data with RND logic
        const chosen = stepOptions[0]; // Take first option for test
        const d = [...chosen];

        // RND Logic for Test Combo? 
        // Usually static test is preferred, but let's apply RND logic for realism if active
        if (d[10] === true) {
            const currentDrop = d[3];
            const limit = Math.abs(currentDrop);
            if(limit > 0) {
                 const totalSteps = (limit * 2) / 0.5;
                 const randomStep = Math.floor(Math.random() * (totalSteps + 1));
                 d[3] = -limit + (randomStep * 0.5);
            }
        }

        balls.push(packBall(d[0], d[1], d[2], d[3], d[4], 1));
    });
    if (balls.length === 0) { showToast("No active balls"); return; }
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

window.handleShareDrill = async () => {
    if (!editingDrillKey || !tempDrillData) return;

    let drillName = "Shared Drill";
    const titleEl = document.querySelector('.modal-title');
    if(titleEl) drillName = titleEl.textContent.replace(' ✎', '');

    const payload = {
        name: drillName,
        level: selectedLevel,
        params: tempDrillData,
        random: document.getElementById('chk-drill-random')?.checked || false
    };

    const btn = document.querySelector('.btn-header-share');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span style="font-size:10px">...</span>'; 
    btn.disabled = true;

    try {
        const code = await uploadDrill(payload);
        
        // UX: Auto-copy + Alert
        if (navigator.clipboard && navigator.clipboard.writeText) {
             await navigator.clipboard.writeText(code);
             alert(`Drill Shared Successfully!\n\nCode: ${code}\n\n(Copied to clipboard)`);
        } else {
             prompt("Drill Shared! Copy this code:", code);
        }

    } catch (e) {
        console.error("Share Error:", e);
        showToast("Share failed. Check network.");
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};