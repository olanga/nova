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

export const DEFAULT_DRILLS = {
    "push(b)": { 1: [[[1547, 2915, 50, -5, 0, 1]]], 2: [[[1205, 3257, 50, -5, 10, 1]]], 3: [[[863, 3599, 50, -5, 10, 1]]] },
    "push(f)": { 1: [[[1547, 2915, 50, 5, 0, 1]]], 2: [[[1205, 3257, 50, 5, 10, 1]]], 3: [[[863, 3599, 50, 5, 10, 1]]] },
    "drive(b)": { 1: [[[3545, 2177, 60, -5, 20, 1]]], 2: [[[3545, 2177, 50, -5, 40, 1]]], 3: [[[3545, 2177, 50, -5, 70, 1]]] },
    "drive(f)": { 1: [[[3545, 2177, 50, 1, 20, 1]]], 2: [[[3545, 2177, 50, 0, 40, 1]]], 3: [[[3545, 2177, 50, 5, 70, 1]]] },
    "loop(f)": { 1: [[[1520, 3572, 50, 5, 0, 1]]], 2: [[[1178, 3914, 50, 5, 10, 1]]], 3: [[[836, 4256, 50, 5, 10, 1]]] },
    "loop(b)": { 1: [[[1520, 3572, 50, -5, 0, 1]]], 2: [[[1178, 3914, 50, -5, 10, 1]]], 3: [[[836, 4256, 50, -5, 10, 1]]] },
    // ... [Truncated for brevity, include all original DEFAULT_DRILLS here] ...
    "random-drive": { 1: [[[3545, 2177, 46, 5, 30, 1]], [[3545, 2177, 46, 0, 30, 1]], [[3545, 2177, 46, -5, 30, 1]]], 2: [[[3545, 2177, 50, 5, 60, 1]], [[3545, 2177, 50, 0, 60, 1]], [[3545, 2177, 50, -5, 60, 1]]], 3: [[[3545, 2177, 50, 5, 80, 1]], [[3545, 2177, 50, 0, 80, 1]], [[3545, 2177, 50, -5, 80, 1]]], random: true },
    "all-random": { 1: [[[1547, 2915, 50, 5, 10, 1]], [[1547, 2915, 50, -5, 10, 1]], [[3545, 2177, 50, 5, 40, 1]], [[3545, 2177, 50, 0, 40, 1]], [[3545, 2177, 50, -5, 40, 1]]], 2: [[[1205, 3257, 50, 5, 10, 1]], [[1205, 3257, 50, -5, 10, 1]], [[3545, 2177, 50, 5, 50, 1]], [[3545, 2177, 50, 0, 50, 1]], [[3545, 2177, 50, -5, 50, 1]]], 3: [[[863, 3599, 50, 5, 10, 1]], [[863, 3599, 50, -5, 10, 1]], [[3545, 2177, 50, 5, 80, 1]], [[3545, 2177, 50, 0, 80, 1]], [[3545, 2177, 50, -5, 80, 1]]], random: true }
};