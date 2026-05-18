const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

console.log("🚀 Starting WhatsApp Bot...");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        markReads: true,
        browser: ["Chrome", "Windows", "131.0"],
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("QR Code received but we will use pairing code instead...");
        }

        if (connection === 'open') {
            console.log('✅ Bot Connected Successfully! 🎉');
        }

        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            setTimeout(startBot, 10000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ==================== PAIRING CODE METHOD ====================
    if (!sock.authState.creds.registered) {
        const phoneNumber = "254113123471";   // ←←← CHANGE THIS TO YOUR PHONE NUMBER
        const code = await sock.requestPairingCode(phoneNumber);
        console.log("\n🔗 Your Pairing Code is:");
        console.log(`     ${code}`);
        console.log("\nOn your phone WhatsApp → Linked Devices → Link with Phone Number → Enter this code");
    }

    console.log("✅ Bot is waiting for pairing...");
}

startBot();
