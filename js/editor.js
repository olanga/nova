import { currentDrills, userCustomDrills, selectedLevel, saveDrillsToStorage } from './state.js';
import { SPIN_LIMITS, RPM_MIN, RPM_MAX } from './constants.js';
import { sendPacket, packBall, bleState } from './bluetooth.js';
import { showToast, clamp, toggleBodyScroll } from './utils.js';
import { uploadDrill } from './cloud.js';

// --- Local State ---
let tempDrillData = null;
let editingDrillKey = null;
let selectedSaveCat = 'custom-a'; 

// --- Public Module Functions ---

export function openEditor(key) {
    editingDrillKey = key;
    updateTitleDisplay(key);

    const chk = document.getElementById('chk-drill-random');
    if (chk) chk.checked = !!(currentDrills[key] && currentDrills[key].random);

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
    toggleBodyScroll(true);
}

export function closeEditor() {
    document.getElementById('editor-modal').classList.remove('open');
    editingDrillKey = null;
    tempDrillData = null;
    toggleBodyScroll(false);
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
            
            // Validate Scatter (Index 10) on save
            const currentDrop = Math.abs(ball[3]);
            const scatter = ball[10] || 0;
            if (currentDrop + scatter > 10) {
                ball[10] = clamp(10 - currentDrop, 0, 10);
            }
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
    
    // Hide "Shuffle balls" toggle if drill has only 1 step
    const shuffleContainer = document.querySelector('.random-toggle-container');
    if (shuffleContainer) {
        shuffleContainer.style.display = (tempDrillData && tempDrillData.length > 1) ? 'flex' : 'none';
    }

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
        
        // --- SCATTER LOGIC ---
        const currentDrop = stepOptions[0][3];
        const currentScatter = stepOptions[0][10] || 0; 
        const maxScatter = 10 - Math.abs(currentDrop); 

        const scatterHtml = isSingle ? `
            <div style="display:flex; align-items:center; gap:5px; margin-left:auto; margin-right:10px;">
                <div class="editor-field" style="flex-direction:row; align-items:center; gap:6px; padding:2px 6px; background:var(--bg); border:1px solid var(--border);">
                    <label style="font-size:0.6rem; color:var(--text-light); font-weight:800; text-transform:uppercase;">Scatter</label>
                    <input type="number" inputmode="decimal" 
                           value="${currentScatter}" 
                           step="0.5" min="0" max="${maxScatter}"
                           style="width:40px; text-align:center; font-weight:bold; color:var(--primary); font-size:0.9rem;"
                           onchange="window.handleScatterChange(${stepIndex}, this.value)">
                </div>
            </div>` : '';

        // Duplicate/Next Step Button (Header)
        const plusBtn = `
            <button class="btn-add-opt" title="Duplicate Ball" onclick="window.handleAddSequenceStep(${stepIndex})">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
            </button>`;

        groupDiv.innerHTML = `
            <div class="group-title">
                <div style="display:flex; align-items:center; gap:10px; flex:1;">
                    <span>Ball ${stepIndex + 1}</span>
                    <div class="ball-toggle ${isActive ? 'active' : ''}" onclick="window.handleToggleBallActive(${stepIndex})">
                        <div class="toggle-switch"></div>
                    </div>
                    ${scatterHtml}
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
            
            // BPM Calculation: 30 + (Percent * 0.6)
            const bpmValue = Math.round(30 + (ballParams[4] * 0.6));

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

            // NOTE: 'Drop' uses onchange to prevent re-rendering while typing negative numbers
            const inputsHtml = `
                <div class="editor-grid">
                    <div class="editor-field">
                        <div class="field-header"><label>Speed</label><span class="range-hint">0-10</span></div>
                        <input type="number" inputmode="decimal" id="inp-speed-${stepIndex}-${optIndex}" value="${speed}" step="0.5" min="0" max="10"
                            oninput="window.handleEditorInput(${stepIndex}, ${optIndex}, 7, this.value)">
                    </div>
                    <div class="editor-field">
                        <div class="field-header"><label>Spin</label><span class="range-hint" id="lbl-spin-${stepIndex}-${optIndex}">Max ${currentMaxSpin}</span></div>
                        <input type="number" inputmode="decimal" id="inp-spin-${stepIndex}-${optIndex}" value="${spin}" step="0.5" min="0" max="${currentMaxSpin}"
                            oninput="window.handleEditorInput(${stepIndex}, ${optIndex}, 8, this.value)">
                    </div>
                    <div class="editor-field">
                        <div class="field-header"><label>Height</label><span class="range-hint">-50/100</span></div>
                        <input type="number" inputmode="decimal" value="${ballParams[2]}" step="1" min="-50" max="100"
                            oninput="window.handleEditorInput(${stepIndex}, ${optIndex}, 2, this.value)">
                    </div>
                    <div class="editor-field">
                        <div class="field-header"><label>Drop</label><span class="range-hint">L/R</span></div>
                        <input type="number" inputmode="decimal" value="${ballParams[3]}" step="0.5" min="-10" max="10"
                            onchange="window.handleEditorInput(${stepIndex}, ${optIndex}, 3, this.value)">
                    </div>
                    <div class="editor-field">
                        <div class="field-header"><label>BPM</label><span class="range-hint">30-90</span></div>
                        <input type="number" inputmode="decimal" value="${bpmValue}" step="1" min="30" max="90"
                            oninput="window.handleEditorInput(${stepIndex}, ${optIndex}, 4, this.value)">
                    </div>
                    <div class="editor-field">
                        <div class="field-header"><label>Reps</label><span class="range-hint">#</span></div>
                        <input type="number" inputmode="decimal" value="${ballParams[5]}" step="1" min="1" max="100"
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
                             onclick="window.handleAddVariant(${stepIndex}, ${optIndex})">+ Variant</button>
                     <button class="btn-action btn-act-del" 
                             onclick="window.handleDeleteBall(${stepIndex}, ${optIndex})" 
                             ${isLastBall ? 'disabled' : ''}>Delete</button>
                </div>
            `;
            
            const label = stepOptions.length > 1 ? `<span class="option-label">Variant ${optIndex + 1}</span>` : '';
            optDiv.innerHTML = label + toggleHtml + inputsHtml + actionsHtml;
            groupDiv.appendChild(optDiv);
        });
        modalBody.appendChild(groupDiv);
    });

    // --- NEW: Add Button at Bottom of Sequence ---
    const addZone = document.createElement('div');
    addZone.className = 'swap-zone';
    addZone.style.margin = "-10px 0 20px 0"; 
    addZone.innerHTML = `
        <button class="btn-swap" 
                style="color:var(--primary); border-color:var(--primary); width:32px; height:32px;" 
                onclick="window.handleAddSequenceStep(${tempDrillData.length - 1})" 
                title="Add New Ball">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
        </button>`;
    modalBody.appendChild(addZone);
}

// --- HANDLERS ---

window.handleScatterChange = (stepIdx, value) => {
    if (!tempDrillData) return;
    const ball = tempDrillData[stepIdx][0]; // Scatter applies to the first ball (group level)
    
    let val = parseFloat(value);
    if(isNaN(val)) val = 0;
    
    const currentDrop = Math.abs(ball[3]);
    if (val + currentDrop > 10) {
        val = 10 - currentDrop;
        showToast(`Limit is ${val} for this Drop position`);
    }
    
    ball[10] = clamp(val, 0, 10);
    renderEditor();
};

window.handleEditorInput = (stepIdx, optIdx, paramIdx, value) => {
    if (!tempDrillData) return;
    const ball = tempDrillData[stepIdx][optIdx];
    let val = parseFloat(value);
    if(isNaN(val)) val = 0;

    if (paramIdx === 4) {
        let percent = (val - 30) / 0.6;
        ball[paramIdx] = clamp(percent, 0, 100);
    } 
    else if (paramIdx === 3) {
        val = clamp(val, -10, 10);
        ball[paramIdx] = val;
        
        const currentScatter = ball[10] || 0;
        if (Math.abs(val) + currentScatter > 10) {
            ball[10] = 10 - Math.abs(val);
        }
        renderEditor(); 
        return; 
    } 
    else {
        ball[paramIdx] = val;
    }

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

window.handleAddSequenceStep = (sourceStepIndex) => {
    const fullStepClone = JSON.parse(JSON.stringify(tempDrillData[sourceStepIndex]));
    tempDrillData.splice(sourceStepIndex + 1, 0, fullStepClone);
    renderEditor();
};

window.handleAddVariant = (stepIndex, sourceOptIndex) => {
    const baseConfig = JSON.parse(JSON.stringify(tempDrillData[stepIndex][sourceOptIndex]));
    tempDrillData[stepIndex].push(baseConfig);
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

window.handleSaveAsDrill = () => {
    selectedSaveCat = 'custom-a';
    const nameInput = document.getElementById('save-name');
    if (nameInput) nameInput.value = '';
    
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
    if (newName.length > 40) { showToast("Name too long"); return; }
    if (!/^[a-zA-Z0-9.\-#\[\]><\+\)\( ]+$/.test(newName)) { showToast("Invalid characters"); return; }

    const targetCat = selectedSaveCat;
    if (userCustomDrills[targetCat].length >= 20) { 
        showToast("That bank is full (Max 20)!"); return; 
    }

    const catChar = targetCat.split('-')[1].toUpperCase(); 
    const newKey = `cust_${catChar}_${newName.replace(/\s+/g, '_')}_${Date.now()}`;
    userCustomDrills[targetCat].push({ name: newName, key: newKey });

    let baseDrill = currentDrills[editingDrillKey] || { 1: [], 2: [], 3: [] }; 
    const newDrillData = JSON.parse(JSON.stringify(baseDrill));
    newDrillData[selectedLevel] = tempDrillData;
    
    const chk = document.getElementById('chk-drill-random');
    if (chk) newDrillData.random = chk.checked;

    currentDrills[newKey] = newDrillData;
    saveDrillsToStorage(); 
    localStorage.setItem('custom_data', JSON.stringify(userCustomDrills));

    window.closeSaveAsModal();
    closeEditor();
    openEditor(newKey);
    document.dispatchEvent(new CustomEvent('drills-updated'));
    
    const tabBtn = document.querySelector(`.tab-btn[onclick*="${targetCat}"]`);
    if (tabBtn) switchTab(targetCat, tabBtn);
    showToast(`Saved to ${catChar}`);
};

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
    
    const nameEl = document.getElementById('editor-drill-name');
    const currentName = nameEl ? nameEl.textContent : "New Drill";
    
    const newName = prompt("Rename Drill:", currentName);
    if (!newName || newName === currentName) return;
    if (newName.length > 40) { showToast("Name too long"); return; }

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
        updateTitleDisplay(newKey);
        showToast("Renamed");
        document.dispatchEvent(new CustomEvent('drills-updated'));
    }
};

function updateTitleDisplay(key) {
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
    
    const nameEl = document.getElementById('editor-drill-name');
    const iconEl = document.getElementById('editor-drill-edit-icon');
    const container = document.querySelector('#editor-modal .title-container');

    if(nameEl) nameEl.textContent = displayName;
    
    if(isCustom) {
        if(iconEl) iconEl.style.display = 'inline-block';
        if(container) {
            container.style.pointerEvents = 'auto';
            container.onclick = () => window.handleRenameDrill();
        }
    } else {
        if(iconEl) iconEl.style.display = 'none';
        if(container) {
            container.style.pointerEvents = 'none';
            container.onclick = null;
        }
    }
}

window.handleTestBall = async (stepIdx, optIdx) => {
    if (!bleState.isConnected) { showToast("Device not connected"); return; }
    const d = tempDrillData[stepIdx][optIdx];
    const ballData = packBall(d[0], d[1], d[2], d[3], d[4], 1); 
    const buffer = new ArrayBuffer(31); 
    const view = new DataView(buffer);
    view.setUint8(0, 0x81); view.setUint16(1, 28, true); 
    view.setUint8(3, 1);
    view.setUint16(4, 1, true); 
    view.setUint8(6, 0);
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
        const chosen = stepOptions[0]; 
        const d = [...chosen];
        
        // --- SCATTER LOGIC FOR TEST COMBO ---
        const scatter = d[10] || 0;
        if (scatter > 0) {
            const currentDrop = d[3];
            const minDrop = currentDrop - scatter;
            const maxDrop = currentDrop + scatter;
            const span = maxDrop - minDrop;
            const steps = Math.floor(span / 0.5);
            if (steps > 0) {
                 const randomStep = Math.floor(Math.random() * (steps + 1));
                 d[3] = clamp(minDrop + (randomStep * 0.5), -10, 10);
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
    view.setUint8(3, 1);
    view.setUint16(4, 1, true); 
    view.setUint8(6, 0);
    let offset = 7;
    balls.forEach(b => { uint8.set(b, offset); offset += 24; });
    try { await sendPacket(uint8); showToast("Testing Drill..."); } 
    catch (e) { console.error(e); showToast("Test Failed"); }
};

window.handleShareDrill = async () => {
    if (!editingDrillKey || !tempDrillData) return;
    let drillName = "Shared Drill";
    const nameEl = document.getElementById('editor-drill-name');
    if(nameEl) drillName = nameEl.textContent;

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