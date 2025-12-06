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
    appStats 
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
    // showToast was removed from here because it's not exported by ui.js
} from './ui.js';

// --- NEW IMPORT LINE ---
import { showToast } from './utils.js';

import { 
    startDrillSequence, 
    stopRun, 
    togglePause 
} from './runner.js';

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize State (Load localStorage)
    initData();

    // 2. Initialize UI (Render buttons, apply theme, update stats)
    renderDrillButtons();
    updateStatsUI();
    
    // 3. Attach Static Event Listeners
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