import { DEFAULT_DRILLS, RPM_MIN, RPM_MAX, SPIN_LIMITS } from './constants.js';
import { showToast } from './utils.js';

export let currentDrills = {};
export let userCustomDrills = { "custom-a": [], "custom-b": [], "custom-c": [] };
export let selectedLevel = 1;
export let runMode = "reps";
export let appStats = { balls: 0, drills: 0 };

export function initData() {
    const savedTheme = localStorage.getItem('nova_theme_pref');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
    const savedStats = localStorage.getItem('nova_stats');
    if (savedStats) { try { appStats = JSON.parse(savedStats); } catch(e){} }

    const savedDrills = localStorage.getItem('custom_drills');
    const userDefaults = localStorage.getItem('user_defaults');
    const customData = localStorage.getItem('custom_data');

    currentDrills = savedDrills ? JSON.parse(savedDrills) : 
                   (userDefaults ? JSON.parse(userDefaults) : JSON.parse(JSON.stringify(DEFAULT_DRILLS)));
    if (customData) userCustomDrills = JSON.parse(customData);
    normalizeDrills();
}

function normalizeDrills() {
    for (let key in currentDrills) {
        if(key === 'random') continue; 
        for (let lvl = 1; lvl <= 3; lvl++) {
            if (currentDrills[key] && currentDrills[key][lvl]) {
                const steps = currentDrills[key][lvl];
                currentDrills[key][lvl] = steps.map(step => {
                    if (step.length > 0 && typeof step[0] === 'number') return [step];
                    return step;
                });
            }
        }
    }
}

export function setLevel(lvl) { selectedLevel = lvl; }
export function setMode(mode) { runMode = mode; }
export function saveDrillsToStorage() { localStorage.setItem('custom_drills', JSON.stringify(currentDrills)); }
export function saveAsDefault() {
    if(confirm("Save current settings as your new personal default?")) {
        localStorage.setItem('user_defaults', JSON.stringify(currentDrills));
        showToast("Saved as Default");
    }
}
export function resetToDefault() {
    const hasUserDefault = localStorage.getItem('user_defaults');
    if(confirm(hasUserDefault ? "Restore saved defaults?" : "Restore factory settings?")) {
        currentDrills = hasUserDefault ? JSON.parse(hasUserDefault) : JSON.parse(JSON.stringify(DEFAULT_DRILLS));
        normalizeDrills();
        localStorage.setItem('custom_drills', JSON.stringify(currentDrills));
        showToast("Restored");
        document.dispatchEvent(new CustomEvent('drills-updated'));
    }
}
export function factoryReset() {
    if(confirm("WARNING: Delete ALL saved data and return to original factory state?")) {
        localStorage.clear();
        location.reload();
    }
}
export function resetStats() {
    if(confirm("Reset stats?")) {
        appStats.balls = 0; appStats.drills = 0;
        localStorage.setItem('nova_stats', JSON.stringify(appStats));
        showToast("Statistics Reset");
        document.dispatchEvent(new CustomEvent('stats-updated'));
    }
}

function calculateRPMs(speed, spin, type) {
    const baseSpeed = 970 + (630.5 * speed);
    const spinFactor = 342 * spin;
    let top, bot;
    if (type === 'top') { top = baseSpeed + spinFactor; bot = baseSpeed - spinFactor; } 
    else { top = baseSpeed - spinFactor; bot = baseSpeed + spinFactor; }
    return { top: Math.max(RPM_MIN, Math.min(RPM_MAX, Math.round(top))), bot: Math.max(RPM_MIN, Math.min(RPM_MAX, Math.round(bot))) };
}

function reverseCalculate(top, bot) {
    const type = top >= bot ? 'top' : 'back';
    const baseSpeed = (top + bot) / 2;
    const speedRaw = (baseSpeed - 970) / 630.5;
    const diff = Math.abs(top - bot) / 2;
    const spinRaw = diff / 342;
    return { speed: Math.round(speedRaw * 2) / 2, spin: Math.round(spinRaw * 2) / 2, type: type };
}

export function importCustomDrills(csvText) {
    try {
        const lines = csvText.split(/\r?\n/);
        const newCustomData = { "custom-a": [], "custom-b": [], "custom-c": [] };
        const builder = {}; 
        for (let cat in userCustomDrills) {
            userCustomDrills[cat].forEach(drill => { if (currentDrills[drill.key]) delete currentDrills[drill.key]; });
        }
        const getCat = (val) => {
            val = val.trim().toUpperCase();
            if(val === 'A') return 'custom-a';
            if(val === 'B') return 'custom-b';
            if(val === 'C') return 'custom-c';
            return null;
        };

        lines.forEach((line, index) => {
            if (!line.trim() || (index === 0 && line.toLowerCase().includes('speed;spin'))) return;
            const parts = line.split(line.includes(';') ? ';' : ',');
            if (parts.length < 10) return;

            const catCode = parts[0].trim();
            const ballNum = parseFloat(parts[1]); 
            const name = parts[2].trim().substring(0, 32);
            const category = getCat(catCode);
            if (!category) return;

            const speed = parseFloat(parts[3]);
            let spin = parseFloat(parts[4]);
            const type = parts[5].trim().toLowerCase(); 

            // --- STRICT IMPORT LIMITS ---
            const maxAllowed = SPIN_LIMITS[speed.toString()] ?? 10;
            if (spin > maxAllowed) spin = maxAllowed;

            const height = parseInt(parts[6]);
            const drop = parseFloat(parts[7]);
            const freq = parseInt(parts[8]);
            const reps = parseInt(parts[9]);

            const motors = calculateRPMs(speed, spin, type);
            const params = [motors.top, motors.bot, height, drop, freq, reps, 1, speed, spin, type];
            const key = `cust_${catCode}_${name.replace(/\s+/g, '_')}`;

            if (!builder[key]) {
                let exists = newCustomData[category].find(d => d.key === key);
                if (!exists && newCustomData[category].length < 20) newCustomData[category].push({ name: name, key: key });
                builder[key] = { 1: {}, 2: {}, 3: {} }; 
            }
            for(let lvl=1; lvl<=3; lvl++) {
                if (!builder[key][lvl][ballNum]) builder[key][lvl][ballNum] = [];
                builder[key][lvl][ballNum].push(params);
            }
        });

        for (let key in builder) {
            currentDrills[key] = {};
            for(let lvl=1; lvl<=3; lvl++) {
                const sortedBalls = Object.keys(builder[key][lvl]).sort((a,b) => parseFloat(a)-parseFloat(b));
                currentDrills[key][lvl] = sortedBalls.map(bKey => builder[key][lvl][bKey]);
            }
        }
        userCustomDrills = newCustomData;
        localStorage.setItem('custom_data', JSON.stringify(userCustomDrills));
        saveDrillsToStorage();
        showToast("Imported Successfully");
        return true;
    } catch(e) { console.error(e); showToast("Import Failed"); return false; }
}

export function exportCustomDrills() {
    let csvContent = "Set;Ball;Name;Speed;Spin;Type;Height;Drop;Freq;Reps\n";
    const cats = { 'custom-a': 'A', 'custom-b': 'B', 'custom-c': 'C' };
    
    for (let catKey in cats) {
        const setLabel = cats[catKey];
        const drillList = userCustomDrills[catKey];
        if(drillList && drillList.length > 0) {
            drillList.forEach(drill => {
                const sequence = currentDrills[drill.key] ? currentDrills[drill.key][1] : null; 
                if (sequence) {
                    sequence.forEach((stepOptions, stepIndex) => {
                         const ballNum = stepIndex + 1;
                         stepOptions.forEach(ball => {
                             let speed = ball[7], spin = ball[8], type = ball[9];
                             if (speed === undefined) {
                                 const rev = reverseCalculate(ball[0], ball[1]);
                                 speed = rev.speed; spin = rev.spin; type = rev.type;
                             }
                             const row = [setLabel, ballNum, drill.name, speed, spin, type, ball[2], ball[3], ball[4], ball[5]].join(";");
                             csvContent += row + "\n";
                         });
                    });
                }
            });
        }
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "nova_drills_v2.csv";
    link.click();
}