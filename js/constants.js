export const SERVICE_UUID = 0xfeff;
export const UUID_S = "02f00000-0000-0000-0000-00000000fe00";
export const UUID_N = "02f00000-0000-0000-0000-00000000ff02";
export const UUID_W = "02f00000-0000-0000-0000-00000000ff01";
export const SALT = "Mjgx1jAwXDBaMFcxCz3JBgNVBAYT4kJF7Rkw";
export const MSG_DONE = "00020300050100";

export const CATEGORIES = {
    basic: ["push(b)", "push(f)", "drive(b)", "drive(f)", "loop(b)", "loop(f)"],
    combined: ["loop(b)-drive(b)", "loop(f)-drive(f)", "drive(f)-drive(b)", "push(f)-drive(f)", "push(b)-loop(b)", "loop(f)-drive(b)", "push(f)-loop(b)", "drive(f)-drive(f)", "push(b)-loop(f)", "push(f)-loop(f)", "loop(f)-loop(f)", "loop(b)-drive(f)"],
    complex: ["push(b)-loop(f)-drive(b)", "push(f)-loop(b)-drive(f)", "loop(f)-drive(f)-drive(b)", "loop(b)-drive(f)-drive(b)", "drive(f)-drive(f)-drive(f)", "push(f)-loop(f)-drive(f)", "push(b)-loop(b)-drive(b)", "push(f)-loop(b)-drive(b)", "loop(f)-drive(b)-drive(f)", "loop(b)-drive(b)-drive(f)", "push(b)-loop(f)-drive(f)", "push(b)-loop(b)-drive(f)", "drive(b)-drive(f)-drive(f)", "random-drive", "23-random-drive", "all-random"],
    "custom-a": [], "custom-b": [], "custom-c": [] 
};

// Editor Range Configuration
export const RANGE_CONFIG = [
    { label: 'Top', class: 'inp-us', min: 400, max: 7500, step: 1, idx: 0 },
    { label: 'Bot', class: 'inp-ls', min: 400, max: 7500, step: 1, idx: 1 },
    { label: 'Hgt', class: 'inp-bh', min: -50, max: 100, step: 1, idx: 2 },
    { label: 'Drp', class: 'inp-dp', min: -10, max: 10, step: 0.5, idx: 3 },
    { label: 'Frq', class: 'inp-fr', min: 0, max: 100, step: 10, idx: 4 },
    { label: 'Rep', class: 'inp-rp', min: 1, max: 200, step: 1, idx: 5 }
];

// Helper to create standard drill steps (prevents huge file size)
// params: [top, bot, hgt, drp, freq, rep, active]
const mkStep = (t, b, h, d, f, r) => [[[t, b, h, d, f, r, 1]]];

// Standard Physics Presets
const PUSH_B = [1547, 2915, 50, -5, 10, 1];
const PUSH_F = [1547, 2915, 50, 5, 10, 1];
const DRIVE_B = [3545, 2177, 50, -5, 40, 1];
const DRIVE_F = [3545, 2177, 50, 5, 40, 1];
const LOOP_B = [1520, 3572, 50, -5, 10, 1];
const LOOP_F = [1520, 3572, 50, 5, 10, 1];

export const DEFAULT_DRILLS = {
    // --- BASIC ---
    "push(b)": { 1: [mkStep(...PUSH_B)], 2: [mkStep(1205, 3257, 50, -5, 20, 1)], 3: [mkStep(863, 3599, 50, -5, 30, 1)] },
    "push(f)": { 1: [mkStep(...PUSH_F)], 2: [mkStep(1205, 3257, 50, 5, 20, 1)], 3: [mkStep(863, 3599, 50, 5, 30, 1)] },
    "drive(b)": { 1: [mkStep(...DRIVE_B)], 2: [mkStep(3545, 2177, 50, -5, 50, 1)], 3: [mkStep(3545, 2177, 50, -5, 70, 1)] },
    "drive(f)": { 1: [mkStep(...DRIVE_F)], 2: [mkStep(3545, 2177, 50, 5, 50, 1)], 3: [mkStep(3545, 2177, 50, 5, 70, 1)] },
    "loop(f)": { 1: [mkStep(...LOOP_F)], 2: [mkStep(1178, 3914, 50, 5, 20, 1)], 3: [mkStep(836, 4256, 50, 5, 30, 1)] },
    "loop(b)": { 1: [mkStep(...LOOP_B)], 2: [mkStep(1178, 3914, 50, -5, 20, 1)], 3: [mkStep(836, 4256, 50, -5, 30, 1)] },

    // --- COMBINED ---
    "loop(b)-drive(b)": { 1: [[LOOP_B],[DRIVE_B]].map(d=>[d]), 2: [[LOOP_B],[DRIVE_B]].map(d=>[d]), 3: [[LOOP_B],[DRIVE_B]].map(d=>[d]) },
    "loop(f)-drive(f)": { 1: [[LOOP_F],[DRIVE_F]].map(d=>[d]), 2: [[LOOP_F],[DRIVE_F]].map(d=>[d]), 3: [[LOOP_F],[DRIVE_F]].map(d=>[d]) },
    "drive(f)-drive(b)": { 1: [[DRIVE_F],[DRIVE_B]].map(d=>[d]), 2: [[DRIVE_F],[DRIVE_B]].map(d=>[d]), 3: [[DRIVE_F],[DRIVE_B]].map(d=>[d]) },
    "push(f)-drive(f)": { 1: [[PUSH_F],[DRIVE_F]].map(d=>[d]), 2: [[PUSH_F],[DRIVE_F]].map(d=>[d]), 3: [[PUSH_F],[DRIVE_F]].map(d=>[d]) },
    "push(b)-loop(b)": { 1: [[PUSH_B],[LOOP_B]].map(d=>[d]), 2: [[PUSH_B],[LOOP_B]].map(d=>[d]), 3: [[PUSH_B],[LOOP_B]].map(d=>[d]) },
    "loop(f)-drive(b)": { 1: [[LOOP_F],[DRIVE_B]].map(d=>[d]), 2: [[LOOP_F],[DRIVE_B]].map(d=>[d]), 3: [[LOOP_F],[DRIVE_B]].map(d=>[d]) },
    "push(f)-loop(b)": { 1: [[PUSH_F],[LOOP_B]].map(d=>[d]), 2: [[PUSH_F],[LOOP_B]].map(d=>[d]), 3: [[PUSH_F],[LOOP_B]].map(d=>[d]) },
    "drive(f)-drive(f)": { 1: [[DRIVE_F],[DRIVE_F]].map(d=>[d]), 2: [[DRIVE_F],[DRIVE_F]].map(d=>[d]), 3: [[DRIVE_F],[DRIVE_F]].map(d=>[d]) },
    "push(b)-loop(f)": { 1: [[PUSH_B],[LOOP_F]].map(d=>[d]), 2: [[PUSH_B],[LOOP_F]].map(d=>[d]), 3: [[PUSH_B],[LOOP_F]].map(d=>[d]) },
    "push(f)-loop(f)": { 1: [[PUSH_F],[LOOP_F]].map(d=>[d]), 2: [[PUSH_F],[LOOP_F]].map(d=>[d]), 3: [[PUSH_F],[LOOP_F]].map(d=>[d]) },
    "loop(f)-loop(f)": { 1: [[LOOP_F],[LOOP_F]].map(d=>[d]), 2: [[LOOP_F],[LOOP_F]].map(d=>[d]), 3: [[LOOP_F],[LOOP_F]].map(d=>[d]) },
    "loop(b)-drive(f)": { 1: [[LOOP_B],[DRIVE_F]].map(d=>[d]), 2: [[LOOP_B],[DRIVE_F]].map(d=>[d]), 3: [[LOOP_B],[DRIVE_F]].map(d=>[d]) },

    // --- COMPLEX ---
    "push(b)-loop(f)-drive(b)": { 1: [[PUSH_B],[LOOP_F],[DRIVE_B]].map(d=>[d]), 2: [[PUSH_B],[LOOP_F],[DRIVE_B]].map(d=>[d]), 3: [[PUSH_B],[LOOP_F],[DRIVE_B]].map(d=>[d]) },
    "push(f)-loop(b)-drive(f)": { 1: [[PUSH_F],[LOOP_B],[DRIVE_F]].map(d=>[d]), 2: [[PUSH_F],[LOOP_B],[DRIVE_F]].map(d=>[d]), 3: [[PUSH_F],[LOOP_B],[DRIVE_F]].map(d=>[d]) },
    "loop(f)-drive(f)-drive(b)": { 1: [[LOOP_F],[DRIVE_F],[DRIVE_B]].map(d=>[d]), 2: [[LOOP_F],[DRIVE_F],[DRIVE_B]].map(d=>[d]), 3: [[LOOP_F],[DRIVE_F],[DRIVE_B]].map(d=>[d]) },
    "loop(b)-drive(f)-drive(b)": { 1: [[LOOP_B],[DRIVE_F],[DRIVE_B]].map(d=>[d]), 2: [[LOOP_B],[DRIVE_F],[DRIVE_B]].map(d=>[d]), 3: [[LOOP_B],[DRIVE_F],[DRIVE_B]].map(d=>[d]) },
    "drive(f)-drive(f)-drive(f)": { 1: [[DRIVE_F],[DRIVE_F],[DRIVE_F]].map(d=>[d]), 2: [[DRIVE_F],[DRIVE_F],[DRIVE_F]].map(d=>[d]), 3: [[DRIVE_F],[DRIVE_F],[DRIVE_F]].map(d=>[d]) },
    "push(f)-loop(f)-drive(f)": { 1: [[PUSH_F],[LOOP_F],[DRIVE_F]].map(d=>[d]), 2: [[PUSH_F],[LOOP_F],[DRIVE_F]].map(d=>[d]), 3: [[PUSH_F],[LOOP_F],[DRIVE_F]].map(d=>[d]) },
    "push(b)-loop(b)-drive(b)": { 1: [[PUSH_B],[LOOP_B],[DRIVE_B]].map(d=>[d]), 2: [[PUSH_B],[LOOP_B],[DRIVE_B]].map(d=>[d]), 3: [[PUSH_B],[LOOP_B],[DRIVE_B]].map(d=>[d]) },
    "push(f)-loop(b)-drive(b)": { 1: [[PUSH_F],[LOOP_B],[DRIVE_B]].map(d=>[d]), 2: [[PUSH_F],[LOOP_B],[DRIVE_B]].map(d=>[d]), 3: [[PUSH_F],[LOOP_B],[DRIVE_B]].map(d=>[d]) },
    "loop(f)-drive(b)-drive(f)": { 1: [[LOOP_F],[DRIVE_B],[DRIVE_F]].map(d=>[d]), 2: [[LOOP_F],[DRIVE_B],[DRIVE_F]].map(d=>[d]), 3: [[LOOP_F],[DRIVE_B],[DRIVE_F]].map(d=>[d]) },
    "loop(b)-drive(b)-drive(f)": { 1: [[LOOP_B],[DRIVE_B],[DRIVE_F]].map(d=>[d]), 2: [[LOOP_B],[DRIVE_B],[DRIVE_F]].map(d=>[d]), 3: [[LOOP_B],[DRIVE_B],[DRIVE_F]].map(d=>[d]) },
    "push(b)-loop(f)-drive(f)": { 1: [[PUSH_B],[LOOP_F],[DRIVE_F]].map(d=>[d]), 2: [[PUSH_B],[LOOP_F],[DRIVE_F]].map(d=>[d]), 3: [[PUSH_B],[LOOP_F],[DRIVE_F]].map(d=>[d]) },
    "push(b)-loop(b)-drive(f)": { 1: [[PUSH_B],[LOOP_B],[DRIVE_F]].map(d=>[d]), 2: [[PUSH_B],[LOOP_B],[DRIVE_F]].map(d=>[d]), 3: [[PUSH_B],[LOOP_B],[DRIVE_F]].map(d=>[d]) },
    "drive(b)-drive(f)-drive(f)": { 1: [[DRIVE_B],[DRIVE_F],[DRIVE_F]].map(d=>[d]), 2: [[DRIVE_B],[DRIVE_F],[DRIVE_F]].map(d=>[d]), 3: [[DRIVE_B],[DRIVE_F],[DRIVE_F]].map(d=>[d]) },

    // --- RANDOM ---
    "random-drive": { 
        1: [[DRIVE_F],[DRIVE_B]].map(d=>[d]), 
        2: [[DRIVE_F],[DRIVE_B]].map(d=>[d]), 
        3: [[DRIVE_F],[DRIVE_B]].map(d=>[d]), 
        random: true 
    },
    "23-random-drive": { 
        1: [[DRIVE_F],[DRIVE_B],[DRIVE_F]].map(d=>[d]), 
        2: [[DRIVE_F],[DRIVE_B],[DRIVE_F]].map(d=>[d]), 
        3: [[DRIVE_F],[DRIVE_B],[DRIVE_F]].map(d=>[d]), 
        random: true 
    },
    "all-random": { 
        1: [[PUSH_F],[PUSH_B],[DRIVE_F],[DRIVE_B]].map(d=>[d]), 
        2: [[PUSH_F],[PUSH_B],[DRIVE_F],[DRIVE_B]].map(d=>[d]), 
        3: [[PUSH_F],[PUSH_B],[DRIVE_F],[DRIVE_B]].map(d=>[d]), 
        random: true 
    }
};