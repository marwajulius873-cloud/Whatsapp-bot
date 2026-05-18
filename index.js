const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');

console.log("🚀 WhatsApp Bot Starting...");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        markReads: true,
        browser: ["Chrome", "Windows", "131.0"],
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("QR received but using pairing code...");
        }

        if (connection === 'open') {
            console.log('✅ Bot Connected Successfully! 🎉');
        }

        if (connection === 'close') {
            console.log("Connection closed. Reconnecting...");
            setTimeout(startBot, 10000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Pairing Code
    if (!sock.authState.creds.registered) {
        const phoneNumber = "+254113123471"; // ← CHANGE TO YOUR NUMBER
        const code = await sock.requestPairingCode(phoneNumber);
        console.log("\n🔥 YOUR PAIRING CODE:");
        console.log(code);
        console.log("\nGo to WhatsApp → Linked Devices → Link with Phone Number");
    }
}

startBot();
