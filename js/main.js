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
    const btnConnect = document.getElementById('btn-connect');
    if (btnConnect) {
        btnConnect.onclick = () => {
            if (bleState.isConnected) disconnectDevice();
            else connectDevice();
        };
    }

    const inputPause = document.getElementById('input-pause');
    if (inputPause) {
        inputPause.onchange = (e) => {
            // Updated Logic: Seconds (0.0 - 5.0) with 0.1 step
            let val = parseFloat(e.target.value);
            if(isNaN(val)) val = 1.0;
            
            // Allow down to 0, max 5
            if(val < 0) val = 0; 
            if(val > 5.0) val = 5.0;
            
            e.target.value = val.toFixed(1);
        };
    }

    document.addEventListener('click', (e) => {
        const menu = document.getElementById('theme-menu');
        if (menu && menu.classList.contains('open') && 
            !menu.contains(e.target) && 
            !e.target.closest('.menu-btn')) {
            menu.classList.remove('open');
        }
    });

    document.addEventListener('drills-updated', () => {
        renderDrillButtons();
        updateDrillButtonStates();
    });
    
    // --- ADDED: Listen for stats reset ---
    document.addEventListener('stats-updated', () => {
        updateStatsUI();
    });
    
    document.addEventListener('connection-changed', () => {
        updateDrillButtonStates();
        const editorModal = document.getElementById('editor-modal');
        if(editorModal && editorModal.classList.contains('open')) {
            const testBtns = document.querySelectorAll('.btn-act-test');
            testBtns.forEach(b => b.disabled = !bleState.isConnected);
        }
    });
}

// --- Window Binding for HTML Compatibility ---

window.toggleMenu = toggleMenu;
window.setTheme = setTheme;
window.switchTab = switchTab;

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

window.openEditor = openEditor;
window.closeEditor = closeEditor;
window.saveDrillChanges = saveDrillChanges;
window.togglePause = togglePause;
window.stopRun = stopRun;

window.handleDrillClick = (key, btn) => {
    if (!bleState.isConnected) {
        showToast("Device not connected");
        return;
    }
    document.querySelectorAll('.btn-drill').forEach(b => b.classList.remove('running'));
    btn.classList.add('running');
    startDrillSequence(key);
};

// --- DOWNLOAD MODAL LOGIC (New) ---

let selectedDownloadCat = 'custom-a';

// 1. Open the Modal
window.handleDownloadDialog = () => {
    // Close main menu if open
    const menu = document.getElementById('theme-menu');
    if(menu) menu.classList.remove('open');

    // Reset State
    selectedDownloadCat = 'custom-a';
    const codeInput = document.getElementById('dl-code');
    if (codeInput) codeInput.value = '';
    
    // Reset Switch UI to default (A)
    const switchEl = document.getElementById('dl-cat-switch');
    if(switchEl) {
        Array.from(switchEl.children).forEach(c => c.classList.remove('active'));
        if(switchEl.children[0]) switchEl.children[0].classList.add('active'); 
    }

    const modal = document.getElementById('download-modal');
    if(modal) {
        modal.classList.add('open');
        setTimeout(() => { if(codeInput) codeInput.focus(); }, 100);
    }
};

// 2. Close the Modal
window.closeDownloadModal = () => {
    const modal = document.getElementById('download-modal');
    if(modal) modal.classList.remove('open');
};

// 3. Handle Tab Switching inside Modal
window.selectDlCategory = (val, btn) => {
    selectedDownloadCat = val;
    if(btn && btn.parentElement) {
        Array.from(btn.parentElement.children).forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
    }
};

// 4. Perform Download
window.performDownload = async () => {
    const codeInput = document.getElementById('dl-code');
    if(!codeInput) return;
    
    const code = codeInput.value.trim().toUpperCase();

    if (code.length !== 6) {
        showToast("Invalid code (Must be 6 chars)");
        return;
    }

    // Check capacity before calling server
    if (userCustomDrills[selectedDownloadCat].length >= 100) {
        const catChar = selectedDownloadCat.split('-')[1].toUpperCase();
        showToast(`Bank ${catChar} is full!`);
        return;
    }

    showToast("Searching...");

    try {
        const data = await downloadDrill(code);
        if (!data) {
            showToast("Code not found");
            return;
        }

        let name = data.name;
        // Check for duplicates in the specific target category
        const existingNames = userCustomDrills[selectedDownloadCat].map(d => d.name);
        if (existingNames.includes(name)) {
            name = `${name} (Imp)`;
        }

        // Unique Key Generation
        const catChar = selectedDownloadCat.split('-')[1].toUpperCase();
        const newKey = `cust_${catChar}_${name.replace(/\s+/g, '_')}_${Date.now()}`;

        // Save Data
        userCustomDrills[selectedDownloadCat].push({ name: name, key: newKey });
        
        const newDrillObj = { 1: [], 2: [], 3: [], random: data.random };
        newDrillObj[selectedLevel] = data.params; 
        currentDrills[newKey] = newDrillObj;

        localStorage.setItem('custom_data', JSON.stringify(userCustomDrills));
        saveDrillsToStorage();

        // UI Refresh
        renderDrillButtons();
        window.closeDownloadModal();
        
        // Auto-switch to the target tab
        const tabBtn = document.querySelector(`.tab-btn[onclick*="${selectedDownloadCat}"]`);
        if (tabBtn) switchTab(selectedDownloadCat, tabBtn);

        showToast(`Imported to ${catChar}`);
        toggleMenu(); // Close main menu if it was open behind modal

    } catch (e) {
        console.error(e);
        showToast("Download Error");
    }
};