const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

console.log("🚀 WhatsApp Bot Starting...");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        markReads: true,
        browser: ["Ubuntu", "Chrome", "110.0.0"],
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("\n📱 === SCAN THIS QR CODE ===\n");
            qrcode.generate(qr, { small: true });
            console.log("\nIf QR doesn't appear clearly, restart the service.");
        }

        if (connection === 'open') {
            console.log('✅ Bot Connected Successfully! 🎉');
        }

        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
            console.log("🔄 Reconnecting in 10 seconds...");
            setTimeout(startBot, 10000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    console.log("✅ Waiting for QR Code...");
}

startBot();
