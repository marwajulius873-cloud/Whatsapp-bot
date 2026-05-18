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
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('✅ Bot Connected Successfully! 🎉');
        }

        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            console.log("🔄 Reconnecting...");
            setTimeout(startBot, 10000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ====================== PAIRING CODE ======================
    if (!sock.authState.creds.registered) {
        const phoneNumber = "254113123471";   // ←←← CHANGE THIS TO YOUR NUMBER
        try {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log("\n====================================");
            console.log("🔗 YOUR PAIRING CODE:");
            console.log(`     ${code}`);
            console.log("====================================");
            console.log("On your phone WhatsApp → Linked Devices → Link with Phone Number");
            console.log("Enter the code above");
        } catch (err) {
            console.log("Failed to generate pairing code:", err.message);
        }
    }

    console.log("✅ Bot is waiting for pairing...");
}

startBot();
