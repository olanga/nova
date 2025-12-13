import { currentDrills, selectedLevel, runMode, appStats } from './state.js';
import { sendPacket, packBall, bleState } from './bluetooth.js';
import { log, showToast, clamp } from './utils.js';
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
    const rawParams = currentDrills[drillName] ? currentDrills[drillName][selectedLevel] : null;
    if(!rawParams) {
         log("Drill data not found: " + drillName);
         return;
    }

    // --- FILTER INACTIVE STEPS ---
    // A step is active if index 6 is 1 or undefined (defaults to active).
    const executableSteps = rawParams.filter(step => {
        // We check the first option of the step (index 0) for the active flag (index 6)
        const isActive = step[0][6]; 
        return isActive === undefined || isActive === 1;
    });

    // --- STOP IF EMPTY ---
    if (executableSteps.length === 0) {
        showToast("no active balls to play");
        // Ensure visual state is cleared if needed
        document.querySelectorAll('.btn-drill').forEach(b => b.classList.remove('running'));
        return;
    }
    
    // Proceed with only the active steps
    activeDrillParams = executableSteps;
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

    // Sequence Building (using filtered activeDrillParams)
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
        
        // Clone to avoid mutating the original drill data in state
        const tempBall = [...chosenOption];

        // --- RND MODE LOGIC ---
        // Index 10 is the RND flag. Index 3 is Drop (-10 to 10).
        if (tempBall[10] === true) {
            const currentDrop = tempBall[3];
            const limit = Math.abs(currentDrop);
            
            // If limit is 0 (Center), random range is 0 to 0, so do nothing.
            if (limit > 0) {
                // Determine how many 0.5 steps exist in the full range (-limit to +limit)
                // Range Span = limit * 2. 
                // Steps = Span / 0.5
                const totalSteps = (limit * 2) / 0.5;
                
                // Pick a random step index
                const randomStep = Math.floor(Math.random() * (totalSteps + 1));
                
                // Calculate new drop value
                const newDrop = -limit + (randomStep * 0.5);
                
                tempBall[3] = newDrop;
                // Optional debug log
                // log(`RND Active: Range ±${limit}, New Drop: ${newDrop}`);
            }
        }

        log(`TX Ball ${i+1}: ${tempBall.join(' ')}`);
        
        // packBall expects (us, ls, bh, dp, freq, reps) -> indices 0,1,2,3,4,5
        balls.push(packBall(...tempBall));
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
    
    // Convert Seconds to Milliseconds
    const pauseInput = parseFloat(document.getElementById('input-pause').value);
    const pauseMs = (isNaN(pauseInput) ? 1.0 : pauseInput) * 1000;

    if (!isPaused) {
         pauseTimer = setTimeout(() => { 
             if(isRunning && !isPaused) runIteration(); 
         }, pauseMs);
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