import { SERVICE_UUID_LONG, SERVICE_UUID, UUID_S, UUID_N, UUID_W, SALT, MSG_DONE } from './constants.js';
import { log, showToast, MD5, clamp } from './utils.js';
import { handleDone } from './runner.js';
import { startSession } from './state.js';

// Public connection state. Other modules only read `isConnected`.
export const bleState = {
    isConnected: false,
    handshakeState: "disconnected"
};

// The active transport (native or web). Holds all platform-specific state.
let transport = null;
// Serializes writes so packets never overlap on the BLE link.
let writeLock = Promise.resolve();

// --- Byte <-> Hex helpers ---------------------------------------------------
// The Capacitor plugin serializes BLE values as hex strings across the bridge,
// so the native transport converts in both directions here.

function bytesToHex(bytes) {
    return [...bytes].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
}

function hexToBytes(hex) {
    const pairs = hex.match(/.{1,2}/g);
    return new Uint8Array(pairs ? pairs.map(h => parseInt(h, 16)) : []);
}

// Normalizes whatever a notification delivers (hex string, DataView, typed
// array) into a Uint8Array, so the rest of the module is platform-agnostic.
function toBytes(value) {
    if (!value) return null;
    if (typeof value === 'string') return hexToBytes(value);
    if (value instanceof DataView) return new Uint8Array(value.buffer);
    if (value.buffer) return new Uint8Array(value.buffer);
    return null;
}

// --- Platform detection -----------------------------------------------------

function isNativePlatform() {
    return !!(
        typeof window !== 'undefined' &&
        window.Capacitor &&
        typeof window.Capacitor.isNativePlatform === 'function' &&
        window.Capacitor.isNativePlatform() &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.BluetoothLe
    );
}

// --- Transport: Native (Android / Capacitor) --------------------------------
// Uses the raw BluetoothLe plugin because the app ships unbundled ES modules
// and cannot import the typed `BleClient` wrapper from node_modules.

function createNativeTransport(onNotify, onDisconnect) {
    const plugin = window.Capacitor.Plugins.BluetoothLe;
    let deviceId = null;
    let listeners = []; // PluginListenerHandle[] — removed on disconnect.

    async function removeListeners() {
        for (const handle of listeners) {
            try { await handle.remove(); } catch (e) { /* already gone */ }
        }
        listeners = [];
    }

    return {
        name: 'native',
        isReady: () => deviceId !== null,

        async connect() {
            await plugin.initialize();

            const device = await plugin.requestDevice({ services: [SERVICE_UUID_LONG] });
            deviceId = device.deviceId;

            await plugin.connect({ deviceId });

            // Device-specific disconnect event (plugin convention:
            // `disconnected|<deviceId>`). Fires on unexpected drops too.
            listeners.push(await plugin.addListener(`disconnected|${deviceId}`, () => onDisconnect()));

            const notifyEvent = `notification|${deviceId}|${UUID_S}|${UUID_N}`;
            listeners.push(await plugin.addListener(notifyEvent, (result) => {
                const bytes = toBytes(result && result.value);
                if (bytes) onNotify(bytes);
            }));

            await plugin.startNotifications({ deviceId, service: UUID_S, characteristic: UUID_N });
        },

        async disconnect() {
            await removeListeners();
            if (deviceId) {
                try { await plugin.disconnect({ deviceId }); } catch (e) { /* already gone */ }
                deviceId = null;
            }
        },

        async write(bytes) {
            await plugin.writeWithoutResponse({
                deviceId,
                service: UUID_S,
                characteristic: UUID_W,
                value: bytesToHex(bytes)
            });
        }
    };
}

// --- Transport: Web Bluetooth -----------------------------------------------

function createWebTransport(onNotify, onDisconnect) {
    let device = null;
    let writeChar = null;
    let notifyChar = null;

    const onGattDisconnect = () => onDisconnect();
    const onCharChanged = (e) => onNotify(new Uint8Array(e.target.value.buffer));

    return {
        name: 'web',
        isReady: () => writeChar !== null,

        async connect() {
            device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [SERVICE_UUID] }],
                optionalServices: [UUID_S]
            });
            device.addEventListener('gattserverdisconnected', onGattDisconnect);

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(UUID_S);
            const chars = await service.getCharacteristics();

            for (const c of chars) {
                if (c.uuid === UUID_N) {
                    notifyChar = c;
                    await c.startNotifications();
                    c.addEventListener('characteristicvaluechanged', onCharChanged);
                }
                if (c.uuid === UUID_W) writeChar = c;
            }

            if (!writeChar) throw new Error("Write-Characteristic nicht gefunden");
        },

        async disconnect() {
            // Detach listeners first so the manual disconnect below does not
            // re-trigger onDisconnect.
            if (notifyChar) {
                try { notifyChar.removeEventListener('characteristicvaluechanged', onCharChanged); } catch (e) {}
                notifyChar = null;
            }
            if (device) {
                device.removeEventListener('gattserverdisconnected', onGattDisconnect);
                if (device.gatt && device.gatt.connected) device.gatt.disconnect();
                device = null;
            }
            writeChar = null;
        },

        async write(bytes) {
            await writeChar.writeValue(bytes);
        }
    };
}

function createTransport(onNotify, onDisconnect) {
    if (isNativePlatform()) return createNativeTransport(onNotify, onDisconnect);
    if (typeof navigator !== 'undefined' && navigator.bluetooth) {
        return createWebTransport(onNotify, onDisconnect);
    }
    return null;
}

// --- Connection lifecycle ---------------------------------------------------

export async function connectDevice() {
    if (transport) return; // already connecting or connected

    try {
        log("Scanning...");

        transport = createTransport(handleNotification, onDisconnect);
        if (!transport) {
            throw new Error("Web Bluetooth wird von diesem Browser nicht unterstützt.");
        }

        await transport.connect();

        bleState.handshakeState = "handshake";
        await sendPacket([0x07, 0, 0, 0]); // Start handshake
    } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        log("Connect Error: " + msg);
        showToast("Verbindung fehlgeschlagen: " + msg);
        await teardownTransport();
    }
}

export async function disconnectDevice() {
    await onDisconnect();
}

async function teardownTransport() {
    if (transport) {
        try { await transport.disconnect(); } catch (e) { /* ignore */ }
        transport = null;
    }
    writeLock = Promise.resolve();
}

async function onDisconnect() {
    const wasActive = transport !== null || bleState.isConnected;

    bleState.isConnected = false;
    bleState.handshakeState = "disconnected";
    await teardownTransport();

    if (!wasActive) return; // already torn down — avoid duplicate toasts/events

    log("Disconnected");
    showToast("Disconnected");
    document.dispatchEvent(new CustomEvent('connection-changed'));
}

// --- Packet I/O -------------------------------------------------------------

export function sendPacket(data) {
    if (!transport || !transport.isReady()) return Promise.reject("No transport");

    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

    writeLock = writeLock.then(() =>
        transport.write(bytes).catch(e => log("TX Error: " + ((e && e.message) ? e.message : e)))
    );
    return writeLock;
}

// Called for every incoming notification with a normalized Uint8Array.
function handleNotification(bytes) {
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

    if (bleState.handshakeState === "handshake") {
        const str = new TextDecoder().decode(bytes);
        if (str.length > 18) {
            const serial = str.slice(6, 18);
            const code = str.slice(18);
            let hashme = serial;
            for (let i = 0; i < serial.length; i++) hashme += SALT[serial.charCodeAt(i) % 0x24];
            hashme += code;
            const hash = MD5(hashme);
            const resp = new Uint8Array(3 + hash.length);
            resp.set([0x08, 0x20, 0, 0]);
            resp.set(new TextEncoder().encode(hash), 3);
            sendPacket(resp);
            bleState.handshakeState = "auth_1";
        }
    }
    else if (bleState.handshakeState === "auth_1") { sendPacket([1, 0, 0]); bleState.handshakeState = "auth_2"; }
    else if (bleState.handshakeState === "auth_2") { sendPacket([2, 0, 0]); bleState.handshakeState = "auth_3"; }
    else if (bleState.handshakeState === "auth_3") {
        sendPacket([0x80, 1, 0, 0]);
        bleState.handshakeState = "ready";
        bleState.isConnected = true;
        startSession();
        log("Ready");
        showToast("Connected");
        document.dispatchEvent(new CustomEvent('connection-changed'));
    }

    if (hex.includes(MSG_DONE)) {
        handleDone();
    }
}

// --- Data packing -----------------------------------------------------------

export function packBall(us, ls, bh, dp, freq, reps) {
    const b = new ArrayBuffer(24), v = new DataView(b);
    us = clamp(us, 400, 7500); ls = clamp(ls, 400, 7500);
    const bh_f = (clamp(bh, -50, 100) + 50) / 150 * 50 - 20;
    const dp_f = (clamp(dp, -10, 10) + 10) / 20 * 44 - 22;
    const fr_f = (clamp(freq, 0, 100) / 100) + 0.5;

    v.setUint32(0, us, true);
    v.setUint32(4, ls, true);
    v.setFloat32(8, bh_f, true);
    v.setFloat32(12, dp_f, true);
    v.setFloat32(16, fr_f, true);
    v.setUint32(20, reps, true);
    return new Uint8Array(b);
}