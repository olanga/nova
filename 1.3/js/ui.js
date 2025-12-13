import { CATEGORIES } from './constants.js';
import { currentDrills, userCustomDrills, appStats } from './state.js';
import { bleState } from './bluetooth.js';
import { showToast } from './utils.js';
import { openEditor } from './editor.js';

export function renderDrillButtons() {
    // Render Basic, Combined, Complex
    ['basic', 'combined', 'complex'].forEach(cat => {
        const container = document.getElementById(`view-${cat}`);
        if (!container) return;
        container.innerHTML = '';
        
        CATEGORIES[cat].forEach(key => {
            if (!currentDrills[key]) return; // Safety check
            createButton(container, key, formatDrillName(key));
        });
    });

    // Render Custom
    ['custom-a', 'custom-b', 'custom-c'].forEach(cat => {
        const container = document.getElementById(`view-${cat}`);
        if (!container) return;
        container.innerHTML = '';
        if (userCustomDrills[cat].length === 0) {
            container.innerHTML = '<div style="grid-column:span 2; text-align:center; color:#999; padding:20px; font-size:0.8rem;">No drills imported.<br>Use Settings > Import CSV</div>';
        } else {
            userCustomDrills[cat].forEach(item => {
                createButton(container, item.key, item.name);
            });
        }
    });
}

function createButton(container, key, label) {
    const btn = document.createElement('button');
    btn.className = 'btn-drill';
    btn.dataset.key = key;
    
    const iconDiv = document.createElement('div');
    iconDiv.className = 'drill-icon';
    for(let i=0; i<4; i++) {
        iconDiv.appendChild(document.createElement('div')).className = 'd-dot';
    }
    btn.appendChild(iconDiv);

    if (currentDrills[key] && currentDrills[key].random) {
        const rMark = document.createElement('div');
        rMark.className = 'mark-random';
        rMark.textContent = 'R';
        btn.appendChild(rMark);
    }
    
    const span = document.createElement('span');
    span.textContent = label;
    btn.appendChild(span);
    
    // Interactions
    btn.onclick = () => window.handleDrillClick(key, btn);

    // Long Press for Editor
    let pressTimer;
    let longPressHandled = false;
    const start = () => {
        if(btn.classList.contains('running')) return;
        longPressHandled = false;
        pressTimer = setTimeout(() => {
            longPressHandled = true;
            openEditor(key);
        }, 600);
    };
    const end = () => clearTimeout(pressTimer);
    
    btn.onmousedown = start;
    btn.ontouchstart = start;
    btn.onmouseup = end;
    btn.onmouseleave = end;
    btn.ontouchend = end;

    container.appendChild(btn);
}

export function updateDrillButtonStates() {
    const btns = document.querySelectorAll('.btn-drill');
    btns.forEach(b => {
         b.style.opacity = bleState.isConnected ? "1" : "0.6"; 
    });
    
    const btnConnect = document.getElementById('btn-connect');
    const statusText = document.getElementById('status-text');
    
    if (bleState.isConnected) {
        btnConnect.textContent = "Disconnect";
        btnConnect.classList.add('connected');
        statusText.textContent = "Connected";
        statusText.style.color = "#00b894";
    } else {
        btnConnect.textContent = "Connect";
        btnConnect.classList.remove('connected');
        statusText.textContent = "Disconnected";
        statusText.style.color = "var(--text-light)";
    }
}

export function updateStatsUI() {
    const el = document.getElementById('stats-display');
    if(el) el.textContent = `Balls: ${appStats.balls} | Drills: ${appStats.drills}`;
}

export function toggleMenu() {
    document.getElementById('theme-menu').classList.toggle('open');
}

export function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('nova_theme_pref', themeName);
    toggleMenu();
}

export function switchTab(catName, btn) {
    const tabs = ['basic','combined','complex','custom-a','custom-b','custom-c'];
    tabs.forEach(c => {
        const el = document.getElementById('view-'+c);
        if(el) el.classList.add('hidden');
    });
    document.getElementById('view-' + catName).classList.remove('hidden');
    
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    if(btn) btn.classList.add('active');

    const diffGroup = document.getElementById('grp-difficulty');
    if(diffGroup) {
        diffGroup.style.display = ['custom-a', 'custom-b', 'custom-c'].includes(catName) ? 'none' : 'flex';
    }
}

function formatDrillName(key) {
    if (key.startsWith('cust_')) return key; 
    return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}