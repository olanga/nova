import { SERVICE_UUID, UUID_S, UUID_N, UUID_W, SALT, MSG_DONE } from './constants.js';
import { log, showToast, MD5, clamp } from './utils.js';
import { handleDone } from './runner.js';
import { startSession } from './state.js'; // <--- ADDED IMPORT

export const bleState = {
    isConnected: false,
    device: null,
    writeChar: null,
    handshakeState: "disconnected"
};

let writeLock = Promise.resolve();

export async function connectDevice() {
    try {
        log("Scanning...");
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [SERVICE_UUID] }],
            optionalServices: [UUID_S]
        });

        bleState.device = device;
        device.addEventListener('gattserverdisconnected', onDisconnect);

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(UUID_S);
        const chars = await service.getCharacteristics();

        for(let c of chars) {
            if(c.uuid === UUID_N) {
                await c.startNotifications();
                c.addEventListener('characteristicvaluechanged', onNotify);
            }
            if(c.uuid === UUID_W) bleState.writeChar = c;
        }

        if(bleState.writeChar) {
            bleState.handshakeState = "handshake";
            sendPacket([0x07,0,0,0]); // Start handshake
        }
    } catch(e) {
        log("Connect Error: " + e.message);
    }
}

export function disconnectDevice() {
    if (bleState.device && bleState.device.gatt.connected) {
        bleState.device.gatt.disconnect();
    }
}

function onDisconnect() {
    bleState.isConnected = false;
    bleState.device = null;
    bleState.writeChar = null;
    bleState.handshakeState = "disconnected";
    
    log("Disconnected");
    showToast("Disconnected");
    document.dispatchEvent(new CustomEvent('connection-changed'));
}

export function sendPacket(data) {
    if(!bleState.writeChar) return Promise.reject("No Write Char");
    const arr = new Uint8Array(data);
    writeLock = writeLock.then(() => bleState.writeChar.writeValue(arr).catch(e => log("TX Error: " + e)));
    return writeLock;
}

function onNotify(e) {
    const buf = e.target.value.buffer;
    const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');

    // Handshake Sequence
    if(bleState.handshakeState === "handshake") {
        const td = new TextDecoder();
        const str = td.decode(buf);
        if(str.length > 18) {
            const serial = str.slice(6,18);
            const code = str.slice(18);
            let hashme = serial;
            for(let i=0; i<serial.length; i++) hashme += SALT[serial.charCodeAt(i)%0x24];
            hashme += code;
            const hash = MD5(hashme);
            const resp = new Uint8Array(3+hash.length);
            resp.set([0x08,0x20,0,0]);
            resp.set(new TextEncoder().encode(hash),3);
            sendPacket(resp);
            bleState.handshakeState = "auth_1";
        }
    } 
    else if(bleState.handshakeState === "auth_1") { sendPacket([1,0,0]); bleState.handshakeState = "auth_2"; }
    else if(bleState.handshakeState === "auth_2") { sendPacket([2,0,0]); bleState.handshakeState = "auth_3"; }
    else if(bleState.handshakeState === "auth_3") {
        sendPacket([0x80,1,0,0]);
        bleState.handshakeState = "ready";
        bleState.isConnected = true;
        startSession(); // <--- ADDED: Capture stats snapshot on connect
        log("Ready");
        showToast("Connected");
        document.dispatchEvent(new CustomEvent('connection-changed'));
    }

    // Drill execution callback
    if (hex.includes(MSG_DONE)) {
        handleDone();
    }
}

// Data Packing Helper
export function packBall(us, ls, bh, dp, freq, reps) {
    const b = new ArrayBuffer(24), v = new DataView(b);
    us = clamp(us, 400, 7500); ls = clamp(ls, 400, 7500);
    const bh_f = (clamp(bh,-50,100)+50)/150*50-20;
    const dp_f = (clamp(dp,-10,10)+10)/20*44-22;
    const fr_f = (clamp(freq,0,100)/100)+0.5;
    
    v.setUint32(0, us, true); 
    v.setUint32(4, ls, true);
    v.setFloat32(8, bh_f, true); 
    v.setFloat32(12, dp_f, true);
    v.setFloat32(16, fr_f, true); 
    v.setUint32(20, reps, true);
    return new Uint8Array(b);
}