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

// Physics Constants
export const RPM_MIN = 400;
export const RPM_MAX = 7500;

// Constraints: Speed (Key) -> Max Spin (Value)
export const SPIN_LIMITS = {
    "0": 2, "0.5": 3, 
    "1": 4, "1.5": 5, 
    "2": 6, "2.5": 7, 
    "3": 8, "3.5": 9, 
    "4": 10, "4.5": 10, 
    "5": 9, "5.5": 8, 
    "6": 8, "6.5": 7, 
    "7": 6, "7.5": 5, 
    "8": 4, "8.5": 3, 
    "9": 2, "9.5": 1, 
    "10": 0
};

// Helper to create standard drill steps
const mkStep = (t, b, h, d, f, r) => [[t, b, h, d, f, r, 1]];

// Standard Physics Presets
const PUSH_B = [1547, 2915, 50, -5, 10, 1];
const PUSH_F = [1547, 2915, 50, 5, 10, 1];
const DRIVE_B = [3545, 2177, 50, -5, 40, 1];
const DRIVE_F = [3545, 2177, 50, 5, 40, 1];
const LOOP_B = [1520, 3572, 50, -5, 10, 1];
const LOOP_F = [1520, 3572, 50, 5, 10, 1];

// Helper to wrap preset arrays into the correct drill structure
// Example: [A, B] -> [ [[...A]], [[...B]] ]
const combine = (arr) => arr.map(d => [d]);

export const DEFAULT_DRILLS = {
    // --- BASIC ---
    "push(b)": { 1: [mkStep(...PUSH_B)], 2: [mkStep(1205, 3257, 50, -5, 20, 1)], 3: [mkStep(863, 3599, 50, -5, 30, 1)] },
    "push(f)": { 1: [mkStep(...PUSH_F)], 2: [mkStep(1205, 3257, 50, 5, 20, 1)], 3: [mkStep(863, 3599, 50, 5, 30, 1)] },
    "drive(b)": { 1: [mkStep(...DRIVE_B)], 2: [mkStep(3545, 2177, 50, -5, 50, 1)], 3: [mkStep(3545, 2177, 50, -5, 70, 1)] },
    "drive(f)": { 1: [mkStep(...DRIVE_F)], 2: [mkStep(3545, 2177, 50, 5, 50, 1)], 3: [mkStep(3545, 2177, 50, 5, 70, 1)] },
    "loop(f)": { 1: [mkStep(...LOOP_F)], 2: [mkStep(1178, 3914, 50, 5, 20, 1)], 3: [mkStep(836, 4256, 50, 5, 30, 1)] },
    "loop(b)": { 1: [mkStep(...LOOP_B)], 2: [mkStep(1178, 3914, 50, -5, 20, 1)], 3: [mkStep(836, 4256, 50, -5, 30, 1)] },

    // --- COMBINED ---
    // Fixed: Removed inner brackets [LOOP_B] -> LOOP_B
    "loop(b)-drive(b)": { 1: combine([LOOP_B, DRIVE_B]), 2: combine([LOOP_B, DRIVE_B]), 3: combine([LOOP_B, DRIVE_B]) },
    "loop(f)-drive(f)": { 1: combine([LOOP_F, DRIVE_F]), 2: combine([LOOP_F, DRIVE_F]), 3: combine([LOOP_F, DRIVE_F]) },
    "drive(f)-drive(b)": { 1: combine([DRIVE_F, DRIVE_B]), 2: combine([DRIVE_F, DRIVE_B]), 3: combine([DRIVE_F, DRIVE_B]) },
    "push(f)-drive(f)": { 1: combine([PUSH_F, DRIVE_F]), 2: combine([PUSH_F, DRIVE_F]), 3: combine([PUSH_F, DRIVE_F]) },
    "push(b)-loop(b)": { 1: combine([PUSH_B, LOOP_B]), 2: combine([PUSH_B, LOOP_B]), 3: combine([PUSH_B, LOOP_B]) },
    "loop(f)-drive(b)": { 1: combine([LOOP_F, DRIVE_B]), 2: combine([LOOP_F, DRIVE_B]), 3: combine([LOOP_F, DRIVE_B]) },
    "push(f)-loop(b)": { 1: combine([PUSH_F, LOOP_B]), 2: combine([PUSH_F, LOOP_B]), 3: combine([PUSH_F, LOOP_B]) },
    "drive(f)-drive(f)": { 1: combine([DRIVE_F, DRIVE_F]), 2: combine([DRIVE_F, DRIVE_F]), 3: combine([DRIVE_F, DRIVE_F]) },
    "push(b)-loop(f)": { 1: combine([PUSH_B, LOOP_F]), 2: combine([PUSH_B, LOOP_F]), 3: combine([PUSH_B, LOOP_F]) },
    "push(f)-loop(f)": { 1: combine([PUSH_F, LOOP_F]), 2: combine([PUSH_F, LOOP_F]), 3: combine([PUSH_F, LOOP_F]) },
    "loop(f)-loop(f)": { 1: combine([LOOP_F, LOOP_F]), 2: combine([LOOP_F, LOOP_F]), 3: combine([LOOP_F, LOOP_F]) },
    "loop(b)-drive(f)": { 1: combine([LOOP_B, DRIVE_F]), 2: combine([LOOP_B, DRIVE_F]), 3: combine([LOOP_B, DRIVE_F]) },

    // --- COMPLEX ---
    "push(b)-loop(f)-drive(b)": { 1: combine([PUSH_B, LOOP_F, DRIVE_B]), 2: combine([PUSH_B, LOOP_F, DRIVE_B]), 3: combine([PUSH_B, LOOP_F, DRIVE_B]) },
    "push(f)-loop(b)-drive(f)": { 1: combine([PUSH_F, LOOP_B, DRIVE_F]), 2: combine([PUSH_F, LOOP_B, DRIVE_F]), 3: combine([PUSH_F, LOOP_B, DRIVE_F]) },
    "loop(f)-drive(f)-drive(b)": { 1: combine([LOOP_F, DRIVE_F, DRIVE_B]), 2: combine([LOOP_F, DRIVE_F, DRIVE_B]), 3: combine([LOOP_F, DRIVE_F, DRIVE_B]) },
    "loop(b)-drive(f)-drive(b)": { 1: combine([LOOP_B, DRIVE_F, DRIVE_B]), 2: combine([LOOP_B, DRIVE_F, DRIVE_B]), 3: combine([LOOP_B, DRIVE_F, DRIVE_B]) },
    "drive(f)-drive(f)-drive(f)": { 1: combine([DRIVE_F, DRIVE_F, DRIVE_F]), 2: combine([DRIVE_F, DRIVE_F, DRIVE_F]), 3: combine([DRIVE_F, DRIVE_F, DRIVE_F]) },
    "push(f)-loop(f)-drive(f)": { 1: combine([PUSH_F, LOOP_F, DRIVE_F]), 2: combine([PUSH_F, LOOP_F, DRIVE_F]), 3: combine([PUSH_F, LOOP_F, DRIVE_F]) },
    "push(b)-loop(b)-drive(b)": { 1: combine([PUSH_B, LOOP_B, DRIVE_B]), 2: combine([PUSH_B, LOOP_B, DRIVE_B]), 3: combine([PUSH_B, LOOP_B, DRIVE_B]) },
    "push(f)-loop(b)-drive(b)": { 1: combine([PUSH_F, LOOP_B, DRIVE_B]), 2: combine([PUSH_F, LOOP_B, DRIVE_B]), 3: combine([PUSH_F, LOOP_B, DRIVE_B]) },
    "loop(f)-drive(b)-drive(f)": { 1: combine([LOOP_F, DRIVE_B, DRIVE_F]), 2: combine([LOOP_F, DRIVE_B, DRIVE_F]), 3: combine([LOOP_F, DRIVE_B, DRIVE_F]) },
    "loop(b)-drive(b)-drive(f)": { 1: combine([LOOP_B, DRIVE_B, DRIVE_F]), 2: combine([LOOP_B, DRIVE_B, DRIVE_F]), 3: combine([LOOP_B, DRIVE_B, DRIVE_F]) },
    "push(b)-loop(f)-drive(f)": { 1: combine([PUSH_B, LOOP_F, DRIVE_F]), 2: combine([PUSH_B, LOOP_F, DRIVE_F]), 3: combine([PUSH_B, LOOP_F, DRIVE_F]) },
    "push(b)-loop(b)-drive(f)": { 1: combine([PUSH_B, LOOP_B, DRIVE_F]), 2: combine([PUSH_B, LOOP_B, DRIVE_F]), 3: combine([PUSH_B, LOOP_B, DRIVE_F]) },
    "drive(b)-drive(f)-drive(f)": { 1: combine([DRIVE_B, DRIVE_F, DRIVE_F]), 2: combine([DRIVE_B, DRIVE_F, DRIVE_F]), 3: combine([DRIVE_B, DRIVE_F, DRIVE_F]) },

    // --- RANDOM ---
    "random-drive": { 
        1: combine([DRIVE_F, DRIVE_B]), 
        2: combine([DRIVE_F, DRIVE_B]), 
        3: combine([DRIVE_F, DRIVE_B]), 
        random: true 
    },
    "23-random-drive": { 
        1: combine([DRIVE_F, DRIVE_B, DRIVE_F]), 
        2: combine([DRIVE_F, DRIVE_B, DRIVE_F]), 
        3: combine([DRIVE_F, DRIVE_B, DRIVE_F]), 
        random: true 
    },
    "all-random": { 
        1: combine([PUSH_F, PUSH_B, DRIVE_F, DRIVE_B]), 
        2: combine([PUSH_F, PUSH_B, DRIVE_F, DRIVE_B]), 
        3: combine([PUSH_F, PUSH_B, DRIVE_F, DRIVE_B]), 
        random: true 
    }
};