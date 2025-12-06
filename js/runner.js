import { currentDrills, selectedLevel, runMode, appStats } from './state.js';
import { sendPacket, packBall, bleState } from './bluetooth.js';
import { log, showToast } from './utils.js';
import { updateStatsUI } from './ui.js';

let isRunning = false;
let isPaused = false;
let currentCount = 0;
let targetCount = 0;
let remainingTime = 0;

// Timers
let pauseTimer = null;
let countdownTimer = null;
let runTimer = null;

let activeDrillParams = null;
let activeDrillRandom = false;

// UI Elements (Cached for performance)
const ui = {
    overlay: document.getElementById('run-overlay'),
    display: document.getElementById('run-display'),
    label: document.getElementById('run-label'),
    progress: document.getElementById('run-progress'),
    btnPause: document.getElementById('btn-pause')
};

export function startDrillSequence(drillName) {
    const params = currentDrills[drillName] ? currentDrills[drillName][selectedLevel] : null;
    if(!params) {
         log("Drill data not found: " + drillName);
         return;
    }
    
    activeDrillParams = params;
    activeDrillRandom = !!currentDrills[drillName].random;
    
    ui.overlay.classList.add('open');
    
    // Countdown Animation
    let count = 4;
    ui.display.textContent = count;
    ui.label.textContent = "GET READY";
    ui.btnPause.style.display = 'none';
    
    ui.progress.style.transition = 'none';
    ui.progress.style.strokeDashoffset = '0';
    void ui.progress.offsetWidth; // Force Reflow
    
    requestAnimationFrame(() => {
        ui.progress.style.transition = 'stroke-dashoffset 4s linear';
        ui.progress.style.strokeDashoffset = '565'; 
    });

    countdownTimer = setInterval(() => {
        count--;
        if (count > 0) {
            ui.display.textContent = count;
        } else {
            clearInterval(countdownTimer);
            ui.display.textContent = "GO!";
            setTimeout(beginDrillExecution, 800);
        }
    }, 1000);
}

export function beginDrillExecution() {
    isRunning = true;
    isPaused = false;
    
    ui.btnPause.style.display = 'block';
    ui.btnPause.textContent = "PAUSE";
    ui.btnPause.classList.remove('pulse-anim');
    ui.label.textContent = "REMAINING";

    ui.progress.style.transition = 'none';
    ui.progress.style.strokeDashoffset = '0';

    if (runMode === 'time') {
        const tVal = document.getElementById('input-time').value;
        remainingTime = parseInt(tVal);
        ui.display.textContent = formatTime(remainingTime);
        
        requestAnimationFrame(() => {
             if(isRunning && !isPaused) {
                 ui.progress.style.transition = `stroke-dashoffset ${remainingTime}s linear`;
                 ui.progress.style.strokeDashoffset = '565';
             }
        });

        runTimer = setInterval(() => {
            if (!isPaused) {
                remainingTime--;
                ui.display.textContent = formatTime(remainingTime);
                if (remainingTime <= 0) stopRun();
            }
        }, 1000);
    } else {
        targetCount = parseInt(document.getElementById('input-reps').value) || 1;
        currentCount = 0;
        ui.display.textContent = targetCount;
        ui.progress.style.transition = 'stroke-dashoffset 0.5s ease';
    }
    
    runIteration();
}

async function runIteration() {
    if(!isRunning || isPaused) return;

    if (runMode === 'reps') {
        const remaining = targetCount - currentCount;
        ui.display.textContent = remaining;
        
        const fractionCompleted = currentCount / targetCount;
        ui.progress.style.strokeDashoffset = 565 * fractionCompleted;
        currentCount++;
    }

    // Sequence Building
    let sequence = activeDrillParams; 
    if (activeDrillRandom) {
        // Simple Fisher-Yates shuffle for randomization
        sequence = [...activeDrillParams]; 
        for (let i = sequence.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
        }
    }

    // Prepare Packets
    const balls = [];
    sequence.forEach((stepOptions, i) => {
        const chosenOption = stepOptions[Math.floor(Math.random() * stepOptions.length)];
        // chosenOption structure: [top, bot, hgt, drp, frq, rep]
        log(`TX Ball ${i+1}: ${chosenOption.join(' ')}`);
        balls.push(packBall(...chosenOption));
    });

    // Update Stats
    appStats.balls += balls.length;
    appStats.drills += 1;
    localStorage.setItem('nova_stats', JSON.stringify(appStats));
    updateStatsUI();

    // Send Bluetooth Packet
    const packet = buildPacket(balls);
    await sendPacket(packet);
}

// Callback from bluetooth.js when robot finishes
export function handleDone() {
    if(!isRunning) return;
    
    if (runMode === 'reps' && currentCount >= targetCount) {
        stopRun();
        return;
    }
    
    const pause = parseInt(document.getElementById('input-pause').value);
    if (!isPaused) {
         pauseTimer = setTimeout(() => { 
             if(isRunning && !isPaused) runIteration(); 
         }, pause);
    }
}

export function togglePause() {
    if (isPaused) {
        isPaused = false;
        ui.btnPause.textContent = "PAUSE";
        ui.btnPause.classList.remove('pulse-anim');
        
        if(runMode === 'time') {
             ui.progress.style.transition = `stroke-dashoffset ${remainingTime}s linear`;
             ui.progress.style.strokeDashoffset = '565';
        }
        runIteration(); 
    } else {
        isPaused = true;
        ui.btnPause.textContent = "RESUME";
        ui.btnPause.classList.add('pulse-anim');
        clearTimeout(pauseTimer);
        
        // Freeze CSS Animation
        const computedStyle = window.getComputedStyle(ui.progress);
        const currentOffset = computedStyle.getPropertyValue('stroke-dashoffset');
        ui.progress.style.transition = 'none';
        ui.progress.style.strokeDashoffset = currentOffset;
        
        // Command robot to stop
        sendPacket([0x80,1,0,1]); 
    }
}

export function stopRun() {
    isRunning = false;
    isPaused = false;
    clearInterval(countdownTimer);
    clearInterval(runTimer);
    clearTimeout(pauseTimer);
    
    ui.overlay.classList.remove('open');
    document.querySelectorAll('.btn-drill').forEach(b => b.classList.remove('running'));
    
    sendPacket([0x80,1,0,1]); // Stop command
    log("Drill Stopped");
}

function formatTime(s) {
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
}

function buildPacket(balls) {
    const b = new ArrayBuffer(7 + balls.length*24);
    const v = new DataView(b);
    v.setUint8(0, 0x81); v.setUint16(1, 4+balls.length*24, true);
    v.setUint8(3, 1); v.setUint16(4, 1, true); v.setUint8(6, 0);
    const u = new Uint8Array(b);
    let off = 7;
    balls.forEach(ba => { u.set(ba, off); off+=24; });
    return u;
}