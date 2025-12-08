import { 
    initData, 
    setLevel, 
    setMode, 
    resetStats, 
    importCustomDrills, 
    exportCustomDrills, 
    saveAsDefault, 
    resetToDefault, 
    factoryReset,
    appStats,
    userCustomDrills,
    currentDrills,
    saveDrillsToStorage,
    selectedLevel 
} from './state.js';

import { 
    connectDevice, 
    disconnectDevice, 
    bleState 
} from './bluetooth.js';

import { 
    openEditor, 
    closeEditor, 
    saveDrillChanges 
} from './editor.js';

import { 
    renderDrillButtons, 
    updateDrillButtonStates, 
    setTheme, 
    toggleMenu, 
    switchTab, 
    updateStatsUI
} from './ui.js';

import { showToast } from './utils.js';

import { 
    startDrillSequence, 
    stopRun, 
    togglePause 
} from './runner.js';

import { downloadDrill } from './cloud.js';

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    initData();
    renderDrillButtons();
    updateStatsUI();
    setupEventListeners();
    console.log("Nova Drill Control: Modules Loaded");
});

// --- Event Listeners Setup ---

function setupEventListeners() {
    // Connect Button
    const btnConnect = document.getElementById('btn-connect');
    if (btnConnect) {
        btnConnect.onclick = () => {
            if (bleState.isConnected) {
                disconnectDevice();
            } else {
                connectDevice();
            }
        };
    }

    // Input: Pause Time
    const inputPause = document.getElementById('input-pause');
    if (inputPause) {
        inputPause.onchange = (e) => {
            let val = parseInt(e.target.value);
            if(val < 500) val = 500;
            if(val > 5000) val = 5000;
            e.target.value = val;
        };
    }

    // Checkbox: Console Log
    const chkConsole = document.getElementById('chk-console');
    if (chkConsole) {
        chkConsole.onchange = (e) => {
            const logBox = document.getElementById('log');
            if(logBox) logBox.style.display = e.target.checked ? 'block' : 'none';
        };
    }

    // Global: Close Menu on outside click
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('theme-menu');
        if (menu && menu.classList.contains('open') && 
            !menu.contains(e.target) && 
            !e.target.closest('.menu-btn')) {
            menu.classList.remove('open');
        }
    });

    // Global: Listen for State Updates to Refresh UI
    document.addEventListener('drills-updated', () => {
        renderDrillButtons();
        updateDrillButtonStates();
    });
    
    document.addEventListener('connection-changed', () => {
        updateDrillButtonStates();
        // Re-enable/disable editor test buttons if open
        const editorModal = document.getElementById('editor-modal');
        if(editorModal && editorModal.classList.contains('open')) {
            const testBtns = document.querySelectorAll('.btn-act-test');
            testBtns.forEach(b => b.disabled = !bleState.isConnected);
        }
    });
}

// --- Window Binding for HTML Compatibility ---

// 1. UI Actions
window.toggleMenu = toggleMenu;
window.setTheme = setTheme;
window.switchTab = switchTab;

// 2. State/Settings Actions
window.setLevel = (lvl, btn) => {
    setLevel(lvl);
    document.querySelectorAll('.lvl-dot').forEach(d => d.classList.remove('active'));
    if(btn) btn.classList.add('active');
};

window.setMode = (mode, btn) => {
    setMode(mode);
    document.querySelectorAll('.mode-option').forEach(d => d.classList.remove('active'));
    if(btn) btn.classList.add('active');
    
    const uiReps = document.getElementById('ui-reps');
    const uiTime = document.getElementById('ui-time');
    if(mode === 'reps') {
        uiReps?.classList.remove('hidden');
        uiTime?.classList.add('hidden');
    } else {
        uiReps?.classList.add('hidden');
        uiTime?.classList.remove('hidden');
    }
};

window.resetStats = resetStats;
window.saveAsDefault = saveAsDefault;
window.resetToDefault = resetToDefault;
window.factoryReset = factoryReset;
window.exportCustomDrills = exportCustomDrills;

// 3. CSV Import Handler
window.handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { 
        const success = importCustomDrills(e.target.result);
        if(success) {
            renderDrillButtons();
            toggleMenu(); 
        }
    };
    reader.readAsText(file);
    event.target.value = '';
};

// 4. Editor Actions
window.openEditor = openEditor;
window.closeEditor = closeEditor;
window.saveDrillChanges = saveDrillChanges;

// 5. Runner Actions (Run Overlay)
window.togglePause = togglePause;
window.stopRun = stopRun;

// --- Helper: Drill Interaction Glue ---
window.handleDrillClick = (key, btn) => {
    if (!bleState.isConnected) {
        showToast("Device not connected");
        return;
    }

    document.querySelectorAll('.btn-drill').forEach(b => b.classList.remove('running'));
    btn.classList.add('running');

    startDrillSequence(key);
};

// --- NEW HANDLER: Download Dialog ---
window.handleDownloadDialog = async () => {
    // Prompt for the 3-letter + 3-digit code
    const code = prompt("Enter Share Code (e.g. ABC123):");
    
    // Basic validation
    if (!code || code.trim().length !== 6) {
        if(code) showToast("Invalid code format");
        return;
    }

    showToast("Searching...");

    try {
        const data = await downloadDrill(code);
        
        if (!data) {
            showToast("Code not found or expired");
            return;
        }

        // 1. Handle Naming (Avoid duplicates)
        let name = data.name;
        // Check if name exists in any custom category
        const allNames = [
            ...userCustomDrills['custom-a'], 
            ...userCustomDrills['custom-b'], 
            ...userCustomDrills['custom-c']
        ].map(d => d.name);

        if (allNames.includes(name)) {
            name = `${name} (Imp)`;
        }

        // 2. Find Available Slot (A -> B -> C)
        let targetCat = 'custom-a';
        if (userCustomDrills['custom-a'].length >= 20) {
            if (userCustomDrills['custom-b'].length < 20) targetCat = 'custom-b';
            else if (userCustomDrills['custom-c'].length < 20) targetCat = 'custom-c';
            else { showToast("All custom banks full!"); return; }
        }

        // 3. Save Data
        const catChar = targetCat.split('-')[1].toUpperCase();
        // Construct safe key
        const newKey = `cust_${catChar}_${name.replace(/\s+/g, '_')}`;

        // Add to registry list
        userCustomDrills[targetCat].push({ name: name, key: newKey });
        
        // Reconstruct drill object
        // Since we only export the *active* data, we place it into the *current* level
        // or default to Level 1 if you prefer. Here we use 'selectedLevel' to match UI context.
        const newDrillObj = { 1: [], 2: [], 3: [], random: data.random };
        newDrillObj[selectedLevel] = data.params; 

        currentDrills[newKey] = newDrillObj;

        // 4. Persist
        localStorage.setItem('custom_data', JSON.stringify(userCustomDrills));
        saveDrillsToStorage();

        // 5. Update UI
        renderDrillButtons();
        showToast(`Imported to Custom ${catChar}`);
        toggleMenu(); 

    } catch (e) {
        console.error(e);
        showToast("Download Error");
    }
};